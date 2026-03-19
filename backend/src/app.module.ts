import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { VisitorModule } from './visitor/visitor.module';
import { ResidentModule } from './resident/resident.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    AnnouncementsModule,
    MaintenanceModule,
    VisitorModule,
    ResidentModule,
    NotificationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
