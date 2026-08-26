/**
 * GEO aggregation endpoints backed by the live upstream Public API.
 * Ported from functions/snapshots-api/geo.mjs — response shapes preserved.
 */
import { Injectable } from '@nestjs/common';
import { isAccountCompetitor, type AccountIdentity } from '@alora/shared';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SourceApiError, SourceApiService } from './source-api.service';
import { getMcpUrl, mcpApiGet } from '../utils/mcp-connection.util';

const RANGE_PRESETS = new Set([1, 7, 14, 30, 90]);

export type GeoFilters = {
  startDate: string;
  endDate: string;
  rangeDays: number | null;
  providers: string[];
  topics: string[];
  prompts: string[];
  regions: string[];
  tags: string[];
  branded: 'AccountIncluded' | 'AccountNotIncluded' | null;
  promptTypes: string[];
};

@Injectable()
export class GeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceApi: SourceApiService,
    private readonly config: ConfigService,
  ) {}

  parseGeoFilters(q: Record<string, unknown>): GeoFilters {
    const startDate = this.isoDay(q.startDate);
    const endDate = this.isoDay(q.endDate);
    if (!startDate || !endDate) {
      const err = new Error('startDate and endDate must be ISO dates (YYYY-MM-DD)') as Error & {
        statusCode: number;
      };
      err.statusCode = 400;
      throw err;
    }
    return {
      startDate,
      endDate,
      rangeDays: this.parseRangeDays(q.range),
      providers: this.csv(q.providers),
      topics: this.csv(q.topics),
      prompts: this.csv(q.prompts),
      regions: this.csv(q.regions),
      tags: this.csv(q.tags),
      branded:
        q.branded === 'AccountIncluded' || q.branded === 'AccountNotIncluded'
          ? q.branded
          : null,
      promptTypes: this.csv(q.promptTypes),
    };
  }

  async geoMeta(tenantId: string) {
    const { accountId, apiKey } = await this.creds(tenantId);

    const [account, topicsRaw, promptsRaw, tagsRaw, lastScan, competitorsRaw] =
      await Promise.all([
        this.sourceGetCached(accountId, apiKey, `/accounts/${accountId}`),
        this.sourceGetCached(accountId, apiKey, this.accountPath(accountId, '/topics')),
        this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(accountId, '/prompts', '?take=200&skip=0'),
        ),
        this.sourceGet(accountId, apiKey, this.accountPath(accountId, '/tags')),
        this.sourceGet(accountId, apiKey, this.accountPath(accountId, '/scans/last')),
        this.optionalSource(
          accountId,
          apiKey,
          this.accountPath(accountId, '/market-players', '?take=100&skip=0'),
        ),
      ]);

    const accountObj = account as Record<string, unknown> | null;
    const topics = this.asArray(topicsRaw, 'topics').map((t: Record<string, unknown>) => ({
      id: t.id,
      name: t.name,
    }));
    const prompts = this.asArray(promptsRaw, 'prompts').map((p: Record<string, unknown>) => ({
      id: p.id,
      text: (p.prompt ?? p.text ?? '') as string,
    }));
    const promptRows = this.asArray(promptsRaw, 'prompts') as Record<string, unknown>[];

    const tagByKey = new Map<string, { name: string; tagId: string; colorRow: string | null }>();
    const promptTypeSet = new Set<string>();
    for (const p of promptRows) {
      if (p.type) promptTypeSet.add(String(p.type));
      for (const t of this.mapTags(p.tags)) {
        tagByKey.set(t.tagId || t.name, t);
      }
    }
    for (const t of this.mapTags(tagsRaw)) {
      tagByKey.set(t.tagId || t.name, t);
    }
    const tagCatalog = [...tagByKey.values()].sort((a, b) => a.name.localeCompare(b.name));
    console.info('[geo/meta] tags', {
      rawType:
        tagsRaw == null
          ? 'null'
          : Array.isArray(tagsRaw)
            ? `array:${tagsRaw.length}`
            : typeof tagsRaw,
      rawKeys:
        tagsRaw && typeof tagsRaw === 'object' && !Array.isArray(tagsRaw)
          ? Object.keys(tagsRaw)
          : [],
      fromPrompts: promptRows.filter((p) => ((p.tags as unknown[]) ?? []).length > 0).length,
      collected: tagCatalog.map((t) => t.name),
    });

    const settings = accountObj?.accountSettings as { aiEngines?: Array<{ name?: string }> } | undefined;
    const providers = (settings?.aiEngines ?? []).map((e) => e?.name).filter(Boolean) as string[];

    const regions = this.collectRegions(accountObj as AccountIdentity & { accountSettings?: { regions?: unknown[] } }, promptRows);

    const competitors = this.asArray(competitorsRaw).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: (c.name ?? c.title ?? '') as string,
      logo: (c.logo ?? null) as string | null,
      site: (c.site ?? null) as string | null,
      domain: (c.domain ?? null) as string | null,
      status: (c.status ?? null) as string | null,
    }));

    const maxDay =
      this.sourceApi.toIsoDay(lastScan) ||
      this.sourceApi.toIsoDay((lastScan as { date?: unknown })?.date) ||
      this.sourceApi.toIsoDay((lastScan as { lastRunDate?: unknown })?.lastRunDate);

    return {
      hasFacts: Boolean(maxDay),
      factDays: { min: null, max: maxDay },
      account: accountObj
        ? {
            id: accountObj.id,
            title: accountObj.title,
            names: (accountObj.names as string[]) ?? [],
            domains: (accountObj.domains as string[]) ?? [],
            logo: (accountObj.logo as string | null) ?? null,
          }
        : null,
      options: {
        providers,
        topics,
        prompts,
        regions,
        tags: tagCatalog.map((t) => t.name),
        tagCatalog,
        promptTypes: [...promptTypeSet].sort(),
      },
      competitors,
    };
  }

  async geoTenantScanDays(tenantId: string) {
    const { accountId, apiKey } = await this.creds(tenantId);
    const lastScan = await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, '/scans/last'),
    );
    const day =
      this.sourceApi.toIsoDay(lastScan) ||
      this.sourceApi.toIsoDay((lastScan as { date?: unknown })?.date) ||
      this.sourceApi.toIsoDay((lastScan as { lastRunDate?: unknown })?.lastRunDate);
    if (!day) return [];
    const pulledAt =
      typeof lastScan === 'string'
        ? lastScan
        : ((lastScan as { finishedAt?: unknown; date?: unknown })?.finishedAt ??
          (lastScan as { date?: unknown })?.date ??
          null);
    return [
      {
        day,
        status: 'ok',
        finishedAt: pulledAt,
        errorSummary: null,
        pulledAt,
      },
    ];
  }

  async geoDashboard(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const q = this.toSourceQueryWithRange(f, {}, { engines: 'aiEngines' });

    console.info('[geo/dashboard] start', {
      tenantId,
      accountId,
      filters: f,
      sourceQuery: q,
    });

    const promptsQ = this.toSourceQueryWithRange(f, { skip: 0, take: 200 }, { engines: 'aiEngines' });
    const histQ = this.toSourceQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' });
    let [dash, topSources, promptsRaw, historicalRaw, account] = await Promise.all([
      this.sourceGet(accountId, apiKey, this.accountPath(accountId, '/ui-pages/dashboard', q)),
      this.sourceGet(
        accountId,
        apiKey,
        this.accountPath(accountId, '/ui-pages/dashboard/top-source-domains', q),
      ),
      this.optionalSource(accountId, apiKey, this.accountPath(accountId, '/prompts', promptsQ)),
      this.optionalSource(
        accountId,
        apiKey,
        this.accountPath(accountId, '/prompts/responses/sentiment/historical', histQ),
      ),
      this.sourceGetCached(accountId, apiKey, `/accounts/${accountId}`),
    ]);

    const noExtraFilters =
      f.providers.length === 0 &&
      f.topics.length === 0 &&
      f.prompts.length === 0 &&
      f.regions.length === 0 &&
      f.tags.length === 0 &&
      !f.branded &&
      f.promptTypes.length === 0;

    const dashObj = dash as Record<string, unknown> | null;
    const firstMentions = this.asArray(dashObj?.providerMentions).length;
    const firstCompetitors = this.asArray(dashObj?.competitorsPerformance).length;
    console.info('[geo/dashboard] first response', {
      dashType: dash == null ? 'null' : Array.isArray(dash) ? 'array' : typeof dash,
      dashKeys: dash && typeof dash === 'object' && !Array.isArray(dash) ? Object.keys(dash) : [],
      firstMentions,
      firstCompetitors,
      promptsCountRaw: dashObj?.promptsCount,
      topSourcesType: Array.isArray(topSources)
        ? `array:${topSources.length}`
        : typeof topSources,
    });

    let usedFallback = false;
    if (noExtraFilters && firstMentions === 0 && firstCompetitors === 0) {
      usedFallback = true;
      const fallback = '?range=7';
      console.info('[geo/dashboard] empty dated payload, retrying with', fallback);
      ;[dash, topSources] = await Promise.all([
        this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(accountId, '/ui-pages/dashboard', fallback),
        ),
        this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(accountId, '/ui-pages/dashboard/top-source-domains', fallback),
        ),
      ]);
    }

    const dashMapped = dash as Record<string, unknown> | null;
    const sources = Array.isArray(topSources) ? topSources : this.asArray(topSources);
    const mentions = this.asArray(dashMapped?.providerMentions).map((m: Record<string, unknown>) => ({
      provider: m.provider,
      count: (m.count as number) ?? 0,
      countChange: (m.countChange as number | null) ?? null,
      historicalData: (m.historicalData as unknown[]) ?? [],
    }));
    const competitors = this.asArray(dashMapped?.competitorsPerformance).map(
      (row: Record<string, unknown>) =>
        this.mapCompetitorRow(row, accountId, account as AccountIdentity),
    );
    const promptsCountRaw = dashMapped?.promptsCount;
    const catalogCount =
      typeof promptsCountRaw === 'number'
        ? promptsCountRaw
        : ((promptsCountRaw as { total?: number; count?: number })?.total ??
          (promptsCountRaw as { count?: number })?.count ??
          0);
    const promptsCount = this.countActivePrompts(promptsRaw) ?? catalogCount;
    const { overallScore, previousOverallScore } = this.sentimentPeriodScores(
      this.mapSentimentHistorical(historicalRaw),
    );

    const mapped = {
      hasPages: (dashMapped?.hasPages as boolean) ?? sources.length > 0,
      promptsCount,
      overallScore,
      previousOverallScore,
      providerMentions: mentions,
      competitorsPerformance: competitors,
      agentPosts: dashMapped?.agentPosts ?? null,
      weeklyInsights: dashMapped?.weeklyInsights ?? null,
      topSourceDomains: sources.map((s: Record<string, unknown>) => ({
        domain: s.domain,
        pageCount: (s.pageCount ?? s.page_count ?? 0) as number,
        occurrences: (s.occurrences as number) ?? 0,
      })),
    };

    console.info('[geo/dashboard] mapped', {
      usedFallback,
      promptsCount,
      catalogCount,
      overallScore,
      previousOverallScore,
      mentionCount: mentions.length,
      mentionTotals: mentions.map((m) => ({ provider: m.provider, count: m.count })),
      competitorCount: competitors.length,
      competitorSample: competitors.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        occurrences: c.occurrences,
        isAccount: c.isAccount,
      })),
      sourceCount: mapped.topSourceDomains.length,
    });

    return {
      data: mapped,
      isLive: true,
      computedAt: this.nowIso(),
      dataVersion: 2,
    };
  }

  async geoMentions(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const q = this.toSourceQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' });
    const chart = (await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, '/prompts/responses/chart-data', q),
    )) as Record<string, unknown> | null;
    return {
      data: {
        providers: chart?.providers ?? [],
        trackedRecommendations: this.asArray(chart?.trackedRecommendations),
        posts: this.asArray(chart?.posts),
      },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoSentiment(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const histQ = this.toSourceQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' });
    const historicalRaw = await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, '/prompts/responses/sentiment/historical', histQ),
    );

    const historical = this.mapSentimentHistorical(historicalRaw);
    const { overallScore, previousOverallScore } = this.sentimentPeriodScores(historical);

    return {
      data: {
        summary: [],
        overallScore,
        previousOverallScore,
        historical,
      },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoPrompts(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const skip = Math.max(0, Number(rawQuery.skip) || 0);
    const take = Math.min(200, Math.max(1, Number(rawQuery.take) || 200));
    const q = this.toSourceQueryWithRange(f, { skip, take }, { engines: 'aiEngines' });
    const result = (await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, '/prompts', q),
    )) as Record<string, unknown> | null;
    const prompts = this.asArray(result, 'prompts').map((p: Record<string, unknown>) =>
      this.mapPromptRow(p),
    );
    return {
      total: typeof result?.total === 'number' ? result.total : prompts.length,
      prompts,
    };
  }

  async geoTags(tenantId: string) {
    const { accountId, apiKey } = await this.creds(tenantId);
    const [tagsRaw, promptsRaw] = await Promise.all([
      this.sourceGet(accountId, apiKey, this.accountPath(accountId, '/tags')),
      this.sourceGet(
        accountId,
        apiKey,
        this.accountPath(accountId, '/prompts', '?take=200&skip=0'),
      ),
    ]);
    const byKey = new Map<string, { name: string; tagId: string; colorRow: string | null }>();
    for (const t of this.mapTags(tagsRaw)) byKey.set(t.tagId || t.name, t);
    for (const p of this.asArray(promptsRaw, 'prompts') as Record<string, unknown>[]) {
      for (const t of this.mapTags(p.tags)) byKey.set(t.tagId || t.name, t);
    }
    return {
      tags: [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  async geoCreateTag(tenantId: string, input: Record<string, unknown>) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) {
      const err = new Error('Tag name is required') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const colorRow =
      typeof input?.colorRow === 'string' && input.colorRow.trim() ? input.colorRow.trim() : 'E';
    const { accountId, apiKey } = await this.creds(tenantId);
    const created = (await this.trySourceWrites(accountId, apiKey, [
      {
        method: 'POST',
        path: this.accountPath(accountId, '/tags'),
        body: { name, colorRow },
      },
      {
        method: 'POST',
        path: this.accountPath(accountId, '/tags'),
        body: { name, color: colorRow },
      },
      { method: 'POST', path: '/tags', body: { name, colorRow } },
    ])) as Record<string, unknown> | null;
    return {
      tag:
        this.mapTag(created) || {
          name,
          tagId: (created?.id || created?.tagId || name) as string,
          colorRow,
        },
    };
  }

  async geoSetPromptTags(
    tenantId: string,
    promptId: string,
    input: Record<string, unknown>,
  ) {
    if (!promptId) {
      const err = new Error('Prompt id is required') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const tags = this.mapTags(input?.tags);
    const tagIds = tags.map((t) => t.tagId).filter(Boolean);
    const { accountId, apiKey } = await this.creds(tenantId);
    const result = (await this.trySourceWrites(accountId, apiKey, [
      {
        method: 'PATCH',
        path: this.accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}`),
        body: { tags: tagIds },
      },
      {
        method: 'PATCH',
        path: this.accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}`),
        body: { tags },
      },
      {
        method: 'PATCH',
        path: this.accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}`),
        body: { tagIds },
      },
      {
        method: 'PUT',
        path: this.accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}/tags`),
        body: { tags: tagIds },
      },
      {
        method: 'PUT',
        path: this.accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}/tags`),
        body: { tagIds },
      },
    ])) as Record<string, unknown> | null;
    const mapped = this.mapPromptRow(
      result?.id
        ? result
        : { id: promptId, prompt: result?.prompt, tags: result?.tags ?? tags },
    );
    const nextTags = result?.tags != null ? this.mapTags(result.tags) : tags;
    return { prompt: { ...mapped, tags: nextTags } };
  }

  async geoDeleteTag(tenantId: string, tagId: string) {
    if (!tagId) {
      const err = new Error('Tag id is required') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const { accountId, apiKey } = await this.creds(tenantId);
    await this.trySourceWrites(accountId, apiKey, [
      {
        method: 'DELETE',
        path: this.accountPath(accountId, `/tags/${encodeURIComponent(tagId)}`),
      },
      { method: 'DELETE', path: `/tags/${encodeURIComponent(tagId)}` },
    ]);
    return { ok: true };
  }

  async geoProviderMentionPrompts(
    tenantId: string,
    rawQuery: Record<string, unknown>,
    provider: string,
  ) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    if (!provider) return { prompts: [] };
    const q = this.toSourceQueryWithRange(f, {}, { engines: 'aiEngines' });
    const rows = await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(
        accountId,
        `/provider-mentions/${encodeURIComponent(provider)}/prompts`,
        q,
      ),
    );
    return {
      prompts: this.asArray(rows).map((r: Record<string, unknown>) => ({
        promptId: (r.promptId ?? r.id ?? null) as string | null,
        prompt: (r.prompt ?? r.text ?? '') as string,
        topic: (r.topic ?? null) as unknown,
        count: r.count,
      })),
    };
  }

  async geoCompetitors(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const q = this.toSourceQueryWithRange(f, {}, { engines: 'aiEngines' });
    const [page, account] = await Promise.all([
      this.sourceGet(accountId, apiKey, this.accountPath(accountId, '/market-players/page-data', q)),
      this.sourceGetCached(accountId, apiKey, `/accounts/${accountId}`),
    ]);
    const pageObj = page as Record<string, unknown> | null;
    const ranking = this.asArray(pageObj?.ranking ?? pageObj?.competitors ?? page).map(
      (row: Record<string, unknown>) =>
        this.mapCompetitorRow(row, accountId, account as AccountIdentity),
    );
    return {
      data: { ranking },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoResponses(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const skip = Math.max(0, Number(rawQuery.skip) || 0);
    const take = Math.min(100, Math.max(1, Number(rawQuery.take) || 50));
    const q = this.toSourceQueryWithRange(
      f,
      { skip, take, listOnly: 'true' },
      { engines: 'providers' },
    );
    const path =
      rawQuery.sentiment === '1' || rawQuery.sentiment === 'true'
        ? '/prompts/responses/sentiment'
        : '/prompts/responses';
    const result = (await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, path, q),
    )) as Record<string, unknown> | null;
    const responseRows = Array.isArray(result?.responses)
      ? (result.responses as Record<string, unknown>[])
      : (this.asArray(result) as Record<string, unknown>[]);
    const responses = responseRows.map((row) => this.mapResponseRow(row, { list: true }));
    return {
      data: {
        total: (result?.total as number) ?? responses.length,
        responses,
      },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoResponseDetail(tenantId: string, responseId: string) {
    const { accountId, apiKey } = await this.creds(tenantId);
    const row = await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, `/prompts/responses/${encodeURIComponent(responseId)}`),
    );
    if (!row) {
      const err = new Error('Response not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
    return {
      data: this.mapResponseRow(row as Record<string, unknown>, { list: false }),
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoTraffic(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const prev = this.sourceApi.previousPeriod(f);
    const params = new URLSearchParams({
      startDate: this.sourceApi.toStartIso(f.startDate),
      endDate: this.sourceApi.toEndIso(f.endDate),
      prevStartDate: this.sourceApi.toStartIso(prev.startDate),
      prevEndDate: this.sourceApi.toEndIso(prev.endDate),
      granularity: 'daily',
    });
    if (f.providers.length) params.set('providers', f.providers.join(','));
    if (f.regions.length) params.set('countries', f.regions.join(','));
    const payload = await this.sourceGet(
      accountId,
      apiKey,
      `/traffic/${accountId}/ai-dashboard-data?${params.toString()}`,
    );
    const rec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    console.info('[geo/traffic]', {
      startDate: f.startDate,
      endDate: f.endDate,
      sourceQuery: params.toString(),
      keys: Object.keys(rec),
      llmProviders: Array.isArray(rec.llmProviders)
        ? rec.llmProviders.length
        : typeof rec.llmProviders,
      historicalData: Array.isArray(rec.historicalData)
        ? rec.historicalData.length
        : typeof rec.historicalData,
      hasEvents: rec.hasEvents ?? null,
    });
    return payload;
  }

  async geoCrawlers(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const params = new URLSearchParams();
    const rangeDays = this.resolveCrawlerRangeDays(f);
    if (rangeDays != null) {
      params.set('range', String(rangeDays));
    } else {
      params.set('startDate', this.sourceApi.toStartIso(f.startDate));
      params.set('endDate', this.sourceApi.toEndIso(f.endDate));
    }
    console.info('[geo/crawlers]', {
      startDate: f.startDate,
      endDate: f.endDate,
      rangeDays: f.rangeDays,
      sourceQuery: params.toString(),
    });
    return this.sourceGet(
      accountId,
      apiKey,
      `/traffic/${accountId}/cloudflare/crawler-analytics?${params.toString()}`,
    );
  }

  async geoMarketplace(tenantId: string, rawQuery: Record<string, unknown>) {
    this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const raw = await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, '/articles-marketplace/catalog', this.catalogQuery(rawQuery)),
    );
    const sites = this.asArray(raw, 'catalog')
      .map((row: Record<string, unknown>) => this.mapMarketplaceSite(row))
      .filter(Boolean) as Array<Record<string, unknown>>;
    const matches = sites
      .filter((site) => site.cited)
      .sort((a, b) => {
        const mentionDiff = ((b.mentions as number) ?? 0) - ((a.mentions as number) ?? 0);
        if (mentionDiff !== 0) return mentionDiff;
        return (
          ((a.rank as number) ?? Number.POSITIVE_INFINITY) -
          ((b.rank as number) ?? Number.POSITIVE_INFINITY)
        );
      });

    console.info('[geo/marketplace] catalog', { sites: sites.length, matches: matches.length });

    return {
      data: {
        matches,
        sites,
        catalogAvailable: true,
      },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoCitations(tenantId: string, rawQuery: Record<string, unknown>) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const pageSize = 200;
    const firstQuery = this.toSourceQueryWithRange(f, { page: 1, pageSize }, { engines: 'aiEngines' });
    const first = (await this.sourceGet(
      accountId,
      apiKey,
      this.accountPath(accountId, '/sources/domains-page', firstQuery),
    )) as Record<string, unknown> | null;
    const summary = this.mapCitationSummary(first);
    let items = this.asArray(
      (first?.domains as { items?: unknown })?.items ?? first?.domains ?? first?.items,
      'items',
    )
      .map((row: Record<string, unknown>) => this.mapCitationDomain(row))
      .filter(Boolean) as Array<Record<string, unknown>>;
    const total =
      this.numberOrNull((first?.domains as { total?: unknown })?.total ?? first?.total) ??
      items.length;
    items = this.normalizeUsedPercents(items);

    console.info('[geo/citations] domains', { total, loaded: items.length });

    return {
      data: {
        summary,
        domains: items,
        total,
      },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoCitationDomain(tenantId: string, rawQuery: Record<string, unknown>, domain: string) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const host = this.normalizeHost(domain);
    if (!host) {
      const err = new Error('domain is required') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const pageSize = 100;
    const encoded = encodeURIComponent(host);
    let raw: Record<string, unknown> | null;
    try {
      raw = (await this.sourceGet(
        accountId,
        apiKey,
        this.accountPath(
          accountId,
          `/sources/domain-drill-down/${encoded}`,
          this.toSourceQueryWithRange(f, { page: 1, pageSize }, { engines: 'aiEngines' }),
        ),
      )) as Record<string, unknown> | null;
    } catch (err) {
      console.warn(
        `[geo/citations] drill-down failed for ${host}, falling back: ${
          err instanceof Error ? err.message : err
        }`,
      );
      const [summaryRaw, urlsRaw] = await Promise.all([
        this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(
            accountId,
            '/sources/url-type-summary',
            this.toSourceQueryWithRange(f, {}, { engines: 'aiEngines' }),
          ),
        ),
        this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(
            accountId,
            `/sources/domains/${encoded}/urls`,
            this.toSourceQueryWithRange(f, { page: 1, pageSize }, { engines: 'aiEngines' }),
          ),
        ),
      ]);
      const summaryObj = summaryRaw as Record<string, unknown> | null;
      const urlsObj = urlsRaw as Record<string, unknown> | null;
      raw = {
        summary: summaryObj?.summary ?? summaryRaw,
        sourceGroups: urlsObj?.sourceGroups ?? urlsRaw,
        total: urlsObj?.total,
      };
    }

    const urls = this.flattenSourceUrls(raw, host);
    const seen = new Set(urls.map((row) => row.url));
    const total = this.numberOrNull(raw?.total) ?? urls.length;
    const pages = Math.min(Math.ceil(total / pageSize), 8);
    for (let page = 2; page <= pages; page += 1) {
      try {
        const next = await this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(
            accountId,
            `/sources/domains/${encoded}/urls`,
            this.toSourceQueryWithRange(f, { page, pageSize }, { engines: 'aiEngines' }),
          ),
        );
        for (const row of this.flattenSourceUrls(next as Record<string, unknown>, host)) {
          if (seen.has(row.url)) continue;
          seen.add(row.url);
          urls.push(row);
        }
      } catch (err) {
        console.warn(
          `[geo/citations] extra URL page failed for ${host}: ${
            err instanceof Error ? err.message : err
          }`,
        );
        break;
      }
    }

    console.info('[geo/citations] domain', { domain: host, urls: urls.length, total });

    return {
      data: {
        domain: host,
        summary: this.mapCitationSummary(raw),
        urls,
        total,
      },
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  async geoCitationUrlDetail(
    tenantId: string,
    rawQuery: Record<string, unknown>,
    url?: string,
  ) {
    const f = this.parseGeoFilters(rawQuery);
    const { accountId, apiKey } = await this.creds(tenantId);
    const target = String(url || rawQuery.url || '').trim();
    if (!target) {
      const err = new Error('url is required') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const attempts: Array<[string, Record<string, string>]> = [
      ['/sources/detail', { url: target }],
      ['/sources/detail', { pageUrl: target }],
      ['/pages/detail', { url: target }],
    ];
    let lastError: unknown;
    let raw: unknown = null;
    for (const [path, extra] of attempts) {
      try {
        raw = await this.sourceGet(
          accountId,
          apiKey,
          this.accountPath(
            accountId,
            path,
            this.toSourceQueryWithRange(f, extra, { engines: 'aiEngines' }),
          ),
        );
        if (raw) break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!raw) {
      throw lastError || new Error('Source URL detail was not available');
    }

    return {
      data: this.mapCitationUrlDetail(raw, target),
      isLive: true,
      computedAt: this.nowIso(),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers (ported from geo.mjs)
  // ---------------------------------------------------------------------------

  private parseRangeDays(value: unknown): number | null {
    const n = Number(value);
    return RANGE_PRESETS.has(n) ? n : null;
  }

  private addUtcDays(day: string, delta: number): string {
    const d = new Date(`${day}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  private resolveCrawlerRangeDays(filters: GeoFilters): number | null {
    const explicit = this.parseRangeDays(filters?.rangeDays);
    if (explicit != null) return explicit;
    if (!filters?.startDate || !filters?.endDate) return null;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = this.addUtcDays(today, -1);
    for (const end of [today, yesterday]) {
      for (const days of RANGE_PRESETS) {
        const start = this.addUtcDays(end, -(days - 1));
        if (filters.startDate === start && filters.endDate === end) return days;
      }
    }
    return null;
  }

  private toSourceQueryWithRange(
    filters: GeoFilters,
    extra: Record<string, string | number | undefined> = {},
    options: { engines?: 'aiEngines' | 'providers' | 'both'; includeRegions?: boolean } = {},
  ): string {
    const q = this.sourceApi.toSourceQuery(filters, extra, options);
    const rangeDays = this.parseRangeDays(filters?.rangeDays);
    if (rangeDays == null) return q;
    const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
    params.delete('startDate');
    params.delete('endDate');
    params.set('range', String(rangeDays));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  private unwrapPayload(value: unknown): unknown {
    let current = value;
    for (let i = 0; i < 4; i++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) break;
      const obj = current as Record<string, unknown>;
      const data = obj.data;
      if (
        data != null &&
        typeof data === 'object' &&
        (obj.computedAt != null ||
          obj.isLive != null ||
          obj.dataVersion != null ||
          (data &&
            typeof data === 'object' &&
            !Array.isArray(data) &&
            (Array.isArray((data as Record<string, unknown>).llmProviders) ||
              (data as Record<string, unknown>).historicalData != null)))
      ) {
        current = data;
        continue;
      }
      break;
    }
    return current;
  }

  private async sourceGet(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
  ): Promise<unknown> {
    return this.unwrapPayload(await this.sourceApi.sourceGet(accountId, apiKey, pathAndQuery));
  }

  private async sourceGetCached(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
  ): Promise<unknown> {
    return this.unwrapPayload(
      await this.sourceApi.sourceGetCached(accountId, apiKey, pathAndQuery),
    );
  }

  private async sourceWrite(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<unknown> {
    const method = (options.method || 'POST').toUpperCase();
    const url = `${this.sourceApi.getSourceApiBase()}${pathAndQuery}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'X-Workspace-Id': accountId,
      Accept: 'application/json',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (err) {
      throw new SourceApiError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }
    if (!response.ok) {
      let detail = '';
      try {
        const body = (await response.json()) as Record<string, unknown>;
        detail = String(body?.title || body?.description || body?.message || body?.error || '');
      } catch {
        detail = await response.text().catch(() => '');
      }
      throw new SourceApiError(
        `Request failed (${response.status}) for ${pathAndQuery}${
          detail ? `: ${String(detail).slice(0, 240)}` : ''
        }`,
        response.status,
      );
    }
    if (response.status === 204) return null;
    return this.unwrapPayload(await response.json());
  }

  private isoDay(v: unknown): string | null {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }

  private csv(v: unknown): string[] {
    if (!v) return [];
    return String(v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private asArray(value: unknown, preferredKey?: string): any[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (preferredKey && Array.isArray(obj[preferredKey])) return obj[preferredKey] as unknown[];
      if (Array.isArray(obj.prompts)) return obj.prompts as unknown[];
      if (Array.isArray(obj.topics)) return obj.topics as unknown[];
      if (Array.isArray(obj.tags)) return obj.tags as unknown[];
      if (Array.isArray(obj.competitors)) return obj.competitors as unknown[];
      if (Array.isArray(obj.sites)) return obj.sites as unknown[];
      if (Array.isArray(obj.catalog)) return obj.catalog as unknown[];
      if (Array.isArray(obj.matches)) return obj.matches as unknown[];
      if (Array.isArray(obj.items)) return obj.items as unknown[];
      if (Array.isArray(obj.data)) return obj.data as unknown[];
    }
    return [];
  }

  private tagName(tag: unknown): string | null {
    if (typeof tag === 'string') return tag.trim() || null;
    if (tag && typeof tag === 'object') {
      const t = tag as Record<string, unknown>;
      const name = t.name || t.label || t.tag;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
    return null;
  }

  mapTag(tag: unknown): { name: string; tagId: string; colorRow: string | null } | null {
    if (typeof tag === 'string') {
      const name = tag.trim();
      return name ? { name, tagId: name, colorRow: null } : null;
    }
    if (!tag || typeof tag !== 'object') return null;
    const t = tag as Record<string, unknown>;
    const name = this.tagName(tag);
    const tagId = (t.tagId || t.id || null) as string | null;
    const colorRow = (t.colorRow || t.color || null) as string | null;
    if (!name && !tagId) return null;
    return {
      name: name || String(tagId),
      tagId: tagId ? String(tagId) : (name as string),
      colorRow: colorRow ? String(colorRow) : null,
    };
  }

  private mapTags(value: unknown): Array<{ name: string; tagId: string; colorRow: string | null }> {
    return this.asArray(value, 'tags')
      .map((t) => this.mapTag(t))
      .filter(Boolean) as Array<{ name: string; tagId: string; colorRow: string | null }>;
  }

  private mapResponseRow(row: Record<string, unknown>, { list = false } = {}) {
    const countries = Array.isArray(row.countries)
      ? row.countries
      : row.region
        ? [row.region]
        : row.country
          ? [row.country]
          : [];
    const preview = (row.responsePreview ?? row.response_preview ?? null) as string | null;
    const full = (row.response ?? null) as string | null;
    return {
      id: row.id,
      provider: (row.provider as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      timestamp: (row.timestamp ?? row.createdAt ?? null) as unknown,
      region: (row.region as string | null) ?? null,
      countries,
      myRank: (row.myRank ?? row.responseRank ?? null) as unknown,
      visibilityAverage: (row.visibilityAverage ?? row.visibility ?? null) as unknown,
      sources: (row.sources as unknown[]) ?? [],
      status: (row.status as string | null) ?? null,
      promptId: (row.promptId as string | null) ?? null,
      topicId: (row.topicId as string | null) ?? null,
      promptText: (row.promptText ?? row.prompt ?? null) as unknown,
      topic:
        typeof row.topic === 'string'
          ? row.topic
          : ((row.topic as { name?: string })?.name ?? null),
      responsePreview: preview || (full ? String(full).slice(0, 400) : null),
      response: list ? null : full,
      sentimentScore: (row.sentimentScore ?? row.sentinemtScore ?? null) as unknown,
      raw: (row.rawResponseDetails ?? row.jsonResponse ?? row.raw ?? null) as unknown,
    };
  }

  private mapPromptRow(p: Record<string, unknown>) {
    const topicObj = p.topic as Record<string, unknown> | null | undefined;
    const topic = topicObj
      ? {
          id: (topicObj.id ?? p.topicId ?? null) as unknown,
          name: (topicObj.name as string) ?? '',
          state: (topicObj.state as string | null) ?? null,
        }
      : p.topicId
        ? { id: p.topicId, name: '', state: null }
        : null;
    return {
      id: p.id,
      prompt: p.prompt,
      topicId: (p.topicId ?? topicObj?.id ?? null) as unknown,
      topic,
      tags: this.mapTags(p.tags),
      type: (p.type as string | null) ?? null,
      regions: (p.regions as unknown[]) ?? [],
      meInPrompt: (p.meInPrompt as unknown) ?? null,
      volume: (p.volume as unknown) ?? null,
      isActive: (p.isActive ?? p.active ?? true) as boolean,
      state: (p.state as string | null) ?? null,
      avgVisibility: (p.avgVisibility as unknown) ?? null,
      visibilityChange: (p.visibilityChange as unknown) ?? null,
      avgRank: (p.avgRank as unknown) ?? null,
      rankChange: (p.rankChange as unknown) ?? null,
      avgSentimentScore: (p.avgSentimentScore as unknown) ?? null,
      sentimentBreakdown: (p.sentimentBreakdown as unknown) ?? null,
      responsesCount: (p.responsesCount as number) ?? 0,
    };
  }

  private async creds(tenantId: string) {
    return this.sourceApi.resolveCredentials(tenantId);
  }

  private accountPath(accountId: string, suffix: string, query = ''): string {
    return `/accounts/${accountId}${suffix}${query}`;
  }

  private async optionalSource(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
  ): Promise<unknown> {
    try {
      return await this.sourceGet(accountId, apiKey, pathAndQuery);
    } catch (err) {
      console.warn(
        `[geo] optional ${pathAndQuery} failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private isPublicAllowlistDenied(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
      (err as { statusCode?: number })?.statusCode === 403 &&
      /not exposed for public API access/i.test(message)
    );
  }

  private async sourceGetAllowlisted(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
  ): Promise<unknown> {
    try {
      return await this.sourceGet(accountId, apiKey, pathAndQuery);
    } catch (err) {
      if (!this.isPublicAllowlistDenied(err)) throw err;
      try {
        const mcpUrl = getMcpUrl(this.config, this.sourceApi.getSourceApiBase());
        const raw = await mcpApiGet(mcpUrl, accountId, apiKey, pathAndQuery);
        console.info(`[geo] MCP api_get OK ${pathAndQuery}`);
        return this.unwrapPayload(raw);
      } catch (mcpErr) {
        console.warn(
          `[geo] MCP api_get failed for ${pathAndQuery}: ${
            mcpErr instanceof Error ? mcpErr.message : mcpErr
          }`,
        );
        throw err;
      }
    }
  }

  private isPromptActive(p: Record<string, unknown>): boolean {
    return (p?.isActive ?? p?.active) !== false;
  }

  private countActivePrompts(promptsRaw: unknown): number | null {
    if (promptsRaw == null) return null;
    return this.asArray(promptsRaw, 'prompts').filter((p) =>
      this.isPromptActive(p as Record<string, unknown>),
    ).length;
  }

  private mapSentimentHistorical(historicalRaw: unknown) {
    return (Array.isArray(historicalRaw) ? historicalRaw : this.asArray(historicalRaw)).map(
      (row: Record<string, unknown>) => ({
        date: this.sourceApi.toIsoDay(row.date) || String(row.date),
        provider: (row.provider as string) || 'ALL',
        sentimentScore: Number(row.sentimentScore) || 0,
      }),
    );
  }

  private sentimentPeriodScores(historical: Array<{ sentimentScore: number }>) {
    const periodScores = historical
      .map((row) => row.sentimentScore)
      .filter((value) => Number.isFinite(value));
    const mean = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : null;
    return {
      overallScore: mean(periodScores),
      previousOverallScore: mean(periodScores.slice(0, Math.floor(periodScores.length / 2))),
    };
  }

  private collectRegions(
    account: (AccountIdentity & { accountSettings?: { regions?: unknown[] } }) | null,
    promptRows: Record<string, unknown>[],
  ): string[] {
    const set = new Set<string>();
    for (const value of account?.accountSettings?.regions ?? []) {
      if (value) set.add(String(value));
    }
    for (const prompt of promptRows) {
      for (const region of (prompt.regions as unknown[]) ?? []) {
        if (typeof region === 'string' && region) set.add(region);
        else if (region && typeof region === 'object') {
          const r = region as Record<string, unknown>;
          if (r.country) set.add(String(r.country));
          else if (r.name) set.add(String(r.name));
          else if (r.locale) set.add(String(r.locale));
        }
      }
    }
    return [...set].sort();
  }

  private mapCompetitorRow(
    row: Record<string, unknown>,
    accountId: string,
    account: AccountIdentity | null,
  ) {
    const id = (row.id ?? row.name ?? '') as string;
    const accountWithId = account
      ? { ...account, id: account.id ?? accountId }
      : { id: accountId };
    return {
      id,
      name: (row.name ?? row.title ?? '') as string,
      logo: (row.logo as string | null) ?? null,
      site: (row.site as string | null) ?? null,
      domain: (row.domain as string | null) ?? null,
      position: (row.position as unknown) ?? null,
      occurrences: (row.occurrences as number) ?? 0,
      occurrencesDelta: (row.occurrencesDelta as unknown) ?? null,
      avgRank: (row.avgRank as unknown) ?? null,
      avgRankDelta: (row.avgRankDelta as unknown) ?? null,
      sentimentScore: (row.sentimentScore as unknown) ?? null,
      sentimentScoreDelta: (row.sentimentScoreDelta as unknown) ?? null,
      topics: (row.topics as unknown[]) ?? [],
      historicalData: (row.historicalData as unknown[]) ?? [],
      isAccount: isAccountCompetitor(
        {
          id,
          name: (row.name ?? row.title) as string | null,
          title: row.title as string | null,
          domain: row.domain as string | null,
          site: row.site as string | null,
          isAccount: row.isAccount as boolean | null,
        },
        accountWithId,
      ),
    };
  }

  private async trySourceWrites(
    accountId: string,
    apiKey: string,
    attempts: Array<{ method: string; path: string; body?: unknown }>,
  ) {
    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        return await this.sourceWrite(accountId, apiKey, attempt.path, {
          method: attempt.method,
          body: attempt.body,
        });
      } catch (err) {
        lastError = err;
        const status = (err as { statusCode?: number })?.statusCode;
        if (status && status !== 400 && status !== 404 && status !== 405) throw err;
        console.warn(
          `[geo/tags] ${attempt.method} ${attempt.path} failed (${status || 'error'}), trying next shape`,
        );
      }
    }
    throw lastError || new Error('Could not save this tag. Try again.');
  }

  private numberOrNull(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private normalizeHost(value: unknown): string | null {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    try {
      const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
      return url.hostname.replace(/^www\./i, '').toLowerCase() || null;
    } catch {
      return (
        raw
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .split('/')[0]
          ?.toLowerCase() || null
      );
    }
  }

  private stringList(value: unknown): string[] {
    return this.asArray(value)
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const name = obj.name || obj.label || obj.title || obj.category;
          return typeof name === 'string' ? name.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
  }

  private mapMarketplaceSite(row: Record<string, unknown>) {
    if (!row || typeof row !== 'object') return null;
    const site = (row.site && typeof row.site === 'object' ? row.site : row) as Record<
      string,
      unknown
    >;
    const domain = this.normalizeHost(site.domain || site.site || site.url || site.website);
    const name = site.name || site.title || site.publisher || domain;
    if (!name && !domain) return null;
    const status = typeof site.status === 'string' ? site.status.toUpperCase() : 'ACTIVE';
    const mentionsValue = site.mentions;
    const mentions =
      mentionsValue && typeof mentionsValue === 'object'
        ? this.numberOrNull(
            (mentionsValue as Record<string, unknown>).appearances ??
              (mentionsValue as Record<string, unknown>).count ??
              (mentionsValue as Record<string, unknown>).avgCitations,
          )
        : this.numberOrNull(mentionsValue);
    return {
      id: String(site.id || site.siteId || site.thirdPartySiteId || domain || name),
      name: String(name || domain),
      domain,
      logo: (site.logoUrl || site.logo || site.faviconUrl || null) as string | null,
      faviconUrl: (site.faviconUrl as string | null) || null,
      categories: this.stringList(site.categories || site.category),
      customerPriceCents: this.numberOrNull(
        site.priceCents ?? site.customerPriceCents ?? site.price,
      ),
      currency: (site.currency as string) || 'USD',
      credits: this.numberOrNull(site.credits),
      publisher: (site.publisher as string | null) || null,
      origin: (site.origin as string | null) || null,
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      thirdPartySiteId: site.thirdPartySiteId ? String(site.thirdPartySiteId) : null,
      traffic: this.numberOrNull(site.traffic),
      rank: this.numberOrNull(site.rank),
      mentions,
      occurrences: mentions,
      cited: mentions != null && mentions > 0,
    };
  }

  private catalogQuery(rawQuery: Record<string, unknown>): string {
    const params = new URLSearchParams();
    for (const key of ['category', 'domain', 'origin', 'includeInactive']) {
      if (rawQuery[key] != null && rawQuery[key] !== '') params.set(key, String(rawQuery[key]));
    }
    for (const key of ['categories', 'origins']) {
      for (const value of this.csv(rawQuery[key])) params.append(key, value);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  private mapTypeCount(row: Record<string, unknown> | null) {
    if (!row || typeof row !== 'object') return null;
    const type = String(row.type || row.name || row.domainType || row.urlType || '').trim();
    const count = this.numberOrNull(row.count ?? row.total ?? row.appearances);
    if (!type || count == null) return null;
    return { type, count };
  }

  private mapCitationTrend(raw: unknown) {
    const trend = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
      chartCategories: this.asArray(trend.chartCategories).map((value) => String(value)),
      chartSeries: this.asArray(trend.chartSeries)
        .map((series: Record<string, unknown>) => ({
          name: String(series?.name || series?.type || 'Other'),
          data: this.asArray(series?.data).map((value) => this.numberOrNull(value) ?? 0),
        }))
        .filter((series) => series.name),
      currentTotal: this.numberOrNull(trend.currentTotal) ?? 0,
      previousTotal: this.numberOrNull(trend.previousTotal) ?? 0,
    };
  }

  private mapCitationSummary(raw: unknown) {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const summary =
      obj.summary && typeof obj.summary === 'object'
        ? (obj.summary as Record<string, unknown>)
        : obj || {};
    return {
      totalCitations: this.numberOrNull(summary.totalCitations) ?? 0,
      distributionByDomainType: this.asArray(summary.distributionByDomainType)
        .map((row: Record<string, unknown>) => this.mapTypeCount(row))
        .filter(Boolean),
      distributionByUrlType: this.asArray(summary.distributionByUrlType)
        .map((row: Record<string, unknown>) => this.mapTypeCount(row))
        .filter(Boolean),
      trend: this.mapCitationTrend(summary.trend),
    };
  }

  private asUsedPercent(value: unknown): number | null {
    return this.numberOrNull(value);
  }

  private normalizeUsedPercents(rows: Array<Record<string, unknown>>) {
    const values = rows
      .map((row) => row.usedPercent as number | null)
      .filter((value) => value != null) as number[];
    if (values.length > 0 && values.every((value) => value >= 0 && value <= 1)) {
      return rows.map((row) => ({
        ...row,
        usedPercent: row.usedPercent == null ? null : (row.usedPercent as number) * 100,
      }));
    }
    return rows;
  }

  private mapCitationDomain(row: Record<string, unknown>) {
    if (!row || typeof row !== 'object') return null;
    const domain = this.normalizeHost(row.domain || row.host || row.hostname || row.source);
    if (!domain) return null;
    return {
      domain,
      appearances: this.numberOrNull(row.appearances ?? row.occurrences ?? row.count),
      domainType: String(row.domainType || row.type || 'Other'),
      usedPercent: this.asUsedPercent(row.usedPercent ?? row.used),
      avgCitations: this.numberOrNull(row.avgCitations ?? row.averageCitations),
    };
  }

  private mapCitationUrl(row: Record<string, unknown>, fallbackDomain: string | null) {
    if (!row || typeof row !== 'object') return null;
    const url = String(row.url || row.href || row.path || '').trim();
    if (!url) return null;
    const domain = this.normalizeHost(row.domain || fallbackDomain) || this.normalizeHost(url);
    return {
      title: String(row.title || row.name || '').trim() || url,
      url,
      domain: domain || fallbackDomain || '',
      urlType: String(row.urlType || row.domainType || row.type || 'Other'),
      mentions: this.numberOrNull(
        row.occurrences ?? row.usedTotal ?? row.mentions ?? row.appearances,
      ),
      avgCitations: this.numberOrNull(row.avgCitations ?? row.averageCitations),
      lastUpdated: (row.lastUpdated || row.updatedAt || row.updated || null) as unknown,
    };
  }

  private flattenSourceUrls(raw: Record<string, unknown> | null, fallbackDomain: string) {
    const groups = this.asArray(
      raw?.sourceGroups ?? raw?.groups ?? raw?.items,
      'sourceGroups',
    ) as Record<string, unknown>[];
    const urls: Array<{
      title: string;
      url: string;
      domain: string;
      urlType: string;
      mentions: number | null;
      avgCitations: number | null;
      lastUpdated: unknown;
    }> = [];
    if (groups.length) {
      for (const group of groups) {
        const groupDomain = (group?.domain as string) || fallbackDomain;
        const groupUrls = this.asArray(group?.urls) as Record<string, unknown>[];
        if (groupUrls.length) {
          for (const item of groupUrls) {
            const mapped = this.mapCitationUrl(item, groupDomain);
            if (mapped) urls.push(mapped);
          }
        } else {
          const mapped = this.mapCitationUrl(group, groupDomain);
          if (mapped) urls.push(mapped);
        }
      }
    } else {
      for (const item of this.asArray(raw?.urls ?? raw?.items, 'urls') as Record<
        string,
        unknown
      >[]) {
        const mapped = this.mapCitationUrl(item, fallbackDomain);
        if (mapped) urls.push(mapped);
      }
    }
    return urls;
  }

  private growthPercent(current: number | null, previous: number | null): number | null {
    if (current == null || previous == null) return null;
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private mapCitationUrlDetail(raw: unknown, fallbackUrl: string) {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const row =
      obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
        ? (obj.data as Record<string, unknown>)
        : obj || {};
    const url = String(row.url || fallbackUrl || '').trim();
    const citations = this.numberOrNull(row.citations ?? row.appearances ?? row.occurrences);
    const previous = this.numberOrNull(row.previousCitations ?? row.previousAppearances);
    const delta = this.numberOrNull(row.citationsDelta ?? row.growthPercent ?? row.growth);
    const computedGrowth =
      this.numberOrNull(row.growthPercent ?? row.growth) ??
      (previous != null ? this.growthPercent(citations, previous) : delta);
    const providers = this.asArray(row.providers)
      .map((item: Record<string, unknown>) => ({
        provider: String(item.provider || item.name || item.engine || ''),
        count: this.numberOrNull(item.count ?? item.appearances) ?? 0,
        share: this.numberOrNull(item.share) ?? 0,
      }))
      .filter((item) => item.provider);
    const prompts = this.asArray(row.promptList ?? row.prompts)
      .map((item: unknown) => {
        if (typeof item === 'string') return { text: item, promptId: null as string | null };
        const obj = item as Record<string, unknown>;
        const text = String(obj?.text || obj?.prompt || obj?.title || '').trim();
        if (!text) return null;
        return { text, promptId: obj.promptId ? String(obj.promptId) : null };
      })
      .filter(Boolean);
    const series = this.asArray(row.citationTimeSeries ?? row.timeSeries)
      .map((item: Record<string, unknown>) => ({
        date: this.sourceApi.toIsoDay(item.date) || String(item.date || ''),
        count: this.numberOrNull(item.count ?? item.value) ?? 0,
      }))
      .filter((item) => item.date);

    return {
      title: String(row.title || row.name || '').trim() || url,
      url,
      path: String(row.path || '').trim(),
      isBranded: typeof row.isBranded === 'boolean' ? row.isBranded : null,
      appearances: citations ?? 0,
      promptCount: this.numberOrNull(row.promptCount) ?? prompts.length,
      growthPercent: computedGrowth,
      providers,
      citationTimeSeries: series,
      sparkline: this.asArray(row.sparkline).map((value) => this.numberOrNull(value) ?? 0),
      prompts,
      lastUpdated: (row.lastUpdated as unknown) || null,
    };
  }
}
