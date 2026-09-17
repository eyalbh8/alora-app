import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SourceApiService } from '../source-api.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { ZernioService } from '../integrations/zernio.service';
import { linkPublishedUrlToPosts } from '../monitored-proposals.util';
import {
  getLocalClock,
  isDueHour,
  localDateDaysAgo,
} from '../../../utils/account-local-time.util';
import type { PlatformsMap, SocialMediaProvider } from './mcp-posts.client';
import {
  findBlogArticleForDay,
  findBlogArticleViaAiScan,
  type BlogArticleCandidate,
} from './blog-url-discovery.util';
import { DailyContentLlmService } from './daily-content-llm.service';

/** Social platforms swept nightly. Adding X here is all it takes. */
export const TRACKED_PLATFORMS: SocialMediaProvider[] = [
  'LINKEDIN',
  'FACEBOOK',
  'INSTAGRAM',
];

const BLOG_PLATFORM: SocialMediaProvider = 'BLOG';
const DEFAULT_TIMEZONE = 'Asia/Nicosia';
/** Local hour the sweep runs at; it always processes the day that just ended. */
const TRACKER_HOUR = 0;
const ZERNIO_PAGE_LIMIT = 25;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrackStatus =
  | 'LINKED'
  | 'ALREADY_LINKED'
  | 'NO_POST'
  | 'NOT_CONNECTED'
  | 'NO_URL'
  | 'ERROR';

export type TrackOutcome = {
  platform: string;
  igeoPostId: string | null;
  url: string | null;
  status: TrackStatus;
  trackedRecommendationId?: string | null;
  error?: string | null;
};

export type TenantTrackResult = {
  tenantId: string;
  localDate: string;
  skipped?: string;
  outcomes: TrackOutcome[];
};

type TrackerTenant = {
  id: string;
  source_account_id: string;
  mcp_api_key: string | null;
  domain: string | null;
  dailyContentTimezone: string;
  name: string | null;
};

type ExistingRow = {
  id: string;
  platform: string;
  platformPostUrl: string | null;
  zernioPostId: string | null;
  igeoLinkedAt: Date | null;
  trackedRecommendationId: string | null;
};

/**
 * Nightly sweep that attaches each day's live post URL to the iGEO post it came
 * from, covering the cases the publish-time link misses: Zernio still
 * `publishing` when we asked, a failed monitored-proposals call, and BLOG
 * (which publishes through iGEO and never records a URL).
 */
@Injectable()
export class PublishedUrlTrackerService {
  private readonly logger = new Logger(PublishedUrlTrackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourceApi: SourceApiService,
    @Inject(forwardRef(() => IntegrationsService))
    private readonly integrations: IntegrationsService,
    private readonly zernio: ZernioService,
    private readonly llm: DailyContentLlmService,
  ) {}

