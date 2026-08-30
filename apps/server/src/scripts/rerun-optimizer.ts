/**
 * Re-run optimizer on an existing DailyContentRun (after generation already completed).
 * Usage:
 *   cd apps/server && npm run build && \
 *   DAILY_CONTENT_OPTIMIZER_INLINE=true npx dotenv -e .env -- \
 *   node dist/scripts/rerun-optimizer.js <runId>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DailyContentOptimizerService } from '../api/services/daily-content/daily-content-optimizer.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  DAILY_CONTENT_PLATFORMS,
  type PlatformsMap,
} from '../api/services/daily-content/mcp-posts.client';

async function main() {
  const runId = process.argv[2];
  if (!runId) throw new Error('Usage: node dist/scripts/rerun-optimizer.js <runId>');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const prisma = app.get(PrismaService);
    const optimizer = app.get(DailyContentOptimizerService);

    const run = await prisma.dailyContentRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`Run ${runId} not found`);

    const platforms = { ...(run.platforms as PlatformsMap) };
    for (const provider of DAILY_CONTENT_PLATFORMS) {
      const state = platforms[provider];
      if (!state) continue;
      if (state.postIds?.length || state.generationId) {
        state.status = 'GENERATED';
        state.error = null;
      }
    }

    await prisma.dailyContentRun.update({
      where: { id: runId },
      data: {
        status: 'OPTIMIZING',
        error: null,
        completedAt: null,
        platforms: platforms as Prisma.InputJsonValue,
      },
    });

    console.log(`[rerun-optimizer] optimizing ${runId}…`);
    await optimizer.optimizeRun(runId);

    const done = await prisma.dailyContentRun.findUnique({ where: { id: runId } });
    console.log('[rerun-optimizer] final:', {
      status: done?.status,
      error: done?.error,
      platforms: done?.platforms,
    });
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[rerun-optimizer] fatal:', err);
  process.exit(1);
});
