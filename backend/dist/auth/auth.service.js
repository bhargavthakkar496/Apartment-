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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma.service");
const bcrypt = __importStar(require("bcrypt"));
let AuthService = class AuthService {
    constructor(jwtService, prisma) {
        this.jwtService = jwtService;
        this.prisma = prisma;
    }
    async validateUser(phone, password) {
        const user = await this.prisma.user.findUnique({ where: { phone } });
        if (user && (await bcrypt.compare(password, user.password))) {
            const { password } = user, result = __rest(user, ["password"]);
            return result;
        }
        return null;
    }
    async login(phone, password) {
        const user = await this.validateUser(phone, password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid phone or password');
        }
        return this.createAuthResponse(user);
    }
    createAuthResponse(user) {
        const payload = { phone: user.phone, sub: user.id };
        return {
            user,
            access_token: this.jwtService.sign(payload),
        };
    }
    async register(phone, password, role, name, email, flatNo) {
        if (!phone || !password || !role || !name || !email || !flatNo) {
            throw new common_1.BadRequestException('Phone, password, role, name, email, and flat number are required');
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
            throw new common_1.ConflictException('A resident with this phone or email already exists');
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
            const { password: _ } = user, safeUser = __rest(user, ["password"]);
            return { user: safeUser, resident };
        });
        return Object.assign(Object.assign({}, this.createAuthResponse(result.user)), { resident: result.resident });
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService, prisma_service_1.PrismaService])
], AuthService);
