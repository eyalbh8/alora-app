import type {
  AnalyticsMetric,
  AnalyticsParams,
  AnalyticsRow,
  BrandKitCompetitor,
  CitationRow,
} from '../api/types'
import { clampAnalyticsEndDate, yesterdayISO } from './dates'

export type CoreMetric =
  | 'mention_rate'
  | 'share_of_voice'
  | 'citation_rate'
  | 'sentiment_score'
  | 'average_position'

export const OVERVIEW_KPI_METRICS: CoreMetric[] = [
  'mention_rate',
  'share_of_voice',
  'citation_rate',
  'average_position',
]

export const VISIBILITY_KPI_METRICS: CoreMetric[] = [
  'mention_rate',
  'share_of_voice',
  'average_position',
]

export type CitationsKpiMetric = 'citation_rate' | 'citation_share' | 'citation_count'

export const CITATIONS_KPI_METRICS: CitationsKpiMetric[] = [
  'citation_rate',
  'citation_share',
  'citation_count',
]

export const LEADERBOARD_METRICS: CoreMetric[] = [
  'mention_rate',
  'share_of_voice',
  'citation_rate',
  'sentiment_score',
  'average_position',
]

/** Lower is better for average_position; higher is better for rates. */
export function isLowerBetter(metric: AnalyticsMetric | string): boolean {
  return metric === 'average_position'
}

export interface LeaderboardEntry {
  id: string
  name: string
  value: number | null
  isYou: boolean
}

/**
 * Merge own-brand total metric with competitor-dimension rows into a ranked
 * leaderboard. Competitor ids are resolved via brand kit settings.
 */
export function buildCompetitorLeaderboard(opts: {
  metric: AnalyticsMetric
  ownValue: number | null | undefined
  ownName: string
  competitorRows: AnalyticsRow[]
  competitors: BrandKitCompetitor[]
}): LeaderboardEntry[] {
  const nameById = new Map(opts.competitors.map((c) => [String(c.id), c.name]))
  const entries: LeaderboardEntry[] = [
    {
      id: 'you',
      name: opts.ownName,
      value: opts.ownValue ?? null,
      isYou: true,
    },
    ...opts.competitorRows.map((row) => {
      const id = String(row.competitor ?? '')
      return {
        id,
        name: nameById.get(id) ?? (id ? id : 'Unknown'),
        value: (row[opts.metric] as number | null | undefined) ?? null,
        isYou: false,
      }
    }),
  ]

  const lowerBetter = isLowerBetter(opts.metric)
  return entries.sort((a, b) => {
    if (a.value === null && b.value === null) return 0
    if (a.value === null) return 1
    if (b.value === null) return -1
    return lowerBetter ? a.value - b.value : b.value - a.value
  })
}

/** Pick a single metric value from a grain=total response (usually one row). */
export function pickTotalMetric(
  rows: AnalyticsRow[] | undefined,
  metric: AnalyticsMetric,
): number | null {
  if (!rows?.length) return null
  const value = rows[0]?.[metric]
  return value === null || value === undefined || Number.isNaN(value) ? null : value
}

export interface DomainCategorySlice {
  category: string
  value: number
  share: number
}

/** Build domain-category slices from citation inventory rows (AirOps Citations UI source). */
export function buildDomainCategoryBreakdownFromCitations(
  rows: CitationRow[],
  topN = 3,
): { slices: DomainCategorySlice[]; otherLabel: string | null } {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const category = row.domain_category ?? 'No Category'
    totals.set(category, (totals.get(category) ?? 0) + (row.citation_count ?? 0))
  }
  const ranked = [...totals.entries()]
    .map(([category, value]) => ({ category, value }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const sum = ranked.reduce((acc, r) => acc + r.value, 0)
  if (!sum) return { slices: [], otherLabel: null }

  const top = ranked.slice(0, topN)
  const rest = ranked.slice(topN)
  const slices: DomainCategorySlice[] = top.map((r) => ({
    category: r.category,
    value: r.value,
    share: (r.value / sum) * 100,
  }))

  if (rest.length) {
    const otherValue = rest.reduce((acc, r) => acc + r.value, 0)
    slices.push({
      category: `+${rest.length} more`,
      value: otherValue,
      share: (otherValue / sum) * 100,
    })
    return { slices, otherLabel: `+${rest.length} more` }
  }

  return { slices, otherLabel: null }
}

export interface DomainCitationAggregate {
  domainId: string
  domainName: string
  logoUrl: string | null
  citationCount: number
  citationShare: number
}

/** Aggregate citation URLs into top domains by citation_count. */
export function aggregateTopCitedDomains(
  rows: CitationRow[],
  limit = 10,
): DomainCitationAggregate[] {
  const byDomain = new Map<
    string,
    { domainName: string; logoUrl: string | null; citationCount: number }
  >()

  for (const row of rows) {
    const id = String(row.domain)
    const existing = byDomain.get(id)
    if (existing) {
      existing.citationCount += row.citation_count ?? 0
      if (!existing.logoUrl && row.logo_url) existing.logoUrl = row.logo_url
    } else {
      byDomain.set(id, {
        domainName: row.domain_name || id,
        logoUrl: row.logo_url,
        citationCount: row.citation_count ?? 0,
      })
    }
  }

  const total = [...byDomain.values()].reduce((acc, d) => acc + d.citationCount, 0) || 1

  return [...byDomain.entries()]
    .map(([domainId, d]) => ({
      domainId,
      domainName: d.domainName,
      logoUrl: d.logoUrl,
      citationCount: d.citationCount,
      citationShare: (d.citationCount / total) * 100,
    }))
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, limit)
}

