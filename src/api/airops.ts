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

export function listDomains(params: DomainsListParams = {}): Promise<ListResponse<DomainRow>> {
  return apiPost<ListResponse<DomainRow>>(kitPath('/domains/list'), params)
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
