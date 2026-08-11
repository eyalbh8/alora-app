import { PROVIDER_ORDER } from '../dashboard/constants'

/** Editorial provider palette used by the Mentions summary and trend chart. */
export const MENTIONS_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#101414',
  CHATGPT: '#101414',
  CHAT_GPT: '#101414',
  GPT: '#101414',
  PERPLEXITY: '#2fc9bc',
  GEMINI: '#7a5fb0',
  BD_GOOGLE_AI_MODE: '#2f6fb0',
  GOOGLE_AI_MODE: '#2f6fb0',
  GOOGLE_AI_OVERVIEW: '#d99b3d',
  ANTHROPIC: '#b76e4e',
  CLAUDE: '#b76e4e',
  GROK: '#64748b',
  BD_COPILOT: '#3f78a8',
  COPILOT: '#3f78a8',
  MICROSOFT_COPILOT: '#3f78a8',
}

export function mentionsProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return MENTIONS_PROVIDER_COLORS[key] ?? '#9a938a'
}

/** Providers shown in mention charts, in display order. */
export const MENTIONS_PROVIDER_ORDER = PROVIDER_ORDER

export const MENTIONS_CHART_HEIGHT = 260
