import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(residentId: string, message: string) {
    return this.prisma.notification.create({
      data: { residentId, message, createdAt: new Date() },
    });
  }

  async getNotifications(residentId: string) {
    return this.prisma.notification.findMany({
      where: { residentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}