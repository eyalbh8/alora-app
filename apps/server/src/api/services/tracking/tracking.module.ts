import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../../../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TrackingController } from '../../controllers/tracking.controller';
import { AnalyticsService } from './analytics.service';
import { TrackingService } from './tracking.service';

/**
 * First-party AI traffic tracking: public ingest plus dashboard aggregation.
 *
 * ThrottlerModule is registered here rather than globally so only the ingest
 * routes are rate limited. On Lambda the default in-memory store is per
 * container, which makes the limit best-effort rather than exact.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ThrottlerModule.forRoot([{ limit: 1000, ttl: 900_000 }]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService, AnalyticsService],
  exports: [TrackingService, AnalyticsService],
})
export class TrackingModule {}
