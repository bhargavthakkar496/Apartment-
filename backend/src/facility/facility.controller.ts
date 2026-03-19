import { Controller, Get, Post, Body } from '@nestjs/common';
import { FacilityService } from './facility.service';

@Controller('facility')
export class FacilityController {
  constructor(private facilityService: FacilityService) {}

  @Post('book')
  async book(@Body() body: { facilityId: string; residentId: string; date: string }) {
    return this.facilityService.bookFacility(body.facilityId, body.residentId, body.date);
  }

  @Get('bookings')
  async findAllBookings() {
    return this.facilityService.getBookings();
  }

  @Get('available')
  async findAvailableFacilities() {
    return this.facilityService.getAvailableFacilities();
  }
}