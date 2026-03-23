import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { TeleconsultationService } from './teleconsultation.service';

@Controller('teleconsultation')
export class TeleconsultationController {
  constructor(private teleconsultationService: TeleconsultationService) {}

  @Get('doctors')
  async getDoctors() {
    return this.teleconsultationService.getDoctors();
  }

  @Get('doctors/:id')
  async getDoctor(@Param('id') id: string) {
    return this.teleconsultationService.getDoctorById(id);
  }

  @Post('appointments')
  async bookAppointment(
    @Body()
    body: {
      residentId: string;
      doctorId: string;
      date: string;
      timeSlot: string;
    },
  ) {
    return this.teleconsultationService.bookAppointment(
      body.residentId,
      body.doctorId,
      body.date,
      body.timeSlot,
    );
  }

  @Get('appointments/resident/:residentId')
  async getResidentAppointments(@Param('residentId') residentId: string) {
    return this.teleconsultationService.getResidentAppointments(residentId);
  }

  @Get('appointments/:id')
  async getAppointmentDetails(@Param('id') id: string) {
    return this.teleconsultationService.getAppointmentDetails(id);
  }

  @Get('appointments/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.teleconsultationService.getAppointmentMessages(id);
  }

  @Post('appointments/:id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Body() body: { senderId: string; senderName: string; message: string },
  ) {
    return this.teleconsultationService.saveMessage(
      id,
      body.senderId,
      body.senderName,
      body.message,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('appointments/:id/cancel')
  async cancelAppointment(
    @Param('id') id: string,
    @Body() body: { residentId: string },
  ) {
    return this.teleconsultationService.cancelAppointment(id, body.residentId);
  }
}
