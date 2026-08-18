import { apiGet } from './client'
import type {
  CompetitorPerformance,
  GeoFilters,
  ProviderMention,
  PromptTag,
  ResponseSource,
  TopSource,
  TrackedRecommendation,
} from './types'

/**
 * Client for the /geo/* aggregation endpoints. The BFF proxies these to the
 * live iGEO Public API and returns the same payload shapes the screens use.
 */

export interface GeoMeta {
  hasFacts: boolean
  factDays: { min: string | null; max: string | null }
  account: {
    id: string
    title: string
    names: string[]
    domains: string[]
    logo: string | null
  } | null
  options: {
    providers: string[]
    topics: Array<{ id: string; name: string }>
    prompts: Array<{ id: string; text: string }>
    regions: string[]
    tags: string[]
    promptTypes: string[]
  }
  competitors: Array<{
    id: string
    name: string
    logo: string | null
    site: string | null
    domain: string | null
    status: string | null
  }>
}

export interface GeoDashboard {
  data: {
    hasPages: boolean
    promptsCount: number
    providerMentions: ProviderMention[]
    competitorsPerformance: CompetitorPerformance[]
    topSourceDomains: TopSource[]
  }
  isLive: boolean
  computedAt: string
}

export interface GeoMentions {
  data: {
    providers: ProviderMention[]
    trackedRecommendations?: TrackedRecommendation[]
    posts?: unknown[]
  }
  computedAt: string
}

export interface GeoSentimentSummaryRow {
  topic: string
  provider: string
  breakdown: { positive: number; negative: number; neutral: number; mixed: number }
  score: number | null
}

export interface GeoSentiment {
  data: {
    summary: GeoSentimentSummaryRow[]
    overallScore: number | null
    previousOverallScore: number | null
    historical: Array<{ date: string; provider: string; sentimentScore: number }>
  }
  computedAt: string
}

export interface GeoPromptRow {
  id: string
  prompt: string
  topicId: string | null
  topic: { id: string; name: string; state: string | null } | null
  tags: PromptTag[]
  type: string | null
  regions: string[]
  meInPrompt: boolean | null
  volume: number | null
  isActive: boolean | null
  state: string | null
  avgVisibility: number | null
  visibilityChange?: number | null
  avgRank: number | null
  rankChange?: number | null
  avgSentimentScore: number | null
  sentimentBreakdown: { positive: number; negative: number; neutral: number; mixed: number } | null
  responsesCount: number
}

export interface GeoPrompts {
  total: number
  prompts: GeoPromptRow[]
}

export interface GeoCompetitors {
  data: { ranking: CompetitorPerformance[] }
  computedAt: string
}

export interface GeoResponseRow {
  id: string
  provider: string
  model: string | null
  timestamp: string
  region: string | null
  countries: string[]
  myRank: number | null
  visibilityAverage: number | null
  sources: ResponseSource[]
  status: string | null
  promptId: string | null
  topicId: string | null
  promptText: string | null
  topic: string | null
  responsePreview?: string | null
  response?: string | null
  sentimentScore?: number | null
  raw: unknown
}

export interface GeoResponseDetail {
  data: GeoResponseRow
  computedAt: string
}

export interface GeoResponses {
  data: { total: number; responses: GeoResponseRow[] }
  computedAt: string
}

export interface GeoProviderMentionPrompt {
  promptId: string | null
  prompt: string
  topic?: string | null
  count?: number
}

export interface GeoProviderMentionPrompts {
  prompts: GeoProviderMentionPrompt[]
}

function filtersToQuery(filters: GeoFilters, extra: Record<string, string | number> = {}): string {
  const q = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate })
  if (filters.rangeDays) q.set('range', String(filters.rangeDays))
  if (filters.providers.length) q.set('providers', filters.providers.join(','))
  if (filters.topics.length) q.set('topics', filters.topics.join(','))
  if (filters.prompts.length) q.set('prompts', filters.prompts.join(','))
  if (filters.regions.length) q.set('regions', filters.regions.join(','))
  if (filters.tags.length) q.set('tags', filters.tags.join(','))
  if (filters.branded) q.set('branded', filters.branded)
  if (filters.promptTypes.length) q.set('promptTypes', filters.promptTypes.join(','))
  for (const [k, v] of Object.entries(extra)) q.set(k, String(v))
  return q.toString()
}

export function getGeoMeta(): Promise<GeoMeta> {
  return apiGet<GeoMeta>('/geo/meta')
}

export async function getGeoDashboard(filters: GeoFilters): Promise<GeoDashboard> {
  const query = filtersToQuery(filters)
  console.info('[dashboard-ui] fetching /geo/dashboard', { filters, query })
  const payload = await apiGet<GeoDashboard>(`/geo/dashboard?${query}`)
  console.info('[dashboard-ui] /geo/dashboard response', {
    keys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    isLive: payload?.isLive,
    promptsCount: payload?.data?.promptsCount,
    mentions: payload?.data?.providerMentions?.map((m) => ({
      provider: m.provider,
      count: m.count,
    })),
    competitors: payload?.data?.competitorsPerformance?.length,
    sources: payload?.data?.topSourceDomains?.length,
  })
  return payload
}

export function getGeoMentions(filters: GeoFilters): Promise<GeoMentions> {
  return apiGet<GeoMentions>(`/geo/mentions?${filtersToQuery(filters)}`)
}

export function getGeoSentiment(filters: GeoFilters): Promise<GeoSentiment> {
  return apiGet<GeoSentiment>(`/geo/sentiment?${filtersToQuery(filters)}`)
}

export function getGeoPrompts(filters: GeoFilters): Promise<GeoPrompts> {
  return apiGet<GeoPrompts>(`/geo/prompts?${filtersToQuery(filters)}`)
}

export function getGeoCompetitors(filters: GeoFilters): Promise<GeoCompetitors> {
  return apiGet<GeoCompetitors>(`/geo/competitors?${filtersToQuery(filters)}`)
}

export function getGeoResponses(
  filters: GeoFilters,
  pagination: { skip?: number; take?: number } = {},
): Promise<GeoResponses> {
  return apiGet<GeoResponses>(
    `/geo/responses?${filtersToQuery(filters, {
      skip: pagination.skip ?? 0,
      take: pagination.take ?? 50,
    })}`,
  )
}

export function getGeoResponseDetail(responseId: string): Promise<GeoResponseDetail> {
  return apiGet<GeoResponseDetail>(`/geo/responses/${encodeURIComponent(responseId)}`)
}

export function getGeoProviderMentionPrompts(
  provider: string,
  filters: GeoFilters,
): Promise<GeoProviderMentionPrompts> {
  return apiGet<GeoProviderMentionPrompts>(
    `/geo/provider-mentions/${encodeURIComponent(provider)}/prompts?${filtersToQuery(filters)}`,
  )
}
