import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../types/auth-request';
import { SourceApiService } from './source-api.service';
import { parseMcpConnectionInput } from '../utils/mcp-connection.util';

export type AccountListItem = {
  id: string;
  name: string | null;
  domain: string | null;
  sourceAccountId: string;
  account: {
    id: string;
    title: string;
    domains: string[];
    logo: string | null;
  } | null;
};

type BrandHub = {
  id?: string;
  title?: string;
  logo?: string | null;
  names?: string[];
  domains?: string[];
  about?: string;
  industryCategory?: string;
  subIndustryCategory?: string;
  language?: string;
  targetAudience?: unknown[];
  toneOfVoice?: unknown[];
  values?: unknown[];
  personality?: unknown[];
  keyFeatures?: unknown[];
  knowledgeSources?: unknown[];
  postGuidelines?: { dos: unknown[]; donts: unknown[] };
  brandColors?: unknown[];
  typography?: Record<string, string>;
  socials?: Record<string, unknown>;
  skipPostImages?: boolean;
  generatePostsOnRecommendation?: boolean;
};

type TenantRow = {
  id: string;
  name: string | null;
  domain: string | null;
  source_account_id: string;
  domains: string[] | null;
  logo: string | null;
};

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceApi: SourceApiService,
  ) {}

  async listAccessibleTenants(userId: string, isAdmin: boolean): Promise<AccountListItem[]> {
    let rows: TenantRow[];
    if (isAdmin) {
      rows = await this.prisma.$queryRaw<TenantRow[]>(Prisma.sql`
        SELECT
          t.id,
          t.name,
          t.domain,
          t.source_account_id,
          t.domains,
          t.logo
        FROM whitelabel_tenants t
        WHERE t.enabled = true
        ORDER BY t.name, t.id
      `);
    } else {
      rows = await this.prisma.$queryRaw<TenantRow[]>(Prisma.sql`
        SELECT
          t.id,
          t.name,
          t.domain,
          t.source_account_id,
          t.domains,
          t.logo
        FROM wl_user_tenants ut
        JOIN whitelabel_tenants t ON t.id = ut.tenant_id
        WHERE ut.user_id = ${userId} AND t.enabled = true
        ORDER BY t.name, t.id
      `);
    }

    return rows.map((row) => this.mapTenantRow(row));
  }

  async connectFirstAccount(user: AuthUser, connectionUrl: string): Promise<AccountListItem> {
    const { apiKey, workspaceId } = parseMcpConnectionInput(connectionUrl);
    const brand = await this.fetchBrandHub(workspaceId, apiKey);
    const title = brand?.title || 'Account';
    const domains = Array.isArray(brand?.domains) ? brand.domains : [];
    const domain = domains[0] || null;
    const logo = brand?.logo ?? null;

    const existing = await this.prisma.whitelabelTenant.findUnique({
      where: { source_account_id: workspaceId },
      select: { id: true, name: true, domain: true },
    });

    let tenantId: string;
    if (existing) {
      tenantId = existing.id;
      await this.prisma.whitelabelTenant.update({
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
    } else {
      const inserted = await this.prisma.whitelabelTenant.create({
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
    }

    await this.prisma.wlUserTenant.upsert({
      where: {
        userId_tenantId: { userId: user.id, tenantId },
      },
      create: {
        userId: user.id,
        tenantId,
        role: 'owner',
      },
      update: {},
    });

    const accounts = await this.listAccessibleTenants(user.id, user.isAdmin);
    const created = accounts.find((account) => account.id === tenantId);
    return (
      created ??
      this.mapTenantRow({
        id: tenantId,
        name: title,
        domain,
        source_account_id: workspaceId,
        domains,
        logo,
      })
    );
  }

  private mapTenantRow(row: TenantRow): AccountListItem {
    const domains = row.domains?.length
      ? row.domains
      : row.domain
        ? [row.domain]
        : [];
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      sourceAccountId: row.source_account_id,
      account: {
        id: row.source_account_id,
        title: row.name || '',
        domains,
        logo: row.logo,
      },
    };
  }

  private async fetchBrandHub(accountId: string, apiKey: string): Promise<BrandHub> {
    try {
      console.log(`[source] Fetching BrandHub for account ${accountId}`);
      const account = (await this.sourceApi.sourceGet(
        accountId,
        apiKey,
        `/accounts/${accountId}`,
      )) as BrandHub & { fonts?: Record<string, string> };

      const typography = account.typography || account.fonts || {};
      const normalizedTypography = {
        headlineFont: typography.headlineFont || typography.headline || 'Montserrat',
        bodyFont: typography.bodyFont || typography.body || 'Inter',
        labelFont: typography.labelFont || typography.label || 'Inter',
        headlineWeight: String(
          typography.headlineWeight || typography.headlineFontWeight || '700',
        ),
        bodyWeight: String(typography.bodyWeight || typography.bodyFontWeight || '500'),
        labelWeight: String(typography.labelWeight || typography.labelFontWeight || '600'),
      };

      return {
        id: account.id,
        title: account.title,
        logo: account.logo || null,
        names: account.names || [],
        domains: account.domains || [],
        about: account.about || '',
        industryCategory: account.industryCategory || '',
        subIndustryCategory: account.subIndustryCategory || '',
        language: account.language || 'en-US',
        targetAudience: account.targetAudience || [],
        toneOfVoice: account.toneOfVoice || [],
        values: account.values || [],
        personality: account.personality || [],
        keyFeatures: account.keyFeatures || [],
        knowledgeSources: account.knowledgeSources || [],
        postGuidelines: account.postGuidelines || { dos: [], donts: [] },
        brandColors: account.brandColors || [],
        typography: normalizedTypography,
        socials: account.socials || {},
        skipPostImages: account.skipPostImages || false,
        generatePostsOnRecommendation: account.generatePostsOnRecommendation || false,
      };
    } catch (error) {
      console.error(
        '[source] Error fetching BrandHub:',
        error instanceof Error ? error.message : error,
      );
      throw new Error(
        `Failed to fetch BrandHub data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
