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
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async validateUser(phone: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(phone: string, password: string) {
    const user = await this.validateUser(phone, password);

    if (!user) {
      throw new UnauthorizedException('Invalid phone or password');
    }

    return this.createAuthResponse(user);
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
  ) {
    if (!phone || !password || !role || !name || !email || !flatNo) {
      throw new BadRequestException(
        'Phone, password, role, name, email, and flat number are required',
      );
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
        'A resident with this phone or email already exists',
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
          flatNo,
          userId: user.id,
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
}
