import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ResidentService {
  constructor(private prisma: PrismaService) {}

  async createResident(
    name: string,
    email: string,
    phone: string,
    flatNo: string,
    userId: string,
    societyId?: string,
  ) {
    return this.prisma.resident.create({
      data: { name, email, phone, flatNo, userId, societyId },
    });
  }

  async getResidents() {
    return this.prisma.resident.findMany({
      where: {
        isActive: true,
      },
      include: { society: true },
    });
  }

  async getResidentById(id: string) {
    return this.prisma.resident.findUnique({
      where: { id },
      include: { society: true },
    });
  }

  async moveOutResident(id: string) {
    const residentId = id.trim();
    if (!residentId) {
      throw new BadRequestException('residentId is required');
    }

    const resident = await this.prisma.resident.findUnique({
      where: { id: residentId },
      include: {
        society: true,
      },
    });

    if (!resident) {
      throw new NotFoundException('Resident record was not found');
    }

    if (!resident.isActive) {
      throw new BadRequestException('This apartment association is already inactive.');
    }

    return this.prisma.resident.update({
      where: { id: residentId },
      data: {
        isActive: false,
        movedOutAt: new Date(),
      },
      include: {
        society: true,
      },
    });
  }
}
