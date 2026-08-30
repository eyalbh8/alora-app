import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '../../../config/config.service';
import { SourceApiService } from '../source-api.service';
import { getMcpUrl } from '../../utils/mcp-connection.util';
import { DailyContentLlmService } from './daily-content-llm.service';
import {
  buildBlogJsonLd,
  injectJsonLd,
  stripJsonLd,
} from './blog-schema.util';
import {
  BLOG_YOAST_SYSTEM,
  PLATFORM_OPTIMIZE_RULES,
  VARIANT_SELECTION_SYSTEM,
  X_SHORTEN_SYSTEM,
} from './optimization-prompts';
import {
  DAILY_CONTENT_PLATFORMS,
  McpPostsClient,
  type McpPost,
  type PlatformsMap,
  type SocialMediaProvider,
} from './mcp-posts.client';

const X_MAX_CHARS = 280;

@Injectable()
export class DailyContentOptimizerService {
  private readonly logger = new Logger(DailyContentOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sourceApi: SourceApiService,
    private readonly llm: DailyContentLlmService,
  ) {}

  async optimizeRun(runId: string): Promise<void> {
    const run = await this.prisma.dailyContentRun.findUnique({ where: { id: runId } });
    if (!run) {
      this.logger.warn(`Optimizer: run ${runId} not found`);
      return;
    }
    if (!['OPTIMIZING', 'GENERATING', 'PARTIAL'].includes(run.status)) {
      this.logger.log(`Optimizer: skip run ${runId} status=${run.status}`);
      return;
    }

    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: run.tenantId },
      select: {
        id: true,
        source_account_id: true,
        mcp_api_key: true,
        name: true,
        domains: true,
        logo: true,
      },
    });
    if (!tenant?.mcp_api_key) {
      await this.finish(runId, 'FAILED', 'Tenant MCP key missing', run.platforms);
      return;
    }

    if (!this.llm.hasLlmConfigured()) {
      await this.finish(runId, 'FAILED', 'No LLM API key configured', run.platforms);
      return;
    }

    await this.prisma.dailyContentRun.update({
      where: { id: runId },
      data: { status: 'OPTIMIZING' },
    });

    const client = new McpPostsClient({
      mcpUrl: getMcpUrl(this.config, this.sourceApi.getSourceApiBase()),
      accountId: tenant.source_account_id,
      apiKey: tenant.mcp_api_key,
    });

    const brand = await this.loadBrandHub(tenant.source_account_id, tenant.mcp_api_key);
    const platforms = { ...(run.platforms as PlatformsMap) };
    let anyOk = false;
    let anyFail = false;

    for (const provider of DAILY_CONTENT_PLATFORMS) {
      const state = platforms[provider];
      if (!state || state.status === 'FAILED') {
        anyFail = true;
        continue;
      }
      if (state.status !== 'GENERATED' && state.postIds.length === 0) {
        state.status = 'FAILED';
        state.error = 'No generated posts to optimize';
        anyFail = true;
        continue;
      }

      try {
        if (provider === 'BLOG') {
          await this.optimizeBlog(client, state, brand);
        } else {
          await this.optimizeSocial(client, provider, state);
        }
        anyOk = true;
      } catch (err) {
        anyFail = true;
        state.status = 'FAILED';
        state.error = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Optimize ${provider} failed for run ${runId}: ${state.error}`,
        );
      }

      await this.prisma.dailyContentRun.update({
        where: { id: runId },
        data: { platforms: platforms as Prisma.InputJsonValue },
      });
    }

    const status = anyOk && anyFail ? 'PARTIAL' : anyOk ? 'COMPLETED' : 'FAILED';
    await this.finish(
      runId,
      status,
      status === 'FAILED' ? 'All platforms failed optimization' : null,
      platforms,
    );
  }

  private async optimizeSocial(
    client: McpPostsClient,
    provider: SocialMediaProvider,
    state: NonNullable<PlatformsMap[SocialMediaProvider]>,
  ): Promise<void> {
    const posts = await this.loadPosts(client, state);
    if (posts.length === 0) {
      throw new Error('No SUGGESTED posts found');
    }

    let winner = posts[0];
    let losers: McpPost[] = posts.slice(1);

    if (posts.length >= 2) {
      const pick = await this.llm.completeJson(
        VARIANT_SELECTION_SYSTEM,
        `Platform: ${provider}\n\nVariant 0:\n${posts[0].body ?? ''}\n\nVariant 1:\n${posts[1].body ?? ''}`,
      );
      const idx = Number(pick.winnerIndex) === 1 ? 1 : 0;
      winner = posts[idx];
      losers = posts.filter((_, i) => i !== idx);
    }

    const rules = PLATFORM_OPTIMIZE_RULES[provider] || PLATFORM_OPTIMIZE_RULES.LINKEDIN;
    let optimizedBody = String(
      (await this.llm.completeJson(rules, `Original post:\n${winner.body ?? ''}`)).body ?? '',
    ).trim();

    if (provider === 'X') {
      optimizedBody = await this.enforceXLength(optimizedBody);
    }

    if (!optimizedBody) {
      throw new Error('Optimizer returned empty body');
    }

    await client.updatePost(winner.id, {
      body: optimizedBody,
      socialMediaProvider: provider,
    });

    const verified = await client.getPost(winner.id, {
      generationId: state.generationId,
    });
    if (!verified || !this.bodiesMatch(verified.body, optimizedBody)) {
      // update_post can succeed while list endpoints are briefly stale — retry once
      await new Promise((r) => setTimeout(r, 1500));
      const retry = await client.getPost(winner.id, {
        generationId: state.generationId,
      });
      if (!retry || !this.bodiesMatch(retry.body, optimizedBody)) {
        throw new Error('Write-back verification failed for optimized social post');
      }
    }

    for (const loser of losers) {
      try {
        await client.softDeletePost(loser.id, provider);
      } catch (err) {
        this.logger.warn(
          `Failed to soft-delete ${loser.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    state.selectedPostId = winner.id;
    state.discardedPostIds = losers.map((p) => p.id);
    state.postIds = posts.map((p) => p.id);
    state.status = 'OPTIMIZED';
    state.error = null;
  }

  private async optimizeBlog(
    client: McpPostsClient,
    state: NonNullable<PlatformsMap[SocialMediaProvider]>,
    brand: {
      title?: string | null;
      domains?: string[] | null;
      logo?: string | null;
      about?: string | null;
    },
  ): Promise<void> {
    const posts = await this.loadPosts(client, state);
    const post = posts[0];
    if (!post) throw new Error('No blog post found');

    const stripped = stripJsonLd(post.body);
    const yoast = await this.llm.completeJson(
      BLOG_YOAST_SYSTEM,
      `Brand: ${brand.title || 'Brand'}\nDomains: ${(brand.domains || []).join(', ')}\n\nArticle HTML:\n${stripped}`,
    );

    const bodyHtml = stripJsonLd(String(yoast.bodyHtml ?? '')).trim();
    const focusKeyphrase = String(yoast.focusKeyphrase ?? '').trim() || undefined;
    const metaTitle = String(yoast.metaTitle ?? '').trim() || undefined;
    const metaDescription = String(yoast.metaDescription ?? '').trim() || undefined;
    const slug = String(yoast.slug ?? '').trim() || undefined;

    if (!bodyHtml) throw new Error('Blog optimizer returned empty bodyHtml');

    await client.updatePost(post.id, {
      body: bodyHtml,
      socialMediaProvider: 'BLOG',
      focusKeyphrase,
      metaDescription,
      slug,
      title: metaTitle || undefined,
    });

    const schema = buildBlogJsonLd(brand, {
      title: metaTitle || post.title,
      slug,
      body: bodyHtml,
      metaDescription,
      focusKeyphrase,
      createdAt: post.createdAt,
    });
    const withSchema = injectJsonLd(bodyHtml, schema);

    await client.updatePost(post.id, {
      body: withSchema,
      socialMediaProvider: 'BLOG',
    });

    const verified = await client.getPost(post.id, {
      generationId: state.generationId,
    });
    if (!verified?.body || !verified.body.includes('application/ld+json')) {
      await new Promise((r) => setTimeout(r, 1500));
      const retry = await client.getPost(post.id, {
        generationId: state.generationId,
      });
      if (!retry?.body || !retry.body.includes('application/ld+json')) {
        throw new Error('Blog write-back verification failed (missing JSON-LD)');
      }
    } else if (!this.bodiesMatch(stripJsonLd(verified.body), bodyHtml)) {
      const verifiedStripped = stripJsonLd(verified.body).replace(/\s+/g, ' ');
      const expected = bodyHtml.replace(/\s+/g, ' ');
      if (!verifiedStripped.includes(expected.slice(0, Math.min(200, expected.length)))) {
        throw new Error('Blog write-back verification failed (body mismatch)');
      }
    }

    state.selectedPostId = post.id;
    state.discardedPostIds = [];
    state.postIds = [post.id];
    state.status = 'OPTIMIZED';
    state.error = null;
  }

  private async enforceXLength(body: string): Promise<string> {
    let current = body.trim();
    if ([...current].length <= X_MAX_CHARS) return current;

    const shortened = await this.llm.completeJson(
      X_SHORTEN_SYSTEM,
      `Current (${[...current].length} chars):\n${current}`,
    );
    current = String(shortened.body ?? '').trim();
    if ([...current].length <= X_MAX_CHARS) return current;

    throw new Error(
      `X post still over ${X_MAX_CHARS} chars after shorten retry (${[...current].length})`,
    );
  }

  private async loadPosts(
    client: McpPostsClient,
    state: NonNullable<PlatformsMap[SocialMediaProvider]>,
  ): Promise<McpPost[]> {
    if (state.generationId) {
      const byGen = await client.getPostsByGenerationId(state.generationId);
      const suggested = byGen.filter((p) => String(p.state).toUpperCase() === 'SUGGESTED');
      if (suggested.length) return suggested;
      if (byGen.length) return byGen;
    }
    const loaded: McpPost[] = [];
    for (const id of state.postIds) {
      const post = await client.getPost(id);
      if (post) loaded.push(post);
    }
    return loaded;
  }

  private async loadBrandHub(accountId: string, apiKey: string) {
    try {
      const raw = (await this.sourceApi.sourceGet(
        accountId,
        apiKey,
        `/accounts/${accountId}`,
      )) as Record<string, unknown> | null;
      return {
        title: (raw?.title as string | null) ?? null,
        domains: (raw?.domains as string[] | null) ?? null,
        logo: (raw?.logo as string | null) ?? null,
        about: (raw?.about as string | null) ?? null,
      };
    } catch {
      return { title: null, domains: null, logo: null, about: null };
    }
  }

  private bodiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    const norm = (s: string | null | undefined) =>
      String(s ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    return norm(a) === norm(b);
  }

  private async finish(
    runId: string,
    status: string,
    error: string | null,
    platforms: unknown,
  ) {
    await this.prisma.dailyContentRun.update({
      where: { id: runId },
      data: {
        status,
        error,
        platforms: platforms as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    this.logger.log(`Run ${runId} finished status=${status}`);
  }
}
