import { Injectable, Logger } from '@nestjs/common';
import * as geoip from 'geoip-lite';
import { PrismaService } from '../../../prisma/prisma.service';
import { httpError } from '../../utils/http-error';
import {
  EVENT_SOURCE,
  crawlerFromUserAgent,
  hostFromReferrer,
  isAiTraffic,
  parseUserAgent,
  resolveProvider,
  type EventSource,
} from '../../../utils/ai-signals.util';

/** Raw payload posted by the browser tracker. All fields are untrusted. */
export interface TrackEventInput {
  trackerVersion?: unknown;
  accountId?: unknown;
  ts?: unknown;
  url?: unknown;
  path?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  browser?: unknown;
  os?: unknown;
  device?: unknown;
  screen?: unknown;
  platform?: unknown;
  language?: unknown;
}

/** Request-derived context the client cannot be trusted to supply. */
export interface TrackRequestContext {
  userAgent: string;
  ip: string | null;
  origin: string | null;
  /** Edge-provided country code, preferred over the GeoIP database when present. */
  edgeCountry: string | null;
}

export interface TrackerStatus {
  hasEvents: boolean;
  eventCount: number;
  lastEventAt: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres TEXT is unbounded, but cap inputs so a hostile client cannot bloat rows. */
const MAX_URL = 2048;
const MAX_TEXT = 512;
const MAX_UA = 1024;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate, classify and store one event.
   *
   * Returns `{ stored: false }` rather than throwing when the request is well
   * formed but carries no AI signal, so ordinary traffic is a cheap no-op.
   */
  async collectEvent(
    input: TrackEventInput,
    context: TrackRequestContext,
  ): Promise<{ stored: boolean; eventId?: string; provider?: string | null }> {
    const tenantId = this.requireUuid(input.accountId, 'accountId');
    const url = this.requireString(input.url, 'url', MAX_URL);

    const tenant = await this.prisma.whitelabelTenant.findFirst({
      where: { id: tenantId, enabled: true },
      select: { id: true, domains: true, domain: true },
    });
    if (!tenant) {
      throw httpError('Unknown or disabled account', 404);
    }

    this.assertOriginAllowed(tenant, context.origin);

    const referrer = this.optionalString(input.referrer, MAX_URL);
    const utmSource = this.optionalString(input.utmSource, MAX_TEXT);
    const utmMedium = this.optionalString(input.utmMedium, MAX_TEXT);
    const utmCampaign = this.optionalString(input.utmCampaign, MAX_TEXT);
    const userAgent = context.userAgent.slice(0, MAX_UA);

    const signals = { referrer, utmSource, userAgent };
    if (!isAiTraffic(signals)) {
      return { stored: false };
    }

    // The user agent is read from the request, not the body, so a real crawler is
    // classified correctly and a human following a tagged link stays a USER.
    const crawler = crawlerFromUserAgent(userAgent);
    const source: EventSource = crawler ? EVENT_SOURCE.AI_CRAWLER : EVENT_SOURCE.USER;
    const provider = resolveProvider(signals);

    const parsedUa = parseUserAgent(userAgent);
    const geo = this.lookupGeo(context);

    const event = await this.prisma.analyticsEvent.create({
      data: {
        tenantId: tenant.id,
        trackerVersion: this.optionalString(input.trackerVersion, 20) ?? 'v1',
        timestamp: this.parseTimestamp(input.ts),
        url,
        path: this.resolvePath(input.path, url),
        referrer,
        userAgent,
        source,
        botName: crawler?.botName ?? null,
        provider,
        utmSource,
        utmMedium,
        utmCampaign,
        browser: this.optionalString(input.browser, MAX_TEXT) ?? parsedUa.browser,
        os: this.optionalString(input.os, MAX_TEXT) ?? parsedUa.os,
        device: this.optionalString(input.device, MAX_TEXT) ?? parsedUa.device,
        screen: this.optionalString(input.screen, MAX_TEXT),
        platform: this.optionalString(input.platform, MAX_TEXT),
        language: this.optionalString(input.language, MAX_TEXT),
        country: geo.country,
        city: geo.city,
        region: geo.region,
        ip: context.ip,
      },
      select: { id: true },
    });

    return { stored: true, eventId: event.id, provider };
  }

