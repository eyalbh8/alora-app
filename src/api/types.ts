// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type FilterOperator =
  | 'EQUALS'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'LT'
  | 'GEQ'
  | 'LEQ'
  | 'IN'

export interface ApiFilter {
  field: string
  operator: FilterOperator
  value: unknown
}

export interface DataAvailability {
  earliest_data_date: string | null
  latest_data_date: string | null
  requested_period_has_data: boolean
}

export interface ListMeta {
  page: number
  per_page: number
  total_pages: number
  total_count: number
  start_date?: string
  end_date?: string
  data_availability?: DataAvailability
}

export interface ListResponse<T> {
  data: T[]
  meta: ListMeta
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type AnalyticsMetric =
  | 'mention_rate'
  | 'share_of_voice'
  | 'citation_rate'
  | 'citation_share'
  | 'citation_count'
  | 'sentiment_score'
  | 'average_position'
  | 'answer_count'
  | 'first_mention_rate'

export type AnalyticsDimension =
  | 'date'
  | 'provider'
  | 'topic'
  | 'country'
  | 'persona'
  | 'domain'
  | 'competitor'
  | 'domain_category'
  | 'theme'

export type AnalyticsGrain = 'daily' | 'weekly' | 'monthly' | 'total'

/** Prompt type filter — maps to AirOps UI "Category Related" vs brand-related. */
export type BrandMentionedFilter = 'category' | 'brand'

export type Provider =
  | 'chat_gpt'
  | 'gemini'
  | 'perplexity'
  | 'google_ai_mode'
  | 'google_ai_overview'
  | 'claude'
  | 'grok'
  | 'microsoft_copilot'

export interface AnalyticsParams {
  metrics: AnalyticsMetric[]
  dimensions?: AnalyticsDimension[]
  grain?: AnalyticsGrain
  start_date?: string
  end_date?: string
  providers?: Provider[]
  countries?: string[]
  topics?: number[]
  personas?: number[]
  /**
   * Prompt type: `category` = generic prompts (AirOps default for visibility),
   * `brand` = prompts that mention the brand. Maps from UI "Prompt Type".
   */
  brand_mentioned?: BrandMentionedFilter
  /** e.g. "mention_rate DESC" */
  order_by?: string
  tags?: number[] | { operator: 'IN' | 'HAS_ALL' | 'NOT_IN'; value: number[] }
  themes?: number[]
  limit?: number
  offset?: number
}

/** Rows are keyed by the requested dimensions plus one key per metric. */
export type AnalyticsRow = {
  date?: string
  provider?: string
  topic?: string | number
  country?: string
  persona?: string | number
  domain?: string | number
  competitor?: string | number
  domain_category?: string
  theme?: string | number
  /** Present on some theme-dimension responses alongside `theme`. */
  theme_id?: number
  theme_name?: string
} & Partial<Record<AnalyticsMetric, number | null>>

export interface AnalyticsResponse {
  query: {
    metrics: AnalyticsMetric[]
    dimensions: AnalyticsDimension[]
    filters: Record<string, unknown>
    grain: AnalyticsGrain
    limit: number
    offset: number
  }
  data: AnalyticsRow[]
  meta: {
    row_count: number
    total_count: number
    execution_time_ms: number
    data_availability: DataAvailability
    start_date: string
    end_date: string
  }
  chart_image_url: string | null
}


// ---------------------------------------------------------------------------
// Sentiment theme answers
// ---------------------------------------------------------------------------

export interface SentimentThemeAnswersParams {
  sentiment_theme_id: number
  start_date?: string
  end_date?: string
  providers?: Provider[]
  countries?: string[]
  topics?: number[]
  personas?: number[]
  page?: number
  per_page?: number
}

export type AnswerSentiment = 'positive' | 'neutral' | 'negative'

export interface SentimentThemeAnswer {
  answer_id: number
  query_id: number
  provider: string
  sentiment: AnswerSentiment
  confidence: number
  date: string
  answer_text: string
}

export interface SentimentThemeAnswersResponse {
  answers: SentimentThemeAnswer[]
  pagination: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
  }
  error?: string | null
}

