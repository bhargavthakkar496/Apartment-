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
var MaintenanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let MaintenanceService = MaintenanceService_1 = class MaintenanceService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRequest(description, residentId) {
        var _a, _b;
        const normalizedDescription = (_a = description === null || description === void 0 ? void 0 : description.trim()) !== null && _a !== void 0 ? _a : '';
        const normalizedResidentId = (_b = residentId === null || residentId === void 0 ? void 0 : residentId.trim()) !== null && _b !== void 0 ? _b : '';
        if (!normalizedDescription) {
            throw new common_1.BadRequestException('description is required.');
        }
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
        if (!resident) {
            throw new common_1.NotFoundException('Resident record was not found.');
        }
        if (!resident.isActive ||
            !resident.user ||
            !MaintenanceService_1.requesterRoles.has(resident.user.role)) {
            throw new common_1.BadRequestException('Only active tenants and owners can raise repair/problem requests.');
        }
        const request = await this.prisma.maintenanceRequest.create({
            data: {
                description: normalizedDescription,
                residentId: resident.id,
            },
        });
        await this.createResidentRepairNotification({
            residentId: resident.id,
            requestId: request.id,
            status: 'pending',
            detail: 'Your repair/problem request has been sent to the chairman for review.',
        });
        if (resident.societyId && resident.society) {
            await this.notifyChairmanAboutRepairRequest({
                requestId: request.id,
                residentName: resident.name,
                flatNo: resident.flatNo,
                societyId: resident.societyId,
                societyName: resident.society.name,
                description: normalizedDescription,
            });
        }
        return this.buildRepairRequestResponse(request, resident.name, resident.flatNo, [
            {
                status: 'pending',
                message: 'Your repair/problem request has been sent to the chairman for review.',
                createdAt: new Date().toISOString(),
            },
        ]);
    }
    async getRequests() {
        return this.prisma.maintenanceRequest.findMany();
    }
    async getResidentRequests(residentId) {
        var _a, _b;
        const normalizedResidentId = (_a = residentId === null || residentId === void 0 ? void 0 : residentId.trim()) !== null && _a !== void 0 ? _a : '';
        if (!normalizedResidentId) {
            throw new common_1.BadRequestException('residentId is required.');
        }
        const resident = await this.prisma.resident.findUnique({
            where: { id: normalizedResidentId },
        });
        if (!resident) {
            throw new common_1.NotFoundException('Resident record was not found.');
        }
        const requests = await this.prisma.maintenanceRequest.findMany({
            where: {
                residentId: normalizedResidentId,
            },
            orderBy: {
                id: 'desc',
            },
        });
        const notificationMap = await this.getRepairNotificationMap([normalizedResidentId]);
        const residentNotifications = (_b = notificationMap.get(normalizedResidentId)) !== null && _b !== void 0 ? _b : [];
        return requests.map((request) => this.buildRepairRequestResponse(request, resident.name, resident.flatNo, residentNotifications
            .filter((notification) => notification.requestId === request.id)
            .map((notification) => ({
            status: notification.status,
            message: notification.message,
            createdAt: notification.createdAt,
        }))));
    }
    async getChairmanRepairRequests(chairmanResidentId) {
        const chairmanResident = await this.getValidatedChairmanResident(chairmanResidentId);
        const requests = await this.prisma.maintenanceRequest.findMany({
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
                resident: {
                    include: {
                        user: true,
                    },
                },
            },
            orderBy: {
                id: 'desc',
            },
        });
        const residentIds = Array.from(new Set(requests.map((request) => request.residentId)));
        const notificationMap = await this.getRepairNotificationMap(residentIds);
        return {
            society: chairmanResident.society,
            items: requests.map((request) => {
                var _a;
                const requestNotifications = ((_a = notificationMap.get(request.residentId)) !== null && _a !== void 0 ? _a : []).filter((notification) => notification.requestId === request.id);
                const view = this.buildRepairRequestResponse(request, request.resident.name, request.resident.flatNo, requestNotifications.map((notification) => ({
                    status: notification.status,
                    message: notification.message,
                    createdAt: notification.createdAt,
                })));
                return Object.assign(Object.assign({}, view), { requesterName: request.resident.name, requesterRole: request.resident.user.role === 'owner' ? 'Owner' : 'Tenant' });
            }),
        };
    }
    async startRepairRequest(chairmanResidentId, requestId, message) {
        const request = await this.getChairmanScopedRepairRequest(chairmanResidentId, requestId);
        const state = await this.getRepairRequestState(request.id, request.residentId);
        if (state.status === 'in_progress') {
            throw new common_1.BadRequestException('This repair/problem request is already in progress.');
        }
        if (state.status === 'resolved') {
            throw new common_1.BadRequestException('This repair/problem request is already resolved.');
        }
        await this.createResidentRepairNotification({
            residentId: request.residentId,
            requestId: request.id,
            status: 'in_progress',
            detail: (message === null || message === void 0 ? void 0 : message.trim()) ||
                'The chairman has started working on your repair/problem request.',
        });
        return this.getResidentRequestById(request.id);
    }
    async addRepairRequestUpdate(chairmanResidentId, requestId, message) {
        var _a;
        const normalizedMessage = (_a = message === null || message === void 0 ? void 0 : message.trim()) !== null && _a !== void 0 ? _a : '';
        if (!normalizedMessage) {
            throw new common_1.BadRequestException('message is required.');
        }
        const request = await this.getChairmanScopedRepairRequest(chairmanResidentId, requestId);
        const state = await this.getRepairRequestState(request.id, request.residentId);
        if (state.status === 'resolved') {
            throw new common_1.BadRequestException('Resolved repair/problem requests cannot be updated.');
        }
        await this.createResidentRepairNotification({
            residentId: request.residentId,
            requestId: request.id,
            status: 'in_progress',
            detail: normalizedMessage,
        });
        return this.getResidentRequestById(request.id);
    }
    async resolveRepairRequest(chairmanResidentId, requestId, message) {
        const request = await this.getChairmanScopedRepairRequest(chairmanResidentId, requestId);
        const state = await this.getRepairRequestState(request.id, request.residentId);
        if (state.status === 'resolved') {
            throw new common_1.BadRequestException('This repair/problem request is already resolved.');
        }
        await this.createResidentRepairNotification({
            residentId: request.residentId,
            requestId: request.id,
            status: 'resolved',
            detail: (message === null || message === void 0 ? void 0 : message.trim()) ||
                'Your repair/problem request has been resolved by the chairman.',
        });
        return this.getResidentRequestById(request.id);
    }
    async getChairmanOverview(chairmanResidentId) {
        const chairmanResident = await this.getValidatedChairmanResident(chairmanResidentId);
        const cycleMonth = this.getCurrentCycleMonth();
        const cycleDates = this.getCycleDates(cycleMonth);
        const apartmentUnits = await this.prisma.apartmentUnit.findMany({
            where: {
                societyId: chairmanResident.societyId,
            },
            orderBy: {
                flatNumber: 'asc',
            },
        });
        if (apartmentUnits.length === 0) {
            return {
                society: chairmanResident.society,
                cycleMonth,
                cycleStartDate: cycleDates.startDate.toISOString(),
                dueDate: cycleDates.dueDate.toISOString(),
                isOverdueWindowOpen: this.isOverdueWindowOpen(cycleDates.dueDate),
                maintenancePerApartment: MaintenanceService_1.monthlyMaintenanceAmount,
                totalApartments: 0,
                collectedApartments: 0,
                pendingApartments: 0,
                overdueApartments: 0,
                totalToBeCollected: 0,
                totalCollected: 0,
                totalPending: 0,
                chairmanWhatsappNumber: MaintenanceService_1.hardcodedChairmanWhatsapp,
                apartments: [],
            };
        }
        await this.ensureCyclePayments(chairmanResident.societyId, apartmentUnits, cycleMonth);
        const payments = await this.prisma.maintenancePayment.findMany({
            where: {
                societyId: chairmanResident.societyId,
                cycleMonth,
            },
            include: {
                apartmentUnit: true,
            },
            orderBy: {
                flatNumber: 'asc',
            },
        });
        const activeResidents = await this.prisma.resident.findMany({
            where: {
                societyId: chairmanResident.societyId,
                isActive: true,
            },
            include: {
                user: true,
            },
        });
        const apartmentContactMap = new Map();
        for (const resident of activeResidents) {
            const existing = apartmentContactMap.get(resident.flatNo);
            const shouldReplace = existing == null ||
                (existing.role !== 'owner' && resident.user.role === 'owner');
            if (shouldReplace) {
                apartmentContactMap.set(resident.flatNo, {
                    phone: resident.phone,
                    name: resident.name,
                    role: resident.user.role,
                });
            }
        }
        const apartments = payments.map((payment) => {
            var _a, _b, _c;
            const contact = apartmentContactMap.get(payment.flatNumber);
            const isCollected = payment.collectedAt != null;
            const status = isCollected
                ? 'collected'
                : this.isOverdueWindowOpen(cycleDates.dueDate)
                    ? 'overdue'
                    : 'pending';
            const whatsappMessage = this.buildWhatsappMessage({
                societyName: chairmanResident.society.name,
                status,
            });
            return {
                id: payment.id,
                flatNumber: payment.flatNumber,
                amount: payment.amount,
                status,
                collectedAt: payment.collectedAt,
                contactName: (_a = contact === null || contact === void 0 ? void 0 : contact.name) !== null && _a !== void 0 ? _a : null,
                contactPhone: (_b = contact === null || contact === void 0 ? void 0 : contact.phone) !== null && _b !== void 0 ? _b : null,
                contactRole: (_c = contact === null || contact === void 0 ? void 0 : contact.role) !== null && _c !== void 0 ? _c : null,
                whatsappUrl: !isCollected && (contact === null || contact === void 0 ? void 0 : contact.phone) != null
                    ? this.buildWhatsappUrl(contact.phone, whatsappMessage)
                    : null,
            };
        });
        const collectedApartments = apartments.filter((item) => item['status'] === 'collected').length;
        const overdueApartments = apartments.filter((item) => item['status'] === 'overdue').length;
        const totalApartments = apartments.length;
        const pendingApartments = apartments.filter((item) => item['status'] === 'pending').length;
        const totalToBeCollected = totalApartments * MaintenanceService_1.monthlyMaintenanceAmount;
        const totalCollected = collectedApartments * MaintenanceService_1.monthlyMaintenanceAmount;
        return {
            society: chairmanResident.society,
            cycleMonth,
            cycleStartDate: cycleDates.startDate.toISOString(),
            dueDate: cycleDates.dueDate.toISOString(),
            isOverdueWindowOpen: this.isOverdueWindowOpen(cycleDates.dueDate),
            maintenancePerApartment: MaintenanceService_1.monthlyMaintenanceAmount,
            totalApartments,
            collectedApartments,
            pendingApartments,
            overdueApartments,
            totalToBeCollected,
            totalCollected,
            totalPending: totalToBeCollected - totalCollected,
            chairmanWhatsappNumber: MaintenanceService_1.hardcodedChairmanWhatsapp,
            apartments,
        };
    }
    async markPaymentCollected(chairmanResidentId, paymentId) {
        const chairmanResident = await this.getValidatedChairmanResident(chairmanResidentId);
        const normalizedPaymentId = paymentId.trim();
        const payment = await this.prisma.maintenancePayment.findUnique({
            where: { id: normalizedPaymentId },
        });
        if (!payment || payment.societyId !== chairmanResident.societyId) {
            throw new common_1.NotFoundException('Maintenance payment was not found.');
        }
        return this.prisma.maintenancePayment.update({
            where: { id: normalizedPaymentId },
            data: {
                collectedAt: new Date(),
                collectedByResidentId: chairmanResident.id,
            },
        });
    }
    async getPendingWhatsappPayload(chairmanResidentId, paymentId) {
        const overview = await this.getChairmanOverview(chairmanResidentId);
        const payment = overview.apartments.find((item) => { var _a; return ((_a = item['id']) === null || _a === void 0 ? void 0 : _a.toString()) == paymentId.trim(); });
        if (!payment) {
            throw new common_1.NotFoundException('Maintenance payment was not found.');
        }
        if (payment['status'] == 'collected') {
            throw new common_1.BadRequestException('Maintenance is already collected for this apartment.');
        }
        if (payment['whatsappUrl'] == null) {
            throw new common_1.BadRequestException('No active contact is available for this apartment.');
        }
        return {
            chairmanWhatsappNumber: MaintenanceService_1.hardcodedChairmanWhatsapp,
            whatsappUrl: payment['whatsappUrl'],
            flatNumber: payment['flatNumber'],
        };
    }
    async ensureCyclePayments(societyId, apartmentUnits, cycleMonth) {
        await Promise.all(apartmentUnits.map((unit) => this.prisma.maintenancePayment.upsert({
            where: {
                societyId_apartmentUnitId_cycleMonth: {
                    societyId,
                    apartmentUnitId: unit.id,
                    cycleMonth,
                },
            },
            update: {},
            create: {
                societyId,
                apartmentUnitId: unit.id,
                flatNumber: unit.flatNumber,
                cycleMonth,
                amount: MaintenanceService_1.monthlyMaintenanceAmount,
            },
        })));
    }
    async getValidatedChairmanResident(chairmanResidentId) {
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
        if (!resident || resident.user.role !== MaintenanceService_1.chairmanRole) {
            throw new common_1.NotFoundException('Chairman record was not found.');
        }
        if (!resident.societyId || !resident.society) {
            throw new common_1.BadRequestException('Chairman is not linked to any society.');
        }
        return resident;
    }
    async getChairmanScopedRepairRequest(chairmanResidentId, requestId) {
        var _a;
        const chairmanResident = await this.getValidatedChairmanResident(chairmanResidentId);
        const normalizedRequestId = (_a = requestId === null || requestId === void 0 ? void 0 : requestId.trim()) !== null && _a !== void 0 ? _a : '';
        if (!normalizedRequestId) {
            throw new common_1.BadRequestException('requestId is required.');
        }
        const request = await this.prisma.maintenanceRequest.findUnique({
            where: {
                id: normalizedRequestId,
            },
            include: {
                resident: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (!request ||
            request.resident.societyId !== chairmanResident.societyId ||
            !MaintenanceService_1.requesterRoles.has(request.resident.user.role)) {
            throw new common_1.NotFoundException('Repair/problem request was not found.');
        }
        return request;
    }
    async getRepairRequestState(requestId, residentId) {
        var _a, _b;
        const residentNotifications = (_a = (await this.getRepairNotificationMap([residentId])).get(residentId)) !== null && _a !== void 0 ? _a : [];
        const requestNotifications = residentNotifications.filter((notification) => notification.requestId === requestId);
        const latest = requestNotifications[requestNotifications.length - 1];
        return {
            status: (_b = latest === null || latest === void 0 ? void 0 : latest.status) !== null && _b !== void 0 ? _b : 'pending',
            updates: requestNotifications.map((notification) => ({
                status: notification.status,
                message: notification.message,
                createdAt: notification.createdAt,
            })),
        };
    }
    async getResidentRequestById(requestId) {
        const request = await this.prisma.maintenanceRequest.findUnique({
            where: {
                id: requestId,
            },
            include: {
                resident: true,
            },
        });
        if (!request) {
            throw new common_1.NotFoundException('Repair/problem request was not found.');
        }
        const state = await this.getRepairRequestState(request.id, request.residentId);
        return this.buildRepairRequestResponse(request, request.resident.name, request.resident.flatNo, state.updates);
    }
    async getRepairNotificationMap(residentIds) {
        var _a;
        if (residentIds.length === 0) {
            return new Map();
        }
        const notifications = await this.prisma.notification.findMany({
            where: {
                residentId: {
                    in: residentIds,
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        const notificationMap = new Map();
        for (const notification of notifications) {
            const parsed = this.parseRepairRequestNotification(notification.message);
            if (!parsed) {
                continue;
            }
            const residentNotifications = (_a = notificationMap.get(notification.residentId)) !== null && _a !== void 0 ? _a : [];
            residentNotifications.push({
                requestId: parsed.requestId,
                status: parsed.status,
                message: parsed.detail,
                createdAt: notification.createdAt.toISOString(),
            });
            notificationMap.set(notification.residentId, residentNotifications);
        }
        return notificationMap;
    }
    buildRepairRequestResponse(request, residentName, flatNumber, updates) {
        var _a, _b, _c, _d, _e, _f;
        const latestUpdate = (_a = updates[updates.length - 1]) !== null && _a !== void 0 ? _a : null;
        return {
            id: request.id,
            description: request.description,
            residentId: request.residentId,
            residentName,
            flatNumber,
            status: (_b = latestUpdate === null || latestUpdate === void 0 ? void 0 : latestUpdate.status) !== null && _b !== void 0 ? _b : 'pending',
            submittedAt: (_d = (_c = updates[0]) === null || _c === void 0 ? void 0 : _c.createdAt) !== null && _d !== void 0 ? _d : null,
            latestUpdate: (_e = latestUpdate === null || latestUpdate === void 0 ? void 0 : latestUpdate.message) !== null && _e !== void 0 ? _e : null,
            latestUpdatedAt: (_f = latestUpdate === null || latestUpdate === void 0 ? void 0 : latestUpdate.createdAt) !== null && _f !== void 0 ? _f : null,
            updates,
        };
    }
    async createResidentRepairNotification(input) {
        await this.prisma.notification.create({
            data: {
                residentId: input.residentId,
                message: this.buildRepairRequestNotificationMessage(input),
                createdAt: new Date(),
            },
        });
    }
    buildRepairRequestNotificationMessage(input) {
        return `${MaintenanceService_1.repairNotificationPrefix}${input.requestId}:${input.status}] ${input.detail}`;
    }
    parseRepairRequestNotification(message) {
        const match = /^\[repair-request:([^:\]]+):(pending|in_progress|resolved)\]\s*(.*)$/i.exec(message);
        if (!match) {
            return null;
        }
        return {
            requestId: match[1],
            status: match[2],
            detail: match[3] || 'Repair/problem request updated.',
        };
    }
    async notifyChairmanAboutRepairRequest(input) {
        const chairmen = await this.prisma.resident.findMany({
            where: {
                societyId: input.societyId,
                isActive: true,
                user: {
                    role: MaintenanceService_1.chairmanRole,
                },
            },
            select: {
                id: true,
            },
        });
        if (chairmen.length === 0) {
            return;
        }
        await this.prisma.notification.createMany({
            data: chairmen.map((chairman) => ({
                residentId: chairman.id,
                message: `New repair/problem request #${input.requestId} from ${input.residentName} (Flat ${input.flatNo}) in ${input.societyName}: ${input.description}`,
                createdAt: new Date(),
            })),
        });
    }
    getCurrentCycleMonth() {
        const now = new Date();
        const month = `${now.getMonth() + 1}`.padStart(2, '0');
        return `${now.getFullYear()}-${month}`;
    }
    getCycleDates(cycleMonth) {
        const [yearText, monthText] = cycleMonth.split('-');
        const year = Number.parseInt(yearText, 10);
        const monthIndex = Number.parseInt(monthText, 10) - 1;
        const startDate = new Date(year, monthIndex, MaintenanceService_1.cycleStartDay);
        const dueDate = new Date(year, monthIndex, MaintenanceService_1.dueDay, 23, 59, 59, 999);
        return {
            startDate,
            dueDate,
        };
    }
    isOverdueWindowOpen(dueDate) {
        return Date.now() > dueDate.getTime();
    }
    buildWhatsappMessage(input) {
        if (input.status === 'overdue') {
            return `Maintenance fee for your apartment in ${input.societyName} is Overdue since 8th of the current month. Penalty of Rs 10 / day will be charged now. Please clear the dues immedietly to avoid penalty. Thank you for your attention to this matter.`;
        }
        return `Maintenance fee for your apartment in ${input.societyName} is pending. Please clear the dues by 7th of the month. Thank you for your attention to this matter.`;
    }
    buildWhatsappUrl(phone, message) {
        const normalizedPhone = phone.replace(/[^0-9]/g, '');
        return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
    }
};
exports.MaintenanceService = MaintenanceService;
MaintenanceService.monthlyMaintenanceAmount = 1000;
MaintenanceService.chairmanRole = 'chairman';
MaintenanceService.hardcodedChairmanWhatsapp = '919879000496';
MaintenanceService.cycleStartDay = 1;
MaintenanceService.dueDay = 7;
MaintenanceService.repairNotificationPrefix = '[repair-request:';
MaintenanceService.requesterRoles = new Set(['resident', 'owner']);
exports.MaintenanceService = MaintenanceService = MaintenanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MaintenanceService);
