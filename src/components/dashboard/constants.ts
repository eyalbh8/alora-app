/** Fixed height for overview dashboard cards (matches iGEO overview2). */
export const DASHBOARD_CARD_HEIGHT = '420px'

/** Shared geometry so Market position rows line up with Visibility trajectory grid. */
export const PAIRED_BRAND_COUNT = 5
export const PAIRED_SECTION_HEADER_MIN_CLASS = 'min-h-[3.25rem]'
export const PAIRED_LEGEND_HEIGHT_PX = 36
export const PAIRED_ROW_HEIGHT_PX = 52
export const PAIRED_XAXIS_HEIGHT_PX = 24
export const PAIRED_PLOT_HEIGHT_PX = PAIRED_ROW_HEIGHT_PX * PAIRED_BRAND_COUNT

export const PROVIDER_ORDER = [
  'OPENAI',
  'PERPLEXITY',
  'GEMINI',
  'ANTHROPIC',
  'GROK',
  'BD_GOOGLE_AI_MODE',
  'GOOGLE_AI_OVERVIEW',
  'BD_COPILOT',
] as const

export const CHART_COLORS = [
  '#148f85',
  '#3B82F6',
  '#EF4444',
  '#F59E0B',
  '#8B5CF6',
  '#10B981',
  '#EC4899',
  '#06B6D4',
]
