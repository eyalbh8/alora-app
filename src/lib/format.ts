/**
 * Formatting rules:
 *  - rate/percentage metrics → 1 decimal place + "%"
 *  - null/undefined → "—" (never coerced to 0; "no data" is not "zero")
 */

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)
}

const PERCENT_METRICS = new Set([
  'mention_rate',
  'share_of_voice',
  'citation_rate',
  'citation_share',
  'sentiment_score',
  'first_mention_rate',
  'ctr',
])

export function isPercentMetric(metric: string): boolean {
  return PERCENT_METRICS.has(metric)
}

export function formatMetricValue(metric: string, value: number | null | undefined): string {
  return isPercentMetric(metric) ? formatPercent(value) : formatNumber(value)
}

import type { Provider } from '../api/types'

export const PROVIDER_LABELS: Record<Provider, string> = {
  chat_gpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  google_ai_mode: 'Google AI Mode',
  google_ai_overview: 'Google AI Overview',
  claude: 'Claude',
  grok: 'Grok',
  microsoft_copilot: 'Microsoft Copilot',
}

export const ALL_PROVIDERS: Provider[] = [
  'chat_gpt',
  'gemini',
  'perplexity',
  'google_ai_mode',
  'google_ai_overview',
  'claude',
  'grok',
  'microsoft_copilot',
]

export function providerLabel(provider: string): string {
  return (PROVIDER_LABELS as Record<string, string>)[provider] ?? provider
}

export const CORE_METRIC_LABELS: Record<string, string> = {
  mention_rate: 'Mention Rate',
  share_of_voice: 'Share of Voice',
  citation_rate: 'Citation Rate',
  citation_share: 'Citation Share',
  citation_count: 'Citations',
  sentiment_score: 'Sentiment Score',
  average_position: 'Average Position',
}

export function metricLabel(metric: string): string {
  return CORE_METRIC_LABELS[metric] ?? metric
}

export function ordinalRank(rank: number): string {
  const mod100 = rank % 100
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`
  switch (rank % 10) {
    case 1:
      return `${rank}st`
    case 2:
      return `${rank}nd`
    case 3:
      return `${rank}rd`
    default:
      return `${rank}th`
  }
}

export function truncateMiddle(text: string, max = 60): string {
  if (text.length <= max) return text
  const half = Math.floor((max - 1) / 2)
  return `${text.slice(0, half)}…${text.slice(-half)}`
}
