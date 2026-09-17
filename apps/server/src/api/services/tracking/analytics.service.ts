import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DASHBOARD_PROVIDERS,
  normalizeProviderCode,
  providerLabel,
} from '../../../utils/ai-signals.util';

export interface AiTrafficAggregateOptions {
  /** Provider codes to restrict to. Empty means all dashboard providers. */
  providers?: string[];
  /** Lowercased country codes to restrict to. Empty means all. */
  countries?: string[];
}

interface ProviderRow {
  domain: string;
  provider: string;
  visits: number;
  changePercent: number;
}

interface HistoricalRow {
  domain: string;
  provider: string;
  historicalData: Array<{ date: string; value: number }>;
}

export interface AiTrafficAggregates {
  hasEvents: boolean;
  totalEntries: number;
  totalChange: number;
  llmProviders: ProviderRow[];
  historicalData: HistoricalRow[];
  topSources: Array<{ source: string; visitors: number }>;
  topPages: Array<{ page: string; visitors: number }>;
  topLocations: Array<{ country: string; countryCode: string; visitors: number }>;
  topDevices: Array<{ device: string; visitors: number }>;
  topBrowsers: Array<{ browser: string; visitors: number }>;
  availableCountries: Array<{ value: string; label: string; count: number }>;
}

const BREAKDOWN_LIMIT = 20;

