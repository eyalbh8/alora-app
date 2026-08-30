import { callMcpTool } from '../../utils/mcp-connection.util';

export type SocialMediaProvider =
  | 'BLOG'
  | 'LINKEDIN'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'X';

export const DAILY_CONTENT_PLATFORMS: SocialMediaProvider[] = [
  'BLOG',
  'LINKEDIN',
  'FACEBOOK',
  'INSTAGRAM',
  'X',
];

/** Match iGEO agent defaults: images on for blog/social except X. */
export const PLATFORM_WANTS_IMAGE: Record<SocialMediaProvider, boolean> = {
  BLOG: true,
  LINKEDIN: true,
  FACEBOOK: true,
  INSTAGRAM: true,
  X: false,
};

export type PlatformRunStatus = 'PENDING' | 'GENERATED' | 'OPTIMIZED' | 'FAILED';

export type PlatformState = {
  generationId?: string | null;
  postIds: string[];
  selectedPostId?: string | null;
  discardedPostIds: string[];
  status: PlatformRunStatus;
  error?: string | null;
};

export type PlatformsMap = Partial<Record<SocialMediaProvider, PlatformState>>;

export type McpPost = {
  id: string;
  body?: string | null;
  title?: string | null;
  state?: string | null;
  prompt?: string | null;
  topic?: string | null;
  socialMediaProvider?: string | null;
  generationId?: string | null;
  createdAt?: string | null;
  focusKeyphrase?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug?: string | null;
  imagesUrl?: string[];
  tags?: string[];
  readTime?: number | null;
  publishAt?: string | null;
  isPublished?: boolean;
  recommendation?: { promptId?: string | null } | null;
};

export type CreatePostInput = {
  topic: string;
  prompt: string;
  socialMediaProvider: SocialMediaProvider;
  generateImage?: boolean;
};

export type UpdatePostInput = {
  body?: string;
  title?: string;
  state?: string;
  socialMediaProvider?: SocialMediaProvider | string;
  focusKeyphrase?: string;
  metaDescription?: string;
  slug?: string;
  textContentChange?: string;
  tags?: string[];
  publishAt?: string | null;
  removeImages?: boolean;
};

export class McpPostsError extends Error {
  readonly code: string;

  constructor(message: string, code = 'MCP_POSTS_ERROR') {
    super(message);
    this.name = 'McpPostsError';
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown, key?: string): unknown[] {
  if (Array.isArray(value)) return value;
  const obj = asRecord(value);
  if (!obj) return [];
  if (key && Array.isArray(obj[key])) return obj[key] as unknown[];
  if (Array.isArray(obj.posts)) return obj.posts;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.items)) return obj.items;
  return [];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function mapPost(raw: unknown): McpPost | null {
  const obj = asRecord(raw);
  if (!obj?.id) return null;
  const rec = asRecord(obj.recommendation);
  const imagesRaw = obj.imagesUrl ?? obj.images_url ?? obj.imageUrls ?? obj.image_urls;
  const tagsRaw = obj.tags ?? obj.hashtags;
  const readTimeRaw = obj.readTime ?? obj.read_time;
  const publishAtRaw = obj.publishAt ?? obj.publish_at;
  const isPublishedRaw = obj.isPublished ?? obj.is_published;
  return {
    id: String(obj.id),
    body: (obj.body as string | null | undefined) ?? null,
    title: (obj.title as string | null | undefined) ?? null,
    state: (obj.state as string | null | undefined) ?? null,
    prompt: (obj.prompt as string | null | undefined) ?? null,
    topic: (obj.topic as string | null | undefined) ?? null,
    socialMediaProvider:
      (obj.socialMediaProvider as string | null | undefined) ??
      (obj.provider as string | null | undefined) ??
      null,
    generationId:
      (obj.generationId as string | null | undefined) ??
      (obj.generation_id as string | null | undefined) ??
      null,
    createdAt:
      (obj.createdAt as string | null | undefined) ??
      (obj.created_at as string | null | undefined) ??
      null,
    focusKeyphrase:
      (obj.focusKeyphrase as string | null | undefined) ??
      (obj.focus_keyphrase as string | null | undefined) ??
      null,
    metaTitle:
      (obj.metaTitle as string | null | undefined) ??
      (obj.meta_title as string | null | undefined) ??
      null,
    metaDescription:
      (obj.metaDescription as string | null | undefined) ??
      (obj.meta_description as string | null | undefined) ??
      null,
    slug: (obj.slug as string | null | undefined) ?? null,
    imagesUrl: asStringArray(imagesRaw),
    tags: asStringArray(tagsRaw),
    readTime:
      typeof readTimeRaw === 'number'
        ? readTimeRaw
        : readTimeRaw != null && Number.isFinite(Number(readTimeRaw))
          ? Number(readTimeRaw)
          : null,
    publishAt: publishAtRaw != null ? String(publishAtRaw) : null,
    isPublished: Boolean(isPublishedRaw) || String(obj.state).toUpperCase() === 'POSTED',
    recommendation: rec
      ? { promptId: (rec.promptId as string | null | undefined) ?? null }
      : null,
  };
}

function extractGenerationId(result: unknown): string | null {
  const obj = asRecord(result);
  if (!obj) return null;
  const direct =
    obj.generationId ??
    obj.generation_id ??
    obj.id ??
    asRecord(obj.data)?.generationId ??
    asRecord(obj.data)?.generation_id ??
    asRecord(obj.post)?.generationId;
  return direct != null ? String(direct) : null;
}

function isPostLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /POST_CREATION_LIMIT|post.?creation.?limit|quota|POST_LIMIT/i.test(message);
}

export type McpPostsClientOptions = {
  mcpUrl: string;
  accountId: string;
  apiKey: string;
};

/**
 * Typed wrappers over MCP tools for daily content automation.
 * Tool argument shapes mirror the upstream GEO agent MCP surface.
 */
function assertUpdateSucceeded(result: unknown, postId: string): void {
  const obj = asRecord(result);
  if (!obj) return;
  if (obj.error || obj.code === 7001 || obj.title === 'Validation Error') {
    throw new McpPostsError(
      `update_post failed for ${postId}: ${String(obj.description || obj.error || obj.title)}`,
      'UPDATE_POST_FAILED',
    );
  }
  if (obj.success === false) {
    throw new McpPostsError(
      `update_post failed for ${postId}: ${String(obj.message || 'unknown')}`,
      'UPDATE_POST_FAILED',
    );
  }
}

export class McpPostsClient {
  constructor(private readonly opts: McpPostsClientOptions) {}

  private call(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return callMcpTool(
      this.opts.mcpUrl,
      this.opts.accountId,
      this.opts.apiKey,
      toolName,
      args,
    );
  }

  async createPost(input: CreatePostInput): Promise<{ generationId: string }> {
    try {
      const result = await this.call('create_post', {
        topic: input.topic,
        prompt: input.prompt,
        socialMediaProvider: input.socialMediaProvider,
        generateImage: input.generateImage ?? false,
      });
      const generationId = extractGenerationId(result);
      if (!generationId) {
        throw new McpPostsError(
          `create_post returned no generationId for ${input.socialMediaProvider}`,
          'NO_GENERATION_ID',
        );
      }
      return { generationId };
    } catch (err) {
      if (err instanceof McpPostsError) throw err;
      if (isPostLimitError(err)) {
        throw new McpPostsError(
          err instanceof Error ? err.message : String(err),
          'POST_LIMIT_REACHED',
        );
      }
      throw new McpPostsError(
        err instanceof Error ? err.message : String(err),
        'CREATE_POST_FAILED',
      );
    }
  }

  async getPostsByGenerationId(generationId: string): Promise<McpPost[]> {
    try {
      const result = await this.call('post_generation', { generationId });
      return asArray(result, 'posts').map(mapPost).filter((p): p is McpPost => Boolean(p));
    } catch {
      const result = await this.call('posts', { generationId });
      return asArray(result, 'posts').map(mapPost).filter((p): p is McpPost => Boolean(p));
    }
  }

  async listPosts(args: {
    take?: number;
    skip?: number;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<McpPost[]> {
    const result = await this.call('posts', {
      take: args.take ?? 200,
      skip: args.skip ?? 0,
      ...(args.startDate ? { startDate: args.startDate } : {}),
      ...(args.endDate ? { endDate: args.endDate } : {}),
    });
    return asArray(result, 'posts').map(mapPost).filter((p): p is McpPost => Boolean(p));
  }

  async getPost(
    postId: string,
    options: { generationId?: string | null } = {},
  ): Promise<McpPost | null> {
    if (options.generationId) {
      const fromGen = await this.getPostsByGenerationId(options.generationId);
      const hit = fromGen.find((p) => p.id === postId);
      if (hit) return hit;
    }
    try {
      const result = await this.call('posts', { postId });
      const mapped = mapPost(result) ?? mapPost(asRecord(result)?.post);
      if (mapped?.id === postId) return mapped;
      const list = asArray(result, 'posts').map(mapPost).filter((p): p is McpPost => Boolean(p));
      return list.find((p) => p.id === postId) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * MCP update_post requires postId + socialMediaProvider, plus at least one field.
   * Do not send alias `id` — upstream rejects invalid write params.
   */
  async updatePost(postId: string, input: UpdatePostInput): Promise<McpPost | null> {
    if (!input.socialMediaProvider) {
      throw new McpPostsError(
        `update_post requires socialMediaProvider for ${postId}`,
        'UPDATE_POST_FAILED',
      );
    }
    const { socialMediaProvider, ...rest } = input;
    const result = await this.call('update_post', {
      postId,
      socialMediaProvider,
      ...rest,
    });
    assertUpdateSucceeded(result, postId);
    const mapped = mapPost(result) ?? mapPost(asRecord(result)?.post);
    if (mapped?.body) return mapped;
    return this.getPost(postId);
  }

  /** Soft-delete a losing variant. */
  async softDeletePost(
    postId: string,
    socialMediaProvider: SocialMediaProvider | string,
  ): Promise<void> {
    await this.updatePost(postId, {
      socialMediaProvider,
      state: 'DELETED',
    });
  }
}

export function emptyPlatformState(): PlatformState {
  return {
    generationId: null,
    postIds: [],
    selectedPostId: null,
    discardedPostIds: [],
    status: 'PENDING',
    error: null,
  };
}

export function emptyPlatformsMap(): PlatformsMap {
  const map: PlatformsMap = {};
  for (const p of DAILY_CONTENT_PLATFORMS) {
    map[p] = emptyPlatformState();
  }
  return map;
}
