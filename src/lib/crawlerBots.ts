/** iGEO-aligned AI crawler bot metadata (icons, labels, normalization). */

export const CRAWLER_BOT_ICONS: Record<string, string> = {
  AMAZONBOT: '/static/llm-icons/amazon-color.svg',
  APPLEBOT: '/static/llm-icons/apple-color.svg',
  BYTESPIDER: '/static/llm-icons/bytedance-color.svg',
  CLAUDEBOT: '/static/llm-icons/claude-color.svg',
  GOOGLEBOT: '/static/llm-icons/google-color.svg',
  GOOGLEBOT_IMAGE: '/static/llm-icons/google-color.svg',
  CHATGPT_USER: '/static/llm-icons/openai.svg',
  META_EXTERNALAGENT: '/static/llm-icons/meta-color.svg',
  PERPLEXITYBOT: '/static/llm-icons/perplexity-color.svg',
  BINGBOT: '/static/llm-icons/copilot-color.svg',
  DEFAULT: '/static/llm-icons/default-llm.svg',
}

/** Featured crawlers shown in the top metric cards (iGEO order). */
export const CRAWLER_BOT_ORDER = [
  'AMAZONBOT',
  'APPLEBOT',
  'BYTESPIDER',
  'CLAUDEBOT',
  'GOOGLEBOT_IMAGE',
] as const

export function normalizeCrawlerBot(raw: string): string {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (key.includes('AMAZON')) return 'AMAZONBOT'
  if (key.includes('APPLE')) return 'APPLEBOT'
  if (key.includes('BYTE') || key.includes('TIKTOK') || key.includes('BYTEDANCE')) return 'BYTESPIDER'
  if (key.includes('CLAUDE') || key.includes('ANTHROPIC')) return 'CLAUDEBOT'
  if (key.includes('GOOGLEBOT') && key.includes('IMAGE')) return 'GOOGLEBOT_IMAGE'
  if (key.includes('GOOGLE')) return 'GOOGLEBOT'
  if (key.includes('CHATGPT') || key.includes('OPENAI')) return 'CHATGPT_USER'
  if (key.includes('META') || key.includes('FACEBOOK')) return 'META_EXTERNALAGENT'
  if (key.includes('PERPLEXITY')) return 'PERPLEXITYBOT'
  if (key.includes('BING') || key.includes('COPILOT')) return 'BINGBOT'
  return key
}

export function getCrawlerBotDisplayName(bot: string): string {
  const key = normalizeCrawlerBot(bot)
  const labels: Record<string, string> = {
    AMAZONBOT: 'Amazonbot',
    APPLEBOT: 'Applebot',
    BYTESPIDER: 'Bytespider',
    CLAUDEBOT: 'ClaudeBot',
    GOOGLEBOT: 'Googlebot',
    GOOGLEBOT_IMAGE: 'Googlebot-Image',
    CHATGPT_USER: 'ChatGPT-User',
    META_EXTERNALAGENT: 'Meta-ExternalAgent',
    PERPLEXITYBOT: 'PerplexityBot',
    BINGBOT: 'Bingbot',
  }
  return labels[key] ?? bot
}

export function getCrawlerBotIcon(bot: string): string {
  const key = normalizeCrawlerBot(bot)
  return CRAWLER_BOT_ICONS[key] ?? CRAWLER_BOT_ICONS.DEFAULT
}
