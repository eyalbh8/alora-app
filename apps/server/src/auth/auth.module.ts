import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { AdminGuard } from './admin.guard';
import { DescopeAuthGuard } from './descope.auth.guard';
import { DescopeService } from './descope.service';
import { TenantGuard } from './tenant.guard';

@Module({
  imports: [ConfigModule],
  providers: [
    ConfigService,
    DescopeService,
    DescopeAuthGuard,
    TenantGuard,
    AdminGuard,
    // Global auth; routes marked @Public() are skipped.
    // TenantGuard is NOT global — apply per-controller when tenant scoping is required.
    {
      provide: APP_GUARD,
      useClass: DescopeAuthGuard,
    },
  ],
  exports: [DescopeService, DescopeAuthGuard, TenantGuard, AdminGuard],
})
export class AuthModule {}
