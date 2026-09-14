import { NestFactory } from '@nestjs/core';
import { Handler } from 'aws-lambda';
import { AppModule } from '../app.module';
import { PublishedUrlTrackerService } from '../api/services/daily-content/published-url-tracker.service';

/**
 * EventBridge cron every hour: for tenants whose local clock just passed
 * midnight, track the day's published post URLs against their iGEO posts.
 */
export const handler: Handler = async () => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const tracker = app.get(PublishedUrlTrackerService);
    const { tenants, linked, results } = await tracker.runTick(new Date());
    console.log('[published-url-tracker]', JSON.stringify({ tenants, linked, results }));
    return { ok: true, tenants, linked };
  } finally {
    await app.close();
  }
};
