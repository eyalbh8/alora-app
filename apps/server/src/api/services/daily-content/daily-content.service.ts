import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '../../../config/config.service';
import { SourceApiService } from '../source-api.service';
import { getMcpUrl } from '../../utils/mcp-connection.util';
import {
  getLocalClock,
  isDueHour,
  localDateDaysAgo,
} from '../../../utils/account-local-time.util';
import {
  buildRecentWorkPromptIds,
  normalizePromptText,
  selectDailyContentPrompt,
  type SelectablePrompt,
} from '../../../utils/daily-content-prompt-selection.util';
import {
  DAILY_CONTENT_PLATFORMS,
  emptyPlatformsMap,
  McpPostsClient,
  McpPostsError,
  PLATFORM_WANTS_IMAGE,
  type PlatformsMap,
  type PlatformState,
  type SocialMediaProvider,
} from './mcp-posts.client';
import { IntegrationsService } from '../integrations/integrations.service';
import { ZernioService } from '../integrations/zernio.service';
import { toZernioPlatform } from '../integrations/platform-map';
import { linkPublishedUrlToPosts } from '../monitored-proposals.util';

const STALE_DAYS = 50;
const GENERATING_TIMEOUT_MS = 60 * 60 * 1000;

type EligibleTenant = {
  id: string;
  source_account_id: string;
  mcp_api_key: string | null;
  dailyContentTimezone: string;
  dailyContentHour: number;
  name: string | null;
};

type PublishPlatformResult = {
  ok: boolean;
  skipped?: boolean;
  provider: string;
  postId: string;
  platformPostUrl?: string | null;
  zernioPostId?: string | null;
  trackedRecommendationId?: string | null;
  error?: string | null;
  result?: unknown;
};

