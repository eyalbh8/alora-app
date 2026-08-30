import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';

export class ZernioApiError extends Error {
  readonly statusCode: number;
  readonly code: string | null;

  constructor(message: string, statusCode: number, code: string | null = null) {
    super(message);
    this.name = 'ZernioApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export type ZernioPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'pinterest'
  | 'reddit'
  | 'bluesky'
  | 'googlebusiness'
  | 'telegram'
  | 'snapchat'
  | 'discord'
  | 'slack'
  | 'whatsapp'
  | 'shopify';

export type ZernioAccount = {
  id: string;
  platform: string;
  username?: string | null;
  displayName?: string | null;
  profileId?: string | null;
  isActive?: boolean;
  raw: Record<string, unknown>;
};

export type ZernioCreatePostPlatform = {
  platform: ZernioPlatform | string;
  accountId: string;
  customContent?: string;
};

export type ZernioCreatePostInput = {
  content?: string;
  title?: string;
  platforms: ZernioCreatePostPlatform[];
  mediaItems?: Array<{ type: string; url: string; title?: string }>;
  publishNow?: boolean;
  scheduledFor?: string;
  isDraft?: boolean;
  requestId?: string;
};

export type ZernioPlatformResult = {
  platform: string;
  accountId: string | null;
  status: string | null;
  platformPostUrl: string | null;
  error?: string | null;
};

export type ZernioCreatePostResult = {
  postId: string | null;
  status: string | null;
  platforms: ZernioPlatformResult[];
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickId(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null;
  if (obj._id != null) return String(obj._id);
  if (obj.id != null) return String(obj.id);
  if (obj.accountId != null) return String(obj.accountId);
  return null;
}

@Injectable()
export class ZernioService {
  private readonly logger = new Logger(ZernioService.name);

  constructor(private readonly config: ConfigService) {}

  private requireApiKey(): string {
    const key = this.config.zernioApiKey;
    if (!key) {
      throw new ZernioApiError(
        'Zernio is not configured. Set ZERNIO_API_KEY on the server.',
        503,
        'ZERNIO_NOT_CONFIGURED',
      );
    }
    return key;
  }

  async zernioRequest(
    pathAndQuery: string,
    options: {
      method?: string;
      body?: unknown;
      requestId?: string;
    } = {},
  ): Promise<unknown> {
    const apiKey = this.requireApiKey();
    const method = (options.method || 'GET').toUpperCase();
    const base = this.config.zernioApiBase;
    const path = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
    const url = `${base}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.requestId) headers['x-request-id'] = options.requestId;

    this.logger.log(`[zernio] ${method} ${path}`);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (err) {
      throw new ZernioApiError(
        `Zernio network error: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }

    const rawText = await response.text();
    let body: unknown = null;
    if (rawText.trim()) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = { error: rawText.slice(0, 240) };
      }
    }

    if (!response.ok) {
      const obj = asRecord(body) ?? {};
      const code = obj.code != null ? String(obj.code) : null;
      const message = String(
        obj.error || obj.message || obj.description || `Zernio request failed (${response.status})`,
      );
      if (response.status === 409) {
        throw new ZernioApiError(
          message ||
            'This exact content was already posted to this account within the last 24 hours.',
          409,
          code || 'CONTENT_DEDUP',
        );
      }
      if (code === 'ACCOUNT_DISCONNECTED' || /disconnected/i.test(message)) {
        throw new ZernioApiError(message, 400, 'ACCOUNT_DISCONNECTED');
      }
      this.logger.warn(`[zernio] ${response.status} ${path}: ${message}`);
      throw new ZernioApiError(message, response.status, code);
    }

    if (response.status === 204) return null;
    return body;
  }

  async createProfile(name: string, description?: string): Promise<{ id: string }> {
    const raw = await this.zernioRequest('/profiles', {
      method: 'POST',
      body: { name, description },
    });
    const obj = asRecord(raw);
    const profile = asRecord(obj?.profile) ?? obj;
    const id = pickId(profile);
    if (!id) {
      throw new ZernioApiError('Zernio createProfile returned no id', 502);
    }
    return { id };
  }

  async getConnectUrl(
    platform: ZernioPlatform | string,
    profileId: string,
    redirectUrl: string,
  ): Promise<{ authUrl: string }> {
    const params = new URLSearchParams({
      profileId,
      redirect_url: redirectUrl,
    });
    const raw = await this.zernioRequest(
      `/connect/${encodeURIComponent(platform)}?${params.toString()}`,
    );
    const obj = asRecord(raw) ?? {};
    const authUrl =
      typeof obj.authUrl === 'string'
        ? obj.authUrl
        : typeof obj.url === 'string'
          ? obj.url
          : null;
    if (!authUrl) {
      throw new ZernioApiError('Zernio connect did not return an authUrl', 502);
    }
    return { authUrl };
  }

  /**
   * Shopify requires the store domain on the connect URL.
   * Accepts `store.myshopify.com` or bare `store`.
   */
  async getShopifyConnectUrl(
    profileId: string,
    shop: string,
    redirectUrl: string,
  ): Promise<{ authUrl: string }> {
    const normalized = shop
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
    if (!normalized) {
      throw new ZernioApiError('Shopify store domain is required', 400);
    }
    const params = new URLSearchParams({
      profileId,
      shop: normalized,
      redirect_url: redirectUrl,
    });
    const raw = await this.zernioRequest(`/connect/shopify?${params.toString()}`);
    const obj = asRecord(raw) ?? {};
    const authUrl =
      typeof obj.authUrl === 'string'
        ? obj.authUrl
        : typeof obj.url === 'string'
          ? obj.url
          : null;
    if (!authUrl) {
      throw new ZernioApiError('Zernio Shopify connect did not return an authUrl', 502);
    }
    return { authUrl };
  }

