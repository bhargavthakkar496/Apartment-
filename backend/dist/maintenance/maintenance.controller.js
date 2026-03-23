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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceController = void 0;
const common_1 = require("@nestjs/common");
const maintenance_service_1 = require("./maintenance.service");
let MaintenanceController = class MaintenanceController {
    constructor(maintenanceService) {
        this.maintenanceService = maintenanceService;
    }
    async create(body) {
        return this.maintenanceService.createRequest(body.description, body.residentId);
    }
    async findAll() {
        return this.maintenanceService.getRequests();
    }
    async findResidentRequests(residentId) {
        return this.maintenanceService.getResidentRequests(residentId);
    }
    async getChairmanRequests(residentId) {
        return this.maintenanceService.getChairmanRepairRequests(residentId);
    }
    async startRequest(residentId, requestId, body) {
        return this.maintenanceService.startRepairRequest(residentId, requestId, body === null || body === void 0 ? void 0 : body.message);
    }
    async updateRequest(residentId, requestId, body) {
        return this.maintenanceService.addRepairRequestUpdate(residentId, requestId, body.message);
    }
    async resolveRequest(residentId, requestId, body) {
        return this.maintenanceService.resolveRepairRequest(residentId, requestId, body === null || body === void 0 ? void 0 : body.message);
    }
    async getChairmanOverview(residentId) {
        return this.maintenanceService.getChairmanOverview(residentId);
    }
    async markCollected(residentId, paymentId) {
        return this.maintenanceService.markPaymentCollected(residentId, paymentId);
    }
    async getWhatsappPayload(residentId, paymentId) {
        return this.maintenanceService.getPendingWhatsappPayload(residentId, paymentId);
    }
};
exports.MaintenanceController = MaintenanceController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('resident/:residentId'),
    __param(0, (0, common_1.Param)('residentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "findResidentRequests", null);
__decorate([
    (0, common_1.Get)('chairman/:residentId/requests'),
    __param(0, (0, common_1.Param)('residentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "getChairmanRequests", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('chairman/:residentId/requests/:requestId/start'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('requestId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "startRequest", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('chairman/:residentId/requests/:requestId/update'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('requestId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "updateRequest", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('chairman/:residentId/requests/:requestId/resolve'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('requestId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "resolveRequest", null);
__decorate([
    (0, common_1.Get)('chairman/:residentId/overview'),
    __param(0, (0, common_1.Param)('residentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "getChairmanOverview", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('chairman/:residentId/payments/:paymentId/collect'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "markCollected", null);
__decorate([
    (0, common_1.Get)('chairman/:residentId/payments/:paymentId/whatsapp'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MaintenanceController.prototype, "getWhatsappPayload", null);
exports.MaintenanceController = MaintenanceController = __decorate([
    (0, common_1.Controller)('maintenance'),
    __metadata("design:paramtypes", [maintenance_service_1.MaintenanceService])
], MaintenanceController);
