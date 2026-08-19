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
  '#42ca80',
  '#111111',
  '#e07a6a',
  '#d9793d',
  '#7a5fb0',
  '#5c5c5c',
  '#2f6fb0',
  '#3d3d3d',
]

export const CHART_GRID = 'rgba(17, 17, 17, 0.12)'
export const CHART_AXIS = '#6b6b6b'
