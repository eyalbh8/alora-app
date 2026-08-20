import { PROVIDER_ORDER } from '../dashboard/constants'

/** Provider palette used by the Mentions summary and trend chart. */
export const MENTIONS_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#14201a',
  CHATGPT: '#14201a',
  CHAT_GPT: '#14201a',
  GPT: '#14201a',
  PERPLEXITY: '#1a8a4a',
  GEMINI: '#5c8f8a',
  BD_GOOGLE_AI_MODE: '#2ec37a',
  GOOGLE_AI_MODE: '#2ec37a',
  GOOGLE_AI_OVERVIEW: '#2a3830',
  ANTHROPIC: '#7a857e',
  CLAUDE: '#7a857e',
  GROK: '#cfe8d6',
  BD_COPILOT: '#5c8f8a',
  COPILOT: '#5c8f8a',
  MICROSOFT_COPILOT: '#5c8f8a',
}

export function mentionsProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return MENTIONS_PROVIDER_COLORS[key] ?? '#7a857e'
}

/** Providers shown in mention charts, in display order. */
export const MENTIONS_PROVIDER_ORDER = PROVIDER_ORDER

export const MENTIONS_CHART_HEIGHT = 260
