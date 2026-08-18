/** LLM providers shown on the upstream AI Traffic screen, in display order. */
export const AI_TRAFFIC_PROVIDER_ORDER = [
  'OPENAI',
  'ANTHROPIC',
  'PERPLEXITY',
  'GEMINI',
  'BD_COPILOT',
] as const

/** Dark-safe provider palette used by the AI Traffic trend chart. */
export const AI_TRAFFIC_PROVIDER_COLORS: Record<string, string> = {
  OPENAI: '#e3dcc8',
  CHATGPT: '#e3dcc8',
  CHAT_GPT: '#e3dcc8',
  GPT: '#e3dcc8',
  ANTHROPIC: '#d9793d',
  CLAUDE: '#d9793d',
  PERPLEXITY: '#42ca80',
  GEMINI: '#7a5fb0',
  BD_COPILOT: '#2f6fb0',
  COPILOT: '#2f6fb0',
  MICROSOFT_COPILOT: '#2f6fb0',
}

export function trafficProviderColor(provider: string): string {
  const key = provider.toUpperCase().replace(/\s+/g, '_')
  return AI_TRAFFIC_PROVIDER_COLORS[key] ?? '#a79f8c'
}

export const AI_TRAFFIC_CHART_HEIGHT = '420px'
