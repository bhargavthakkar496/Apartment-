import { Controller, Get, Post, Body } from '@nestjs/common';
import { ResidentService } from './resident.service';

@Controller('resident')
export class ResidentController {
  constructor(private residentService: ResidentService) {}

  @Post()
  async create(@Body() body: { name: string; email: string; phone: string; flatNo: string; userId: string }) {
    return this.residentService.createResident(body.name, body.email, body.phone, body.flatNo, body.userId);
  }

  @Get()
  async findAll() {
    return this.residentService.getResidents();
  }
}