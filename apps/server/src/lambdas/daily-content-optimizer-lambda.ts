import { NestFactory } from '@nestjs/core';
import { Handler } from 'aws-lambda';
import { AppModule } from '../app.module';
import { DailyContentOptimizerService } from '../api/services/daily-content/daily-content-optimizer.service';

type OptimizerEvent = { runId?: string };

/**
 * Async optimizer invoked by the scheduler when a run is ready.
 */
export const handler: Handler = async (event: OptimizerEvent) => {
  const runId = event?.runId;
  if (!runId) {
    console.error('[daily-content-optimizer] missing runId');
    return { ok: false, error: 'missing runId' };
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const optimizer = app.get(DailyContentOptimizerService);
    await optimizer.optimizeRun(runId);
    return { ok: true, runId };
  } finally {
    await app.close();
  }
};
