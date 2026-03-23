import { Module } from '@nestjs/common';
import { TeleconsultationController } from './teleconsultation.controller';
import { TeleconsultationService } from './teleconsultation.service';
import { TeleconsultationGateway } from './teleconsultation.gateway';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TeleconsultationController],
  providers: [TeleconsultationService, TeleconsultationGateway, PrismaService],
})
export class TeleconsultationModule {}
