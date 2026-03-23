"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma.service");
const bcrypt = __importStar(require("bcrypt"));
let AuthService = AuthService_1 = class AuthService {
    constructor(jwtService, prisma) {
        this.jwtService = jwtService;
        this.prisma = prisma;
        this.rolesWithoutFlatNumber = new Set([
            'admin',
            'chairman',
            'committee_member',
        ]);
    }
    async getAccountStatus(phone) {
        var _a, _b, _c;
        const normalizedPhone = phone === null || phone === void 0 ? void 0 : phone.trim();
        if (!normalizedPhone) {
            throw new common_1.BadRequestException('Phone is required');
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
            residentName: (_a = resident === null || resident === void 0 ? void 0 : resident.name) !== null && _a !== void 0 ? _a : null,
            societyName: (_c = (_b = resident === null || resident === void 0 ? void 0 : resident.society) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : null,
            message: 'Account found. Enter your password to continue.',
        };
    }
    async validateUser(phone, password) {
        const user = await this.prisma.user.findUnique({ where: { phone } });
        if (user && (await bcrypt.compare(password, user.password))) {
            const { password } = user, result = __rest(user, ["password"]);
            return result;
        }
        return null;
    }
    async requestPasswordReset(phone) {
        const normalizedPhone = phone === null || phone === void 0 ? void 0 : phone.trim();
        if (!normalizedPhone) {
            throw new common_1.BadRequestException('Phone is required');
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
            throw new common_1.BadRequestException('No account found for this phone number');
        }
        const resident = user.residents[0];
        if (!(resident === null || resident === void 0 ? void 0 : resident.email)) {
            throw new common_1.BadRequestException('No registered email was found for this account');
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
        const response = {
            message: 'OTP sent to the registered email address and mobile number.',
            deliveryMode: 'mock',
            maskedEmail: this.maskEmail(resident.email),
            maskedPhone: this.maskPhone(normalizedPhone),
        };
        if (process.env.NODE_ENV !== 'production') {
            response['debugOtp'] = otp;
        }
        return response;
    }
    async resetPassword(phone, otp, newPassword) {
        const normalizedPhone = phone === null || phone === void 0 ? void 0 : phone.trim();
        const normalizedOtp = otp === null || otp === void 0 ? void 0 : otp.trim();
        const normalizedPassword = newPassword !== null && newPassword !== void 0 ? newPassword : '';
        if (!normalizedPhone || !normalizedOtp || !normalizedPassword) {
            throw new common_1.BadRequestException('Phone, OTP, and new password are required');
        }
        if (!AuthService_1.passwordRegex.test(normalizedPassword)) {
            throw new common_1.BadRequestException('Password must be at least 6 characters and include letters, numbers, and special characters');
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
            throw new common_1.BadRequestException('OTP is invalid or expired. Please request a new one.');
        }
        const isOtpValid = await bcrypt.compare(normalizedOtp, resetRequest.otpHash);
        if (!isOtpValid) {
            throw new common_1.BadRequestException('Invalid OTP');
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
    async login(phone, password) {
        const user = await this.validateUser(phone, password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid phone or password');
        }
        const resident = await this.prisma.resident.findFirst({
            where: {
                userId: user.id,
                isActive: true,
            },
            include: { society: true },
        });
        return Object.assign(Object.assign({}, this.createAuthResponse(user)), { resident });
    }
    createAuthResponse(user) {
        const payload = { phone: user.phone, sub: user.id };
        return {
            user,
            access_token: this.jwtService.sign(payload),
        };
    }
    async register(phone, password, role, name, email, flatNo, societyId) {
        var _a, _b;
        const requiresFlatNumber = !this.rolesWithoutFlatNumber.has(role);
        const normalizedFlatNo = requiresFlatNumber ? (_a = flatNo === null || flatNo === void 0 ? void 0 : flatNo.trim()) !== null && _a !== void 0 ? _a : '' : '';
        const normalizedSocietyId = (_b = societyId === null || societyId === void 0 ? void 0 : societyId.trim()) !== null && _b !== void 0 ? _b : '';
        if (!phone ||
            !password ||
            !role ||
            !name ||
            !email ||
            !normalizedSocietyId ||
            (requiresFlatNumber && !normalizedFlatNo)) {
            throw new common_1.BadRequestException(requiresFlatNumber
                ? 'Phone, password, role, name, email, society, and flat number are required'
                : 'Phone, password, role, name, email, and society are required');
        }
        const society = await this.prisma.society.findUnique({
            where: { id: normalizedSocietyId },
        });
        if (!society) {
            throw new common_1.BadRequestException('Selected society was not found');
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
            if (role === AuthService_1.ownerRole) {
                const existingOwner = flatResidents.find((resident) => resident.user.role === AuthService_1.ownerRole);
                if (existingOwner) {
                    throw new common_1.ConflictException('This apartment is already listed by another owner in the selected society.');
                }
            }
            else {
                const occupiedResident = flatResidents.find((resident) => resident.user.role !== AuthService_1.ownerRole);
                if (occupiedResident) {
                    throw new common_1.ConflictException('This apartment is already occupied in the selected society.');
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
                throw new common_1.BadRequestException('Flat number not found for the selected society. Please choose one of the seeded apartments.');
            }
        }
        const existingUser = await this.prisma.user.findUnique({ where: { phone } });
        if (existingUser) {
            throw new common_1.ConflictException('A user with this phone already exists');
        }
        const existingResident = await this.prisma.resident.findFirst({
            where: {
                OR: [{ phone }, { email }],
            },
        });
        if (existingResident) {
            throw new common_1.ConflictException('A tenant with this phone or email already exists');
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
            const { password: _ } = user, safeUser = __rest(user, ["password"]);
            return { user: safeUser, resident };
        });
        return Object.assign(Object.assign({}, this.createAuthResponse(result.user)), { resident: result.resident });
    }
    generateOtp() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    sendPasswordResetOtp(input) {
        console.log(`[Mock OTP Delivery] Password reset OTP ${input.otp} sent to email ${input.email} and phone ${input.phone}`);
    }
    maskEmail(email) {
        var _a;
        const [name, domain] = email.split('@');
        if (!name || !domain)
            return email;
        const visibleName = name.length <= 2 ? (_a = name[0]) !== null && _a !== void 0 ? _a : '*' : name.slice(0, 2);
        return `${visibleName}***@${domain}`;
    }
    maskPhone(phone) {
        if (phone.length <= 4)
            return phone;
        return `${phone.substring(0, 2)}******${phone.substring(phone.length - 2)}`;
    }
};
exports.AuthService = AuthService;
AuthService.passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,}$/;
AuthService.ownerRole = 'owner';
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, prisma_service_1.PrismaService])
], AuthService);
