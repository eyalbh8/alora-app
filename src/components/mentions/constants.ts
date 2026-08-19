import { PROVIDER_ORDER } from '../dashboard/constants'

/** Provider palette used by the Mentions summary and trend chart. */
export const MENTIONS_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#111111',
  CHATGPT: '#111111',
  CHAT_GPT: '#111111',
  GPT: '#111111',
  PERPLEXITY: '#42ca80',
  GEMINI: '#7a5fb0',
  BD_GOOGLE_AI_MODE: '#2f6fb0',
  GOOGLE_AI_MODE: '#2f6fb0',
  GOOGLE_AI_OVERVIEW: '#d99b3d',
  ANTHROPIC: '#d9793d',
  CLAUDE: '#d9793d',
  GROK: '#5c5c5c',
  BD_COPILOT: '#2f6fb0',
  COPILOT: '#2f6fb0',
  MICROSOFT_COPILOT: '#2f6fb0',
}

export function mentionsProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return MENTIONS_PROVIDER_COLORS[key] ?? '#6b6b6b'
}

/** Providers shown in mention charts, in display order. */
export const MENTIONS_PROVIDER_ORDER = PROVIDER_ORDER

export const MENTIONS_CHART_HEIGHT = 260
