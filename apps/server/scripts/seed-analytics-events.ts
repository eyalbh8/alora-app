/**
 * One-off seed for manual dashboard verification.
 * Usage: cd apps/server && npx dotenv -e .env -- node --import tsx scripts/seed-analytics-events.ts
 */
import { PrismaClient } from '@prisma/client';

const TENANT_ID = '92d99e94-a267-4b4e-99ba-eabc25f4abd1';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(14, 30, 0, 0);
  return d;
}

async function main() {
  const prisma = new PrismaClient();

  const tenant = await prisma.whitelabelTenant.findUnique({
    where: { id: TENANT_ID },
    select: { id: true, name: true, domain: true, domains: true, enabled: true },
  });

  if (!tenant) {
    console.error(`Tenant ${TENANT_ID} not found in whitelabel_tenants.`);
    process.exit(1);
  }

  console.log('Tenant:', tenant);

  const samples = [
    {
      timestamp: daysAgo(1),
      url: 'https://example.com/pricing',
      path: '/pricing',
      referrer: 'https://chatgpt.com/c/abc',
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      source: 'USER',
      provider: 'OPENAI',
      browser: 'Chrome',
      os: 'macOS',
      device: 'desktop',
      country: 'US',
    },
    {
      timestamp: daysAgo(2),
      url: 'https://example.com/blog/ai-seo',
      path: '/blog/ai-seo',
      referrer: null,
      utmSource: 'claude',
      utmMedium: 'ai-chat',
      userAgent: 'Mozilla/5.0 Safari/605.1',
      source: 'USER',
      provider: 'ANTHROPIC',
      browser: 'Safari',
      os: 'iOS',
      device: 'mobile',
      country: 'IL',
    },
    {
      timestamp: daysAgo(3),
      url: 'https://example.com/',
      path: '/',
      referrer: 'https://www.perplexity.ai/search/test',
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      source: 'USER',
      provider: 'PERPLEXITY',
      browser: 'Chrome',
      os: 'Windows',
      device: 'desktop',
      country: 'US',
    },
    {
      timestamp: daysAgo(0),
      url: 'https://example.com/docs',
      path: '/docs',
      referrer: 'https://copilot.microsoft.com/',
      userAgent: 'Mozilla/5.0 Edge/120.0',
      source: 'USER',
      provider: 'BD_COPILOT',
      browser: 'Edge',
      os: 'Windows',
      device: 'desktop',
      country: 'DE',
    },
    {
      timestamp: daysAgo(1),
      url: 'https://example.com/features',
      path: '/features',
      referrer: 'https://gemini.google.com/app',
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      source: 'USER',
      provider: 'GEMINI',
      browser: 'Chrome',
      os: 'macOS',
      device: 'desktop',
      country: 'US',
    },
  ];

  const created = await prisma.analyticsEvent.createMany({
    data: samples.map((row) => ({
      tenantId: TENANT_ID,
      trackerVersion: 'v1',
      timestamp: row.timestamp,
      url: row.url,
      path: row.path,
      referrer: row.referrer,
      userAgent: row.userAgent,
      source: row.source,
      botName: null,
      provider: row.provider,
      utmSource: row.utmSource ?? null,
      utmMedium: row.utmMedium ?? null,
      utmCampaign: null,
      browser: row.browser,
      os: row.os,
      device: row.device,
      screen: '1920x1080',
      platform: null,
      language: 'en-US',
      country: row.country,
      city: null,
      region: null,
      ip: null,
    })),
  });

  const total = await prisma.analyticsEvent.count({ where: { tenantId: TENANT_ID } });
  console.log(`Inserted ${created.count} rows. Tenant total events: ${total}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
