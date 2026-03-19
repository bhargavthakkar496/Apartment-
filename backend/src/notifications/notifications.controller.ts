import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('create')
  async create(@Body() body: { residentId: string; message: string }) {
    return this.notificationsService.createNotification(body.residentId, body.message);
  }

  @Get(':residentId')
  async getNotifications(@Param('residentId') residentId: string) {
    return this.notificationsService.getNotifications(residentId);
  }
}