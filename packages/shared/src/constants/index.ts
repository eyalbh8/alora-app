export const SCREEN_KEYS = [
  'dashboard',
  'dashboard_top_sources',
  'prompts',
  'topics',
  'mentions_chart',
  'mentions_sentiment',
  'sentiment',
  'sentiment_historical',
  'competitors',
  'ai_traffic',
  'ai_crawlers',
] as const

export type ScreenKey = (typeof SCREEN_KEYS)[number]
