import { PROVIDER_ORDER } from '../dashboard/constants'

/** Dark-safe provider palette used by the Mentions summary and trend chart. */
export const MENTIONS_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#e3dcc8',
  CHATGPT: '#e3dcc8',
  CHAT_GPT: '#e3dcc8',
  GPT: '#e3dcc8',
  PERPLEXITY: '#42ca80',
  GEMINI: '#7a5fb0',
  BD_GOOGLE_AI_MODE: '#2f6fb0',
  GOOGLE_AI_MODE: '#2f6fb0',
  GOOGLE_AI_OVERVIEW: '#d99b3d',
  ANTHROPIC: '#d9793d',
  CLAUDE: '#d9793d',
  GROK: '#bfb7a3',
  BD_COPILOT: '#2f6fb0',
  COPILOT: '#2f6fb0',
  MICROSOFT_COPILOT: '#2f6fb0',
}

export function mentionsProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return MENTIONS_PROVIDER_COLORS[key] ?? '#a79f8c'
}

/** Providers shown in mention charts, in display order. */
export const MENTIONS_PROVIDER_ORDER = PROVIDER_ORDER

export const MENTIONS_CHART_HEIGHT = 260
