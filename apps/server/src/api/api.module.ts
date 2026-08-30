import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsController } from './controllers/accounts.controller';
import { GeoController } from './controllers/geo.controller';
import { TenantController } from './controllers/tenant.controller';
import { TrafficController } from './controllers/traffic.controller';
import { AccountsService } from './services/accounts.service';
import { GeoService } from './services/geo.service';
import { SnapshotsService } from './services/snapshots.service';
import { SourceApiService } from './services/source-api.service';
import { DailyContentModule } from './services/daily-content/daily-content.module';
import { IntegrationsModule } from './services/integrations/integrations.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConfigModule,
    CommonModule,
    DailyContentModule,
    IntegrationsModule,
  ],
  controllers: [
    AccountsController,
    TenantController,
    TrafficController,
    GeoController,
  ],
  providers: [
    SourceApiService,
    SnapshotsService,
    GeoService,
    AccountsService,
  ],
})
export class ApiModule {}
