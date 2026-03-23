import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SocietyController } from './society.controller';
import { SocietyService } from './society.service';

@Module({
  controllers: [SocietyController],
  providers: [SocietyService, PrismaService],
})
export class SocietyModule {}
