import { PROVIDER_ORDER } from '../dashboard/constants'

/** iGEO-aligned provider colors for the Mentions screen charts. */
export const MENTIONS_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#1a1a1a',
  CHATGPT: '#1a1a1a',
  CHAT_GPT: '#1a1a1a',
  GPT: '#1a1a1a',
  PERPLEXITY: '#f97316',
  GEMINI: '#3b82f6',
  BD_GOOGLE_AI_MODE: '#eab308',
  GOOGLE_AI_MODE: '#eab308',
  GOOGLE_AI_OVERVIEW: '#8b5cf6',
  ANTHROPIC: '#d97706',
  CLAUDE: '#d97706',
  GROK: '#64748b',
  BD_COPILOT: '#2563eb',
  COPILOT: '#2563eb',
  MICROSOFT_COPILOT: '#2563eb',
}

export function mentionsProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return MENTIONS_PROVIDER_COLORS[key] ?? '#94a3b8'
}

/** Providers shown in iGEO mention charts, in display order. */
export const MENTIONS_PROVIDER_ORDER = PROVIDER_ORDER

export const MENTIONS_CHART_HEIGHT = '420px'

/** Layout for the LLM Mentions donut + provider icon orbit (matches Share of Voice pattern). */
export const MENTIONS_DONUT = {
  width: 400,
  height: 300,
  donutSize: 188,
  outerRadiusPct: 0.84,
  innerRadiusPct: 0.58,
  logoOrbit: 128,
  paddingAngle: 1,
  startAngle: 90,
} as const

export function mentionsDonutCenter() {
  return { cx: MENTIONS_DONUT.width / 2, cy: MENTIONS_DONUT.height / 2 }
}

export function mentionsDonutOuterRadius() {
  return (MENTIONS_DONUT.donutSize / 2) * MENTIONS_DONUT.outerRadiusPct
}
