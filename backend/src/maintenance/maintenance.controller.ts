import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
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

  @Get('resident/:residentId')
  async findResidentRequests(@Param('residentId') residentId: string) {
    return this.maintenanceService.getResidentRequests(residentId);
  }

  @Get('chairman/:residentId/requests')
  async getChairmanRequests(@Param('residentId') residentId: string) {
    return this.maintenanceService.getChairmanRepairRequests(residentId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('chairman/:residentId/requests/:requestId/start')
  async startRequest(
    @Param('residentId') residentId: string,
    @Param('requestId') requestId: string,
    @Body() body: { message?: string },
  ) {
    return this.maintenanceService.startRepairRequest(
      residentId,
      requestId,
      body?.message,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('chairman/:residentId/requests/:requestId/update')
  async updateRequest(
    @Param('residentId') residentId: string,
    @Param('requestId') requestId: string,
    @Body() body: { message: string },
  ) {
    return this.maintenanceService.addRepairRequestUpdate(
      residentId,
      requestId,
      body.message,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('chairman/:residentId/requests/:requestId/resolve')
  async resolveRequest(
    @Param('residentId') residentId: string,
    @Param('requestId') requestId: string,
    @Body() body: { message?: string },
  ) {
    return this.maintenanceService.resolveRepairRequest(
      residentId,
      requestId,
      body?.message,
    );
  }

  @Get('chairman/:residentId/overview')
  async getChairmanOverview(@Param('residentId') residentId: string) {
    return this.maintenanceService.getChairmanOverview(residentId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('chairman/:residentId/payments/:paymentId/collect')
  async markCollected(
    @Param('residentId') residentId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.maintenanceService.markPaymentCollected(residentId, paymentId);
  }

  @Get('chairman/:residentId/payments/:paymentId/whatsapp')
  async getWhatsappPayload(
    @Param('residentId') residentId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.maintenanceService.getPendingWhatsappPayload(
      residentId,
      paymentId,
    );
  }
}