/** Shared filter fields applied to every analytics query on Analytics screens. */
export type AnalyticsFilterParams = Pick<
  AnalyticsParams,
  'start_date' | 'end_date' | 'providers' | 'countries' | 'brand_mentioned' | 'topics' | 'personas'
>

/** Clamp end_date to yesterday for analytics (list endpoints may keep today). */
export function analyticsDateParams(
  filters: AnalyticsFilterParams,
): Pick<AnalyticsParams, 'start_date' | 'end_date'> {
  return clampAnalyticsEndDate({
    start_date: filters.start_date ?? yesterdayISO(),
    end_date: filters.end_date ?? yesterdayISO(),
  })
}

export interface SeriesMeta {
  key: string
  label: string
}

export interface MultiSeriesChartPoint {
  date: string
  dateLabel: string
  [seriesKey: string]: string | number | null
}

/**
 * Rank series keys by average metric value (desc), keep top N.
 * Rows must include `date` plus a series dimension field.
 */
export type MultiSeriesField = 'domain' | 'competitor' | 'provider' | 'topic' | 'theme'

export function pickTopSeriesKeys(
  rows: AnalyticsRow[],
  seriesField: MultiSeriesField,
  metric: AnalyticsMetric,
  limit = 5,
): string[] {
  const sums = new Map<string, { total: number; count: number }>()
  for (const row of rows) {
    const key = String(row[seriesField] ?? '')
    if (!key) continue
    const value = row[metric]
    if (value === null || value === undefined || Number.isNaN(value)) continue
    const entry = sums.get(key) ?? { total: 0, count: 0 }
    entry.total += value
    entry.count += 1
    sums.set(key, entry)
  }
  return [...sums.entries()]
    .map(([key, { total, count }]) => ({ key, avg: count ? total / count : 0 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, limit)
    .map((e) => e.key)
}

/** Pivot date + series-dimension rows into Recharts multi-line points. */
export function buildMultiSeriesPoints(
  rows: AnalyticsRow[],
  seriesField: MultiSeriesField,
  metric: AnalyticsMetric,
  seriesKeys: string[],
  dateLabelFn: (date: string) => string,
): MultiSeriesChartPoint[] {
  const keySet = new Set(seriesKeys)
  const byDate = new Map<string, MultiSeriesChartPoint>()

  for (const row of rows) {
    const date = row.date
    if (!date) continue
    const seriesKey = String(row[seriesField] ?? '')
    if (!keySet.has(seriesKey)) continue

    let point = byDate.get(date)
    if (!point) {
      point = { date, dateLabel: dateLabelFn(date) }
      byDate.set(date, point)
    }
    const value = row[metric]
    point[seriesKey] =
      value === null || value === undefined || Number.isNaN(value) ? null : value
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Build domain-category slices; collapse leftovers into "+N more". */
export function buildDomainCategoryBreakdown(
  rows: AnalyticsRow[],
  metric: AnalyticsMetric = 'citation_share',
  topN = 3,
): { slices: DomainCategorySlice[]; otherLabel: string | null } {
  const totals = rows
    .map((row) => {
      const category = String(row.domain_category ?? 'No Category')
      const raw = row[metric]
      const value =
        raw === null || raw === undefined || Number.isNaN(raw) ? 0 : Number(raw)
      return { category, value }
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const sum = totals.reduce((acc, r) => acc + r.value, 0)
  if (!sum) return { slices: [], otherLabel: null }

  const top = totals.slice(0, topN)
  const rest = totals.slice(topN)
  const slices: DomainCategorySlice[] = top.map((r) => ({
    category: r.category,
    value: r.value,
    share: (r.value / sum) * 100,
  }))

  if (rest.length) {
    const otherValue = rest.reduce((acc, r) => acc + r.value, 0)
    slices.push({
      category: `+${rest.length} more`,
      value: otherValue,
      share: (otherValue / sum) * 100,
    })
    return { slices, otherLabel: `+${rest.length} more` }
  }

  return { slices, otherLabel: null }
}

export interface TopicPlatformCell {
  topicId: string
  topicName: string
  byProvider: Record<string, number | null>
}

/** Pivot topic × provider analytics rows into a matrix for the citations table. */
export function buildTopicPlatformMatrix(
  rows: AnalyticsRow[],
  topics: Array<{ id: number; name: string }>,
  providers: string[],
  metric: AnalyticsMetric = 'citation_rate',
): TopicPlatformCell[] {
  const nameById = new Map(topics.map((t) => [String(t.id), t.name]))
  const topicIds = [
    ...new Set(rows.map((r) => String(r.topic ?? '')).filter(Boolean)),
  ]

  return topicIds.map((topicId) => {
    const byProvider: Record<string, number | null> = {}
    for (const provider of providers) {
      const row = rows.find(
        (r) => String(r.topic) === topicId && String(r.provider) === provider,
      )
      const value = row?.[metric]
      byProvider[provider] =
        value === null || value === undefined || Number.isNaN(value) ? null : Number(value)
    }
    return {
      topicId,
      topicName: nameById.get(topicId) ?? topicId,
      byProvider,
    }
  })
}
