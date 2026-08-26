/** Fixed height for overview dashboard cards (matches upstream overview2). */
export const DASHBOARD_CARD_HEIGHT = '420px'

/** Shared geometry so Market position rows line up with Visibility trend grid. */
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
  '#1a8a4a',
  '#14201a',
  '#5c8f8a',
  '#2ec37a',
  '#cfe8d6',
  '#7a857e',
  '#2a3830',
  '#e8f6c8',
]

export const CHART_GRID = 'rgba(20, 32, 26, 0.08)'
export const CHART_AXIS = '#7a857e'
