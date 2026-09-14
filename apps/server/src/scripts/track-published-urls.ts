/**
 * One-off local runner for the published URL tracking sweep.
 * Usage:
 *   cd apps/server && npx dotenv -e .env -- node --import tsx src/scripts/track-published-urls.ts \
 *     [--tenant <tenantId>] [--date YYYY-MM-DD]
 *
 * With no --tenant, runs the same tick the cron runs (only tenants at local
 * midnight). With --tenant, sweeps that tenant directly, ignoring the hour gate;
 * --date defaults to the tenant's previous local day.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PublishedUrlTrackerService } from '../api/services/daily-content/published-url-tracker.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  getLocalClock,
  localDateDaysAgo,
} from '../utils/account-local-time.util';

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

async function main() {
  const tenantId = argValue('--tenant');
  const date = argValue('--date');

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`--date must be YYYY-MM-DD, got "${date}"`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const tracker = app.get(PublishedUrlTrackerService);

    if (!tenantId) {
      console.log('[track-published-urls] running full tick');
      const result = await tracker.runTick(new Date());
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    let localDate = date;
    if (!localDate) {
      const prisma = app.get(PrismaService);
      const tenant = await prisma.whitelabelTenant.findUnique({
        where: { id: tenantId },
        select: { dailyContentTimezone: true },
      });
      if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
      const tz = tenant.dailyContentTimezone || 'Asia/Nicosia';
      localDate = localDateDaysAgo(getLocalClock(new Date(), tz).localDate, 1);
    }

    console.log(`[track-published-urls] tenant=${tenantId} date=${localDate}`);
    const result = await tracker.trackTenantDay(tenantId, localDate);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[track-published-urls] fatal:', err);
  process.exit(1);
});
