/** LLM providers shown on the iGEO AI Traffic screen, in display order. */
export const AI_TRAFFIC_PROVIDER_ORDER = [
  'OPENAI',
  'ANTHROPIC',
  'PERPLEXITY',
  'GEMINI',
  'BD_COPILOT',
] as const

/** Editorial provider palette used by the AI Traffic trend chart. */
export const AI_TRAFFIC_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#101414',
  CHATGPT: '#101414',
  CHAT_GPT: '#101414',
  GPT: '#101414',
  ANTHROPIC: '#d9793d',
  CLAUDE: '#d9793d',
  PERPLEXITY: '#2fc9bc',
  GEMINI: '#7a5fb0',
  BD_COPILOT: '#2f6fb0',
  COPILOT: '#2f6fb0',
  MICROSOFT_COPILOT: '#2f6fb0',
}

export function trafficProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return AI_TRAFFIC_PROVIDER_COLORS[key] ?? '#94a3b8'
}

export const AI_TRAFFIC_CHART_HEIGHT = '420px'
