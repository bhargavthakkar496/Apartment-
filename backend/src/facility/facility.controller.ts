import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { FacilityService } from './facility.service';

@Controller('facility')
export class FacilityController {
  constructor(private facilityService: FacilityService) {}

  @Post('book')
  async book(
    @Body()
    body: {
      facilityId: string;
      residentId: string;
      bookingDate: string;
      timeSlot?: string;
    },
  ) {
    return this.facilityService.bookFacility(
      body.facilityId,
      body.residentId,
      body.bookingDate,
      body.timeSlot,
    );
  }

  @Get('bookings')
  async findAllBookings() {
    return this.facilityService.getBookings();
  }

  @Get('resident/:residentId/bookings')
  async getResidentBookings(@Param('residentId') residentId: string) {
    return this.facilityService.getResidentBookings(residentId);
  }

  @Get('availability')
  async getAvailability(
    @Query('facilityId') facilityId: string,
    @Query('bookingDate') bookingDate: string,
    @Query('timeSlot') timeSlot?: string,
  ) {
    return this.facilityService.getAvailability(
      facilityId,
      bookingDate,
      timeSlot,
    );
  }

  @Get('available')
  async findAvailableFacilities() {
    return this.facilityService.getAvailableFacilities();
  }

  @Get('chairman/:residentId/requests')
  async getChairmanRequests(@Param('residentId') residentId: string) {
    return this.facilityService.getChairmanAmenityRequests(residentId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('chairman/:residentId/requests/:bookingId/approve')
  async approveRequest(
    @Param('residentId') residentId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.facilityService.approveBooking(residentId, bookingId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('chairman/:residentId/requests/:bookingId/reject')
  async rejectRequest(
    @Param('residentId') residentId: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.facilityService.rejectBooking(residentId, bookingId);
  }
}
