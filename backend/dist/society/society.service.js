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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocietyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let SocietyService = class SocietyService {
    constructor(prisma) {
        this.prisma = prisma;
        this.allowedTypes = new Set(['society', 'apartment']);
    }
    async getSocieties(filters) {
        const normalizedFilters = this.normalizeFilters(filters);
        const items = await this.prisma.society.findMany({
            where: {
                country: normalizedFilters.country,
                state: normalizedFilters.state,
                city: normalizedFilters.city,
                area: normalizedFilters.area,
                pincode: normalizedFilters.pincode,
            },
            orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }, { area: 'asc' }, { name: 'asc' }],
        });
        return {
            filters: normalizedFilters,
            total: items.length,
            items,
        };
    }
    async discoverSocietiesByPincode(pincode) {
        const normalizedPincode = this.normalizeRequiredPincode(pincode);
        const exactItems = await this.prisma.society.findMany({
            where: { pincode: normalizedPincode },
            orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }, { area: 'asc' }, { name: 'asc' }],
        });
        if (exactItems.length > 0) {
            return {
                requestedPincode: normalizedPincode,
                matchedPincode: normalizedPincode,
                matchType: 'exact',
                total: exactItems.length,
                items: exactItems,
            };
        }
        const allPincodes = await this.prisma.society.findMany({
            select: { pincode: true },
            orderBy: { pincode: 'asc' },
        });
        const distinctPincodes = this.distinctValues(allPincodes.map((society) => society.pincode));
        if (distinctPincodes.length == 0) {
            return {
                requestedPincode: normalizedPincode,
                matchedPincode: null,
                matchType: 'none',
                total: 0,
                items: [],
            };
        }
        const nearestPincode = this.findNearestPincode(normalizedPincode, distinctPincodes);
        const nearbyItems = await this.prisma.society.findMany({
            where: { pincode: nearestPincode },
            orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }, { area: 'asc' }, { name: 'asc' }],
        });
        return {
            requestedPincode: normalizedPincode,
            matchedPincode: nearestPincode,
            matchType: 'nearby',
            total: nearbyItems.length,
            items: nearbyItems,
        };
    }
    async createSociety(input) {
        const data = this.validateAndNormalizeCreateInput(input);
        try {
            return await this.prisma.society.create({ data });
        }
        catch (error) {
            if (this.isUniqueConstraintError(error)) {
                throw new common_1.ConflictException('A society or apartment with this country, state, city, area, and name already exists.');
            }
            throw error;
        }
    }
    async getApartmentUnits(societyId) {
        const normalizedSocietyId = societyId.trim();
        if (!normalizedSocietyId) {
            throw new common_1.BadRequestException('societyId is required.');
        }
        const society = await this.prisma.society.findUnique({
            where: { id: normalizedSocietyId },
        });
        if (!society) {
            throw new common_1.BadRequestException('Selected society was not found.');
        }
        const apartmentUnits = await this.prisma.apartmentUnit.findMany({
            where: { societyId: normalizedSocietyId },
            orderBy: { flatNumber: 'asc' },
        });
        const occupiedResidents = await this.prisma.resident.findMany({
            where: {
                societyId: normalizedSocietyId,
                isActive: true,
            },
            select: {
                flatNo: true,
                name: true,
                user: {
                    select: {
                        role: true,
                    },
                },
            },
        });
        const occupiedFlatMap = new Map();
        const ownerListedFlatMap = new Map();
        for (const resident of occupiedResidents) {
            if (resident.user.role === 'owner') {
                ownerListedFlatMap.set(resident.flatNo, resident.name);
            }
            else {
                occupiedFlatMap.set(resident.flatNo, resident.name);
            }
        }
        return apartmentUnits.map((apartmentUnit) => {
            var _a, _b;
            return (Object.assign(Object.assign({}, apartmentUnit), { occupied: occupiedFlatMap.has(apartmentUnit.flatNumber), occupiedBy: (_a = occupiedFlatMap.get(apartmentUnit.flatNumber)) !== null && _a !== void 0 ? _a : null, ownerListed: ownerListedFlatMap.has(apartmentUnit.flatNumber), ownerListedBy: (_b = ownerListedFlatMap.get(apartmentUnit.flatNumber)) !== null && _b !== void 0 ? _b : null }));
        });
    }
    async getCountries() {
        const societies = await this.prisma.society.findMany({
            select: { country: true },
            orderBy: { country: 'asc' },
        });
        return this.distinctValues(societies.map((society) => society.country));
    }
    async getStates(filters) {
        const normalizedCountry = this.normalizeOptionalText(filters.country, 'country');
        const societies = await this.prisma.society.findMany({
            where: {
                country: normalizedCountry,
            },
            select: { state: true },
            orderBy: { state: 'asc' },
        });
        return this.distinctValues(societies.map((society) => society.state));
    }
    async getCities(filters) {
        const normalizedCountry = this.normalizeOptionalText(filters.country, 'country');
        const normalizedState = this.normalizeOptionalText(filters.state, 'state');
        const societies = await this.prisma.society.findMany({
            where: {
                country: normalizedCountry,
                state: normalizedState,
            },
            select: { city: true },
            orderBy: { city: 'asc' },
        });
        return this.distinctValues(societies.map((society) => society.city));
    }
    async getAreas(filters) {
        const normalizedCountry = this.normalizeOptionalText(filters.country, 'country');
        const normalizedState = this.normalizeOptionalText(filters.state, 'state');
        const normalizedCity = this.normalizeOptionalText(filters.city, 'city');
        const societies = await this.prisma.society.findMany({
            where: {
                country: normalizedCountry,
                state: normalizedState,
                city: normalizedCity,
            },
            select: { area: true },
            orderBy: { area: 'asc' },
        });
        return this.distinctValues(societies.map((society) => society.area));
    }
    normalizeFilters(filters) {
        return {
            country: this.normalizeOptionalText(filters.country, 'country'),
            state: this.normalizeOptionalText(filters.state, 'state'),
            city: this.normalizeOptionalText(filters.city, 'city'),
            area: this.normalizeOptionalText(filters.area, 'area'),
            pincode: this.normalizeOptionalPincode(filters.pincode),
        };
    }
    validateAndNormalizeCreateInput(input) {
        const country = this.normalizeRequiredText(input.country, 'country');
        const state = this.normalizeRequiredText(input.state, 'state');
        const city = this.normalizeRequiredText(input.city, 'city');
        const area = this.normalizeRequiredText(input.area, 'area');
        const pincode = this.normalizeRequiredPincode(input.pincode);
        const name = this.normalizeRequiredName(input.name);
        const type = this.normalizeRequiredText(input.type, 'type');
        if (!this.allowedTypes.has(type)) {
            throw new common_1.BadRequestException('Type must be either "society" or "apartment".');
        }
        return {
            country,
            state,
            city,
            area,
            pincode,
            name,
            type,
        };
    }
    normalizeOptionalText(value, field) {
        if (value == null)
            return undefined;
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
            throw new common_1.BadRequestException(`${field} cannot be empty.`);
        }
        return normalized;
    }
    normalizeRequiredText(value, field) {
        const normalized = this.normalizeOptionalText(value, field);
        if (!normalized) {
            throw new common_1.BadRequestException(`${field} is required.`);
        }
        return normalized;
    }
    normalizeOptionalPincode(value) {
        if (value == null)
            return undefined;
        const normalized = value.trim();
        if (!normalized) {
            throw new common_1.BadRequestException('pincode cannot be empty.');
        }
        if (!/^\d{6}$/.test(normalized)) {
            throw new common_1.BadRequestException('pincode must be a 6-digit number.');
        }
        return normalized;
    }
    normalizeRequiredPincode(value) {
        const normalized = this.normalizeOptionalPincode(value);
        if (!normalized) {
            throw new common_1.BadRequestException('pincode is required.');
        }
        return normalized;
    }
    normalizeRequiredName(value) {
        const normalized = value === null || value === void 0 ? void 0 : value.trim();
        if (!normalized) {
            throw new common_1.BadRequestException('name is required.');
        }
        if (normalized.length < 2) {
            throw new common_1.BadRequestException('name must be at least 2 characters long.');
        }
        return normalized;
    }
    distinctValues(values) {
        return [...new Set(values)].filter(Boolean);
    }
    findNearestPincode(requestedPincode, availablePincodes) {
        const requestedValue = Number.parseInt(requestedPincode, 10);
        return availablePincodes.reduce((best, current) => {
            const bestDistance = Math.abs(requestedValue - Number.parseInt(best, 10));
            const currentDistance = Math.abs(requestedValue - Number.parseInt(current, 10));
            if (currentDistance < bestDistance) {
                return current;
            }
            return best;
        });
    }
    isUniqueConstraintError(error) {
        return (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002');
    }
};
exports.SocietyService = SocietyService;
exports.SocietyService = SocietyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SocietyService);
