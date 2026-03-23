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
exports.FacilityController = void 0;
const common_1 = require("@nestjs/common");
const facility_service_1 = require("./facility.service");
let FacilityController = class FacilityController {
    constructor(facilityService) {
        this.facilityService = facilityService;
    }
    async book(body) {
        return this.facilityService.bookFacility(body.facilityId, body.residentId, body.bookingDate, body.timeSlot);
    }
    async findAllBookings() {
        return this.facilityService.getBookings();
    }
    async getResidentBookings(residentId) {
        return this.facilityService.getResidentBookings(residentId);
    }
    async getAvailability(facilityId, bookingDate, timeSlot) {
        return this.facilityService.getAvailability(facilityId, bookingDate, timeSlot);
    }
    async findAvailableFacilities() {
        return this.facilityService.getAvailableFacilities();
    }
    async getChairmanRequests(residentId) {
        return this.facilityService.getChairmanAmenityRequests(residentId);
    }
    async approveRequest(residentId, bookingId) {
        return this.facilityService.approveBooking(residentId, bookingId);
    }
    async rejectRequest(residentId, bookingId) {
        return this.facilityService.rejectBooking(residentId, bookingId);
    }
};
exports.FacilityController = FacilityController;
__decorate([
    (0, common_1.Post)('book'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "book", null);
__decorate([
    (0, common_1.Get)('bookings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "findAllBookings", null);
__decorate([
    (0, common_1.Get)('resident/:residentId/bookings'),
    __param(0, (0, common_1.Param)('residentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "getResidentBookings", null);
__decorate([
    (0, common_1.Get)('availability'),
    __param(0, (0, common_1.Query)('facilityId')),
    __param(1, (0, common_1.Query)('bookingDate')),
    __param(2, (0, common_1.Query)('timeSlot')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.Get)('available'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "findAvailableFacilities", null);
__decorate([
    (0, common_1.Get)('chairman/:residentId/requests'),
    __param(0, (0, common_1.Param)('residentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "getChairmanRequests", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('chairman/:residentId/requests/:bookingId/approve'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "approveRequest", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.Post)('chairman/:residentId/requests/:bookingId/reject'),
    __param(0, (0, common_1.Param)('residentId')),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FacilityController.prototype, "rejectRequest", null);
exports.FacilityController = FacilityController = __decorate([
    (0, common_1.Controller)('facility'),
    __metadata("design:paramtypes", [facility_service_1.FacilityService])
], FacilityController);
