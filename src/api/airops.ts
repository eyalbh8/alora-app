/**
 * Typed wrappers for the AirOps Insights + Brand Kit REST APIs.
 *
 * Insights endpoints are POSTs under /public_api/brand_kits/{brand_kit_id}/...
 * Brand Kit READ endpoints:
 *   - POST /public_api/brand_kits/list
 *   - GET  /public_api/brand_kits/{id}
 *
 * CRITICAL: There is NO public REST write endpoint for Brand Kit fields.
 * `submitBrandKitChanges` posts to VITE_SUBMIT_WEBHOOK_URL (Playbook webhook).
 *
 * Requests are routed through the local dev proxy (/api/airops) which adds
 * the Authorization header server-side. See vite.config.ts.
 */
import { apiGet, apiPost } from './client'
import { BRAND_KIT_ID, SUBMIT_WEBHOOK_URL } from '../config'
import { normalizeBrandKit } from '../lib/normalize'
import type {
  AnalyticsParams,
  AnalyticsResponse,
  BrandKit,
  BrandKitDiff,
  BrandKitSettings,
  CitationRow,
  CitationsListParams,
  DomainRow,
  DomainsListParams,
  ListBrandKitsParams,
  ListResponse,
  PromptRow,
  PromptsListParams,
  SentimentThemeAnswersParams,
  SentimentThemeAnswersResponse,
  Topic,
  WebPageRow,
  WebPagesListParams,
} from './types'

const kitPath = (suffix: string) => `/public_api/brand_kits/${BRAND_KIT_ID}${suffix}`

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export function getAnalytics(params: AnalyticsParams): Promise<AnalyticsResponse> {
  return apiPost<AnalyticsResponse>(kitPath('/analytics'), params)
}

export function listWebPages(params: WebPagesListParams = {}): Promise<ListResponse<WebPageRow>> {
  return apiPost<ListResponse<WebPageRow>>(kitPath('/web_pages/list'), params)
}

export function listPrompts(params: PromptsListParams = {}): Promise<ListResponse<PromptRow>> {
  return apiPost<ListResponse<PromptRow>>(kitPath('/prompts/list'), params)
}

export function listCitations(params: CitationsListParams = {}): Promise<ListResponse<CitationRow>> {
  return apiPost<ListResponse<CitationRow>>(kitPath('/citations/list'), params)
}

/** Fetch every page from /citations/list (max 100 per page). */
async function listAllCitationPages(
  params: Pick<CitationsListParams, 'start_date' | 'end_date' | 'filters'>,
): Promise<CitationRow[]> {
  const all: CitationRow[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await listCitations({
      ...params,
      sort: '-citation_count',
      per_page: 100,
      page,
    })
    all.push(...res.data)
    totalPages = res.meta.total_pages || 1
    page += 1
  } while (page <= totalPages)
  return all
}

/**
 * Aggregate citation URLs into domain-level rows.
 *
 * AirOps has no public `/domains/list` endpoint (returns 404). Domain inventory
 * is derived from `/citations/list`, matching how the AirOps UI builds this view.
 */
