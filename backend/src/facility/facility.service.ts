import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FacilityService {
  constructor(private prisma: PrismaService) {}

  async bookFacility(facilityId: string, residentId: string, date: string) {
    return this.prisma.booking.create({
      data: { facilityId, residentId, date: new Date(date) },
    });
  }

  async getBookings() {
    return this.prisma.booking.findMany({
      include: { facility: true, resident: true },
    });
  }

  async getAvailableFacilities() {
    return this.prisma.facility.findMany();
  }
}