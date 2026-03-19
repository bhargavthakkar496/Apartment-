import { Controller, Get, Post, Body } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private maintenanceService: MaintenanceService) {}

  @Post()
  async create(@Body() body: { description: string; residentId: string }) {
    return this.maintenanceService.createRequest(body.description, body.residentId);
  }

  @Get()
  async findAll() {
    return this.maintenanceService.getRequests();
  }
}