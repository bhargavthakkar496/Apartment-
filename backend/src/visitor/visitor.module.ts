import { Module } from '@nestjs/common';
import { VisitorService } from './visitor.service';
import { VisitorController } from './visitor.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [VisitorController],
  providers: [VisitorService, PrismaService],
})
export class VisitorModule {}