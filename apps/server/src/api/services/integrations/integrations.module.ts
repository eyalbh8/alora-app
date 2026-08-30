import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConfigModule } from '../../../config/config.module';
import { AuthModule } from '../../../auth/auth.module';
import { SourceApiService } from '../source-api.service';
import { ZernioService } from './zernio.service';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from '../../controllers/integrations.controller';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [IntegrationsController],
  providers: [SourceApiService, ZernioService, IntegrationsService],
  exports: [IntegrationsService, ZernioService],
})
export class IntegrationsModule {}
