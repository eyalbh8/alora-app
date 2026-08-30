/**
 * One-off local runner for daily content automation.
 * Usage:
 *   cd apps/server && npx dotenv -e .env -- node --import tsx src/scripts/run-daily-content.ts [tenantId]
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DailyContentService } from '../api/services/daily-content/daily-content.service';
import { DailyContentOptimizerService } from '../api/services/daily-content/daily-content-optimizer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '../config/config.service';
import { SourceApiService } from '../api/services/source-api.service';
import { getMcpUrl, callMcpTool } from '../api/utils/mcp-connection.util';

const DEFAULT_TENANT = '18ea393e-8109-46a8-8dc6-4380cab56c97'; // Casinocom
const POLL_MS = 20_000;
const MAX_WAIT_MS = 25 * 60_000;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const tenantId = process.argv[2] || DEFAULT_TENANT;
  console.log(`[run-daily-content] tenant=${tenantId}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const daily = app.get(DailyContentService);
    const optimizer = app.get(DailyContentOptimizerService);
    const prisma = app.get(PrismaService);
    const config = app.get(ConfigService);
    const sourceApi = app.get(SourceApiService);

    const tenant = await prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant?.mcp_api_key) {
      throw new Error('Tenant missing or has no mcp_api_key');
    }

    const mcpUrl = getMcpUrl(config, sourceApi.getSourceApiBase() || 'https://api.igeo.ai');
    console.log(`[run-daily-content] mcpUrl=${mcpUrl}`);
    console.log(`[run-daily-content] sourceApiBase=${sourceApi.getSourceApiBase()}`);
    console.log(
      `[run-daily-content] openai=${config.openaiApiKey ? 'set' : 'missing'} anthropic=${config.anthropicApiKey ? 'set' : 'missing'}`,
    );

    try {
      const tools = await callMcpTool(
        mcpUrl,
        tenant.source_account_id,
        tenant.mcp_api_key,
        // tools/list is RPC method, not a tool — probe via create_post-related discovery
        'api_get',
        { path: `/accounts/${tenant.source_account_id}` },
      );
      const title = (tools as { title?: string })?.title;
      console.log(`[run-daily-content] BrandHub OK title=${title ?? '(unknown)'}`);
    } catch (err) {
      console.warn(
        `[run-daily-content] BrandHub probe failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    const start = await daily.forceStartForTenant(tenantId);
    console.log('[run-daily-content] forceStart:', start);

    if (!start.runId) {
      throw new Error('No run created');
    }

    if (start.status === 'SKIPPED') {
      console.log(`[run-daily-content] skipped: ${start.skipReason}`);
      return;
    }

    const runId = start.runId;
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      const sweep = await daily.runSweepPass(new Date());
      console.log('[run-daily-content] sweep:', sweep);

      const run = await prisma.dailyContentRun.findUnique({ where: { id: runId } });
      console.log(
        `[run-daily-content] status=${run?.status} platforms=`,
        JSON.stringify(run?.platforms, null, 2),
      );

      if (!run) throw new Error('Run disappeared');

      if (run.status === 'OPTIMIZING' || run.status === 'PARTIAL') {
        // Local: optimizer Lambda is not available — run inline
        if (
          run.status === 'OPTIMIZING' ||
          (run.status === 'PARTIAL' &&
            Object.values((run.platforms as object) || {}).some(
              (p: { status?: string }) => p?.status === 'GENERATED',
            ))
        ) {
          console.log('[run-daily-content] running optimizer inline…');
          await optimizer.optimizeRun(runId);
          const done = await prisma.dailyContentRun.findUnique({ where: { id: runId } });
          console.log('[run-daily-content] final:', {
            status: done?.status,
            error: done?.error,
            platforms: done?.platforms,
          });
          return;
        }
      }

      if (['COMPLETED', 'FAILED', 'SKIPPED'].includes(run.status)) {
        console.log('[run-daily-content] finished early:', run.status, run.error);
        return;
      }

      // If sweep flipped to OPTIMIZING but invoke failed and marked FAILED
      if (run.status === 'FAILED' && /Optimizer invoke failed/i.test(run.error || '')) {
        console.log('[run-daily-content] recovering from failed Lambda invoke — optimizing inline');
        await prisma.dailyContentRun.update({
          where: { id: runId },
          data: { status: 'OPTIMIZING', error: null },
        });
        await optimizer.optimizeRun(runId);
        const done = await prisma.dailyContentRun.findUnique({ where: { id: runId } });
        console.log('[run-daily-content] final:', {
          status: done?.status,
          error: done?.error,
          platforms: done?.platforms,
        });
        return;
      }

      console.log(`[run-daily-content] waiting ${POLL_MS / 1000}s for generations…`);
      await sleep(POLL_MS);
    }

    console.error('[run-daily-content] timed out waiting for generations');
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[run-daily-content] fatal:', err);
  process.exit(1);
});
