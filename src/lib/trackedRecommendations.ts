import type { TrackedRecommendation } from '../api/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

function pickUrls(obj: Record<string, unknown>): string[] {
  if (Array.isArray(obj.urls)) {
    return obj.urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
  }
  const single = pickString(obj, ['url', 'link', 'href', 'pageUrl'])
  return single ? [single] : []
}

/** Normalize upstream chart-data items that may use alternate field names. */
export function normalizeTrackedRecommendation(
  raw: unknown,
  index = 0,
): TrackedRecommendation | null {
  const obj = asRecord(raw)
  if (!obj) return null

  const nested = asRecord(obj.recommendation) ?? asRecord(obj.post) ?? obj
  const title = pickString(nested, [
    'recommendationTitle',
    'title',
    'name',
    'headline',
    'topic',
  ])
  const createdAt = pickString(nested, [
    'createdAt',
    'publishedAt',
    'date',
    'created_at',
    'published_at',
  ])
  const id =
    pickString(nested, ['id', 'recommendationId', 'postId', 'generationId']) ??
    `rec-${createdAt ?? index}-${title ?? index}`

  if (!title && !createdAt) return null

  return {
    id,
    recommendationTitle: title,
    urls: pickUrls(nested),
    totalAppearances: pickNumber(nested, [
      'totalAppearances',
      'cited',
      'citations',
      'appearances',
      'citationCount',
    ]),
    createdAt,
    type: pickString(nested, ['type', 'contentType', 'category', 'kind', 'postType']),
    imageUrl: pickString(nested, ['imageUrl', 'thumbnail', 'image', 'coverImage', 'ogImage']),
  }
}

export function recommendationDay(rec: TrackedRecommendation): string | null {
  if (!rec.createdAt) return null
  const day = rec.createdAt.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

export function recommendationTitle(rec: TrackedRecommendation): string {
  return rec.recommendationTitle?.trim() || rec.urls?.[0] || 'Untitled recommendation'
}

export function recommendationCited(rec: TrackedRecommendation): number {
  return rec.totalAppearances ?? 0
}

export function recommendationUrl(rec: TrackedRecommendation): string | null {
  return rec.urls?.[0] ?? null
}

export function recommendationTypeLabel(rec: TrackedRecommendation): string {
  const explicit = rec.type?.trim()
  if (explicit) {
    return explicit.charAt(0).toUpperCase() + explicit.slice(1)
  }

  const url = recommendationUrl(rec)?.toLowerCase() ?? ''
  if (url.includes('wordpress') || /\/blog\b/.test(url) || url.includes('/posts/')) {
    return 'Blog'
  }
  if (url) return 'Page'
  return 'Recommendation'
}

export function isBlogRecommendation(rec: TrackedRecommendation): boolean {
  return recommendationTypeLabel(rec).toLowerCase() === 'blog'
}

export function collectTrackedRecommendations(
  tracked: unknown[] | undefined,
  posts?: unknown[],
): TrackedRecommendation[] {
  const source = tracked?.length ? tracked : (posts ?? [])
  const seen = new Set<string>()
  const items: TrackedRecommendation[] = []

  for (const [index, raw] of source.entries()) {
    const rec = normalizeTrackedRecommendation(raw, index)
    if (!rec || seen.has(rec.id)) continue
    seen.add(rec.id)
    items.push(rec)
  }

  return items
}

export function groupRecommendationsByDay(
  items: TrackedRecommendation[],
  allowedDays?: Set<string>,
): Map<string, TrackedRecommendation[]> {
  const groups = new Map<string, TrackedRecommendation[]>()

  for (const rec of items) {
    const day = recommendationDay(rec)
    if (!day) continue
    if (allowedDays && !allowedDays.has(day)) continue
    const existing = groups.get(day)
    if (existing) existing.push(rec)
    else groups.set(day, [rec])
  }

  return groups
}
