import type { AnalyticsRow } from '../api/types'

export type SentimentBand = 'positive' | 'neutral' | 'negative'

export type SentimentFilter = 'all' | 'positive' | 'negative'

export type SentimentSeriesMode = 'overall' | 'provider' | 'topic' | 'theme'

export interface SentimentThemeRow {
  id: number
  name: string
  sentiment_score: number | null
  answer_count: number
  volume: number
}

/** AirOps bands: ≥60 positive, 40–59 neutral, <40 negative. */
export function sentimentBand(score: number | null | undefined): SentimentBand | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null
  if (score >= 60) return 'positive'
  if (score >= 40) return 'neutral'
  return 'negative'
}

/** Table / badge colors (green / gray / red). */
export function sentimentBandColor(band: SentimentBand | null): string {
  switch (band) {
    case 'positive':
      return '#2fc9bc'
    case 'negative':
      return '#ef4444'
    case 'neutral':
      return '#94a3b8'
    default:
      return '#cbd5e1'
  }
}

/**
 * Treemap fill: pink (negative) → slate (neutral) → teal (positive).
 * Interpolates across the 0–100 score range.
 */
export function sentimentTreemapColor(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '#e2e8f0'
  const t = Math.min(1, Math.max(0, score / 100))
  // pink #f9a8d4 → slate #94a3b8 → turquoise #2fc9bc
  if (t < 0.5) {
    const u = t * 2
    return mixHex('#f9a8d4', '#94a3b8', u)
  }
  const u = (t - 0.5) * 2
  return mixHex('#94a3b8', '#2fc9bc', u)
}

function mixHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

function parseThemeId(row: AnalyticsRow): number | null {
  if (typeof row.theme_id === 'number' && !Number.isNaN(row.theme_id)) return row.theme_id
  if (typeof row.theme === 'number' && !Number.isNaN(row.theme)) return row.theme
  if (typeof row.theme === 'string' && /^\d+$/.test(row.theme)) return Number(row.theme)
  return null
}

function parseThemeName(row: AnalyticsRow, id: number | null): string {
  if (typeof row.theme_name === 'string' && row.theme_name.trim()) return row.theme_name
  if (typeof row.theme === 'string' && row.theme.trim() && !/^\d+$/.test(row.theme)) {
    return row.theme
  }
  return id != null ? `Theme ${id}` : 'Unknown theme'
}

/** Normalize theme-dimension analytics rows for treemap + table. */
export function normalizeThemeRows(rows: AnalyticsRow[]): SentimentThemeRow[] {
  const mapped = rows
    .map((row) => {
      const id = parseThemeId(row)
      const answer_count =
        row.answer_count === null || row.answer_count === undefined || Number.isNaN(row.answer_count)
          ? 0
          : Number(row.answer_count)
      const sentiment_score =
        row.sentiment_score === null ||
        row.sentiment_score === undefined ||
        Number.isNaN(row.sentiment_score)
          ? null
          : Number(row.sentiment_score)
      return {
        id: id ?? -1,
        name: parseThemeName(row, id),
        sentiment_score,
        answer_count,
        volume: 0,
      }
    })
    .filter((t) => t.id > 0 || t.name !== 'Unknown theme')

  // Dedupe by id (keep highest answer_count)
  const byId = new Map<number | string, SentimentThemeRow>()
  for (const theme of mapped) {
    const key = theme.id > 0 ? theme.id : theme.name
    const existing = byId.get(key)
    if (!existing || theme.answer_count > existing.answer_count) {
      byId.set(key, theme)
    }
  }

  const unique = [...byId.values()]
  const total = unique.reduce((acc, t) => acc + t.answer_count, 0) || 1
  return unique
    .map((t) => ({ ...t, volume: (t.answer_count / total) * 100 }))
    .sort((a, b) => b.answer_count - a.answer_count)
}

export function filterThemesBySentiment(
  themes: SentimentThemeRow[],
  filter: SentimentFilter,
): SentimentThemeRow[] {
  if (filter === 'all') return themes
  return themes.filter((t) => sentimentBand(t.sentiment_score) === filter)
}

export const SERIES_MODE_LABELS: Record<SentimentSeriesMode, string> = {
  overall: 'Overall Score',
  provider: 'By Platform',
  topic: 'By Topic',
  theme: 'By Theme',
}

export const SENTIMENT_FILTER_LABELS: Record<SentimentFilter, string> = {
  all: 'All Sentiment',
  positive: 'Positive',
  negative: 'Negative',
}
