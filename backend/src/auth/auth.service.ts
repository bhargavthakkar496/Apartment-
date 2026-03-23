import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private static readonly passwordRegex =
    /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/;
  private static readonly ownerRole = 'owner';
  private readonly rolesWithoutFlatNumber = new Set([
    'admin',
    'chairman',
    'committee_member',
  ]);

  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async getAccountStatus(phone: string) {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('Phone is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: {
        residents: {
          where: {
            isActive: true,
          },
          take: 1,
          include: {
            society: true,
          },
        },
      },
    });

    if (!user) {
      return {
        exists: false,
        phone: normalizedPhone,
        message: 'No account found. Continue with your details to create one.',
      };
    }

    const resident = user.residents[0];
    return {
      exists: true,
      phone: normalizedPhone,
      role: user.role,
      residentName: resident?.name ?? null,
      societyName: resident?.society?.name ?? null,
      message: 'Account found. Enter your password to continue.',
    };
  }

  async validateUser(phone: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async requestPasswordReset(phone: string) {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) {
      throw new BadRequestException('Phone is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      include: {
        residents: {
          take: 1,
        },
      },
    });

    if (!user) {
      throw new BadRequestException('No account found for this phone number');
    }

    const resident = user.residents[0];
    if (!resident?.email) {
      throw new BadRequestException(
        'No registered email was found for this account',
      );
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    await this.prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await this.prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        phone: normalizedPhone,
        email: resident.email,
        otpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    this.sendPasswordResetOtp({
      otp,
      email: resident.email,
      phone: normalizedPhone,
    });

    const response: Record<string, unknown> = {
      message:
        'OTP sent to the registered email address and mobile number.',
      deliveryMode: 'mock',
      maskedEmail: this.maskEmail(resident.email),
      maskedPhone: this.maskPhone(normalizedPhone),
    };

    if (process.env.NODE_ENV !== 'production') {
      response['debugOtp'] = otp;
    }

    return response;
  }

  async resetPassword(phone: string, otp: string, newPassword: string) {
    const normalizedPhone = phone?.trim();
    const normalizedOtp = otp?.trim();
    const normalizedPassword = newPassword ?? '';

    if (!normalizedPhone || !normalizedOtp || !normalizedPassword) {
      throw new BadRequestException(
        'Phone, OTP, and new password are required',
      );
    }

    if (!AuthService.passwordRegex.test(normalizedPassword)) {
      throw new BadRequestException(
        'Password must be at least 6 characters and include letters, numbers, and special characters',
      );
    }

    const resetRequest = await this.prisma.passwordResetOtp.findFirst({
      where: {
        phone: normalizedPhone,
        usedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!resetRequest || resetRequest.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'OTP is invalid or expired. Please request a new one.',
      );
    }

    const isOtpValid = await bcrypt.compare(normalizedOtp, resetRequest.otpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRequest.userId },
        data: {
          password: hashedPassword,
        },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: resetRequest.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Password reset successful. You can now log in with the new password.',
    };
  }

  async login(phone: string, password: string) {
    const user = await this.validateUser(phone, password);

    if (!user) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    const resident = await this.prisma.resident.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: { society: true },
    });

    return {
      ...this.createAuthResponse(user),
      resident,
    };
  }

  private createAuthResponse(user: { id: string; phone: string; role: string }) {
    const payload = { phone: user.phone, sub: user.id };
    return {
      user,
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(
    phone: string,
    password: string,
    role: string,
    name: string,
    email: string,
    flatNo: string,
    societyId: string,
  ) {
    const requiresFlatNumber = !this.rolesWithoutFlatNumber.has(role);
    const normalizedFlatNo = requiresFlatNumber ? flatNo?.trim() ?? '' : '';
    const normalizedSocietyId = societyId?.trim() ?? '';

    if (
      !phone ||
      !password ||
      !role ||
      !name ||
      !email ||
      !normalizedSocietyId ||
      (requiresFlatNumber && !normalizedFlatNo)
    ) {
      throw new BadRequestException(
        requiresFlatNumber
          ? 'Phone, password, role, name, email, society, and flat number are required'
          : 'Phone, password, role, name, email, and society are required',
      );
    }

    const society = await this.prisma.society.findUnique({
      where: { id: normalizedSocietyId },
    });

    if (!society) {
      throw new BadRequestException('Selected society was not found');
    }

    if (requiresFlatNumber) {
      const flatResidents = await this.prisma.resident.findMany({
        where: {
          societyId: normalizedSocietyId,
          flatNo: normalizedFlatNo,
          isActive: true,
        },
        include: {
          user: true,
        },
      });

      if (role === AuthService.ownerRole) {
        const existingOwner = flatResidents.find(
          (resident) => resident.user.role === AuthService.ownerRole,
        );
        if (existingOwner) {
          throw new ConflictException(
            'This apartment is already listed by another owner in the selected society.',
          );
        }
      } else {
        const occupiedResident = flatResidents.find(
          (resident) => resident.user.role !== AuthService.ownerRole,
        );
        if (occupiedResident) {
          throw new ConflictException(
            'This apartment is already occupied in the selected society.',
          );
        }
      }

      const apartmentUnit = await this.prisma.apartmentUnit.findUnique({
        where: {
          societyId_flatNumber: {
            societyId: normalizedSocietyId,
            flatNumber: normalizedFlatNo,
          },
        },
      });

      if (!apartmentUnit) {
        throw new BadRequestException(
          'Flat number not found for the selected society. Please choose one of the seeded apartments.',
        );
      }
    }

    const existingUser = await this.prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      throw new ConflictException('A user with this phone already exists');
    }

    const existingResident = await this.prisma.resident.findFirst({
      where: {
        OR: [{ phone }, { email }],
      },
    });

    if (existingResident) {
      throw new ConflictException(
        'A tenant with this phone or email already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { phone, password: hashedPassword, role },
      });

      const resident = await tx.resident.create({
        data: {
          name,
          email,
          phone,
          flatNo: normalizedFlatNo,
          userId: user.id,
          societyId: normalizedSocietyId,
        },
        include: {
          society: true,
        },
      });

      const { password: _, ...safeUser } = user;
      return { user: safeUser, resident };
    });

    return {
      ...this.createAuthResponse(result.user),
      resident: result.resident,
    };
  }

  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sendPasswordResetOtp(input: {
    otp: string;
    email: string;
    phone: string;
  }) {
    console.log(
      `[Mock OTP Delivery] Password reset OTP ${input.otp} sent to email ${input.email} and phone ${input.phone}`,
    );
  }

  private maskEmail(email: string) {
    const [name, domain] = email.split('@');
    if (!name || !domain) return email;
    const visibleName = name.length <= 2 ? name[0] ?? '*' : name.slice(0, 2);
    return `${visibleName}***@${domain}`;
  }

  private maskPhone(phone: string) {
    if (phone.length <= 4) return phone;
    return `${phone.substring(0, 2)}******${phone.substring(phone.length - 2)}`;
  }
}
