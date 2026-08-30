import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConfigModule } from '../../../config/config.module';
import { AuthModule } from '../../../auth/auth.module';
import { SourceApiService } from '../source-api.service';
import { DailyContentService } from './daily-content.service';
import { DailyContentOptimizerService } from './daily-content-optimizer.service';
import { DailyContentLlmService } from './daily-content-llm.service';
import { DailyContentController } from '../../controllers/daily-content.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
    forwardRef(() => IntegrationsModule),
  ],
  controllers: [DailyContentController],
  providers: [
    SourceApiService,
    DailyContentLlmService,
    DailyContentService,
    DailyContentOptimizerService,
  ],
  exports: [DailyContentService, DailyContentOptimizerService],
})
export class DailyContentModule {}
