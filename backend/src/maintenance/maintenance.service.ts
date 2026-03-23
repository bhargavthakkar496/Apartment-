import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type RepairRequestStatus = 'pending' | 'in_progress' | 'resolved';

@Injectable()
export class MaintenanceService {
  private static readonly monthlyMaintenanceAmount = 1000;
  private static readonly chairmanRole = 'chairman';
  private static readonly hardcodedChairmanWhatsapp = '919879000496';
  private static readonly cycleStartDay = 1;
  private static readonly dueDay = 7;
  private static readonly repairNotificationPrefix = '[repair-request:';
  private static readonly requesterRoles = new Set(['resident', 'owner']);

  constructor(private prisma: PrismaService) {}

  async createRequest(description: string, residentId: string) {
    const normalizedDescription = description?.trim() ?? '';
    const normalizedResidentId = residentId?.trim() ?? '';

    if (!normalizedDescription) {
      throw new BadRequestException('description is required.');
    }

    if (!normalizedResidentId) {
      throw new BadRequestException('residentId is required.');
    }

    const resident = await this.prisma.resident.findUnique({
      where: { id: normalizedResidentId },
      include: {
        user: true,
        society: true,
      },
    });

    if (!resident) {
      throw new NotFoundException('Resident record was not found.');
    }

    if (
      !resident.isActive ||
      !resident.user ||
      !MaintenanceService.requesterRoles.has(resident.user.role)
    ) {
      throw new BadRequestException(
        'Only active tenants and owners can raise repair/problem requests.',
      );
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
      detail:
        'Your repair/problem request has been sent to the chairman for review.',
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
        message:
          'Your repair/problem request has been sent to the chairman for review.',
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async getRequests() {
    return this.prisma.maintenanceRequest.findMany();
  }

  async getResidentRequests(residentId: string) {
    const normalizedResidentId = residentId?.trim() ?? '';
    if (!normalizedResidentId) {
      throw new BadRequestException('residentId is required.');
    }

    const resident = await this.prisma.resident.findUnique({
      where: { id: normalizedResidentId },
    });

    if (!resident) {
      throw new NotFoundException('Resident record was not found.');
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
    const residentNotifications = notificationMap.get(normalizedResidentId) ?? [];

    return requests.map((request) =>
      this.buildRepairRequestResponse(
        request,
        resident.name,
        resident.flatNo,
        residentNotifications
          .filter((notification) => notification.requestId === request.id)
          .map((notification) => ({
            status: notification.status,
            message: notification.message,
            createdAt: notification.createdAt,
          })),
      ),
    );
  }

  async getChairmanRepairRequests(chairmanResidentId: string) {
    const chairmanResident = await this.getValidatedChairmanResident(
      chairmanResidentId,
    );

    const requests = await this.prisma.maintenanceRequest.findMany({
      where: {
        resident: {
          societyId: chairmanResident.societyId!,
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
        const requestNotifications =
          (notificationMap.get(request.residentId) ?? []).filter(
            (notification) => notification.requestId === request.id,
          );
        const view = this.buildRepairRequestResponse(
          request,
          request.resident.name,
          request.resident.flatNo,
          requestNotifications.map((notification) => ({
            status: notification.status,
            message: notification.message,
            createdAt: notification.createdAt,
          })),
        );

        return {
          ...view,
          requesterName: request.resident.name,
          requesterRole:
            request.resident.user.role === 'owner' ? 'Owner' : 'Tenant',
        };
      }),
    };
  }

  async startRepairRequest(
    chairmanResidentId: string,
    requestId: string,
    message?: string,
  ) {
    const request = await this.getChairmanScopedRepairRequest(
      chairmanResidentId,
      requestId,
    );
    const state = await this.getRepairRequestState(request.id, request.residentId);

    if (state.status === 'in_progress') {
      throw new BadRequestException('This repair/problem request is already in progress.');
    }

    if (state.status === 'resolved') {
      throw new BadRequestException('This repair/problem request is already resolved.');
    }

    await this.createResidentRepairNotification({
      residentId: request.residentId,
      requestId: request.id,
      status: 'in_progress',
      detail:
        message?.trim() ||
        'The chairman has started working on your repair/problem request.',
    });

    return this.getResidentRequestById(request.id);
  }

  async addRepairRequestUpdate(
    chairmanResidentId: string,
    requestId: string,
    message: string,
  ) {
    const normalizedMessage = message?.trim() ?? '';
    if (!normalizedMessage) {
      throw new BadRequestException('message is required.');
    }

    const request = await this.getChairmanScopedRepairRequest(
      chairmanResidentId,
      requestId,
    );
    const state = await this.getRepairRequestState(request.id, request.residentId);

    if (state.status === 'resolved') {
      throw new BadRequestException('Resolved repair/problem requests cannot be updated.');
    }

    await this.createResidentRepairNotification({
      residentId: request.residentId,
      requestId: request.id,
      status: 'in_progress',
      detail: normalizedMessage,
    });

    return this.getResidentRequestById(request.id);
  }

  async resolveRepairRequest(
    chairmanResidentId: string,
    requestId: string,
    message?: string,
  ) {
    const request = await this.getChairmanScopedRepairRequest(
      chairmanResidentId,
      requestId,
    );
    const state = await this.getRepairRequestState(request.id, request.residentId);

    if (state.status === 'resolved') {
      throw new BadRequestException('This repair/problem request is already resolved.');
    }

    await this.createResidentRepairNotification({
      residentId: request.residentId,
      requestId: request.id,
      status: 'resolved',
      detail:
        message?.trim() ||
        'Your repair/problem request has been resolved by the chairman.',
    });

    return this.getResidentRequestById(request.id);
  }

  async getChairmanOverview(chairmanResidentId: string) {
    const chairmanResident = await this.getValidatedChairmanResident(
      chairmanResidentId,
    );
    const cycleMonth = this.getCurrentCycleMonth();
    const cycleDates = this.getCycleDates(cycleMonth);

    const apartmentUnits = await this.prisma.apartmentUnit.findMany({
      where: {
        societyId: chairmanResident.societyId!,
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
        maintenancePerApartment: MaintenanceService.monthlyMaintenanceAmount,
        totalApartments: 0,
        collectedApartments: 0,
        pendingApartments: 0,
        overdueApartments: 0,
        totalToBeCollected: 0,
        totalCollected: 0,
        totalPending: 0,
        chairmanWhatsappNumber: MaintenanceService.hardcodedChairmanWhatsapp,
        apartments: [],
      };
    }

    await this.ensureCyclePayments(chairmanResident.societyId!, apartmentUnits, cycleMonth);

    const payments = await this.prisma.maintenancePayment.findMany({
      where: {
        societyId: chairmanResident.societyId!,
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
        societyId: chairmanResident.societyId!,
        isActive: true,
      },
      include: {
        user: true,
      },
    });

    const apartmentContactMap = new Map<
      string,
      {
        phone: string | null;
        name: string | null;
        role: string | null;
      }
    >();

    for (const resident of activeResidents) {
      const existing = apartmentContactMap.get(resident.flatNo);
      const shouldReplace =
        existing == null ||
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
      const contact = apartmentContactMap.get(payment.flatNumber);
      const isCollected = payment.collectedAt != null;
      const status = isCollected
        ? 'collected'
        : this.isOverdueWindowOpen(cycleDates.dueDate)
        ? 'overdue'
        : 'pending';
      const whatsappMessage = this.buildWhatsappMessage({
        societyName: chairmanResident.society!.name,
        status,
      });

      return {
        id: payment.id,
        flatNumber: payment.flatNumber,
        amount: payment.amount,
        status,
        collectedAt: payment.collectedAt,
        contactName: contact?.name ?? null,
        contactPhone: contact?.phone ?? null,
        contactRole: contact?.role ?? null,
        whatsappUrl:
          !isCollected && contact?.phone != null
              ? this.buildWhatsappUrl(contact.phone, whatsappMessage)
              : null,
      };
    });

    const collectedApartments = apartments.filter(
      (item) => item['status'] === 'collected',
    ).length;
    const overdueApartments = apartments.filter(
      (item) => item['status'] === 'overdue',
    ).length;
    const totalApartments = apartments.length;
    const pendingApartments = apartments.filter(
      (item) => item['status'] === 'pending',
    ).length;
    const totalToBeCollected =
      totalApartments * MaintenanceService.monthlyMaintenanceAmount;
    const totalCollected =
      collectedApartments * MaintenanceService.monthlyMaintenanceAmount;

    return {
      society: chairmanResident.society,
      cycleMonth,
      cycleStartDate: cycleDates.startDate.toISOString(),
      dueDate: cycleDates.dueDate.toISOString(),
      isOverdueWindowOpen: this.isOverdueWindowOpen(cycleDates.dueDate),
      maintenancePerApartment: MaintenanceService.monthlyMaintenanceAmount,
      totalApartments,
      collectedApartments,
      pendingApartments,
      overdueApartments,
      totalToBeCollected,
      totalCollected,
      totalPending: totalToBeCollected - totalCollected,
      chairmanWhatsappNumber: MaintenanceService.hardcodedChairmanWhatsapp,
      apartments,
    };
  }

  async markPaymentCollected(chairmanResidentId: string, paymentId: string) {
    const chairmanResident = await this.getValidatedChairmanResident(
      chairmanResidentId,
    );
    const normalizedPaymentId = paymentId.trim();

    const payment = await this.prisma.maintenancePayment.findUnique({
      where: { id: normalizedPaymentId },
    });

    if (!payment || payment.societyId !== chairmanResident.societyId) {
      throw new NotFoundException('Maintenance payment was not found.');
    }

    return this.prisma.maintenancePayment.update({
      where: { id: normalizedPaymentId },
      data: {
        collectedAt: new Date(),
        collectedByResidentId: chairmanResident.id,
      },
    });
  }

  async getPendingWhatsappPayload(chairmanResidentId: string, paymentId: string) {
    const overview = await this.getChairmanOverview(chairmanResidentId);
    const payment = (overview.apartments as Array<Record<string, unknown>>).find(
      (item) => item['id']?.toString() == paymentId.trim(),
    );

    if (!payment) {
      throw new NotFoundException('Maintenance payment was not found.');
    }

    if (payment['status'] == 'collected') {
      throw new BadRequestException('Maintenance is already collected for this apartment.');
    }

    if (payment['whatsappUrl'] == null) {
      throw new BadRequestException('No active contact is available for this apartment.');
    }

    return {
      chairmanWhatsappNumber: MaintenanceService.hardcodedChairmanWhatsapp,
      whatsappUrl: payment['whatsappUrl'],
      flatNumber: payment['flatNumber'],
    };
  }

  private async ensureCyclePayments(
    societyId: string,
    apartmentUnits: Array<{ id: string; flatNumber: string }>,
    cycleMonth: string,
  ) {
    await Promise.all(
      apartmentUnits.map((unit) =>
        this.prisma.maintenancePayment.upsert({
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
            amount: MaintenanceService.monthlyMaintenanceAmount,
          },
        }),
      ),
    );
  }

  private async getValidatedChairmanResident(chairmanResidentId: string) {
    const normalizedResidentId = chairmanResidentId.trim();
    if (!normalizedResidentId) {
      throw new BadRequestException('residentId is required.');
    }

    const resident = await this.prisma.resident.findUnique({
      where: { id: normalizedResidentId },
      include: {
        user: true,
        society: true,
      },
    });

    if (!resident || resident.user.role !== MaintenanceService.chairmanRole) {
      throw new NotFoundException('Chairman record was not found.');
    }

    if (!resident.societyId || !resident.society) {
      throw new BadRequestException('Chairman is not linked to any society.');
    }

    return resident;
  }

  private async getChairmanScopedRepairRequest(
    chairmanResidentId: string,
    requestId: string,
  ) {
    const chairmanResident = await this.getValidatedChairmanResident(
      chairmanResidentId,
    );
    const normalizedRequestId = requestId?.trim() ?? '';

    if (!normalizedRequestId) {
      throw new BadRequestException('requestId is required.');
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

    if (
      !request ||
      request.resident.societyId !== chairmanResident.societyId ||
      !MaintenanceService.requesterRoles.has(request.resident.user.role)
    ) {
      throw new NotFoundException('Repair/problem request was not found.');
    }

    return request;
  }

  private async getRepairRequestState(requestId: string, residentId: string) {
    const residentNotifications =
      (await this.getRepairNotificationMap([residentId])).get(residentId) ?? [];
    const requestNotifications = residentNotifications.filter(
      (notification) => notification.requestId === requestId,
    );
    const latest = requestNotifications[requestNotifications.length - 1];

    return {
      status: latest?.status ?? 'pending',
      updates: requestNotifications.map((notification) => ({
        status: notification.status,
        message: notification.message,
        createdAt: notification.createdAt,
      })),
    };
  }

  private async getResidentRequestById(requestId: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        resident: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Repair/problem request was not found.');
    }

    const state = await this.getRepairRequestState(request.id, request.residentId);
    return this.buildRepairRequestResponse(
      request,
      request.resident.name,
      request.resident.flatNo,
      state.updates,
    );
  }

  private async getRepairNotificationMap(residentIds: string[]) {
    if (residentIds.length === 0) {
      return new Map<
        string,
        Array<{
          requestId: string;
          status: RepairRequestStatus;
          message: string;
          createdAt: string;
        }>
      >();
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

    const notificationMap = new Map<
      string,
      Array<{
        requestId: string;
        status: RepairRequestStatus;
        message: string;
        createdAt: string;
      }>
    >();

    for (const notification of notifications) {
      const parsed = this.parseRepairRequestNotification(notification.message);
      if (!parsed) {
        continue;
      }

      const residentNotifications =
        notificationMap.get(notification.residentId) ?? [];
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

  private buildRepairRequestResponse(
    request: {
      id: string;
      description: string;
      residentId: string;
    },
    residentName: string,
    flatNumber: string,
    updates: Array<{
      status: RepairRequestStatus;
      message: string;
      createdAt: string;
    }>,
  ) {
    const latestUpdate = updates[updates.length - 1] ?? null;

    return {
      id: request.id,
      description: request.description,
      residentId: request.residentId,
      residentName,
      flatNumber,
      status: latestUpdate?.status ?? 'pending',
      submittedAt: updates[0]?.createdAt ?? null,
      latestUpdate: latestUpdate?.message ?? null,
      latestUpdatedAt: latestUpdate?.createdAt ?? null,
      updates,
    };
  }

  private async createResidentRepairNotification(input: {
    residentId: string;
    requestId: string;
    status: RepairRequestStatus;
    detail: string;
  }) {
    await this.prisma.notification.create({
      data: {
        residentId: input.residentId,
        message: this.buildRepairRequestNotificationMessage(input),
        createdAt: new Date(),
      },
    });
  }

  private buildRepairRequestNotificationMessage(input: {
    requestId: string;
    status: RepairRequestStatus;
    detail: string;
  }) {
    return `${MaintenanceService.repairNotificationPrefix}${input.requestId}:${input.status}] ${input.detail}`;
  }

  private parseRepairRequestNotification(message: string): {
    requestId: string;
    status: RepairRequestStatus;
    detail: string;
  } | null {
    const match = /^\[repair-request:([^:\]]+):(pending|in_progress|resolved)\]\s*(.*)$/i.exec(
      message,
    );

    if (!match) {
      return null;
    }

    return {
      requestId: match[1],
      status: match[2] as RepairRequestStatus,
      detail: match[3] || 'Repair/problem request updated.',
    };
  }

  private async notifyChairmanAboutRepairRequest(input: {
    requestId: string;
    residentName: string;
    flatNo: string;
    societyId: string;
    societyName: string;
    description: string;
  }) {
    const chairmen = await this.prisma.resident.findMany({
      where: {
        societyId: input.societyId,
        isActive: true,
        user: {
          role: MaintenanceService.chairmanRole,
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

  private getCurrentCycleMonth() {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }

  private getCycleDates(cycleMonth: string) {
    const [yearText, monthText] = cycleMonth.split('-');
    const year = Number.parseInt(yearText, 10);
    const monthIndex = Number.parseInt(monthText, 10) - 1;
    const startDate = new Date(year, monthIndex, MaintenanceService.cycleStartDay);
    const dueDate = new Date(year, monthIndex, MaintenanceService.dueDay, 23, 59, 59, 999);

    return {
      startDate,
      dueDate,
    };
  }

  private isOverdueWindowOpen(dueDate: Date) {
    return Date.now() > dueDate.getTime();
  }

  private buildWhatsappMessage(input: {
    societyName: string;
    status: string;
  }) {
    if (input.status === 'overdue') {
      return `Maintenance fee for your apartment in ${input.societyName} is Overdue since 8th of the current month. Penalty of Rs 10 / day will be charged now. Please clear the dues immedietly to avoid penalty. Thank you for your attention to this matter.`;
    }

    return `Maintenance fee for your apartment in ${input.societyName} is pending. Please clear the dues by 7th of the month. Thank you for your attention to this matter.`;
  }

  private buildWhatsappUrl(phone: string, message: string) {
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  }
}
