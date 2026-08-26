import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';

export const SOURCE_NOT_CONNECTED_MESSAGE =
  'This account is not connected. Connect an API key when adding the account, or set the workspace API key.';

const META_CACHE_TTL_MS = 5 * 60 * 1000;

export class SourceApiError extends Error {
  readonly statusCode: number;
  readonly retryAfter: string | null;

  constructor(message: string, statusCode: number, retryAfter: string | null = null) {
    super(message);
    this.name = 'SourceApiError';
    this.statusCode = statusCode;
    this.retryAfter = retryAfter;
  }
}

type TenantRow = {
  id: string;
  source_account_id: string;
  name: string | null;
  domain: string | null;
  enabled: boolean;
};

@Injectable()
export class SourceApiService {
  private readonly metaCache = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getSourceApiBase(): string {
    const configured = this.config.sourceApiBase;
    if (configured) return configured;
    return `https://api.${String.fromCharCode(105, 103, 101, 111)}.ai`;
  }

  async resolveCredentials(tenantId: string): Promise<{
    tenant: TenantRow;
    accountId: string;
    apiKey: string;
  }> {
    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        source_account_id: true,
        name: true,
        domain: true,
        enabled: true,
        mcp_api_key: true,
      },
    });
    if (!tenant) {
      throw new SourceApiError('Configured tenant was not found', 404);
    }
    if (!tenant.enabled) {
      throw new SourceApiError('Configured tenant is disabled', 403);
    }
    const apiKey = tenant.mcp_api_key || null;
    const accountId = tenant.source_account_id;
    if (!apiKey || !accountId) {
      throw new SourceApiError(SOURCE_NOT_CONNECTED_MESSAGE, 400);
    }
    return {
      tenant: {
        id: tenant.id,
        source_account_id: tenant.source_account_id,
        name: tenant.name,
        domain: tenant.domain,
        enabled: tenant.enabled,
      },
      accountId,
      apiKey,
    };
  }

  toStartIso(day: string): string {
    return `${day}T00:00:00.000Z`;
  }

  toEndIso(day: string): string {
    return `${day}T23:59:59.999Z`;
  }

  previousPeriod(range: { startDate: string; endDate: string }): {
    startDate: string;
    endDate: string;
  } {
    const start = new Date(`${range.startDate}T00:00:00.000Z`);
    const end = new Date(`${range.endDate}T00:00:00.000Z`);
    const spanDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const prevEnd = new Date(start);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevStart.getUTCDate() - (spanDays - 1));
    return {
      startDate: prevStart.toISOString().slice(0, 10),
      endDate: prevEnd.toISOString().slice(0, 10),
    };
  }

  parseRangeDays(value: unknown): number | null {
    const n = Number(value);
    return new Set([1, 7, 14, 30, 90]).has(n) ? n : null;
  }

  toSourceQuery(
    filters: Record<string, unknown> | null | undefined,
    extra: Record<string, string | number | undefined> = {},
    options: {
      engines?: 'aiEngines' | 'providers' | 'both';
      includeRegions?: boolean;
    } = {},
  ): string {
    const params = new URLSearchParams();
    const rangeDays = this.parseRangeDays(filters?.rangeDays);
    if (rangeDays != null) {
      params.set('range', String(rangeDays));
    } else {
      if (filters?.startDate) params.set('startDate', this.toStartIso(String(filters.startDate)));
      if (filters?.endDate) params.set('endDate', this.toEndIso(String(filters.endDate)));
    }

    const engines = options.engines ?? 'both';
    const providers = filters?.providers as unknown[] | undefined;
    if (engines === 'aiEngines' || engines === 'both') {
      this.appendList(params, 'aiEngines', providers);
    }
    if (engines === 'providers' || engines === 'both') {
      this.appendList(params, 'providers', providers);
    }
    this.appendList(params, 'topics', filters?.topics as unknown[]);
    this.appendList(params, 'promptIds', filters?.prompts as unknown[]);
    this.appendList(params, 'countries', filters?.regions as unknown[]);
    if (options.includeRegions) {
      this.appendList(params, 'regions', filters?.regions as unknown[]);
    }
    this.appendList(params, 'tags', filters?.tags as unknown[]);
    this.appendList(params, 'promptTypes', filters?.promptTypes as unknown[]);
    if (filters?.branded === 'AccountIncluded' || filters?.branded === 'AccountNotIncluded') {
      params.set('isCompanyInPrompt', String(filters.branded));
    }

    for (const [key, value] of Object.entries(extra)) {
      if (value == null || value === '') continue;
      params.set(key, String(value));
    }

    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  async sourceRequest(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<unknown> {
    const method = (options.method || 'GET').toUpperCase();
    const url = `${this.getSourceApiBase()}${pathAndQuery}`;
    const keyPrefix = this.isLiveApiKey(apiKey)
      ? `${apiKey.slice(0, 14)}…`
      : apiKey
        ? 'present-but-unexpected-prefix'
        : 'missing';
    console.info(`[source] ${method}`, {
      path: pathAndQuery,
      workspaceId: accountId,
      keyPrefix,
      url,
    });
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

    const retryAfter = response.headers.get('retry-after');
    if (!response.ok) {
      if (response.status === 429 && retryAfter) {
        console.warn(`[source] 429 ${pathAndQuery} Retry-After=${retryAfter}`);
      }
      let detail = '';
      try {
        const body = (await response.json()) as Record<string, unknown>;
        detail = String(
          body?.title ||
            body?.description ||
            body?.message ||
            body?.error_description ||
            body?.error ||
            '',
        );
      } catch {
        detail = await response.text().catch(() => '');
      }
      const suffix = detail ? `: ${String(detail).slice(0, 240)}` : '';
      console.warn(`[source] ${response.status} ${pathAndQuery}${suffix}`);
      const err = this.httpError(response.status, pathAndQuery, retryAfter);
      err.message = `${err.message}${suffix}`;
      throw err;
    }

    if (response.status === 204) return null;
    const body = await response.json();
    const unwrapped = this.unwrapSourceBody(body);
    const didUnwrap = unwrapped !== body;
    console.info('[source] OK', {
      path: pathAndQuery,
      status: response.status,
      didUnwrap,
      raw: this.summarizeSourceValue(body),
      unwrapped: didUnwrap ? this.summarizeSourceValue(unwrapped) : undefined,
    });
    return unwrapped;
  }

  async sourceGet(accountId: string, apiKey: string, pathAndQuery: string): Promise<unknown> {
    return this.sourceRequest(accountId, apiKey, pathAndQuery);
  }

  invalidateSourceMetaCache(accountId?: string): void {
    if (!accountId) {
      this.metaCache.clear();
      return;
    }
    for (const key of this.metaCache.keys()) {
      if (key.startsWith(`${accountId}:`)) this.metaCache.delete(key);
    }
  }

  unwrapSourceBody(body: unknown): unknown {
    let current = body;
    for (let i = 0; i < 4; i++) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) return current;
      const obj = current as Record<string, unknown>;
      if (
        obj.data != null &&
        (obj.computedAt != null || obj.isLive != null || obj.dataVersion != null)
      ) {
        current = obj.data;
        continue;
      }
      break;
    }
    return current;
  }

  async sourceGetCached(
    accountId: string,
    apiKey: string,
    pathAndQuery: string,
  ): Promise<unknown> {
    const key = `${accountId}:${pathAndQuery}`;
    const hit = this.metaCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
    const value = await this.sourceGet(accountId, apiKey, pathAndQuery);
    this.metaCache.set(key, { value, expiresAt: Date.now() + META_CACHE_TTL_MS });
    return value;
  }

  toIsoDay(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const text = String(value);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  private appendList(params: URLSearchParams, key: string, values: unknown): void {
    if (!Array.isArray(values)) return;
    for (const value of values) {
      if (value == null || value === '') continue;
      params.append(key, String(value));
    }
  }

  private isLiveApiKey(apiKey: string): boolean {
    return typeof apiKey === 'string' && apiKey.includes('_live_');
  }

  private httpError(status: number, path: string, retryAfter: string | null): SourceApiError {
    if (status === 401) {
      return new SourceApiError(
        'API key is missing, invalid, expired, or revoked.',
        401,
        retryAfter,
      );
    }
    if (status === 403) {
      return new SourceApiError(
        'Access denied for this workspace, role, scope, or path.',
        403,
        retryAfter,
      );
    }
    if (status === 429) {
      const wait = retryAfter ? ` Retry after ${retryAfter}s.` : '';
      return new SourceApiError(`Rate limit reached.${wait}`, 429, retryAfter);
    }
    return new SourceApiError(`Request failed (${status}) for ${path}`, status, retryAfter);
  }

  private summarizeSourceValue(value: unknown, depth = 0): unknown {
    if (value == null) return value;
    if (Array.isArray(value)) {
      const first = value[0];
      return {
        type: 'array',
        length: value.length,
        first:
          first && typeof first === 'object'
            ? { keys: Object.keys(first as object).slice(0, 12), sample: first }
            : first,
      };
    }
    if (typeof value !== 'object') return value;
    if (depth >= 1) return { keys: Object.keys(value).slice(0, 20) };
    const keys = Object.keys(value);
    const nested: Record<string, unknown> = {};
    for (const key of keys.slice(0, 16)) {
      nested[key] = this.summarizeSourceValue((value as Record<string, unknown>)[key], depth + 1);
    }
    return { keys, nested };
  }
}
