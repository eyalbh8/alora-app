/** iGEO-aligned LLM provider metadata (icons, labels, normalization). */

export const LLM_PROVIDER_ICONS: Record<string, string> = {
  GEMINI: '/static/llm-icons/gemini-color.svg',
  OPENAI: '/static/llm-icons/openai.svg',
  CLAUDE: '/static/llm-icons/claude-color.svg',
  ANTHROPIC: '/static/llm-icons/claude-color.svg',
  PERPLEXITY: '/static/llm-icons/perplexity-color.svg',
  BD_PERPLEXITY: '/static/llm-icons/perplexity-color.svg',
  GROK: '/static/llm-icons/grok.svg',
  BD_GOOGLE_AI_MODE: '/static/llm-icons/google-color.svg',
  GOOGLE_AI_MODE: '/static/llm-icons/google-color.svg',
  GOOGLE_AI_OVERVIEW: '/static/llm-icons/google-color.svg',
  BD_COPILOT: '/static/llm-icons/copilot-color.svg',
  COPILOT: '/static/llm-icons/copilot-color.svg',
  DEEPSEEK: '/static/llm-icons/deepseek-color.svg',
  META: '/static/llm-icons/meta-color.svg',
  DEFAULT: '/static/llm-icons/default-llm.svg',
}

export const LLM_PROVIDER_NAMES: Record<string, string> = {
  GEMINI: 'Gemini',
  OPENAI: 'ChatGPT',
  CHATGPT: 'ChatGPT',
  CHAT_GPT: 'ChatGPT',
  GPT: 'ChatGPT',
  CLAUDE: 'Claude',
  ANTHROPIC: 'Claude',
  PERPLEXITY: 'Perplexity',
  BD_PERPLEXITY: 'Perplexity',
  GROK: 'Grok',
  BD_GOOGLE_AI_MODE: 'Google AI mode',
  GOOGLE_AI_MODE: 'Google AI mode',
  GOOGLE_AI_OVERVIEW: 'Google AI Overview',
  BD_COPILOT: 'Copilot',
  COPILOT: 'Copilot',
  MICROSOFT_COPILOT: 'Copilot',
  DEEPSEEK: 'DeepSeek',
  META: 'Meta AI',
  ALL: 'All providers',
}

export function normalizeLlmProviderName(name: string): string {
  const key = name.toUpperCase().replace(/\s+/g, '_')
  if (key.includes('OPENAI') || key.includes('CHAT') || key === 'GPT') return 'OPENAI'
  if (key === 'CLAUDE') return 'ANTHROPIC'
  if (key === 'BD_PERPLEXITY') return 'PERPLEXITY'
  if (key === 'COPILOT' || key === 'MICROSOFT_COPILOT') return 'BD_COPILOT'
  if (key === 'GOOGLE_AI_MODE') return 'BD_GOOGLE_AI_MODE'
  return key
}

export function getLlmProviderDisplayName(provider: string): string {
  const normalized = normalizeLlmProviderName(provider)
  return LLM_PROVIDER_NAMES[normalized] ?? provider
}

export function getLlmProviderIcon(provider: string): string {
  const normalized = normalizeLlmProviderName(provider)
  return LLM_PROVIDER_ICONS[normalized] ?? LLM_PROVIDER_ICONS.DEFAULT
}
