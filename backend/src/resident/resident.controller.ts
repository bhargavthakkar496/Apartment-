import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ResidentService } from './resident.service';

@Controller('resident')
export class ResidentController {
  constructor(private residentService: ResidentService) {}

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      email: string;
      phone: string;
      flatNo: string;
      userId: string;
      societyId?: string;
    },
  ) {
    return this.residentService.createResident(
      body.name,
      body.email,
      body.phone,
      body.flatNo,
      body.userId,
      body.societyId,
    );
  }

  @Get()
  async findAll() {
    return this.residentService.getResidents();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.residentService.getResidentById(id);
  }

  @Post(':id/move-out')
  async moveOut(@Param('id') id: string) {
    return this.residentService.moveOutResident(id);
  }
}
