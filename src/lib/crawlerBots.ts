/** AI crawler bot metadata (icons, labels, normalization). */

export const CRAWLER_BOT_ICONS: Record<string, string> = {
  AMAZONBOT: '/static/llm-icons/amazon-color.svg',
  APPLEBOT: '/static/llm-icons/apple-color.svg',
  BYTESPIDER: '/static/llm-icons/bytedance-color.svg',
  CLAUDEBOT: '/static/llm-icons/claude-color.svg',
  GOOGLEBOT: '/static/llm-icons/google-color.svg',
  GOOGLEBOT_IMAGE: '/static/llm-icons/google-color.svg',
  CHATGPT_USER: '/static/llm-icons/openai.svg',
  GPTBOT: '/static/llm-icons/openai.svg',
  OAI_SEARCHBOT: '/static/llm-icons/openai.svg',
  META_EXTERNALAGENT: '/static/llm-icons/meta-color.svg',
  FACEBOOKBOT: '/static/llm-icons/meta-color.svg',
  PERPLEXITYBOT: '/static/llm-icons/perplexity-color.svg',
  BINGBOT: '/static/llm-icons/copilot-color.svg',
  DEFAULT: '/static/llm-icons/default-llm.svg',
}

const CRAWLER_BOT_LABELS: Record<string, string> = {
  AMAZONBOT: 'Amazonbot',
  APPLEBOT: 'Applebot',
  BYTESPIDER: 'Bytespider',
  CLAUDEBOT: 'ClaudeBot',
  GOOGLEBOT: 'Googlebot',
  GOOGLEBOT_IMAGE: 'Googlebot-Image',
  CHATGPT_USER: 'ChatGPT-User',
  GPTBOT: 'GPTBot',
  OAI_SEARCHBOT: 'OAI-SearchBot',
  META_EXTERNALAGENT: 'Meta-ExternalAgent',
  FACEBOOKBOT: 'FacebookBot',
  PERPLEXITYBOT: 'PerplexityBot',
  BINGBOT: 'Bingbot',
  PETALBOT: 'PetalBot',
}

/** Known upstream crawlers — used only as a fallback roster, not a display cap. */
export const CRAWLER_BOT_ORDER = [
  'AMAZONBOT',
  'APPLEBOT',
  'BINGBOT',
  'BYTESPIDER',
  'CHATGPT_USER',
  'CLAUDEBOT',
  'FACEBOOKBOT',
  'GOOGLEBOT',
  'GOOGLEBOT_IMAGE',
  'GPTBOT',
  'META_EXTERNALAGENT',
  'OAI_SEARCHBOT',
  'PERPLEXITYBOT',
] as const

const ICON_ALIASES: Array<[RegExp, string]> = [
  [/AMAZON/, 'AMAZONBOT'],
  [/APPLE/, 'APPLEBOT'],
  [/BYTE|TIKTOK|BYTEDANCE/, 'BYTESPIDER'],
  [/CLAUDE|ANTHROPIC/, 'CLAUDEBOT'],
  [/GOOGLEBOT.*IMAGE|IMAGE.*GOOGLEBOT/, 'GOOGLEBOT_IMAGE'],
  [/GOOGLE/, 'GOOGLEBOT'],
  [/OAI.*SEARCH/, 'OAI_SEARCHBOT'],
  [/CHATGPT|OPENAI|GPTBOT/, 'GPTBOT'],
  [/FACEBOOK/, 'FACEBOOKBOT'],
  [/META/, 'META_EXTERNALAGENT'],
  [/PERPLEXITY/, 'PERPLEXITYBOT'],
  [/BING|COPILOT/, 'BINGBOT'],
]

/** Canonicalize spelling only — do not merge distinct upstream crawlers. */
export function normalizeCrawlerBot(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

export function getCrawlerBotDisplayName(bot: string): string {
  const key = normalizeCrawlerBot(bot)
  return CRAWLER_BOT_LABELS[key] ?? bot.replace(/_/g, '-')
}

function iconKey(bot: string): string {
  const key = normalizeCrawlerBot(bot)
  if (CRAWLER_BOT_ICONS[key]) return key
  for (const [pattern, alias] of ICON_ALIASES) {
    if (pattern.test(key)) return alias
  }
  return 'DEFAULT'
}

export function getCrawlerBotIcon(bot: string): string {
  return CRAWLER_BOT_ICONS[iconKey(bot)] ?? CRAWLER_BOT_ICONS.DEFAULT
}
