/**
 * Upsert a whitelabel tenant from SOURCE workspace + MCP API key.
 *
 * Usage:
 *   WORKSPACE_ID=... API_KEY=... npx ts-node -r dotenv/config src/scripts/add-account.ts
 *
 * Optional: LINK_USER_EMAIL=someone@example.com (defaults to all admin users)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type BrandHub = {
  title?: string;
  logo?: string | null;
  domains?: string[];
};

async function fetchBrandHub(accountId: string, apiKey: string): Promise<BrandHub> {
  const base = process.env.SOURCE_API_BASE || 'https://api.igeo.ai';
  const res = await fetch(`${base}/accounts/${accountId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Workspace-Id': accountId,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`BrandHub fetch failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as BrandHub;
}

async function main() {
  const workspaceId = (process.env.WORKSPACE_ID || '').trim().toLowerCase();
  const apiKey = (process.env.API_KEY || '').trim();
  const linkEmail = (process.env.LINK_USER_EMAIL || '').trim().toLowerCase();

  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    throw new Error('WORKSPACE_ID must be a UUID');
  }
  if (!apiKey || !apiKey.includes('_live_')) {
    throw new Error('API_KEY must be a live MCP key');
  }

  console.log(`Fetching BrandHub for workspace ${workspaceId}…`);
  const brand = await fetchBrandHub(workspaceId, apiKey);
  const title = brand.title || 'Account';
  const domains = Array.isArray(brand.domains) ? brand.domains : [];
  const domain = domains[0] || null;
  const logo = brand.logo ?? null;

  const existing = await prisma.whitelabelTenant.findUnique({
    where: { source_account_id: workspaceId },
    select: { id: true, name: true, domain: true },
  });

  let tenantId: string;
  if (existing) {
    tenantId = existing.id;
    await prisma.whitelabelTenant.update({
      where: { id: tenantId },
      data: {
        mcp_api_key: apiKey,
        enabled: true,
        name: existing.name || title,
        domain: existing.domain || domain,
        domains,
        logo,
      },
    });
    console.log(`Updated existing tenant ${tenantId} (${title})`);
  } else {
    const inserted = await prisma.whitelabelTenant.create({
      data: {
        name: title,
        domain,
        domains,
        logo,
        source_account_id: workspaceId,
        enabled: true,
        mcp_api_key: apiKey,
      },
      select: { id: true },
    });
    tenantId = inserted.id;
    console.log(`Created tenant ${tenantId} (${title})`);
  }

  const users = linkEmail
    ? await prisma.wlUser.findMany({ where: { email: linkEmail }, select: { id: true, email: true } })
    : await prisma.wlUser.findMany({ where: { isAdmin: true }, select: { id: true, email: true } });

  if (users.length === 0) {
    console.warn('No users to link; tenant created but not assigned.');
  } else {
    for (const user of users) {
      await prisma.wlUserTenant.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        create: { userId: user.id, tenantId, role: 'owner' },
        update: {},
      });
      console.log(`Linked user ${user.email} → tenant ${tenantId}`);
    }
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
