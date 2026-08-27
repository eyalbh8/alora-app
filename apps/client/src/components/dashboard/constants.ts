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
  '#2d4f9e',
  '#6f8fd8',
  '#8ca6e0',
  '#07080c',
  '#bfcdf0',
  '#4d5568',
  '#d4d8f6',
  '#6b7488',
]

export const CHART_GRID = 'rgba(45, 79, 158, 0.1)'
export const CHART_AXIS = '#6b7488'