  /** Cron entry: sweep every tenant whose local clock just passed midnight. */
  async runTick(now = new Date()): Promise<{
    tenants: number;
    linked: number;
    results: TenantTrackResult[];
  }> {
    const tenants = await this.listTenants();
    const results: TenantTrackResult[] = [];

    for (const tenant of tenants) {
      const tz = tenant.dailyContentTimezone || DEFAULT_TIMEZONE;
      if (!isDueHour(now, tz, TRACKER_HOUR)) continue;

      // At local midnight the day worth inspecting is the one that just ended.
      const localDate = localDateDaysAgo(getLocalClock(now, tz).localDate, 1);
      try {
        results.push(await this.trackTenantDay(tenant.id, localDate));
      } catch (err) {
        this.logger.error(
          `Tracking failed for tenant ${tenant.id} on ${localDate}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    const linked = results.reduce(
      (sum, r) => sum + r.outcomes.filter((o) => o.status === 'LINKED').length,
      0,
    );
    return { tenants: results.length, linked, results };
  }

  /** Sweep one tenant for one account-local calendar day. */
  async trackTenantDay(
    tenantId: string,
    localDate: string,
  ): Promise<TenantTrackResult> {
    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        domain: true,
        dailyContentTimezone: true,
        name: true,
      },
    });
    if (!tenant) {
      return { tenantId, localDate, skipped: 'tenant not found', outcomes: [] };
    }

    const run = await this.prisma.dailyContentRun.findUnique({
      where: { tenantId_localDate: { tenantId, localDate } },
      select: { id: true, platforms: true },
    });
    if (!run) {
      // Without a run there is no iGEO post to attach a URL to, and an
      // unattached URL is exactly what we must not create.
      return {
        tenantId,
        localDate,
        skipped: `no daily content run for ${localDate}`,
        outcomes: [],
      };
    }

    const { accountId, apiKey } = await this.sourceApi.resolveCredentials(tenantId);
    const platforms = (run.platforms ?? {}) as unknown as PlatformsMap;
    const timeZone = tenant.dailyContentTimezone || DEFAULT_TIMEZONE;

    const priorRows = await this.prisma.publishedPost.findMany({
      where: { tenantId, runId: run.id },
      select: {
        id: true,
        igeoPostId: true,
        platform: true,
        platformPostUrl: true,
        zernioPostId: true,
        igeoLinkedAt: true,
        trackedRecommendationId: true,
      },
    });
    // Keyed the same way the table is unique, so a run that switched its
    // selected post cannot read another post's link state.
    const rowByKey = new Map(
      priorRows.map((r) => [`${r.igeoPostId}::${r.platform}`, r]),
    );
    const knownZernioPostIds = new Set(
      priorRows.map((r) => r.zernioPostId).filter((id): id is string => Boolean(id)),
    );

    const existingFor = (igeoPostId: string | null, platform: string) =>
      igeoPostId ? rowByKey.get(`${igeoPostId}::${platform}`) ?? null : null;

    const outcomes: TrackOutcome[] = [];
    for (const platform of TRACKED_PLATFORMS) {
      const igeoPostId = this.igeoPostIdFor(platforms, platform);
      outcomes.push(
        await this.trackSocialPlatform({
          tenant,
          runId: run.id,
          accountId,
          apiKey,
          platform,
          localDate,
          timeZone,
          igeoPostId,
          existing: existingFor(igeoPostId, platform),
          knownZernioPostIds,
        }),
      );
    }

    const blogPostId = this.igeoPostIdFor(platforms, BLOG_PLATFORM);
    outcomes.push(
      await this.trackBlog({
        tenant,
        runId: run.id,
        accountId,
        apiKey,
        localDate,
        timeZone,
        igeoPostId: blogPostId,
        existing: existingFor(blogPostId, BLOG_PLATFORM),
      }),
    );

    return { tenantId, localDate, outcomes };
  }

  private async listTenants(): Promise<TrackerTenant[]> {
    const rows = await this.prisma.whitelabelTenant.findMany({
      where: { enabled: true, mcp_api_key: { not: null } },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        domain: true,
        dailyContentTimezone: true,
        name: true,
      },
    });
    return rows.filter((r) => Boolean(r.mcp_api_key));
  }

  /** The post this run actually produced for a platform. */
  private igeoPostIdFor(
    platforms: PlatformsMap,
    provider: SocialMediaProvider,
  ): string | null {
    const state = platforms?.[provider];
    if (!state) return null;
    const id = state.selectedPostId || state.postIds?.[0] || null;
    return id && UUID_RE.test(id) ? id : null;
  }

  private toDate(stamp: string | null | undefined): Date | null {
    if (!stamp) return null;
    const parsed = new Date(stamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private isOnLocalDate(
    stamp: string | null,
    localDate: string,
    timeZone: string,
  ): boolean {
    const parsed = this.toDate(stamp);
    if (!parsed) return false;
    return getLocalClock(parsed, timeZone).localDate === localDate;
  }

  private async trackSocialPlatform(ctx: {
    tenant: TrackerTenant;
    runId: string;
    accountId: string;
    apiKey: string;
    platform: SocialMediaProvider;
    localDate: string;
    timeZone: string;
    igeoPostId: string | null;
    existing: ExistingRow | null;
    knownZernioPostIds: Set<string>;
  }): Promise<TrackOutcome> {
    const base = { platform: ctx.platform, igeoPostId: ctx.igeoPostId, url: null };

    if (!ctx.igeoPostId) {
      return { ...base, status: 'NO_POST' };
    }
    if (ctx.existing?.igeoLinkedAt) {
      return {
        ...base,
        url: ctx.existing.platformPostUrl,
        status: 'ALREADY_LINKED',
        trackedRecommendationId: ctx.existing.trackedRecommendationId,
      };
    }

    const account = await this.integrations.getConnectedAccount(
      ctx.tenant.id,
      ctx.platform,
    );
    if (!account) {
      return { ...base, status: 'NOT_CONNECTED' };
    }

    let url = ctx.existing?.platformPostUrl ?? null;
    let zernioPostId = ctx.existing?.zernioPostId ?? null;
    let publishedAt: Date | null = null;

    try {
      if (!url && zernioPostId) {
        // We know exactly which Zernio post this is; ask for it directly.
        const post = await this.zernio.getPost(zernioPostId);
        url = this.platformUrlFor(post?.platforms ?? [], account.id, account.platform);
        publishedAt = this.toDate(post?.publishedAt ?? post?.createdAt);
      }
      if (!url) {
        const found = await this.findDayPostUrl({
          zernioAccountId: account.id,
          zernioPlatform: account.platform,
          localDate: ctx.localDate,
          timeZone: ctx.timeZone,
          preferPostIds: ctx.knownZernioPostIds,
        });
        if (found) {
          url = found.url;
          zernioPostId = found.zernioPostId ?? zernioPostId;
          publishedAt = found.publishedAt;
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Zernio lookup failed for ${ctx.tenant.id}/${ctx.platform} on ${ctx.localDate}: ${error}`,
      );
      return { ...base, status: 'ERROR', error };
    }

    if (!url) {
      return { ...base, status: 'NO_URL' };
    }

    return this.trackUrl({
      tenantId: ctx.tenant.id,
      accountId: ctx.accountId,
      apiKey: ctx.apiKey,
      runId: ctx.runId,
      igeoPostId: ctx.igeoPostId,
      platform: ctx.platform,
      url,
      zernioPostId,
      zernioAccountId: account.id,
      publishedAt,
    });
  }

  /** Our account's live URL on a post, falling back to the platform match. */
  private platformUrlFor(
    platforms: Array<{ platform: string; accountId: string | null; platformPostUrl: string | null }>,
    zernioAccountId: string,
    zernioPlatform: string,
  ): string | null {
    const withUrl = platforms.filter((p) => p.platformPostUrl);
    const hit =
      withUrl.find((p) => p.accountId === zernioAccountId) ??
      withUrl.find((p) => p.platform === zernioPlatform);
    return hit?.platformPostUrl ?? null;
  }

  /**
   * The account's newest post published on `localDate`. Prefers a post this run
   * already recorded, so a manual post published later the same day cannot win.
   *
   * No status filter: a `partial` post (one platform failed) still carries a
   * real URL for the platforms that succeeded, and requiring platformPostUrl
   * already excludes drafts and scheduled posts.
   */
  private async findDayPostUrl(opts: {
    zernioAccountId: string;
    zernioPlatform: string;
    localDate: string;
    timeZone: string;
    preferPostIds: Set<string>;
  }): Promise<{
    url: string;
    zernioPostId: string | null;
    publishedAt: Date | null;
  } | null> {
    // Zernio defaults to origin=zernio when `source` is omitted, which hides
    // native uploads synced from the platform (origin=external). The nightly
    // sweep has to see both: posts we published and posts they uploaded.
    const [authored, external, accountFeed] = await Promise.all([
      this.zernio.listPosts({
        accountId: opts.zernioAccountId,
        source: 'zernio',
        dateFrom: localDateDaysAgo(opts.localDate, 1),
        dateTo: localDateDaysAgo(opts.localDate, -1),
        sort: 'created-desc',
        limit: ZERNIO_PAGE_LIMIT,
      }),
      this.zernio.listPosts({
        accountId: opts.zernioAccountId,
        source: 'external',
        dateFrom: localDateDaysAgo(opts.localDate, 1),
        dateTo: localDateDaysAgo(opts.localDate, -1),
        sort: 'created-desc',
        limit: ZERNIO_PAGE_LIMIT,
      }),
      this.zernio.listAccountPosts(opts.zernioAccountId, {
        limit: ZERNIO_PAGE_LIMIT,
      }),
    ]);
    const seen = new Set<string>();
    const posts = [...authored, ...external, ...accountFeed].filter((p) => {
      const key = p.postId ?? `${p.createdAt}:${p.platforms[0]?.platformPostUrl ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sameDay = posts.filter((p) =>
      this.isOnLocalDate(
        p.publishedAt ?? p.createdAt ?? p.scheduledFor,
        opts.localDate,
        opts.timeZone,
      ),
    );
    if (!sameDay.length) return null;

    const ordered = [
      ...sameDay.filter((p) => p.postId && opts.preferPostIds.has(p.postId)),
      ...sameDay.filter((p) => !p.postId || !opts.preferPostIds.has(p.postId)),
    ];

    for (const post of ordered) {
      const url = this.platformUrlFor(
        post.platforms,
        opts.zernioAccountId,
        opts.zernioPlatform,
      );
      if (url) {
        return {
          url,
          zernioPostId: post.postId,
          publishedAt: this.toDate(post.publishedAt ?? post.createdAt),
        };
      }
    }
    return null;
  }

  private async trackBlog(ctx: {
    tenant: TrackerTenant;
    runId: string;
    accountId: string;
    apiKey: string;
    localDate: string;
    timeZone: string;
    igeoPostId: string | null;
    existing: ExistingRow | null;
  }): Promise<TrackOutcome> {
    const base = { platform: BLOG_PLATFORM, igeoPostId: ctx.igeoPostId, url: null };

    if (!ctx.igeoPostId) {
      return { ...base, status: 'NO_POST' };
    }
    if (ctx.existing?.igeoLinkedAt) {
      return {
        ...base,
        url: ctx.existing.platformPostUrl,
        status: 'ALREADY_LINKED',
        trackedRecommendationId: ctx.existing.trackedRecommendationId,
      };
    }

    let url = ctx.existing?.platformPostUrl ?? null;
    let publishedAt: Date | null = null;

    if (!url) {
      // A blog that is unreachable must never take down the social sweep.
      try {
        const found = await this.discoverBlogArticle(
          ctx.tenant,
          ctx.localDate,
          ctx.timeZone,
        );
        if (found) {
          url = found.url;
          publishedAt = this.toDate(found.publishedAt);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Blog discovery failed for ${ctx.tenant.id} on ${ctx.localDate}: ${error}`,
        );
        return { ...base, status: 'ERROR', error };
      }
    }

    if (!url) {
      return { ...base, status: 'NO_URL' };
    }

    return this.trackUrl({
      tenantId: ctx.tenant.id,
      accountId: ctx.accountId,
      apiKey: ctx.apiKey,
      runId: ctx.runId,
      igeoPostId: ctx.igeoPostId,
      platform: BLOG_PLATFORM,
      url,
      publishedAt,
    });
  }

