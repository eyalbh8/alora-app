/** Exact screen keys stored in whitelabel_screen_snapshots.screen */
export const SCREEN_KEYS = [
  'dashboard',
  'dashboard_top_sources',
  'prompts',
  'topics',
  'mentions_chart',
  'mentions_sentiment',
  'sentiment',
  'sentiment_historical',
  'competitors',
  'ai_traffic',
  'ai_crawlers',
] as const

export type ScreenKey = (typeof SCREEN_KEYS)[number]

export interface TenantInfo {
  id: string
  name: string | null
  domain: string | null
  sourceAccountId: string | null
}

export interface AvailableDay {
  day: string
  status: string
  finishedAt: string | null
  errorSummary: string | null
  pulledAt: string | null
}

export interface TenantResponse {
  tenant: TenantInfo
  availableDays: AvailableDay[]
}

export interface ScreenSnapshot {
  day: string
  screen: ScreenKey | string
  payload: unknown
  source: string | null
  schemaVersion: number
  pulledAt: string | null
  error: string | null
}

export interface SnapshotsResponse {
  tenant: TenantInfo
  range: { startDate: string; endDate: string }
  availableDays: AvailableDay[]
  snapshots: ScreenSnapshot[]
}

// ---------------------------------------------------------------------------
// Payload shapes (tolerant; generated from sample DB rows)
// ---------------------------------------------------------------------------

export interface ProviderMention {
  provider: string
  count: number
  countChange?: number | null
  historicalData?: Array<{ date: string; value: number }>
}

export interface CompetitorPerformance {
  id: string
  name: string
  logo?: string | null
  site?: string | null
  domain?: string | null
  avgRank?: number | null
  position?: number | null
  occurrences?: number | null
  avgRankDelta?: number | null
  occurrencesDelta?: number | null
  sentimentScore?: number | null
  sentimentScoreDelta?: number | null
  topics?: string[]
  historicalData?: Array<{ date: string; value: number }>
  status?: string | null
  isAccount?: boolean
}

export interface AgentPost {
  topic?: string | null
  prompt?: string | null
  createdAt?: string | null
  generationId?: string | null
  socialMediaProvider?: string | null
}

export interface DashboardData {
  hasPages?: boolean
  promptsCount?: number
  providerMentions?: ProviderMention[]
  competitorsPerformance?: CompetitorPerformance[]
  agentPosts?: { posts?: AgentPost[]; totalCount?: number }
  weeklyInsights?: { count?: number; latestDate?: string | null }
  topSourceDomains?: TopSource[]
}

export interface DashboardPayload {
  data?: DashboardData
  isLive?: boolean
  computedAt?: string
  dataVersion?: number
}

export interface TopSource {
  domain: string
  pageCount?: number
  occurrences?: number
}

export interface TopicRow {
  id: string
  name: string
  state?: string | null
  volume?: number | null
  priority?: number | null
  promptsCount?: number | null
}

export interface PromptTopicRef {
  id: string
  name: string
  state?: string | null
  volume?: number | null
  priority?: number | null
}

/** Tags may be plain strings or snapshot objects `{ name, tagId, colorRow }`. */
export interface PromptTagObject {
  name?: string | null
  tagId?: string | null
  colorRow?: string | null
}

export type PromptTag = string | PromptTagObject

export interface PromptRow {
  id: string
  prompt: string
  topicId?: string | null
  topic?: PromptTopicRef | null
  tags?: PromptTag[] | null
  type?: string | null
  regions?: string[] | null
  meInPrompt?: boolean | null
  avgVisibility?: number | null
  avgSentimentScore?: number | null
  avgRank?: number | null
  volume?: number | null
  visibilityChange?: number | null
  sentimentChange?: number | null
  rankChange?: number | null
  state?: string | null
  isActive?: boolean | null
  sentimentBreakdown?: {
    mixed?: number
    neutral?: number
    negative?: number
    positive?: number
  } | null
}

