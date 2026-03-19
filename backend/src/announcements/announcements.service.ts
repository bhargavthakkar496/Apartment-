import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async createAnnouncement(title: string, content: string) {
    return this.prisma.announcement.create({
      data: { title, content },
    });
  }

  async getAnnouncements() {
    return this.prisma.announcement.findMany();
  }
}