function requestIdFor(parts: string[]): string {
  const hash = createHash('sha256').update(parts.join(':')).digest('hex');
  // UUID-shaped for Zernio x-request-id format
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    'a' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

@Injectable()
export class DailyContentService {
  private readonly logger = new Logger(DailyContentService.name);
  private readonly lambda = new LambdaClient({});

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sourceApi: SourceApiService,
    @Inject(forwardRef(() => IntegrationsService))
    private readonly integrations: IntegrationsService,
    private readonly zernio: ZernioService,
  ) {}

  /** Cron entry: start due tenants + sweep in-flight runs. */
  async runSchedulerTick(now = new Date()): Promise<{
    started: number;
    swept: number;
    invoked: number;
  }> {
    const started = await this.runStartPass(now);
    const { swept, invoked } = await this.runSweepPass(now);
    return { started, swept, invoked };
  }

  async runStartPass(now = new Date()): Promise<number> {
    const tenants = await this.listEligibleTenants();
    let started = 0;
    for (const tenant of tenants) {
      try {
        const did = await this.maybeStartForTenant(tenant, now, false);
        if (did) started += 1;
      } catch (err) {
        this.logger.error(
          `Start pass failed for tenant ${tenant.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return started;
  }

  /**
   * Manual / local kickoff: ignore the configured local hour gate.
   * Still idempotent on (tenantId, localDate).
   */
  async forceStartForTenant(tenantId: string, now = new Date()): Promise<{
    started: boolean;
    runId?: string;
    status?: string;
    skipReason?: string | null;
  }> {
    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
        name: true,
        enabled: true,
        dailyContentAutomation: true,
      },
    });
    if (!tenant?.enabled) {
      throw new Error(`Tenant ${tenantId} not found or disabled`);
    }
    if (!tenant.mcp_api_key) {
      throw new Error(`Tenant ${tenantId} has no MCP API key`);
    }
    if (!tenant.dailyContentAutomation) {
      throw new Error(`Tenant ${tenantId} does not have daily content automation enabled`);
    }

    const eligible: EligibleTenant = {
      id: tenant.id,
      source_account_id: tenant.source_account_id,
      mcp_api_key: tenant.mcp_api_key,
      dailyContentTimezone: tenant.dailyContentTimezone,
      dailyContentHour: tenant.dailyContentHour,
      name: tenant.name,
    };

    const tz = eligible.dailyContentTimezone || 'Asia/Nicosia';
    const { localDate } = getLocalClock(now, tz);
    const existing = await this.prisma.dailyContentRun.findUnique({
      where: { tenantId_localDate: { tenantId, localDate } },
    });
    if (existing) {
      return {
        started: false,
        runId: existing.id,
        status: existing.status,
        skipReason: existing.skipReason,
      };
    }

    const did = await this.maybeStartForTenant(eligible, now, true);
    const run = await this.prisma.dailyContentRun.findUnique({
      where: { tenantId_localDate: { tenantId, localDate } },
    });
    return {
      started: did,
      runId: run?.id,
      status: run?.status,
      skipReason: run?.skipReason,
    };
  }

  async runSweepPass(now = new Date()): Promise<{ swept: number; invoked: number }> {
    const runs = await this.prisma.dailyContentRun.findMany({
      where: { status: 'GENERATING' },
      take: 50,
    });
    let swept = 0;
    let invoked = 0;
    for (const run of runs) {
      try {
        const result = await this.sweepRun(run.id, now);
        if (result.swept) swept += 1;
        if (result.invoked) invoked += 1;
      } catch (err) {
        this.logger.error(
          `Sweep failed for run ${run.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return { swept, invoked };
  }

  async listRuns(tenantId: string, take = 30) {
    return this.prisma.dailyContentRun.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(100, Math.max(1, take)),
    });
  }

  /**
   * Load selected (or generated) posts for a run via MCP, for the Daily automation UI.
   */
  async getRunPosts(tenantId: string, runId: string) {
    const { run, tenant } = await this.requireRunWithTenant(tenantId, runId);
    const posts = await this.loadPostsForRun(run, tenant);
    return {
      run: {
        id: run.id,
        localDate: run.localDate,
        status: run.status,
        promptText: run.promptText,
        selectionRationale: run.selectionRationale,
      },
      posts,
    };
  }

  /** DB-only list of run days for the Content screen day picker. */
  async listRunDays(tenantId: string, take = 60) {
    const rows = await this.prisma.dailyContentRun.findMany({
      where: { tenantId },
      orderBy: { localDate: 'desc' },
      take: Math.min(120, Math.max(1, take)),
      select: {
        id: true,
        localDate: true,
        status: true,
        promptText: true,
        completedAt: true,
      },
    });
    return rows.map((row) => ({
      localDate: row.localDate,
      runId: row.id,
      status: row.status,
      promptText: row.promptText,
      completedAt: row.completedAt,
    }));
  }

  /** Day-scoped posts for the Content screen (one run per localDate). */
  async getPostsForDate(tenantId: string, localDate: string) {
    const run = await this.prisma.dailyContentRun.findUnique({
      where: { tenantId_localDate: { tenantId, localDate } },
    });
    if (!run) {
      return {
        run: null,
        posts: [],
      };
    }

    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
        name: true,
      },
    });
    if (!tenant?.mcp_api_key) {
      const err = new Error('Tenant MCP key missing') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const posts = await this.loadPostsForRun(run, tenant);
    return {
      run: {
        id: run.id,
        localDate: run.localDate,
        status: run.status,
        promptText: run.promptText,
        selectionRationale: run.selectionRationale,
      },
      posts,
    };
  }

  private async loadPostsForRun(
    run: {
      id?: string;
      platforms: unknown;
    },
    tenant: {
      id?: string;
      source_account_id: string;
      mcp_api_key: string | null;
    },
  ) {
    const client = this.mcpClientFor(tenant);
    const platforms = this.parsePlatforms(run.platforms);
    const posts: Array<{
      platform: SocialMediaProvider;
      postId: string;
      generationId: string | null;
      title: string | null;
      body: string | null;
      state: string | null;
      slug: string | null;
      metaTitle: string | null;
      metaDescription: string | null;
      focusKeyphrase: string | null;
      createdAt: string | null;
      selected: boolean;
      imagesUrl: string[];
      tags: string[];
      topic: string | null;
      readTime: number | null;
      publishAt: string | null;
      isPublished: boolean;
      platformPostUrl: string | null;
      trackedRecommendationId: string | null;
    }> = [];

    for (const provider of DAILY_CONTENT_PLATFORMS) {
      const state = platforms[provider];
      if (!state) continue;
      const preferredId = state.selectedPostId || state.postIds?.[0];
      if (!preferredId && !state.generationId) continue;

      let post = preferredId
        ? await client.getPost(preferredId, { generationId: state.generationId })
        : null;
      if (!post && state.generationId) {
        const list = await client.getPostsByGenerationId(state.generationId);
        post =
          list.find((p) => p.id === preferredId) ||
          list.find((p) => String(p.state).toUpperCase() !== 'DELETED') ||
          list[0] ||
          null;
      }
      if (!post) continue;

      posts.push({
        platform: provider,
        postId: post.id,
        generationId: post.generationId || state.generationId || null,
        title: post.title ?? null,
        body: post.body ?? null,
        state: post.state ?? null,
        slug: post.slug ?? null,
        metaTitle: post.metaTitle ?? null,
        metaDescription: post.metaDescription ?? null,
        focusKeyphrase: post.focusKeyphrase ?? null,
        createdAt: post.createdAt ?? null,
        selected: Boolean(state.selectedPostId && state.selectedPostId === post.id),
        imagesUrl: post.imagesUrl ?? [],
        tags: post.tags ?? [],
        topic: post.topic ?? null,
        readTime: post.readTime ?? null,
        publishAt: post.publishAt ?? null,
        isPublished: Boolean(post.isPublished),
        platformPostUrl: null,
        trackedRecommendationId: null,
      });
    }

    if (posts.length && tenant.id) {
      const published = await this.prisma.publishedPost.findMany({
        where: {
          tenantId: tenant.id,
          igeoPostId: { in: posts.map((p) => p.postId) },
        },
        select: {
          igeoPostId: true,
          platformPostUrl: true,
          trackedRecommendationId: true,
        },
      });
      const byId = new Map(published.map((p) => [p.igeoPostId, p]));
      for (const post of posts) {
        const hit = byId.get(post.postId);
        if (hit) {
          post.platformPostUrl = hit.platformPostUrl;
          post.trackedRecommendationId = hit.trackedRecommendationId;
          if (hit.platformPostUrl) post.isPublished = true;
        }
      }
    }

    return posts;
  }

  async updateRunPost(
    tenantId: string,
    runId: string,
    postId: string,
    patch: {
      body?: string;
      title?: string;
      tags?: string[];
      focusKeyphrase?: string;
      metaDescription?: string;
      slug?: string;
      publishAt?: string | null;
      removeImages?: boolean;
      state?: string;
    },
  ) {
    const { run, tenant, provider } = await this.requireOwnedPost(tenantId, runId, postId);
    void run;
    const client = this.mcpClientFor(tenant);
    const updated = await client.updatePost(postId, {
      socialMediaProvider: provider,
      ...patch,
    });
    return {
      platform: provider,
      postId,
      generationId: updated?.generationId ?? null,
      title: updated?.title ?? null,
      body: updated?.body ?? null,
      state: updated?.state ?? null,
      slug: updated?.slug ?? null,
      metaTitle: updated?.metaTitle ?? null,
      metaDescription: updated?.metaDescription ?? null,
      focusKeyphrase: updated?.focusKeyphrase ?? null,
      createdAt: updated?.createdAt ?? null,
      selected: true,
      imagesUrl: updated?.imagesUrl ?? [],
      tags: updated?.tags ?? [],
      topic: updated?.topic ?? null,
      readTime: updated?.readTime ?? null,
      publishAt: updated?.publishAt ?? null,
      isPublished: Boolean(updated?.isPublished),
    };
  }

  async publishRunPost(
    tenantId: string,
    runId: string,
    postId: string,
    options: {
      siteIds?: string[];
      categoryBySite?: Record<string, number>;
    } = {},
  ): Promise<PublishPlatformResult> {
    const { tenant, provider, run } = await this.requireOwnedPost(
      tenantId,
      runId,
      postId,
    );

    if (provider === 'BLOG') {
      return this.publishBlogViaIgeo(tenant, runId, postId, options);
    }

    const client = this.mcpClientFor(tenant);
    const post = await client.getPost(postId);
    if (!post) {
      const err = new Error('Post not found upstream') as Error & {
        statusCode: number;
      };
      err.statusCode = 404;
      throw err;
    }

    const results = await this.publishSocialViaZernio(tenantId, run.id, [
      {
        provider,
        postId,
        title: post.title ?? null,
        body: post.body ?? null,
        imagesUrl: post.imagesUrl ?? [],
      },
    ]);
    return results[0];
  }

  /**
   * Publish every selected, not-yet-published post in a run.
   * Social platforms go out in one Zernio call; BLOG goes through iGEO.
   */
  async publishRun(
    tenantId: string,
    runId: string,
    options: {
      platforms?: string[];
      siteIds?: string[];
      categoryBySite?: Record<string, number>;
    } = {},
  ): Promise<{ results: PublishPlatformResult[] }> {
    const { run, tenant } = await this.requireRunWithTenant(tenantId, runId);
    const posts = await this.loadPostsForRun(run, tenant);
    const filter = options.platforms?.map((p) => p.toUpperCase());
    const eligible = posts.filter((p) => {
      if (p.isPublished || String(p.state).toUpperCase() === 'POSTED') return false;
      if (filter && !filter.includes(p.platform)) return false;
      return true;
    });

    const results: PublishPlatformResult[] = [];
    const social = eligible.filter((p) => p.platform !== 'BLOG');
    const blog = eligible.find((p) => p.platform === 'BLOG');

    if (social.length) {
      const socialResults = await this.publishSocialViaZernio(
        tenantId,
        runId,
        social.map((p) => ({
          provider: p.platform,
          postId: p.postId,
          title: p.title,
          body: p.body,
          imagesUrl: p.imagesUrl,
        })),
      );
      results.push(...socialResults);
    }

    if (blog) {
      try {
        results.push(
          await this.publishBlogViaIgeo(tenant, runId, blog.postId, {
            siteIds: options.siteIds,
            categoryBySite: options.categoryBySite,
          }),
        );
      } catch (err) {
        results.push({
          ok: false,
          provider: 'BLOG',
          postId: blog.postId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { results };
  }

  private async publishBlogViaIgeo(
    tenant: { source_account_id: string; mcp_api_key: string | null },
    runId: string,
    postId: string,
    options: {
      siteIds?: string[];
      categoryBySite?: Record<string, number>;
    },
  ): Promise<PublishPlatformResult> {
    const accountId = tenant.source_account_id;
    const apiKey = tenant.mcp_api_key!;
    if (!options.siteIds?.length) {
      const err = new Error('Select at least one WordPress site to publish') as Error & {
        statusCode: number;
      };
      err.statusCode = 400;
      throw err;
    }
    const body: Record<string, unknown> = {
      postId,
      provider: 'BLOG',
      siteIds: options.siteIds,
    };
    if (options.categoryBySite) body.categoryBySite = options.categoryBySite;

    const result = await this.sourceApi.sourceRequest(
      accountId,
      apiKey,
      `/accounts/${accountId}/agents/publish`,
      { method: 'POST', body },
    );
    void runId;
    return { ok: true, provider: 'BLOG', postId, result };
  }

  private async publishSocialViaZernio(
    tenantId: string,
    runId: string,
    items: Array<{
      provider: SocialMediaProvider | string;
      postId: string;
      title: string | null;
      body: string | null;
      imagesUrl: string[];
    }>,
  ): Promise<PublishPlatformResult[]> {
    const { accountId, apiKey } = await this.sourceApi.resolveCredentials(tenantId);
    const results: PublishPlatformResult[] = [];
    const platformEntries: Array<{
      platform: string;
      accountId: string;
      customContent?: string;
      menchly: string;
      postId: string;
      zernioAccountId: string;
    }> = [];

    for (const item of items) {
      const zernioPlatform = toZernioPlatform(item.provider);
      if (!zernioPlatform) {
        results.push({
          ok: false,
          skipped: true,
          provider: item.provider,
          postId: item.postId,
          error: `Platform ${item.provider} is not supported via Zernio`,
        });
        continue;
      }
      const account = await this.integrations.getConnectedAccount(
        tenantId,
        item.provider,
      );
      if (!account) {
        results.push({
          ok: false,
          skipped: true,
          provider: item.provider,
          postId: item.postId,
          error: `${item.provider} is not connected. Connect it in Integrations first.`,
        });
        continue;
      }
      const content = (item.body || item.title || '').trim();
      platformEntries.push({
        platform: zernioPlatform,
        accountId: account.id,
        customContent: content || undefined,
        menchly: item.provider,
        postId: item.postId,
        zernioAccountId: account.id,
      });
    }

    if (!platformEntries.length) return results;

    // Collect media from first item that has images (shared when present)
    const mediaItems = items
      .flatMap((i) => i.imagesUrl || [])
      .filter(Boolean)
      .slice(0, 4)
      .map((url) => ({ type: 'image', url }));

    const requestId = requestIdFor([
      runId,
      ...platformEntries.map((p) => p.postId).sort(),
    ]);

    let zernioResult;
    try {
      zernioResult = await this.zernio.createPost({
        // Fallback content when customContent is absent on an entry
        content:
          platformEntries[0]?.customContent ||
          items[0]?.title ||
          ' ',
        platforms: platformEntries.map((p) => ({
          platform: p.platform,
          accountId: p.accountId,
          customContent: p.customContent,
        })),
        mediaItems: mediaItems.length ? mediaItems : undefined,
        publishNow: true,
        requestId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const entry of platformEntries) {
        results.push({
          ok: false,
          provider: entry.menchly,
          postId: entry.postId,
          error: message,
        });
      }
      return results;
    }

    for (const entry of platformEntries) {
      const platformHit =
        zernioResult.platforms.find(
          (p) =>
            p.platform === entry.platform ||
            p.accountId === entry.zernioAccountId,
        ) || null;
      const platformPostUrl = platformHit?.platformPostUrl ?? null;
      const failed =
        platformHit?.status === 'failed' ||
        Boolean(platformHit?.error) ||
        (!platformPostUrl &&
          platformHit?.status !== 'published' &&
          platformHit?.status !== 'publishing');

      if (failed && !platformPostUrl) {
        results.push({
          ok: false,
          provider: entry.menchly,
          postId: entry.postId,
          zernioPostId: zernioResult.postId,
          error: platformHit?.error || `Publish failed for ${entry.menchly}`,
        });
        continue;
      }

      // Persist published_posts row (unique on igeoPostId+platform guards duplicates)
      const row = await this.prisma.publishedPost.upsert({
        where: {
          igeoPostId_platform: {
            igeoPostId: entry.postId,
            platform: entry.menchly,
          },
        },
        create: {
          tenantId,
          runId,
          igeoPostId: entry.postId,
          platform: entry.menchly,
          zernioPostId: zernioResult.postId,
          zernioAccountId: entry.zernioAccountId,
          platformPostUrl,
          publishedAt: new Date(),
        },
        update: {
          zernioPostId: zernioResult.postId,
          zernioAccountId: entry.zernioAccountId,
          platformPostUrl: platformPostUrl ?? undefined,
        },
      });

      let trackedRecommendationId = row.trackedRecommendationId;
      if (platformPostUrl && !row.igeoLinkedAt) {
        try {
          const linked = await linkPublishedUrlToPosts(this.sourceApi, {
            accountId,
            apiKey,
            url: platformPostUrl,
            postIds: [entry.postId],
          });
          trackedRecommendationId = linked.id;
          await this.prisma.publishedPost.update({
            where: { id: row.id },
            data: {
              igeoLinkedAt: new Date(),
              trackedRecommendationId: linked.id,
              linkError: null,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Failed to link ${platformPostUrl} to iGEO post ${entry.postId}: ${message}`,
          );
          await this.prisma.publishedPost.update({
            where: { id: row.id },
            data: { linkError: message },
          });
        }
      }

      results.push({
        ok: true,
        provider: entry.menchly,
        postId: entry.postId,
        platformPostUrl,
        zernioPostId: zernioResult.postId,
        trackedRecommendationId,
      });
    }

    return results;
  }

  async getPublishTargets(tenantId: string) {
    const connectedSocial = await this.integrations.getConnectedMap(tenantId);
    const statusesAvailable = true;
    let blogSites: Array<{ id: string; name: string; url?: string | null }> = [];

    try {
      const { accountId, apiKey } = await this.sourceApi.resolveCredentials(tenantId);
      const raw = await this.sourceApi.sourceRequest(
        accountId,
        apiKey,
        `/accounts/${accountId}/agents/blog/sites`,
      );
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { sites?: unknown[] })?.sites)
          ? (raw as { sites: unknown[] }).sites
          : Array.isArray((raw as { data?: unknown[] })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
      blogSites = list
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const row = item as Record<string, unknown>;
          const id = row.id ?? row.siteId ?? row.site_id;
          if (id == null) return null;
          return {
            id: String(id),
            name: String(row.name ?? row.title ?? row.url ?? id),
            url: row.url != null ? String(row.url) : row.site != null ? String(row.site) : null,
          };
        })
        .filter((s): s is { id: string; name: string; url: string | null } => Boolean(s));
    } catch (err) {
      this.logger.warn(
        `Failed to load blog sites for ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const connected: Record<string, boolean> = {
      ...connectedSocial,
      BLOG: blogSites.length > 0,
    };

    // Enrich with published URLs for this tenant (recent)
    const published = await this.prisma.publishedPost.findMany({
      where: { tenantId },
      orderBy: { publishedAt: 'desc' },
      take: 200,
      select: {
        igeoPostId: true,
        platform: true,
        platformPostUrl: true,
        trackedRecommendationId: true,
        igeoLinkedAt: true,
      },
    });

    return {
      connected,
      statusesAvailable,
      statuses: connected,
      blogSites,
      publishedByPostId: Object.fromEntries(
        published.map((p) => [
          p.igeoPostId,
          {
            platform: p.platform,
            platformPostUrl: p.platformPostUrl,
            trackedRecommendationId: p.trackedRecommendationId,
            linked: Boolean(p.igeoLinkedAt),
          },
        ]),
      ),
    };
  }

  async addPostImage(tenantId: string, runId: string, postId: string) {
    const { tenant } = await this.requireOwnedPost(tenantId, runId, postId);
    const accountId = tenant.source_account_id;
    const apiKey = tenant.mcp_api_key!;
    const raw = await this.sourceApi.sourceRequest(
      accountId,
      apiKey,
      `/accounts/${accountId}/agents/updatePost/${encodeURIComponent(postId)}/addImage`,
      { method: 'POST' },
    );
    const obj =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const signedUrl =
      typeof obj.signedUrl === 'string'
        ? obj.signedUrl
        : typeof obj.signed_url === 'string'
          ? obj.signed_url
          : null;
    if (!signedUrl) {
      const err = new Error('addImage did not return a signedUrl') as Error & {
        statusCode: number;
      };
      err.statusCode = 502;
      throw err;
    }
    const imagesRaw = obj.imagesUrl ?? obj.images_url;
    const imagesUrl = Array.isArray(imagesRaw)
      ? imagesRaw.map((u) => String(u)).filter(Boolean)
      : [];
    return { signedUrl, imagesUrl, message: String(obj.message ?? '') };
  }

  async removePostImage(
    tenantId: string,
    runId: string,
    postId: string,
    imageUrl: string,
  ) {
    if (!imageUrl?.trim()) {
      const err = new Error('imageUrl is required') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const { tenant } = await this.requireOwnedPost(tenantId, runId, postId);
    const accountId = tenant.source_account_id;
    const apiKey = tenant.mcp_api_key!;
    const raw = await this.sourceApi.sourceRequest(
      accountId,
      apiKey,
      `/accounts/${accountId}/agents/updatePost/${encodeURIComponent(postId)}/removeImages`,
      {
        method: 'POST',
        body: [{ imageUrl: imageUrl.trim() }],
      },
    );
    const obj =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const imagesRaw = obj.imagesUrl ?? obj.images_url;
    const imagesUrl = Array.isArray(imagesRaw)
      ? imagesRaw.map((u) => String(u)).filter(Boolean)
      : [];
    return {
      success: obj.success !== false,
      postId,
      imagesUrl,
      message: String(obj.message ?? 'Images removed'),
    };
  }

  async getBlogSiteCategories(tenantId: string, siteId: string) {
    const { accountId, apiKey } = await this.sourceApi.resolveCredentials(tenantId);
    const raw = await this.sourceApi.sourceRequest(
      accountId,
      apiKey,
      `/accounts/${accountId}/agents/blog/sites/${encodeURIComponent(siteId)}/categories`,
    );
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { categories?: unknown[] })?.categories)
        ? (raw as { categories: unknown[] }).categories
        : Array.isArray((raw as { data?: unknown[] })?.data)
          ? (raw as { data: unknown[] }).data
          : [];
    return list
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const id = row.id;
        if (id == null) return null;
        return {
          id: Number(id),
          name: String(row.name ?? row.title ?? id),
          parent: Number(row.parent ?? 0),
        };
      })
      .filter((c): c is { id: number; name: string; parent: number } => Boolean(c));
  }

  private async requireRunWithTenant(tenantId: string, runId: string) {
    const run = await this.prisma.dailyContentRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) {
      const err = new Error('Run not found') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }

    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
        name: true,
      },
    });
    if (!tenant?.mcp_api_key) {
      const err = new Error('Tenant MCP key missing') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    return { run, tenant };
  }

  private async requireOwnedPost(tenantId: string, runId: string, postId: string) {
    const { run, tenant } = await this.requireRunWithTenant(tenantId, runId);
    const platforms = this.parsePlatforms(run.platforms);
    for (const provider of DAILY_CONTENT_PLATFORMS) {
      const state = platforms[provider];
      if (!state) continue;
      const ids = new Set<string>([
        ...(state.postIds || []),
        ...(state.discardedPostIds || []),
        ...(state.selectedPostId ? [state.selectedPostId] : []),
      ]);
      if (ids.has(postId)) {
        return { run, tenant, provider };
      }
    }
    const err = new Error('Post does not belong to this run') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        dailyContentAutomation: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
      },
    });
    if (!tenant) return null;
    return {
      dailyContentAutomation: tenant.dailyContentAutomation,
      dailyContentTimezone: tenant.dailyContentTimezone,
      dailyContentHour: tenant.dailyContentHour,
    };
  }

  async updateSettings(
    tenantId: string,
    patch: {
      dailyContentAutomation?: boolean;
      dailyContentTimezone?: string;
      dailyContentHour?: number;
    },
  ) {
    const data: Prisma.WhitelabelTenantUpdateInput = {};
    if (typeof patch.dailyContentAutomation === 'boolean') {
      data.dailyContentAutomation = patch.dailyContentAutomation;
    }
    if (typeof patch.dailyContentTimezone === 'string' && patch.dailyContentTimezone.trim()) {
      data.dailyContentTimezone = patch.dailyContentTimezone.trim();
    }
    if (
      typeof patch.dailyContentHour === 'number' &&
      Number.isInteger(patch.dailyContentHour) &&
      patch.dailyContentHour >= 0 &&
      patch.dailyContentHour <= 23
    ) {
      data.dailyContentHour = patch.dailyContentHour;
    }
    return this.prisma.whitelabelTenant.update({
      where: { id: tenantId },
      data,
      select: {
        dailyContentAutomation: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
      },
    });
  }

  private async listEligibleTenants(): Promise<EligibleTenant[]> {
    const rows = await this.prisma.whitelabelTenant.findMany({
      where: {
        enabled: true,
        dailyContentAutomation: true,
        mcp_api_key: { not: null },
      },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
        name: true,
      },
    });
    return rows.filter((r) => Boolean(r.mcp_api_key)) as EligibleTenant[];
  }

  private async maybeStartForTenant(
    tenant: EligibleTenant,
    now: Date,
    force = false,
  ): Promise<boolean> {
    const tz = tenant.dailyContentTimezone || 'Asia/Nicosia';
    const hour = tenant.dailyContentHour ?? 5;
    if (!force && !isDueHour(now, tz, hour)) return false;

    const { localDate } = getLocalClock(now, tz);
    const existing = await this.prisma.dailyContentRun.findUnique({
      where: {
        tenantId_localDate: { tenantId: tenant.id, localDate },
      },
    });
    if (existing) return false;

    const client = this.mcpClientFor(tenant);
    const selection = await this.selectPrompt(tenant, client, localDate);
    if (!selection) {
      await this.prisma.dailyContentRun.create({
        data: {
          tenantId: tenant.id,
          localDate,
          status: 'SKIPPED',
          skipReason: 'NO_ELIGIBLE_PROMPT',
          platforms: emptyPlatformsMap() as Prisma.InputJsonValue,
          completedAt: now,
        },
      });
      return true;
    }

    const platforms = emptyPlatformsMap();
    let run;
    try {
      run = await this.prisma.dailyContentRun.create({
        data: {
          tenantId: tenant.id,
          localDate,
          status: 'GENERATING',
          promptId: selection.prompt.id,
          promptText: selection.prompt.prompt,
          topicId: selection.prompt.topicId ?? null,
          selectionRationale: selection.rationale,
          visibilityAtSelection: selection.visibilityAtSelection,
          platforms: platforms as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Unique constraint race on (tenantId, localDate)
      if ((err as { code?: string })?.code === 'P2002') return false;
      throw err;
    }

    const topicName = selection.prompt.topicName || 'General';
    const dispatchResults = await Promise.allSettled(
      DAILY_CONTENT_PLATFORMS.map(async (provider) => {
        const { generationId } = await client.createPost({
          topic: topicName,
          prompt: selection.prompt.prompt,
          socialMediaProvider: provider,
          generateImage: PLATFORM_WANTS_IMAGE[provider],
        });
        return { provider, generationId };
      }),
    );

    let hitLimit = false;
    for (let i = 0; i < DAILY_CONTENT_PLATFORMS.length; i++) {
      const provider = DAILY_CONTENT_PLATFORMS[i];
      const result = dispatchResults[i];
      const state = platforms[provider]!;
      if (result.status === 'fulfilled') {
        state.generationId = result.value.generationId;
        state.status = 'PENDING';
      } else {
        const err = result.reason;
        const message = err instanceof Error ? err.message : String(err);
        state.status = 'FAILED';
        state.error = message;
        if (err instanceof McpPostsError && err.code === 'POST_LIMIT_REACHED') {
          hitLimit = true;
        }
      }
    }

    if (hitLimit && DAILY_CONTENT_PLATFORMS.every((p) => platforms[p]?.status === 'FAILED')) {
      await this.prisma.dailyContentRun.update({
        where: { id: run.id },
        data: {
          status: 'SKIPPED',
          skipReason: 'POST_LIMIT_REACHED',
          platforms: platforms as Prisma.InputJsonValue,
          completedAt: now,
        },
      });
      return true;
    }

    await this.prisma.dailyContentRun.update({
      where: { id: run.id },
      data: { platforms: platforms as Prisma.InputJsonValue },
    });
    this.logger.log(
      `Started daily content run ${run.id} for tenant ${tenant.id} prompt=${selection.prompt.id}`,
    );
    return true;
  }

  private async selectPrompt(
    tenant: EligibleTenant,
    client: McpPostsClient,
    localDate: string,
  ) {
    const { accountId, apiKey } = {
      accountId: tenant.source_account_id,
      apiKey: tenant.mcp_api_key!,
    };

    const [promptsRaw, topicsRaw, recentPosts] = await Promise.all([
      this.sourceApi.sourceGet(
        accountId,
        apiKey,
        `/accounts/${accountId}/prompts?take=200&skip=0`,
      ),
      this.sourceApi.sourceGet(accountId, apiKey, `/accounts/${accountId}/topics`),
      client.listPosts({
        take: 200,
        startDate: `${localDateDaysAgo(localDate, STALE_DAYS)}T00:00:00.000Z`,
        endDate: `${localDate}T23:59:59.999Z`,
      }),
    ]);

    const topicPriority = new Map<string, number>();
    const topicName = new Map<string, string>();
    const topics = Array.isArray(topicsRaw)
      ? topicsRaw
      : ((topicsRaw as { topics?: unknown[] })?.topics ?? []);
    for (const t of topics as Array<Record<string, unknown>>) {
      if (!t?.id) continue;
      topicName.set(String(t.id), String(t.name ?? ''));
      if (typeof t.priority === 'number') topicPriority.set(String(t.id), t.priority);
    }

    const promptRows = Array.isArray(promptsRaw)
      ? promptsRaw
      : ((promptsRaw as { prompts?: unknown[] })?.prompts ?? []);

    const prompts: SelectablePrompt[] = (promptRows as Array<Record<string, unknown>>)
      .filter((p) => p?.id && (p.isActive ?? p.active ?? true) !== false)
      .map((p) => {
        const topicObj = p.topic as Record<string, unknown> | null | undefined;
        const topicId = String(p.topicId ?? topicObj?.id ?? '') || null;
        return {
          id: String(p.id),
          prompt: String(p.prompt ?? p.text ?? ''),
          topicId,
          topicName: topicId
            ? topicName.get(topicId) || String(topicObj?.name ?? '') || null
            : String(topicObj?.name ?? '') || null,
          topicPriority: topicId ? topicPriority.get(topicId) ?? null : null,
          type: (p.type as string | null) ?? null,
          stage: (p.stage as string | null) ?? null,
          volume: typeof p.volume === 'number' ? p.volume : null,
          avgVisibility: typeof p.avgVisibility === 'number' ? p.avgVisibility : null,
          visibilityChange:
            typeof p.visibilityChange === 'number' ? p.visibilityChange : null,
        };
      });

    const promptTextToId = new Map<string, string>();
    for (const p of prompts) {
      const key = normalizePromptText(p.prompt);
      if (key) promptTextToId.set(key, p.id);
    }

    const recentWorkPromptIds = buildRecentWorkPromptIds(
      recentPosts.map((post) => ({
        promptId: post.recommendation?.promptId ?? null,
        promptText: post.prompt,
        createdAt: post.createdAt,
      })),
      promptTextToId,
    );

    const since = new Date(`${localDateDaysAgo(localDate, STALE_DAYS)}T00:00:00.000Z`);
    const recentRuns = await this.prisma.dailyContentRun.findMany({
      where: {
        tenantId: tenant.id,
        promptId: { not: null },
        startedAt: { gte: since },
        status: { not: 'SKIPPED' },
      },
      select: { promptId: true },
    });
    const recentRunPromptIds = new Set(
      recentRuns.map((r) => r.promptId!).filter(Boolean),
    );

    return selectDailyContentPrompt({
      prompts,
      recentWorkPromptIds,
      recentRunPromptIds,
    });
  }

  private async sweepRun(
    runId: string,
    now: Date,
  ): Promise<{ swept: boolean; invoked: boolean }> {
    const run = await this.prisma.dailyContentRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'GENERATING') return { swept: false, invoked: false };

    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: run.tenantId },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        dailyContentTimezone: true,
        dailyContentHour: true,
        name: true,
      },
    });
    if (!tenant?.mcp_api_key) {
      await this.prisma.dailyContentRun.update({
        where: { id: runId },
        data: { status: 'FAILED', error: 'Tenant MCP key missing', completedAt: now },
      });
      return { swept: true, invoked: false };
    }

    const client = this.mcpClientFor(tenant as EligibleTenant);
    const platforms = { ...(run.platforms as PlatformsMap) };
    let allReady = true;
    let anyPending = false;

    for (const provider of DAILY_CONTENT_PLATFORMS) {
      const state = platforms[provider] ?? {
        generationId: null,
        postIds: [],
        selectedPostId: null,
        discardedPostIds: [],
        status: 'FAILED' as const,
        error: 'Missing platform state',
      };
      platforms[provider] = state;

      if (state.status === 'FAILED' || state.status === 'OPTIMIZED') continue;
      if (!state.generationId) {
        state.status = 'FAILED';
        state.error = state.error || 'No generationId';
        continue;
      }

      const posts = await client.getPostsByGenerationId(state.generationId);
      const suggested = posts.filter((p) => String(p.state).toUpperCase() === 'SUGGESTED');
      if (suggested.length === 0 && posts.length === 0) {
        allReady = false;
        anyPending = true;
        continue;
      }
      if (suggested.length === 0 && posts.some((p) => /FAIL|ERROR/i.test(String(p.state)))) {
        state.status = 'FAILED';
        state.error = 'Generation failed upstream';
        continue;
      }
      if (suggested.length === 0) {
        allReady = false;
        anyPending = true;
        continue;
      }

      state.postIds = suggested.map((p) => p.id);
      state.status = 'GENERATED';
    }

    const timedOut = now.getTime() - run.startedAt.getTime() > GENERATING_TIMEOUT_MS;
    const readyProviders = DAILY_CONTENT_PLATFORMS.filter(
      (p) => platforms[p]?.status === 'GENERATED',
    );
    const failedAll = DAILY_CONTENT_PLATFORMS.every(
      (p) => platforms[p]?.status === 'FAILED',
    );

    await this.prisma.dailyContentRun.update({
      where: { id: runId },
      data: { platforms: platforms as Prisma.InputJsonValue },
    });

    if (failedAll) {
      await this.prisma.dailyContentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          error: 'All platforms failed to generate',
          completedAt: now,
          platforms: platforms as Prisma.InputJsonValue,
        },
      });
      return { swept: true, invoked: false };
    }

    const shouldOptimize =
      (allReady && readyProviders.length > 0 && !anyPending) ||
      (timedOut && readyProviders.length > 0);

    if (!shouldOptimize) {
      if (timedOut && readyProviders.length === 0) {
        await this.prisma.dailyContentRun.update({
          where: { id: runId },
          data: {
            status: 'PARTIAL',
            error: 'Timed out waiting for generations',
            completedAt: now,
            platforms: platforms as Prisma.InputJsonValue,
          },
        });
        return { swept: true, invoked: false };
      }
      return { swept: true, invoked: false };
    }

    const nextStatus = timedOut && !allReady ? 'PARTIAL' : 'OPTIMIZING';
    await this.prisma.dailyContentRun.update({
      where: { id: runId },
      data: {
        status: nextStatus === 'PARTIAL' ? 'OPTIMIZING' : 'OPTIMIZING',
        platforms: platforms as Prisma.InputJsonValue,
      },
    });

    const invoked = await this.invokeOptimizer(runId);
    return { swept: true, invoked };
  }

  private async invokeOptimizer(runId: string): Promise<boolean> {
    const functionName =
      this.config.getOptional<string>('DAILY_CONTENT_OPTIMIZER_FUNCTION') ||
      `menchly-${this.config.getOptional<string>('NODE_ENV') || 'prod'}-daily-content-optimizer`;

    // Local / missing AWS: call optimizer in-process when possible
    if (this.config.getOptional<string>('DAILY_CONTENT_OPTIMIZER_INLINE') === 'true') {
      this.logger.log(`Inline optimizer for run ${runId}`);
      return false;
    }

    try {
      await this.lambda.send(
        new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'Event',
          Payload: Buffer.from(JSON.stringify({ runId })),
        }),
      );
      this.logger.log(`Invoked optimizer ${functionName} for run ${runId}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to invoke optimizer for ${runId}: ${err instanceof Error ? err.message : err}`,
      );
      await this.prisma.dailyContentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          error: `Optimizer invoke failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
      return false;
    }
  }

  private mcpClientFor(tenant: {
    source_account_id: string;
    mcp_api_key: string | null;
  }): McpPostsClient {
    const mcpUrl = getMcpUrl(this.config, this.sourceApi.getSourceApiBase());
    return new McpPostsClient({
      mcpUrl,
      accountId: tenant.source_account_id,
      apiKey: tenant.mcp_api_key!,
    });
  }

  /** Exposed for optimizer / tests. */
  parsePlatforms(value: unknown): PlatformsMap {
    if (!value || typeof value !== 'object') return emptyPlatformsMap();
    return value as PlatformsMap;
  }

  getPlatformState(platforms: PlatformsMap, provider: SocialMediaProvider): PlatformState {
    return (
      platforms[provider] ?? {
        generationId: null,
        postIds: [],
        selectedPostId: null,
        discardedPostIds: [],
        status: 'FAILED',
        error: 'Missing',
      }
    );
  }
}
