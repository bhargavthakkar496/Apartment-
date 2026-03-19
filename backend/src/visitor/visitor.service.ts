import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class VisitorService {
  constructor(private prisma: PrismaService) {}

  async logVisitor(name: string, purpose: string, residentId: string) {
    return this.prisma.visitor.create({
      data: { name, purpose, residentId },
    });
  }

  async getVisitors() {
    return this.prisma.visitor.findMany();
  }
}