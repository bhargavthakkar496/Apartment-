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
exports.SocietyController = void 0;
const common_1 = require("@nestjs/common");
const society_service_1 = require("./society.service");
let SocietyController = class SocietyController {
    constructor(societyService) {
        this.societyService = societyService;
    }
    findAll(country, state, city, area, pincode) {
        return this.societyService.getSocieties({
            country,
            state,
            city,
            area,
            pincode,
        });
    }
    discover(pincode) {
        return this.societyService.discoverSocietiesByPincode(pincode !== null && pincode !== void 0 ? pincode : '');
    }
    findCountries() {
        return this.societyService.getCountries();
    }
    findStates(country) {
        return this.societyService.getStates({ country });
    }
    findCities(country, state) {
        return this.societyService.getCities({ country, state });
    }
    findAreas(country, state, city) {
        return this.societyService.getAreas({ country, state, city });
    }
    findApartmentUnits(societyId) {
        return this.societyService.getApartmentUnits(societyId);
    }
    create(body) {
        return this.societyService.createSociety(body);
    }
};
exports.SocietyController = SocietyController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('country')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('city')),
    __param(3, (0, common_1.Query)('area')),
    __param(4, (0, common_1.Query)('pincode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('discover'),
    __param(0, (0, common_1.Query)('pincode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "discover", null);
__decorate([
    (0, common_1.Get)('countries'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "findCountries", null);
__decorate([
    (0, common_1.Get)('states'),
    __param(0, (0, common_1.Query)('country')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "findStates", null);
__decorate([
    (0, common_1.Get)('cities'),
    __param(0, (0, common_1.Query)('country')),
    __param(1, (0, common_1.Query)('state')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "findCities", null);
__decorate([
    (0, common_1.Get)('areas'),
    __param(0, (0, common_1.Query)('country')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('city')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "findAreas", null);
__decorate([
    (0, common_1.Get)(':societyId/apartments'),
    __param(0, (0, common_1.Param)('societyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "findApartmentUnits", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocietyController.prototype, "create", null);
exports.SocietyController = SocietyController = __decorate([
    (0, common_1.Controller)('societies'),
    __metadata("design:paramtypes", [society_service_1.SocietyService])
], SocietyController);
