/** LLM providers shown on the upstream AI Traffic screen, in display order. */
export const AI_TRAFFIC_PROVIDER_ORDER = [
  'OPENAI',
  'ANTHROPIC',
  'PERPLEXITY',
  'GEMINI',
  'BD_COPILOT',
] as const

/** Provider palette used by the AI Traffic trend chart. */
export const AI_TRAFFIC_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#07080c',
  CHATGPT: '#07080c',
  CHAT_GPT: '#07080c',
  GPT: '#07080c',
  ANTHROPIC: '#6b7488',
  CLAUDE: '#6b7488',
  PERPLEXITY: '#2d4f9e',
  GEMINI: '#6f8fd8',
  BD_COPILOT: '#8ca6e0',
  COPILOT: '#8ca6e0',
  MICROSOFT_COPILOT: '#8ca6e0',
}

export function trafficProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return AI_TRAFFIC_PROVIDER_COLORS[key] ?? '#6b7488'
}

export const AI_TRAFFIC_CHART_HEIGHT = '420px'