  private async discoverBlogArticle(
    tenant: TrackerTenant,
    localDate: string,
    timeZone: string,
  ): Promise<BlogArticleCandidate | null> {
    const bases: string[] = [];

    try {
      const sites = await this.integrations.loadIgeoBlogSites(tenant.id);
      const ordered = [
        ...sites.filter((s) => s.kind === 'wordpress'),
        ...sites.filter((s) => s.kind !== 'wordpress'),
      ];
      for (const site of ordered) {
        if (site.url) bases.push(site.url);
      }
    } catch (err) {
      this.logger.warn(
        `Could not load iGEO blog sites for ${tenant.id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
    if (tenant.domain) {
      bases.push(tenant.domain);
      bases.push(`${tenant.domain.replace(/\/+$/, '')}/blog`);
    }

    for (const baseUrl of [...new Set(bases)]) {
      const found = await findBlogArticleForDay({ baseUrl, localDate, timeZone });
      if (found) return found;
    }

    if (this.llm.hasLlmConfigured()) {
      for (const baseUrl of [...new Set(bases)]) {
        try {
          const found = await findBlogArticleViaAiScan({
            listingUrl: /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`,
            localDate,
            completeJson: (system, user) => this.llm.completeJson(system, user),
          });
          if (found) return found;
        } catch (err) {
          this.logger.warn(
            `AI blog scan failed for ${tenant.id} at ${baseUrl}: ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
      }
    }

    const shopify = await this.prisma.zernioAccount.findFirst({
      where: { tenantId: tenant.id, platform: 'shopify', status: 'connected' },
      select: { id: true },
    });
    if (shopify) {
      this.logger.log(
        `Shopify is connected for ${tenant.id} but Shopify article URLs are not resolved yet; skipping blog tracking for ${localDate}`,
      );
    }
    return null;
  }

  /**
   * Persist the URL, then link it to the iGEO post. monitored-proposals is not
   * idempotent, so the igeoLinkedAt guard is what stops duplicate tracking.
   */
  private async trackUrl(input: {
    tenantId: string;
    accountId: string;
    apiKey: string;
    runId: string;
    igeoPostId: string;
    platform: string;
    url: string;
    zernioPostId?: string | null;
    zernioAccountId?: string | null;
    publishedAt?: Date | null;
  }): Promise<TrackOutcome> {
    const row = await this.prisma.publishedPost.upsert({
      where: {
        igeoPostId_platform: {
          igeoPostId: input.igeoPostId,
          platform: input.platform,
        },
      },
      create: {
        tenantId: input.tenantId,
        runId: input.runId,
        igeoPostId: input.igeoPostId,
        platform: input.platform,
        zernioPostId: input.zernioPostId ?? null,
        zernioAccountId: input.zernioAccountId ?? null,
        platformPostUrl: input.url,
        publishedAt: input.publishedAt ?? new Date(),
      },
      update: {
        platformPostUrl: input.url,
        zernioPostId: input.zernioPostId ?? undefined,
        zernioAccountId: input.zernioAccountId ?? undefined,
      },
    });

    const base = {
      platform: input.platform,
      igeoPostId: input.igeoPostId,
      url: input.url,
    };

    if (row.igeoLinkedAt) {
      return {
        ...base,
        status: 'ALREADY_LINKED',
        trackedRecommendationId: row.trackedRecommendationId,
      };
    }

    try {
      const linked = await linkPublishedUrlToPosts(this.sourceApi, {
        accountId: input.accountId,
        apiKey: input.apiKey,
        url: input.url,
        postIds: [input.igeoPostId],
      });
      await this.prisma.publishedPost.update({
        where: { id: row.id },
        data: {
          igeoLinkedAt: new Date(),
          trackedRecommendationId: linked.id,
          linkError: null,
        },
      });
      this.logger.log(
        `Tracked ${input.platform} ${input.url} against iGEO post ${input.igeoPostId}`,
      );
      return { ...base, status: 'LINKED', trackedRecommendationId: linked.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to link ${input.url} to iGEO post ${input.igeoPostId}: ${error}`,
      );
      await this.prisma.publishedPost.update({
        where: { id: row.id },
        data: { linkError: error },
      });
      return { ...base, status: 'ERROR', error };
    }
  }
}
