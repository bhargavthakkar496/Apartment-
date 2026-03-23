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
var FacilityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacilityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let FacilityService = FacilityService_1 = class FacilityService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async bookFacility(facilityId, residentId, bookingDate, timeSlot) {
        await this.ensureDefaultFacilities();
        const resident = await this.prisma.resident.findUnique({
            where: { id: residentId.trim() },
            include: {
                user: true,
                society: true,
            },
        });
        if (!resident ||
            !resident.isActive ||
            !resident.user ||
            !FacilityService_1.bookableRoles.has(resident.user.role)) {
            throw new common_1.BadRequestException('Only active tenants and owners can raise amenity booking requests.');
        }
        const facility = await this.prisma.facility.findUnique({
            where: { id: facilityId.trim() },
        });
        if (!facility) {
            throw new common_1.NotFoundException('Selected amenity was not found.');
        }
        const normalizedBookingDate = this.normalizeBookingDate(bookingDate);
        const normalizedTimeSlot = facility.requiresTimeslot
            ? this.normalizeTimeSlot(timeSlot)
            : null;
        const existingPendingRequest = await this.prisma.booking.findFirst({
            where: {
                facilityId: facility.id,
                residentId: resident.id,
                bookingDate: normalizedBookingDate,
                timeSlot: normalizedTimeSlot,
                status: 'pending',
            },
        });
        if (existingPendingRequest) {
            throw new common_1.ConflictException('You already have a pending request for this amenity and slot.');
        }
        return this.prisma.booking.create({
            data: {
                facilityId: facility.id,
                residentId: resident.id,
                date: new Date(`${normalizedBookingDate}T00:00:00.000Z`),
                bookingDate: normalizedBookingDate,
                timeSlot: normalizedTimeSlot,
                status: 'pending',
            },
            include: {
                facility: true,
            },
        });
    }
    async getBookings() {
        return this.prisma.booking.findMany({
            include: { facility: true, resident: true },
            orderBy: [{ bookingDate: 'asc' }, { date: 'asc' }],
        });
    }
    async getAvailableFacilities() {
        await this.ensureDefaultFacilities();
        return {
            items: await this.prisma.facility.findMany({
                orderBy: { name: 'asc' },
            }),
            gymTimeSlots: FacilityService_1.gymTimeSlots,
        };
    }
    async getResidentBookings(residentId) {
        const normalizedResidentId = residentId.trim();
        if (!normalizedResidentId) {
            throw new common_1.BadRequestException('residentId is required.');
        }
        return this.prisma.booking.findMany({
            where: {
                residentId: normalizedResidentId,
            },
            include: {
                facility: true,
            },
            orderBy: [{ bookingDate: 'desc' }, { date: 'desc' }],
        });
    }
    async getAvailability(facilityId, bookingDate, timeSlot) {
        await this.ensureDefaultFacilities();
        const normalizedFacilityId = facilityId.trim();
        if (!normalizedFacilityId) {
            throw new common_1.BadRequestException('facilityId is required.');
        }
        const facility = await this.prisma.facility.findUnique({
            where: { id: normalizedFacilityId },
        });
        if (!facility) {
            throw new common_1.NotFoundException('Selected amenity was not found.');
        }
        const normalizedBookingDate = this.normalizeBookingDate(bookingDate);
        const normalizedTimeSlot = facility.requiresTimeslot
            ? this.normalizeTimeSlot(timeSlot)
            : null;
        const approvedCount = await this.prisma.booking.count({
            where: Object.assign({ facilityId: facility.id, bookingDate: normalizedBookingDate, status: 'approved' }, (facility.requiresTimeslot ? { timeSlot: normalizedTimeSlot } : {})),
        });
        const pendingCount = await this.prisma.booking.count({
            where: Object.assign({ facilityId: facility.id, bookingDate: normalizedBookingDate, status: 'pending' }, (facility.requiresTimeslot ? { timeSlot: normalizedTimeSlot } : {})),
        });
        const remainingCapacity = Math.max(facility.capacity - approvedCount, 0);
        const isFull = remainingCapacity == 0;
        const hasPendingConflict = pendingCount > 0;
        const hint = facility.requiresTimeslot
            ? isFull
                ? 'This gym timeslot is already full.'
                : hasPendingConflict
                    ? `${pendingCount} booking request(s) are already awaiting chairman approval for this gym timeslot. You can still raise your request, but a conflict already exists.`
                    : '$remainingCapacity of ${facility.capacity} approval slots are still open for this gym timeslot.'
            : isFull
                ? 'This amenity is already fully booked for the selected date.'
                : hasPendingConflict
                    ? 'A booking request is already raised for approval for this amenity and date. You can still submit your request, but a conflict already exists.'
                    : 'This amenity is available for the selected date.';
        return {
            facilityName: facility.name,
            bookingDate: normalizedBookingDate,
            timeSlot: normalizedTimeSlot,
            capacity: facility.capacity,
            approvedCount,
            pendingCount,
            remainingCapacity,
            isFull,
            hasPendingConflict,
            hint,
        };
    }
    async getChairmanAmenityRequests(chairmanResidentId) {
        await this.ensureDefaultFacilities();
        const chairmanResident = await this.getValidatedChairman(chairmanResidentId);
        const bookings = await this.prisma.booking.findMany({
            where: {
                resident: {
                    societyId: chairmanResident.societyId,
                    isActive: true,
                    user: {
                        role: {
                            in: ['resident', 'owner'],
                        },
                    },
                },
            },
            include: {
                facility: true,
                resident: {
                    include: {
                        user: true,
                    },
                },
            },
            orderBy: [{ bookingDate: 'asc' }, { timeSlot: 'asc' }, { date: 'asc' }],
        });
        return {
            society: chairmanResident.society,
            items: bookings.map((booking) => ({
                id: booking.id,
                amenityName: booking.facility.name,
                bookingDate: booking.bookingDate,
                timeSlot: booking.timeSlot,
                status: booking.status,
                residentId: booking.residentId,
                requesterName: booking.resident.name,
                requesterRole: booking.resident.user.role === 'resident' ? 'Tenant' : 'Owner',
                flatNumber: booking.resident.flatNo,
                capacity: booking.facility.capacity,
                requiresTimeslot: booking.facility.requiresTimeslot,
            })),
        };
    }
    async approveBooking(chairmanResidentId, bookingId) {
        const chairmanResident = await this.getValidatedChairman(chairmanResidentId);
        const booking = await this.getChairmanScopedBooking(chairmanResident, bookingId);
        if (booking.status === 'approved') {
            throw new common_1.BadRequestException('This request is already approved.');
        }
        if (booking.status === 'rejected') {
            throw new common_1.BadRequestException('This request was already rejected.');
        }
        const approvedCount = await this.prisma.booking.count({
            where: Object.assign({ facilityId: booking.facilityId, bookingDate: booking.bookingDate, status: 'approved' }, (booking.facility.requiresTimeslot
                ? { timeSlot: booking.timeSlot }
                : {})),
        });
        if (approvedCount >= booking.facility.capacity) {
            throw new common_1.ConflictException(booking.facility.requiresTimeslot
                ? 'This gym slot is already full for the selected date.'
                : 'This amenity is already booked for the selected date.');
        }
        const approvedBooking = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
                status: 'approved',
                approvedAt: new Date(),
                approvedByResidentId: chairmanResident.id,
                rejectedAt: null,
            },
        });
        await this.createAmenityNotification(booking.residentId, `Your ${booking.facility.name} booking request for ${booking.bookingDate}${booking.timeSlot == null ? '' : ' at ' + booking.timeSlot} has been approved by the chairman.`);
        const totalApprovedAfterUpdate = approvedCount + 1;
        if (totalApprovedAfterUpdate >= booking.facility.capacity) {
            await this.rejectConflictingPendingRequests(booking);
        }
        return approvedBooking;
    }
    async rejectBooking(chairmanResidentId, bookingId) {
        const chairmanResident = await this.getValidatedChairman(chairmanResidentId);
        const booking = await this.getChairmanScopedBooking(chairmanResident, bookingId);
        if (booking.status === 'rejected') {
            throw new common_1.BadRequestException('This request is already rejected.');
        }
        const rejectedBooking = await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
                status: 'rejected',
                rejectedAt: new Date(),
            },
        });
        await this.createAmenityNotification(booking.residentId, `Your ${booking.facility.name} booking request for ${booking.bookingDate}${booking.timeSlot == null ? '' : ' at ' + booking.timeSlot} has been rejected by the chairman.`);
        return rejectedBooking;
    }
    async ensureDefaultFacilities() {
        await Promise.all(FacilityService_1.defaultFacilities.map((facility) => this.prisma.facility.upsert({
            where: { name: facility.name },
            update: {
                capacity: facility.capacity,
                requiresTimeslot: facility.requiresTimeslot,
            },
            create: facility,
        })));
    }
    normalizeBookingDate(value) {
        var _a;
        const normalized = (_a = value === null || value === void 0 ? void 0 : value.trim()) !== null && _a !== void 0 ? _a : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            throw new common_1.BadRequestException('bookingDate must be in YYYY-MM-DD format.');
        }
        return normalized;
    }
    normalizeTimeSlot(value) {
        var _a;
        const normalized = (_a = value === null || value === void 0 ? void 0 : value.trim()) !== null && _a !== void 0 ? _a : '';
        if (!FacilityService_1.gymTimeSlots.includes(normalized)) {
            throw new common_1.BadRequestException('A valid gym timeslot is required.');
        }
        return normalized;
    }
    async getValidatedChairman(chairmanResidentId) {
        const normalizedResidentId = chairmanResidentId.trim();
        if (!normalizedResidentId) {
            throw new common_1.BadRequestException('residentId is required.');
        }
        const resident = await this.prisma.resident.findUnique({
            where: { id: normalizedResidentId },
            include: {
                user: true,
                society: true,
            },
        });
        if (!resident || resident.user.role !== FacilityService_1.chairmanRole) {
            throw new common_1.NotFoundException('Chairman record was not found.');
        }
        if (!resident.societyId || !resident.society) {
            throw new common_1.BadRequestException('Chairman is not linked to any society.');
        }
        return resident;
    }
    async getChairmanScopedBooking(chairmanResident, bookingId) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId.trim() },
            include: {
                facility: true,
                resident: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (!booking ||
            booking.resident.societyId !== chairmanResident.societyId) {
            throw new common_1.NotFoundException('Amenity request was not found.');
        }
        return booking;
    }
    async rejectConflictingPendingRequests(booking) {
        const conflictingPendingRequests = await this.prisma.booking.findMany({
            where: Object.assign({ id: {
                    not: booking.id,
                }, facilityId: booking.facilityId, bookingDate: booking.bookingDate, status: 'pending' }, (booking.facility.requiresTimeslot ? { timeSlot: booking.timeSlot } : {})),
        });
        if (conflictingPendingRequests.length === 0) {
            return;
        }
        await this.prisma.booking.updateMany({
            where: {
                id: {
                    in: conflictingPendingRequests.map((item) => item.id),
                },
            },
            data: {
                status: 'rejected',
                rejectedAt: new Date(),
            },
        });
        await Promise.all(conflictingPendingRequests.map((item) => this.createAmenityNotification(item.residentId, `Your ${booking.facility.name} booking request for ${booking.bookingDate}${item.timeSlot == null ? '' : ' at ' + item.timeSlot} could not be approved because another request has already been finalized by the chairman.`)));
    }
    async createAmenityNotification(residentId, message) {
        await this.prisma.notification.create({
            data: {
                residentId,
                message,
                createdAt: new Date(),
            },
        });
    }
};
exports.FacilityService = FacilityService;
FacilityService.chairmanRole = 'chairman';
FacilityService.bookableRoles = new Set(['resident', 'owner']);
FacilityService.gymName = 'Gymnasium';
FacilityService.defaultFacilities = [
    { name: 'Clubhouse', capacity: 1, requiresTimeslot: false },
    { name: 'Swimming Pool', capacity: 1, requiresTimeslot: false },
    { name: 'Party Lawn', capacity: 1, requiresTimeslot: false },
    { name: 'Gymnasium', capacity: 5, requiresTimeslot: true },
    { name: 'Community Hall', capacity: 1, requiresTimeslot: false },
];
FacilityService.gymTimeSlots = [
    '06:00-07:00',
    '07:00-08:00',
    '08:00-09:00',
    '18:00-19:00',
    '19:00-20:00',
    '20:00-21:00',
];
exports.FacilityService = FacilityService = FacilityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FacilityService);
