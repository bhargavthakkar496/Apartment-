"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("./auth/auth.module");
const announcements_module_1 = require("./announcements/announcements.module");
const maintenance_module_1 = require("./maintenance/maintenance.module");
const visitor_module_1 = require("./visitor/visitor.module");
const resident_module_1 = require("./resident/resident.module");
const notifications_module_1 = require("./notifications/notifications.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            announcements_module_1.AnnouncementsModule,
            maintenance_module_1.MaintenanceModule,
            visitor_module_1.VisitorModule,
            resident_module_1.ResidentModule,
            notifications_module_1.NotificationsModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
