import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      content: string;
      targetRoles?: string[];
      createdByRole?: string;
      createdByName?: string;
    },
  ) {
    return this.announcementsService.createAnnouncement(body);
  }

  @Get()
  async findAll(@Query('role') role?: string) {
    return this.announcementsService.getAnnouncements(role);
  }
}
