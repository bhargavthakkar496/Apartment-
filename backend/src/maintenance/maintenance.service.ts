import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async createRequest(description: string, residentId: string) {
    return this.prisma.maintenanceRequest.create({
      data: { description, residentId },
    });
  }

  async getRequests() {
    return this.prisma.maintenanceRequest.findMany();
  }
}