import { SourceApiError, SourceApiService } from './source-api.service';

export type LinkPublishedUrlInput = {
  accountId: string;
  apiKey: string;
  /** Canonical live permalink including scheme (https://). */
  url: string;
  /** iGEO post UUIDs to attach. Only urls[0] is written onto these posts. */
  postIds: string[];
  recommendationId?: string;
};

export type LinkPublishedUrlResult = {
  id: string;
  recommendationId?: string | null;
  accountId?: string | null;
  urls?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Link an externally published social URL back to iGEO posts via monitored-proposals.
 *
 * Do NOT put publishedUrl on updatePost — that field is stripped by validation.
 * This endpoint is NOT idempotent: callers must guard against duplicate submissions
 * (e.g. only call when published_posts.igeoLinkedAt is null).
 *
 * Call once per distinct live URL. Only urls[0] is written onto related posts.
 */
export async function linkPublishedUrlToPosts(
  sourceApi: SourceApiService,
  input: LinkPublishedUrlInput,
): Promise<LinkPublishedUrlResult> {
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  if (!url) {
    const err = new Error('At least one URL is required to track results') as Error & {
      statusCode: number;
    };
    err.statusCode = 400;
    throw err;
  }
  if (!/^https?:\/\//i.test(url)) {
    const err = new Error(
      'Send the full canonical permalink including scheme (https://)',
    ) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const postIds = (input.postIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  const body: Record<string, unknown> = {
    urls: [url],
  };
  if (postIds.length) body.relatedPostIds = postIds;
  if (input.recommendationId) body.recommendationId = input.recommendationId;

  let raw: unknown;
  try {
    raw = await sourceApi.sourceRequest(
      input.accountId,
      input.apiKey,
      `/accounts/${input.accountId}/monitored-proposals`,
      { method: 'POST', body },
    );
  } catch (err) {
    if (err instanceof SourceApiError && err.statusCode === 403) {
      const scoped = new Error(
        'iGEO API key lacks the write scope required to link published URLs. Update the workspace key scopes.',
      ) as Error & { statusCode: number; code: string };
      scoped.statusCode = 403;
      scoped.code = 'IGEO_WRITE_SCOPE_MISSING';
      throw scoped;
    }
    throw err;
  }

  const obj = asRecord(raw) ?? asRecord(asRecord(raw)?.data) ?? {};
  const id =
    obj.id != null
      ? String(obj.id)
      : obj.trackedRecommendationId != null
        ? String(obj.trackedRecommendationId)
        : null;
  if (!id) {
    const err = new Error(
      'monitored-proposals did not return a tracked recommendation id',
    ) as Error & { statusCode: number };
    err.statusCode = 502;
    throw err;
  }

  return {
    id,
    recommendationId:
      obj.recommendationId != null ? String(obj.recommendationId) : null,
    accountId: obj.accountId != null ? String(obj.accountId) : null,
    urls: Array.isArray(obj.urls) ? obj.urls.map((u) => String(u)) : [url],
    createdAt: obj.createdAt != null ? String(obj.createdAt) : null,
    updatedAt: obj.updatedAt != null ? String(obj.updatedAt) : null,
  };
}
