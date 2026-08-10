/** LLM providers shown on the iGEO AI Traffic screen, in display order. */
export const AI_TRAFFIC_PROVIDER_ORDER = [
  'OPENAI',
  'ANTHROPIC',
  'PERPLEXITY',
  'GEMINI',
  'BD_COPILOT',
] as const

/** iGEO-aligned colors for the AI Traffic chart legend. */
export const AI_TRAFFIC_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#1a1a1a',
  CHATGPT: '#1a1a1a',
  CHAT_GPT: '#1a1a1a',
  GPT: '#1a1a1a',
  ANTHROPIC: '#d97706',
  CLAUDE: '#d97706',
  PERPLEXITY: '#3b82f6',
  GEMINI: '#eab308',
  BD_COPILOT: '#ec4899',
  COPILOT: '#ec4899',
  MICROSOFT_COPILOT: '#ec4899',
}

export function trafficProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return AI_TRAFFIC_PROVIDER_COLORS[key] ?? '#94a3b8'
}

export const AI_TRAFFIC_CHART_HEIGHT = '420px'