export interface PromptsPayload {
  total?: number
  prompts?: PromptRow[]
}

export interface MentionsChartData {
  posts?: unknown[]
  providers?: ProviderMention[]
  trackedRecommendations?: Array<{
    id: string
    recommendationTitle?: string
    urls?: string[]
    totalAppearances?: number
    createdAt?: string
  }>
}

export interface MentionsChartPayload {
  data?: MentionsChartData
  isLive?: boolean
  computedAt?: string
}

export interface ResponseSource {
  url: string
  title?: string | null
  isMe?: boolean
  isTracked?: boolean
}

export interface ResponseRow {
  id: string
  model?: string | null
  provider?: string | null
  myRank?: number | null
  region?: string | null
  topicId?: string | null
  promptId?: string | null
  promptText?: string | null
  response?: string | null
  responsePreview?: string | null
  sentimentScore?: number | null
  /** Typo present in some upstream snapshots */
  sentinemtScore?: number | null
  visibilityAverage?: number | null
  createdAt?: string | null
  timestamp?: string | null
  sources?: ResponseSource[]
  meInPrompt?: boolean | null
  isCompanyInPrompt?: boolean | null
  tags?: PromptTag[] | null
  promptType?: string | null
  type?: string | null
  topic?: string | null
  countries?: string[] | null
  /** Geo mirror payload minus heavy response text (companies, sentiment, etc.). */
  raw?: unknown
}

export interface ResponsesPayloadData {
  total?: number
  responses?: ResponseRow[]
}

export interface ResponsesEnvelope {
  data?: ResponsesPayloadData
  isLive?: boolean
  computedAt?: string
}

export interface SentimentHistoricalPoint {
  date: string
  provider: string
  sentimentScore: number
}

export interface SentimentHistoricalPayload {
  data?: SentimentHistoricalPoint[]
  isLive?: boolean
  computedAt?: string
}

export interface CitationLink {
  url: string
  title?: string | null
  isMe?: boolean
  isTracked?: boolean
}

export interface CompetitorsData {
  ranking?: CompetitorPerformance[]
  competitors?: CompetitorPerformance[]
  citations?: Record<string, CitationLink[]>
  citationCounts?: Record<string, number>
}

export interface CompetitorsPayload {
  data?: CompetitorsData
  isLive?: boolean
  computedAt?: string
}

export interface AiTrafficPayload {
  hasEvents?: boolean
  totalEntries?: number
  totalChange?: number
  changePercents?: Record<string, number>
  preferences?: unknown
  llmProviders?: Array<Record<string, unknown>>
  topSources?: Array<Record<string, unknown>>
  topPages?: Array<Record<string, unknown>>
  topLocations?: Array<Record<string, unknown>>
  topDevices?: Array<Record<string, unknown>>
  topBrowsers?: Array<Record<string, unknown>>
  historicalData?: Array<Record<string, unknown>>
  availableCountries?: string[]
  // error-shaped snapshots
  error?: boolean
  message?: string
  detail?: string
  statusCode?: number
  path?: string
}

export interface AiCrawlersPayload {
  totalRequests?: number
  totalBytes?: number
  changePercents?: Record<string, number>
  byBot?: Array<Record<string, unknown>>
  topPaths?: Array<Record<string, unknown>>
  timeSeriesData?: Array<Record<string, unknown>>
  error?: boolean
  message?: string
  detail?: string
  statusCode?: number
  path?: string
}

/** Branded / me-in-prompt filter values (AccountIncluded / AccountNotIncluded). */
export type BrandedFilter = 'AccountIncluded' | 'AccountNotIncluded' | null

export interface GeoFilters {
  startDate: string
  endDate: string
  providers: string[]
  topics: string[]
  prompts: string[]
  regions: string[]
  tags: string[]
  branded: BrandedFilter
  promptTypes: string[]
  crawlers: string[]
}
