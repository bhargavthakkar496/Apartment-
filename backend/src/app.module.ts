import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { VisitorModule } from './visitor/visitor.module';
import { ResidentModule } from './resident/resident.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SocietyModule } from './society/society.module';
import { FacilityModule } from './facility/facility.module';
import { TeleconsultationModule } from './teleconsultation/teleconsultation.module';

@Module({
  imports: [
    AuthModule,
    AnnouncementsModule,
    MaintenanceModule,
    VisitorModule,
    ResidentModule,
    NotificationsModule,
    SocietyModule,
    FacilityModule,
    TeleconsultationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