// ---------------------------------------------------------------------------
// Web pages (Onsite)
// ---------------------------------------------------------------------------

export interface WebPagesListParams {
  start_date?: string
  end_date?: string
  filters?: ApiFilter[]
  sort?: string
  page?: number
  per_page?: number
}

export interface WebPageRow {
  id: number
  web_page_id: number
  url: string
  folder_name: string | null
  primary_keyword: string
  tracked: boolean
  citations_count: number
  citations_count_diff: number
  citation_rate: number | null
  citation_rate_diff: number
  prompts_count: number
  prompts_count_diff: number
  // Google Search Console — null means GSC is not connected
  clicks: number | null
  clicks_diff: number | null
  impressions: number | null
  impressions_diff: number | null
  ctr: number | null
  ctr_diff: number | null
  position: number | null
  position_diff: number | null
  // GA4 — null means GA4 is not connected
  traffic: number | null
  traffic_diff: number | null
  sessions: number | null
  sessions_diff: number | null
  engagement: number | null
  engagement_diff: number | null
  average_session_engagement: number | null
  average_session_engagement_diff: number | null
  events: number | null
  amplitude_events: number | null
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

export type PromptVolume = 'very_low' | 'low' | 'medium' | 'high'

export interface PromptsListParams {
  filters?: ApiFilter[]
  fields?: string[]
  includes?: Array<'topic' | 'tags'>
  sort?: string
  page?: number
  per_page?: number
  start_date?: string
  end_date?: string
}

export interface PromptRow {
  id: number
  text: string
  keyword: string
  brand_mentioned: boolean
  prompt_volume: PromptVolume | null
  mention_rate: number | null
  citation_rate: number | null
  mention_rate_trend?: number | null
  citation_rate_trend?: number | null
  topic_id?: number | null
  topic?: Topic | null
  created_at?: string
}

// ---------------------------------------------------------------------------
// Citations & Domains (Offsite)
// ---------------------------------------------------------------------------

export type DomainCategory =
  | 'Social'
  | 'Communities'
  | 'Reviews'
  | 'Media'
  | 'Educational'
  | 'Marketplaces'
  | 'Products'
  | 'Affiliates'
  | 'Other'
  | 'Owned'
  | 'Competitors'
  | 'No Category'

export interface CitationsListParams {
  /** Only EQUALS / EQ / IN operators are supported on this endpoint. */
  filters?: ApiFilter[]
  sort?: string
  page?: number
  per_page?: number
  start_date?: string
  end_date?: string
}

export interface InfluenceScoreBreakdown {
  coverage_score: number
  impact_score: number
  da_score: number
}

export interface CitationRow {
  url: string
  domain: number
  domain_name: string
  domain_category: string | null
  logo_url: string | null
  citation_count: number
  citation_count_trend: number | null
  citation_share: number
  citation_share_trend: number | null
  citation_rate: number
  citation_rate_trend: number | null
  influence_score: number
  influence_score_breakdown: InfluenceScoreBreakdown | null
  page_type: string | null
  brand_mentioned: boolean | null
  brand_sentiment: string | null
  mentioned_competitor_domains: string[] | null
  domain_authority: number | null
}

export interface DomainsListParams {
  filters?: ApiFilter[]
  sort?: string
  page?: number
  per_page?: number
  start_date?: string
  end_date?: string
}

export interface DomainRow {
  domain_id: number
  domain_name: string
  domain_category: string | null
  logo_url: string | null
  citation_count: number
  citation_count_trend: number | null
  url_count: number
  citation_share: number
  citation_share_trend: number | null
  citation_rate: number
  citation_rate_trend: number | null
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export interface Topic {
  id: number
  name: string
  color: string | null
}

// ---------------------------------------------------------------------------
// Brand kit settings
// ---------------------------------------------------------------------------

export interface BrandKitCompetitor {
  id: number
  name: string
  domain_url?: string | null
  domain?: string | null
}

export interface BrandKitSettings {
  id: number
  brand_name: string
  brand_url: string | null
  countries: string[]
  aeo_enabled: boolean
  prompts_count: number | null
  competitors: BrandKitCompetitor[]
  personas: unknown[]
}

// ---------------------------------------------------------------------------
// Brand Kit editor (full model for Brand Kit UI + webhook submit)
// ---------------------------------------------------------------------------

/** Brand Kit shapes aligned with AirOps Brand Kit UI / MCP get_brand_kit. */

export interface BrandKit {
  id: number
  workspace_name: string
  brand_name: string
  brand_url: string
  brand_about: string
  brand_customer?: string
  brand_competitors?: string
  brand_point_of_view?: string
  writing_persona: string
  writing_tone: string
  writing_cta?: string
  writing_cta_url?: string
  primary_color?: string | null
  secondary_color?: string | null
  accent_color?: string | null
  header_case?: string | null
  header_case_custom_value?: string | null
  countries: string[]
  aeo_enabled: boolean
  prompts_count: number
  status: 'published' | 'draft' | string
  unpublished_changes: boolean
  created_at: string
  updated_at: string
  product_lines: ProductLine[]
  audiences: Audience[]
  content_types: ContentType[]
  regions: Region[]
  writing_rules: WritingRule[]
  custom_variables: CustomVariable[]
  logo_variants: LogoVariant[]
  logo_sizes: LogoSize[]
  usage_rules: UsageRule[]
  palettes: Palette[]
  fonts: Font[]
  type_sizes: TypeSize[]
  visual_examples: VisualExample[]
}

export interface ProductLine {
  id: number
  name: string
  details: string
  positioning: string
  ideal_customer_profile: string
  url: string
  generation_status?: string
  competitors: Competitor[]
}

export interface Competitor {
  id: number
  name: string
  domain: string
  details: string | null
}

export interface Audience {
  id: number
  name: string
  description: string
  writing_rules: WritingRule[]
}

export interface ContentSample {
  id: number
  title?: string
  body?: string
  url?: string
}

export interface ContentType {
  id: number
  name: string
  template_outline?: string
  cta_text?: string
  cta_url?: string
  header_case?: string
  content_samples?: ContentSample[]
  writing_rules?: WritingRule[]
}

export interface Region {
  id: number
  name: string
  description: string
  icon_name: string
  writing_rules: WritingRule[]
}

export interface WritingRule {
  id: number
  text: string
}

export interface CustomVariable {
  id: number
  name: string
  value: string
}

export interface LogoVariant {
  id: number
  name: string
  background_color: string
  usage_instructions: string
  file_url: string
}

export interface LogoSize {
  id: number
  name: string
  width?: number
  height?: number
  usage_instructions?: string
}

export interface UsageRule {
  id: number
  applies_to: 'logo' | 'color' | 'typography' | 'visual_examples'
  name: string
}

export interface PaletteColor {
  id: number
  name: string
  value: string
  usage_instructions: string
}

export interface Palette {
  id: number
  name: string
  colors: PaletteColor[]
}

export interface Font {
  id: number
  name: string
  usage_instructions: string
  google_font_link?: string
  file_url?: string | null
}

export interface TypeSize {
  id: number
  font_id: number
  name: string
  weight: number
  size: number
  line_height: number
  usage_instructions: string
}

export interface VisualExample {
  id: number
  title: string
  sample_url?: string
  file_url?: string
  usage_instructions?: string
}

export type DiffKind = 'updated' | 'added' | 'removed'

export interface DiffChange {
  path: string
  entity: string
  label: string
  kind: DiffKind
  before?: string
  after?: string
}

export interface BrandKitDiff {
  brand_kit_id: number
  brand_name: string
  submitted_at: string
  changes: DiffChange[]
  /** Full current local snapshot for the Playbook agent to apply. */
  current: BrandKit
  /** Original fetched snapshot for reference. */
  original: BrandKit
}

export interface ListBrandKitsParams {
  filters?: Array<{ field: string; operator: string; value: unknown }>
  includes?: Array<'product_lines' | 'competitors' | 'audiences' | 'content_types'>
  fields?: string[]
  page?: number
  per_page?: number
}