  /**
   * Record a hit from the no-JS pixel. Crawlers that fetch HTML without running
   * scripts can only be seen here, so the user agent is the sole signal.
   */
  async collectPixel(
    accountId: string | undefined,
    url: string | undefined,
    context: TrackRequestContext,
  ): Promise<{ stored: boolean }> {
    try {
      const result = await this.collectEvent(
        { accountId, url: url || 'https://unknown.invalid/', ts: new Date().toISOString() },
        context,
      );
      return { stored: result.stored };
    } catch (err) {
      // The pixel must always return an image, so failures are logged not thrown.
      this.logger.warn(
        `Pixel ingest failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { stored: false };
    }
  }

  async getStatus(tenantId: string): Promise<TrackerStatus> {
    const [eventCount, latest] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: { tenantId } }),
      this.prisma.analyticsEvent.findFirst({
        where: { tenantId },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
    ]);

    return {
      hasEvents: eventCount > 0,
      eventCount,
      lastEventAt: latest?.timestamp.toISOString() ?? null,
    };
  }

  /**
   * Reject events whose Origin is not one of the tenant's configured domains.
   *
   * Only enforced when the tenant has domains on file; tenants without any are
   * left open so onboarding is not blocked by missing configuration.
   */
  private assertOriginAllowed(
    tenant: { domains: string[]; domain: string | null },
    origin: string | null,
  ): void {
    const configured = [...tenant.domains, tenant.domain]
      .map((value) => hostFromReferrer(value))
      .filter((value): value is string => Boolean(value));

    if (configured.length === 0) return;

    // A missing Origin means a non-browser client (a crawler, or curl). Those
    // cannot be origin-checked, so let them through for user-agent classification.
    const originHost = hostFromReferrer(origin);
    if (!originHost) return;

    const allowed = configured.some(
      (candidate) => originHost === candidate || originHost.endsWith(`.${candidate}`),
    );
    if (!allowed) {
      throw httpError('Origin not allowed for this account', 403);
    }
  }

  private lookupGeo(context: TrackRequestContext): {
    country: string | null;
    city: string | null;
    region: string | null;
  } {
    if (!context.ip) {
      return { country: context.edgeCountry, city: null, region: null };
    }

    try {
      const found = geoip.lookup(context.ip);
      if (found) {
        return {
          country: found.country || context.edgeCountry,
          city: found.city || null,
          region: found.region || null,
        };
      }
    } catch (err) {
      this.logger.warn(
        `GeoIP lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { country: context.edgeCountry, city: null, region: null };
  }

  private parseTimestamp(value: unknown): Date {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        // Reject clock-skewed or replayed timestamps so range queries stay sane.
        const now = Date.now();
        const drift = parsed.getTime() - now;
        if (drift < 48 * 60 * 60 * 1000 && drift > -30 * 24 * 60 * 60 * 1000) {
          return parsed;
        }
      }
    }
    return new Date();
  }

  /** Prefer the reported path, falling back to parsing it out of the URL. */
  private resolvePath(value: unknown, url: string): string {
    const reported = this.optionalString(value, MAX_URL);
    if (reported) return reported;
    try {
      return new URL(url).pathname || '/';
    } catch {
      return '/';
    }
  }

  private requireUuid(value: unknown, field: string): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!UUID_RE.test(raw)) {
      throw httpError(`${field} must be a UUID`, 400);
    }
    return raw;
  }

  private requireString(value: unknown, field: string, max: number): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
      throw httpError(`${field} is required`, 400);
    }
    return raw.slice(0, max);
  }

  private optionalString(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  }
}
