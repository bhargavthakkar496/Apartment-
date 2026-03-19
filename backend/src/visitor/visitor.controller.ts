import { Controller, Get, Post, Body } from '@nestjs/common';
import { VisitorService } from './visitor.service';

@Controller('visitor')
export class VisitorController {
  constructor(private visitorService: VisitorService) {}

  @Post()
  async log(@Body() body: { name: string; purpose: string; residentId: string }) {
    return this.visitorService.logVisitor(body.name, body.purpose, body.residentId);
  }

  @Get()
  async findAll() {
    return this.visitorService.getVisitors();
  }
}