function aggregateDomainsFromCitations(rows: CitationRow[]): DomainRow[] {
  type Acc = {
    domain_id: number
    domain_name: string
    domain_category: string | null
    logo_url: string | null
    citation_count: number
    citation_count_trend: number | null
    urls: Set<string>
    citation_rate: number
    citation_rate_trend: number | null
    citation_share_trend: number | null
  }

  const byDomain = new Map<number, Acc>()

  for (const row of rows) {
    const id = Number(row.domain)
    if (!Number.isFinite(id)) continue
    const existing = byDomain.get(id)
    if (existing) {
      existing.citation_count += row.citation_count ?? 0
      existing.urls.add(row.url)
      if (!existing.logo_url && row.logo_url) existing.logo_url = row.logo_url
      if (!existing.domain_category && row.domain_category) {
        existing.domain_category = row.domain_category
      }
      // Domain citation rate ≈ unique answers citing any URL on the domain;
      // URL rates can overlap, so use the max as a lower-bound proxy.
      if ((row.citation_rate ?? 0) > existing.citation_rate) {
        existing.citation_rate = row.citation_rate ?? 0
        existing.citation_rate_trend = row.citation_rate_trend
      }
    } else {
      byDomain.set(id, {
        domain_id: id,
        domain_name: row.domain_name || String(id),
        domain_category: row.domain_category,
        logo_url: row.logo_url,
        citation_count: row.citation_count ?? 0,
        citation_count_trend: row.citation_count_trend,
        urls: new Set([row.url]),
        citation_rate: row.citation_rate ?? 0,
        citation_rate_trend: row.citation_rate_trend,
        citation_share_trend: row.citation_share_trend,
      })
    }
  }

  const totalCitations =
    [...byDomain.values()].reduce((sum, d) => sum + d.citation_count, 0) || 1

  return [...byDomain.values()].map((d) => ({
    domain_id: d.domain_id,
    domain_name: d.domain_name,
    domain_category: d.domain_category,
    logo_url: d.logo_url,
    citation_count: d.citation_count,
    citation_count_trend: d.citation_count_trend,
    url_count: d.urls.size,
    citation_share: (d.citation_count / totalCitations) * 100,
    citation_share_trend: d.citation_share_trend,
    citation_rate: d.citation_rate,
    citation_rate_trend: d.citation_rate_trend,
  }))
}

function sortDomainRows(rows: DomainRow[], sort = '-citation_count'): DomainRow[] {
  const descending = sort.startsWith('-')
  const field = (descending ? sort.slice(1) : sort) as keyof DomainRow
  const sortable: Array<keyof DomainRow> = [
    'citation_count',
    'citation_share',
    'citation_rate',
    'url_count',
    'domain_name',
  ]
  if (!sortable.includes(field)) return rows

  return [...rows].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'string' && typeof bv === 'string') {
      return descending ? bv.localeCompare(av) : av.localeCompare(bv)
    }
    const an = typeof av === 'number' ? av : 0
    const bn = typeof bv === 'number' ? bv : 0
    return descending ? bn - an : an - bn
  })
}

/**
 * Domain inventory for Offsite.
 * Derived from `/citations/list` — there is no public `/domains/list` route.
 */
export async function listDomains(
  params: DomainsListParams = {},
): Promise<ListResponse<DomainRow>> {
  const citations = await listAllCitationPages({
    start_date: params.start_date,
    end_date: params.end_date,
    filters: params.filters,
  })
  const sorted = sortDomainRows(aggregateDomainsFromCitations(citations), params.sort)

  const page = params.page ?? 1
  const perPage = params.per_page ?? 25
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))
  const start = (page - 1) * perPage

  return {
    data: sorted.slice(start, start + perPage),
    meta: {
      page,
      per_page: perPage,
      total_count: totalCount,
      total_pages: totalPages,
      start_date: params.start_date,
      end_date: params.end_date,
      data_availability: {
        earliest_data_date: null,
        latest_data_date: null,
        requested_period_has_data: totalCount > 0,
      },
    },
  }
}

export async function listTopics(): Promise<Topic[]> {
  const res = await apiPost<{ data: Topic[] }>(kitPath('/topics/list'), { per_page: 100 })
  return res.data
}

/** Drill into AI answers that contributed to a sentiment theme. */
export function listSentimentThemeAnswers(
  params: SentimentThemeAnswersParams,
): Promise<SentimentThemeAnswersResponse> {
  return apiPost<SentimentThemeAnswersResponse>(kitPath('/sentiment_theme_answers'), {
    brand_kit_id: Number(BRAND_KIT_ID),
    ...params,
  })
}

interface BrandKitListRow {
  id: number
  brand_name: string
  brand_url?: string | null
  countries?: string[] | null
  aeo_enabled?: boolean | null
  prompts_count?: number | null
  competitors?: BrandKitSettings['competitors'] | null
  personas?: unknown[] | null
}

/**
 * Lightweight settings for Insights chrome (header, competitor labels).
 * Uses POST /public_api/brand_kits/list with includes: ["competitors"].
 */
