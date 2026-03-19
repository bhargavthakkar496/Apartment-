import { Controller, Get, Post, Body } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Post()
  async create(@Body() body: { title: string; content: string }) {
    return this.announcementsService.createAnnouncement(body.title, body.content);
  }

  @Get()
  async findAll() {
    return this.announcementsService.getAnnouncements();
  }
}