/**
 * Builds the AI Traffic dashboard payload from first-party `analytics_events`.
 *
 * The output deliberately matches the `AiTrafficPayload` contract the client
 * already parses in lib/snapshots/aiTraffic.ts, so the screen renders without
 * any changes to the view model.
 *
 * Aggregates cover DASHBOARD_PROVIDERS only. Events attributed to other
 * providers (Grok, DeepSeek, Meta AI) are still stored, but including them here
 * would make the breakdowns sum to more than the provider cards, since the
 * client derives "Total entries" from the five providers it renders.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasEvents(tenantId: string): Promise<boolean> {
    const found = await this.prisma.analyticsEvent.findFirst({
      where: { tenantId },
      select: { id: true },
    });
    return Boolean(found);
  }

  async getAiDashboardAggregates(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    prevStartDate: Date,
    prevEndDate: Date,
    options: AiTrafficAggregateOptions = {},
  ): Promise<AiTrafficAggregates> {
    const providers = this.resolveProviders(options.providers);
    const countries = (options.countries ?? [])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const current = this.where(tenantId, startDate, endDate, providers, countries);
    const previous = this.where(tenantId, prevStartDate, prevEndDate, providers, countries);

    const [
      hasEvents,
      currentCounts,
      previousCounts,
      historical,
      topSources,
      topPages,
      topLocations,
      topDevices,
      topBrowsers,
    ] = await Promise.all([
      this.hasEvents(tenantId),
      this.countByProvider(current),
      this.countByProvider(previous),
      this.dailyCountsByProvider(tenantId, startDate, endDate, providers, countries),
      this.topReferrerHosts(tenantId, startDate, endDate, providers, countries),
      this.countByColumn(current, 'path'),
      this.countByColumn(current, 'country'),
      this.countByColumn(current, 'device'),
      this.countByColumn(current, 'browser'),
    ]);

    const llmProviders = this.buildProviderRows(providers, currentCounts, previousCounts);
    const total = llmProviders.find((row) => row.provider === 'TOTAL');

    return {
      hasEvents,
      totalEntries: total?.visits ?? 0,
      totalChange: total?.changePercent ?? 0,
      llmProviders,
      historicalData: this.buildHistoricalRows(providers, historical),
      topSources,
      topPages: topPages.map((row) => ({ page: row.label, visitors: row.visitors })),
      topLocations: topLocations.map((row) => ({
        country: row.label,
        countryCode: row.label.toLowerCase(),
        visitors: row.visitors,
      })),
      topDevices: topDevices.map((row) => ({ device: row.label, visitors: row.visitors })),
      topBrowsers: topBrowsers.map((row) => ({ browser: row.label, visitors: row.visitors })),
      availableCountries: topLocations.map((row) => ({
        value: row.label.toLowerCase(),
        label: row.label.toUpperCase(),
        count: row.visitors,
      })),
    };
  }

  /** Intersect any requested providers with the set the dashboard can render. */
  private resolveProviders(requested?: string[]): string[] {
    const normalized = (requested ?? [])
      .map((value) => normalizeProviderCode(value))
      .filter((value) => DASHBOARD_PROVIDERS.includes(value as never));

    return normalized.length > 0 ? [...new Set(normalized)] : [...DASHBOARD_PROVIDERS];
  }

  private where(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    providers: string[],
    countries: string[],
  ): Prisma.AnalyticsEventWhereInput {
    return {
      tenantId,
      timestamp: { gte: startDate, lte: endDate },
      provider: { in: providers },
      ...(countries.length > 0
        ? { country: { in: countries, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };
  }

  private async countByProvider(
    where: Prisma.AnalyticsEventWhereInput,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['provider'],
      where,
      _count: { _all: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.provider) counts.set(row.provider, row._count._all);
    }
    return counts;
  }

  /** Group a text column, dropping blank values and sorting by row count desc. */
  private async countByColumn(
    where: Prisma.AnalyticsEventWhereInput,
    column: 'path' | 'country' | 'device' | 'browser',
  ): Promise<Array<{ label: string; visitors: number }>> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: [column],
      where,
      _count: { _all: true },
      // Ordered by the count of a non-null column so this is a true row count
      // whether or not `column` itself is nullable.
      orderBy: { _count: { id: 'desc' } },
      // Null and empty groups are dropped below, so over-fetch slightly.
      take: BREAKDOWN_LIMIT + 2,
    });

    return rows
      .map((row) => ({
        label: String(row[column] ?? '').trim(),
        visitors: row._count._all,
      }))
      .filter((row) => row.label.length > 0)
      .slice(0, BREAKDOWN_LIMIT);
  }

  /**
   * Daily per-provider counts. Needs raw SQL because Prisma cannot group by a
   * truncated timestamp. Bucketed in UTC so buckets do not shift with the
   * database session timezone.
   */
  private async dailyCountsByProvider(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    providers: string[],
    countries: string[],
  ): Promise<Array<{ provider: string; date: string; count: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ provider: string; date: string; count: bigint }>
    >`
      SELECT
        provider,
        to_char((timestamp AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS date,
        COUNT(*)::bigint AS count
      FROM analytics_events
      WHERE tenant_id = ${tenantId}::uuid
        AND timestamp >= ${startDate}
        AND timestamp <= ${endDate}
        AND provider = ANY(${providers}::text[])
        ${this.countryFilter(countries)}
      GROUP BY provider, 2
      ORDER BY 2 ASC
    `;

    return rows.map((row) => ({
      provider: row.provider,
      date: row.date,
      count: Number(row.count),
    }));
  }

  /**
   * Top referring hosts. Raw SQL so the hostname can be extracted from the
   * stored referrer; the tracker records the referrer verbatim.
   */
  private async topReferrerHosts(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    providers: string[],
    countries: string[],
  ): Promise<Array<{ source: string; visitors: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ source: string; visitors: bigint }>>`
      SELECT source, SUM(cnt)::bigint AS visitors
      FROM (
        SELECT
          regexp_replace(
            lower(split_part(regexp_replace(referrer, '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''), '/', 1)),
            '^www\\.|:[0-9]+$',
            '',
            'g'
          ) AS source,
          COUNT(*)::bigint AS cnt
        FROM analytics_events
        WHERE tenant_id = ${tenantId}::uuid
          AND timestamp >= ${startDate}
          AND timestamp <= ${endDate}
          AND provider = ANY(${providers}::text[])
          AND referrer IS NOT NULL
          AND btrim(referrer) <> ''
          ${this.countryFilter(countries)}
        GROUP BY 1
      ) hosts
      WHERE source IS NOT NULL AND source <> ''
      GROUP BY source
      ORDER BY visitors DESC
      LIMIT ${BREAKDOWN_LIMIT}
    `;

    return rows.map((row) => ({ source: row.source, visitors: Number(row.visitors) }));
  }

  private countryFilter(countries: string[]): Prisma.Sql {
    if (countries.length === 0) return Prisma.empty;
    return Prisma.sql`AND country IS NOT NULL AND lower(country) = ANY(${countries}::text[])`;
  }

  /**
   * Emit one row per provider plus a leading TOTAL row.
   *
   * The client skips aggregate rows when building its provider cards but reads
   * TOTAL for the "Total entries" change percentage, so both are required.
   */
  private buildProviderRows(
    providers: string[],
    current: Map<string, number>,
    previous: Map<string, number>,
  ): ProviderRow[] {
    const rows = providers.map((provider) => {
      const visits = current.get(provider) ?? 0;
      return {
        domain: providerLabel(provider),
        provider,
        visits,
        changePercent: this.changePercent(visits, previous.get(provider) ?? 0),
      };
    });

    const totalVisits = rows.reduce((sum, row) => sum + row.visits, 0);
    const totalPrevious = providers.reduce(
      (sum, provider) => sum + (previous.get(provider) ?? 0),
      0,
    );

    const totalRow: ProviderRow = {
      domain: 'ALL_ENTRIES',
      provider: 'TOTAL',
      visits: totalVisits,
      changePercent: this.changePercent(totalVisits, totalPrevious),
    };

    return [totalRow, ...rows.sort((a, b) => b.visits - a.visits)];
  }

  private buildHistoricalRows(
    providers: string[],
    rows: Array<{ provider: string; date: string; count: number }>,
  ): HistoricalRow[] {
    const byProvider = new Map<string, Array<{ date: string; value: number }>>();
    for (const provider of providers) {
      byProvider.set(provider, []);
    }

    for (const row of rows) {
      const series = byProvider.get(row.provider);
      if (series) series.push({ date: row.date, value: row.count });
    }

    return [...byProvider.entries()].map(([provider, historicalData]) => ({
      domain: providerLabel(provider),
      provider,
      historicalData,
    }));
  }

  private changePercent(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}
