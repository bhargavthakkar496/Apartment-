import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ResidentService {
  constructor(private prisma: PrismaService) {}

  async createResident(name: string, email: string, phone: string, flatNo: string, userId: string) {
    return this.prisma.resident.create({
      data: { name, email, phone, flatNo, userId },
    });
  }

  async getResidents() {
    return this.prisma.resident.findMany();
  }
}