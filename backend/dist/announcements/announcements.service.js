"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AnnouncementsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnouncementsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let AnnouncementsService = AnnouncementsService_1 = class AnnouncementsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createAnnouncement(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const title = (_b = (_a = input.title) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        const content = (_d = (_c = input.content) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
        if (!title || !content) {
            throw new common_1.BadRequestException('Title and content are required');
        }
        const normalizedRoles = this.normalizeTargetRoles(input.targetRoles);
        return this.prisma.announcement.create({
            data: {
                title,
                content,
                targetRoles: normalizedRoles,
                createdByRole: (_f = (_e = input.createdByRole) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : 'chairman',
                createdByName: (_h = (_g = input.createdByName) === null || _g === void 0 ? void 0 : _g.trim()) !== null && _h !== void 0 ? _h : null,
            },
        });
    }
    async getAnnouncements(role) {
        const normalizedRole = role === null || role === void 0 ? void 0 : role.trim().toLowerCase();
        return this.prisma.announcement.findMany({
            where: normalizedRole
                ? {
                    targetRoles: {
                        has: normalizedRole,
                    },
                }
                : undefined,
            orderBy: {
                createdAt: 'desc',
            },
        });
    }
    normalizeTargetRoles(targetRoles) {
        const normalized = (targetRoles !== null && targetRoles !== void 0 ? targetRoles : [])
            .map((role) => role.trim().toLowerCase())
            .filter((role) => AnnouncementsService_1.supportedTargetRoles.includes(role));
        const uniqueRoles = [...new Set(normalized)];
        return uniqueRoles.length > 0
            ? uniqueRoles
            : [...AnnouncementsService_1.supportedTargetRoles];
    }
};
exports.AnnouncementsService = AnnouncementsService;
AnnouncementsService.supportedTargetRoles = ['resident', 'owner'];
exports.AnnouncementsService = AnnouncementsService = AnnouncementsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnnouncementsService);