  async listAccounts(profileId: string): Promise<ZernioAccount[]> {
    const params = new URLSearchParams({ profileId });
    const raw = await this.zernioRequest(`/accounts?${params.toString()}`);
    const obj = asRecord(raw);
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(obj?.accounts)
        ? (obj!.accounts as unknown[])
        : Array.isArray(obj?.data)
          ? (obj!.data as unknown[])
          : [];
    const accounts: ZernioAccount[] = [];
    for (const item of list) {
      const row = asRecord(item);
      if (!row) continue;
      const id = pickId(row);
      if (!id) continue;
      accounts.push({
        id,
        platform: String(row.platform ?? ''),
        username:
          row.username != null
            ? String(row.username)
            : row.handle != null
              ? String(row.handle)
              : null,
        displayName:
          row.displayName != null
            ? String(row.displayName)
            : row.name != null
              ? String(row.name)
              : null,
        profileId:
          row.profileId != null
            ? String(row.profileId)
            : asRecord(row.profile)?.['_id'] != null
              ? String(asRecord(row.profile)!['_id'])
              : null,
        isActive: row.isActive !== false && row.status !== 'disconnected',
        raw: row,
      });
    }
    return accounts;
  }

  async disconnectAccount(accountId: string): Promise<void> {
    await this.zernioRequest(`/accounts/${encodeURIComponent(accountId)}`, {
      method: 'DELETE',
    });
  }

  async accountHealth(accountId: string): Promise<{ healthy: boolean; raw: unknown }> {
    try {
      const raw = await this.zernioRequest(
        `/accounts/${encodeURIComponent(accountId)}/health`,
      );
      const obj = asRecord(raw) ?? {};
      const healthy =
        obj.healthy === true ||
        obj.isHealthy === true ||
        obj.status === 'healthy' ||
        obj.status === 'ok';
      return { healthy, raw };
    } catch (err) {
      if (err instanceof ZernioApiError && err.statusCode === 404) {
        return { healthy: true, raw: null };
      }
      throw err;
    }
  }

  async createPost(input: ZernioCreatePostInput): Promise<ZernioCreatePostResult> {
    const body: Record<string, unknown> = {
      platforms: input.platforms.map((p) => {
        const entry: Record<string, unknown> = {
          platform: p.platform,
          accountId: p.accountId,
        };
        if (p.customContent != null) entry.customContent = p.customContent;
        return entry;
      }),
      publishNow: input.publishNow ?? true,
    };
    if (input.content != null) body.content = input.content;
    if (input.title != null) body.title = input.title;
    if (input.mediaItems?.length) body.mediaItems = input.mediaItems;
    if (input.scheduledFor) body.scheduledFor = input.scheduledFor;
    if (input.isDraft) body.isDraft = true;

    const raw = await this.zernioRequest('/posts', {
      method: 'POST',
      body,
      requestId: input.requestId,
    });

    const obj = asRecord(raw) ?? {};
    // Idempotent retry returns existingPost
    const post =
      asRecord(obj.post) ??
      asRecord(obj.existingPost) ??
      asRecord(asRecord(obj.data)?.post) ??
      obj;
    const postId = pickId(post);
    const platformsRaw = Array.isArray(post?.platforms)
      ? (post!.platforms as unknown[])
      : Array.isArray(obj.platforms)
        ? (obj.platforms as unknown[])
        : [];

    const platforms: ZernioPlatformResult[] = platformsRaw.map((item) => {
      const row = asRecord(item) ?? {};
      const account =
        typeof row.accountId === 'string'
          ? row.accountId
          : pickId(asRecord(row.accountId));
      return {
        platform: String(row.platform ?? ''),
        accountId: account,
        status: row.status != null ? String(row.status) : null,
        platformPostUrl:
          row.platformPostUrl != null
            ? String(row.platformPostUrl)
            : row.url != null
              ? String(row.url)
              : row.permalink != null
                ? String(row.permalink)
                : null,
        error: row.error != null ? String(row.error) : null,
      };
    });

    return {
      postId,
      status: post?.status != null ? String(post.status) : null,
      platforms,
      raw,
    };
  }

  async presignMedia(opts: {
    fileName: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; publicUrl: string }> {
    const raw = await this.zernioRequest('/media/presign', {
      method: 'POST',
      body: opts,
    });
    const obj = asRecord(raw) ?? {};
    const uploadUrl =
      typeof obj.uploadUrl === 'string'
        ? obj.uploadUrl
        : typeof obj.signedUrl === 'string'
          ? obj.signedUrl
          : null;
    const publicUrl =
      typeof obj.publicUrl === 'string'
        ? obj.publicUrl
        : typeof obj.url === 'string'
          ? obj.url
          : null;
    if (!uploadUrl || !publicUrl) {
      throw new ZernioApiError('Zernio media presign missing uploadUrl/publicUrl', 502);
    }
    return { uploadUrl, publicUrl };
  }
}
