import { PROVIDER_ORDER } from '../dashboard/constants'

/** Provider palette used by the Mentions summary and trend chart. */
export const MENTIONS_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#07080c',
  CHATGPT: '#07080c',
  CHAT_GPT: '#07080c',
  GPT: '#07080c',
  PERPLEXITY: '#2d4f9e',
  GEMINI: '#6f8fd8',
  BD_GOOGLE_AI_MODE: '#8ca6e0',
  GOOGLE_AI_MODE: '#8ca6e0',
  GOOGLE_AI_OVERVIEW: '#4d5568',
  ANTHROPIC: '#6b7488',
  CLAUDE: '#6b7488',
  GROK: '#bfcdf0',
  BD_COPILOT: '#8ca6e0',
  COPILOT: '#8ca6e0',
  MICROSOFT_COPILOT: '#8ca6e0',
}

export function mentionsProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return MENTIONS_PROVIDER_COLORS[key] ?? '#6b7488'
}

/** Providers shown in mention charts, in display order. */
export const MENTIONS_PROVIDER_ORDER = PROVIDER_ORDER

export const MENTIONS_CHART_HEIGHT = 260
