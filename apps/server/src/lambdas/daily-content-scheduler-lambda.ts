import { NestFactory } from '@nestjs/core';
import { Handler } from 'aws-lambda';
import { AppModule } from '../app.module';
import { DailyContentService } from '../api/services/daily-content/daily-content.service';

/**
 * EventBridge cron every 5 minutes: start due tenants + sweep GENERATING runs.
 */
export const handler: Handler = async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const service = app.get(DailyContentService);
    const result = await service.runSchedulerTick(new Date());
    console.log('[daily-content-scheduler]', result);
    return { ok: true, ...result };
  } finally {
    await app.close();
  }
};