export async function getBrandKitSettings(): Promise<BrandKitSettings> {
  const res = await apiPost<{ data: BrandKitListRow[] }>('/public_api/brand_kits/list', {
    fields: ['brand_url', 'countries', 'aeo_enabled', 'prompts_count'],
    includes: ['competitors'],
    per_page: 100,
  })
  const kit = res.data.find((k) => String(k.id) === String(BRAND_KIT_ID))
  if (!kit) {
    throw new Error(
      `Brand kit ${BRAND_KIT_ID} not found in /brand_kits/list response. Check VITE_AIROPS_BRAND_KIT_ID.`,
    )
  }
  return {
    id: kit.id,
    brand_name: kit.brand_name,
    brand_url: kit.brand_url ?? null,
    countries: kit.countries ?? [],
    aeo_enabled: kit.aeo_enabled ?? false,
    prompts_count: kit.prompts_count ?? null,
    competitors: kit.competitors ?? [],
    personas: kit.personas ?? [],
  }
}

// ---------------------------------------------------------------------------
// Brand Kit editor (READ + webhook submit)
// ---------------------------------------------------------------------------

const FULL_FIELDS = [
  'brand_url',
  'brand_about',
  'brand_customer',
  'brand_competitors',
  'brand_point_of_view',
  'writing_persona',
  'writing_tone',
  'writing_cta',
  'writing_cta_url',
  'writing_rules',
  'primary_color',
  'secondary_color',
  'accent_color',
  'header_case',
  'header_case_custom_value',
  'countries',
  'aeo_enabled',
  'prompts_count',
  'created_at',
  'updated_at',
] as const

const FULL_INCLUDES = ['product_lines', 'competitors', 'audiences', 'content_types'] as const

/** GET /public_api/brand_kits/{id} — foundations only (no nested includes on GET). */
export async function getBrandKitRaw(
  id: number = Number(BRAND_KIT_ID),
): Promise<Record<string, unknown>> {
  const res = await apiGet<{ data: Record<string, unknown> }>(`/public_api/brand_kits/${id}`)
  return res.data
}

/**
 * Full editor model: GET foundations + list with includes for nested collections.
 */
export async function getBrandKit(id: number = Number(BRAND_KIT_ID)): Promise<BrandKit> {
  const [raw, listed] = await Promise.all([
    getBrandKitRaw(id),
    listBrandKits({
      fields: [...FULL_FIELDS],
      includes: [...FULL_INCLUDES],
      per_page: 100,
    }),
  ])

  const fromList = listed.data.find((k) => Number(k.id) === Number(id))
  const merged: Record<string, unknown> = {
    ...raw,
    ...(fromList ?? {}),
    id,
  }

  return normalizeBrandKit(merged)
}

export async function listBrandKits(
  filters: ListBrandKitsParams = {},
): Promise<{ data: Array<Record<string, unknown>>; meta?: unknown }> {
  return apiPost('/public_api/brand_kits/list', {
    fields: filters.fields ?? [...FULL_FIELDS],
    includes: filters.includes ?? [...FULL_INCLUDES],
    filters: filters.filters,
    page: filters.page ?? 1,
    per_page: filters.per_page ?? 25,
  })
}

/**
 * WRITE — NOT a real AirOps public endpoint.
 * Posts the diff to VITE_SUBMIT_WEBHOOK_URL (AirOps Playbook webhook).
 */
export async function submitBrandKitChanges(
  diff: BrandKitDiff,
): Promise<{ status: string }> {
  if (!SUBMIT_WEBHOOK_URL || SUBMIT_WEBHOOK_URL.includes('your-airops-playbook')) {
    throw new Error(
      'VITE_SUBMIT_WEBHOOK_URL is not configured. Set it to your AirOps Playbook webhook URL in .env.',
    )
  }

  let response: Response
  try {
    response = await fetch(SUBMIT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diff),
    })
  } catch (err) {
    throw new Error(
      `Failed to reach submit webhook: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Webhook responded ${response.status}: ${text || response.statusText}`)
  }

  try {
    const body = (await response.json()) as { status?: string }
    return { status: body.status ?? 'queued' }
  } catch {
    return { status: 'queued' }
  }
}
