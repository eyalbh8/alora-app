import type {
  AiCrawlersPayload,
  AiTrafficPayload,
  CompetitorPerformance,
  ProviderMention,
  ResponseRow,
  ScreenSnapshot,
  SentimentHistoricalPoint,
  TopSource,
} from '../../api/types'
import {
  latestSnap,
  mapAiCrawlers,
  mapAiTraffic,
  mapCompetitors,
  mapDashboard,
  mapMentionsChart,
  mapPrompts,
  mapResponses,
  mapSentimentHistorical,
  mapTopSources,
  mapTopics,
  normalizeSnapshot,
} from './normalize'
import { normalizeTrafficProvider } from './aiTraffic'
import { normalizeCrawlerBot } from '../crawlerBots'

/**
 * Range composition rules:
 * - Summary / ranking / list-of-entities → prefer the latest snapshot day
 * - Dated series and response rows → concatenate across days and dedupe
 * - Never invent or sum overlapping summary metrics
 */

function dedupeById<T extends { id?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const id = row.id
    if (id) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    out.push(row)
  }
  return out
}

function dedupeSeries(
  points: Array<{ date: string; provider: string; value?: number; sentimentScore?: number }>,
): typeof points {
  const seen = new Set<string>()
  const out: typeof points = []
  for (const p of points) {
    const key = `${p.date}|${p.provider}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

export function mergeDashboard(snapshots: ScreenSnapshot[]) {
  const latest = latestSnap(snapshots, 'dashboard')
  const topSnap = latestSnap(snapshots, 'dashboard_top_sources')
  const dash = normalizeSnapshot(latest, mapDashboard)
  const top = normalizeSnapshot(topSnap, (p) => mapTopSources(p))

  const payload = dash.payload
    ? {
        ...dash.payload,
        topSourceDomains:
          top.payload && top.payload.length
            ? top.payload
            : dash.payload.topSourceDomains ?? [],
      }
    : null

  return {
    ...dash,
    payload,
    topSources: (top.payload ?? payload?.topSourceDomains ?? []) as TopSource[],
    freshness: {
      day: dash.day || top.day,
      pulledAt: dash.pulledAt || top.pulledAt,
    },
  }
}

export function mergePrompts(snapshots: ScreenSnapshot[]) {
  // Prefer latest for entity lists (prompts/topics change slowly; latest is authoritative)
  const promptsSnap = latestSnap(snapshots, 'prompts')
  const topicsSnap = latestSnap(snapshots, 'topics')
  const prompts = normalizeSnapshot(promptsSnap, mapPrompts)
  const topics = normalizeSnapshot(topicsSnap, mapTopics)
  return {
    prompts,
    topics,
    freshness: {
      day: prompts.day || topics.day,
      pulledAt: prompts.pulledAt || topics.pulledAt,
    },
  }
}

export function mergeMentions(snapshots: ScreenSnapshot[]) {
  const chartSnap = latestSnap(snapshots, 'mentions_chart')
  const chart = normalizeSnapshot(chartSnap, mapMentionsChart)

  // Concatenate responses across days when multiple exist
  const responseSnaps = snapshots
    .filter((s) => s.screen === 'mentions_sentiment')
    .sort((a, b) => a.day.localeCompare(b.day))

  let responses: ResponseRow[] = []
  let total = 0
  let error: string | null = null
  let pulledAt: string | null = null
  let day = ''

  if (!responseSnaps.length) {
    error = 'Snapshot not found for this day'
  } else {
    for (const snap of responseSnaps) {
      const n = normalizeSnapshot(snap, mapResponses)
      if (n.error && !n.payload) {
        error = n.error
        continue
      }
      if (n.payload) {
        responses = responses.concat(n.payload.responses)
        total = Math.max(total, n.payload.total)
      }
      pulledAt = n.pulledAt || pulledAt
      day = n.day || day
    }
    responses = dedupeById(responses)
  }

  return {
    chart,
    responses: {
      day,
      pulledAt,
      source: responseSnaps.at(-1)?.source ?? null,
      error: responses.length ? null : error,
      empty: responses.length === 0,
      payload: { total: responses.length || total, responses },
    },
    freshness: {
      day: chart.day || day,
      pulledAt: chart.pulledAt || pulledAt,
    },
  }
}

export function mergeSentiment(snapshots: ScreenSnapshot[]) {
  const histSnaps = snapshots
    .filter((s) => s.screen === 'sentiment_historical')
    .sort((a, b) => a.day.localeCompare(b.day))

  let historical: SentimentHistoricalPoint[] = []
  let histError: string | null = null
  let histDay = ''
  let histPulled: string | null = null

  for (const snap of histSnaps) {
    const n = normalizeSnapshot(snap, mapSentimentHistorical)
    if (n.error && !n.payload) {
      histError = n.error
      continue
    }
    if (n.payload) historical = historical.concat(n.payload)
    histDay = n.day || histDay
    histPulled = n.pulledAt || histPulled
  }
  historical = dedupeSeries(
    historical.map((p) => ({
      date: p.date,
      provider: p.provider,
      sentimentScore: p.sentimentScore,
    })),
  ) as SentimentHistoricalPoint[]

  const responseSnaps = snapshots
    .filter((s) => s.screen === 'sentiment')
    .sort((a, b) => a.day.localeCompare(b.day))

  let responses: ResponseRow[] = []
  let total = 0
  let error: string | null = null
  let day = ''
  let pulledAt: string | null = null

  for (const snap of responseSnaps) {
    const n = normalizeSnapshot(snap, mapResponses)
    if (n.error && !n.payload) {
      error = n.error
      continue
    }
    if (n.payload) {
      responses = responses.concat(n.payload.responses)
      total = Math.max(total, n.payload.total)
    }
    day = n.day || day
    pulledAt = n.pulledAt || pulledAt
  }
  responses = dedupeById(responses)

  return {
    historical: {
      day: histDay,
      pulledAt: histPulled,
      source: histSnaps.at(-1)?.source ?? null,
      error: historical.length ? null : histError,
      empty: historical.length === 0,
      payload: historical,
    },
    responses: {
      day,
      pulledAt,
      source: responseSnaps.at(-1)?.source ?? null,
      error: responses.length ? null : error,
      empty: responses.length === 0,
      payload: { total: responses.length || total, responses },
    },
    freshness: {
      day: histDay || day,
      pulledAt: histPulled || pulledAt,
    },
  }
}

export function mergeCompetitors(snapshots: ScreenSnapshot[]) {
  const latest = latestSnap(snapshots, 'competitors')
  return {
    ...normalizeSnapshot(latest, mapCompetitors),
    freshness: {
      day: latest?.day ?? '',
      pulledAt: latest?.pulledAt ?? null,
    },
  }
}

export function mergeProviderSeries(
  providers: ProviderMention[] | undefined,
): Array<{ date: string; provider: string; value: number }> {
  if (!providers?.length) return []
  const points: Array<{ date: string; provider: string; value: number }> = []
  for (const p of providers) {
    for (const h of p.historicalData ?? []) {
      points.push({ date: h.date.slice(0, 10), provider: p.provider, value: h.value })
    }
  }
  return dedupeSeries(points) as Array<{ date: string; provider: string; value: number }>
}

export function pickLatestRanking(
  ranking: CompetitorPerformance[] | undefined,
): CompetitorPerformance[] {
  return ranking ?? []
}

function mergeTrafficHistorical(payloads: AiTrafficPayload[]) {
  const byProvider = new Map<string, Map<string, number>>()

  for (const payload of payloads) {
    for (const row of payload.historicalData ?? []) {
      const rec = row as Record<string, unknown>
      const providerRaw = String(rec.provider ?? rec.name ?? '')
      if (!providerRaw || providerRaw.toUpperCase() === 'TOTAL') continue
      const provider = normalizeTrafficProvider(providerRaw)
      const nested = rec.historicalData
      if (!Array.isArray(nested)) continue
      if (!byProvider.has(provider)) byProvider.set(provider, new Map())
      const dateMap = byProvider.get(provider)!
      for (const point of nested) {
        const p = point as Record<string, unknown>
        const date = String(p.date ?? p.day ?? '').slice(0, 10)
        const value = typeof p.value === 'number' ? p.value : 0
        if (!date) continue
        dateMap.set(date, (dateMap.get(date) ?? 0) + value)
      }
    }
  }

  return [...byProvider.entries()].map(([provider, dateMap]) => ({
    domain: provider,
    provider,
    historicalData: [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value })),
  }))
}

function crawlerSeriesValue(row: Record<string, unknown>): number {
  for (const key of ['entries', 'requests', 'count', 'value', 'hits', 'totalRequests']) {
    const value = row[key]
    if (typeof value === 'number' && !Number.isNaN(value)) return value
  }
  return 0
}

function mergeCrawlerTimeSeries(
  payloads: AiCrawlersPayload[],
  days: string[] = [],
): Array<{ date: string; value: number; requests: number; entries: number }> {
  const byDate = new Map<string, number>()
  for (const payload of payloads) {
    for (const row of payload.timeSeriesData ?? []) {
      const rec = row as Record<string, unknown>
      const date = String(rec.date ?? rec.day ?? rec.timestamp ?? '').slice(0, 10)
      if (!date) continue
      byDate.set(date, (byDate.get(date) ?? 0) + crawlerSeriesValue(rec))
    }
  }

  const seriesTotal = [...byDate.values()].reduce((sum, value) => sum + value, 0)

  // Some crawler snapshots only include byBot totals for the sync day.
  // Rebuild a usable daily series from those totals when timeSeries is empty/zero.
  if (seriesTotal === 0 && days.length === payloads.length) {
    byDate.clear()
    payloads.forEach((payload, index) => {
      const day = days[index]?.slice(0, 10)
      if (!day) return
      const dayTotal = (payload.byBot ?? []).reduce((sum, row) => {
        return sum + crawlerSeriesValue(row as Record<string, unknown>)
      }, 0)
      if (dayTotal > 0) {
        byDate.set(day, (byDate.get(day) ?? 0) + dayTotal)
      }
    })
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value, requests: value, entries: value }))
}

/** Concatenate per-day ai_traffic snapshots across the selected range. */
export function mergeAiTraffic(snapshots: ScreenSnapshot[]) {
  const snaps = snapshots
    .filter((s) => s.screen === 'ai_traffic')
    .sort((a, b) => a.day.localeCompare(b.day))

  if (!snaps.length) {
    return {
      day: '',
      pulledAt: null,
      source: null,
      error: 'Snapshot not found for this day',
      empty: true,
      payload: null,
      freshness: { day: '', pulledAt: null },
    }
  }

  const normalized = snaps.map((s) => normalizeSnapshot(s, mapAiTraffic))
  const payloads = normalized.map((n) => n.payload).filter(Boolean) as AiTrafficPayload[]
  const latest = normalized.at(-1)!
  const error = payloads.length ? null : normalized.find((n) => n.error)?.error ?? null

  const merged: AiTrafficPayload | null = payloads.length
    ? {
        hasEvents: payloads.some((p) => p.hasEvents),
        preferences: latest.payload?.preferences,
        llmProviders: latest.payload?.llmProviders ?? [],
        totalEntries: latest.payload?.totalEntries,
        totalChange: latest.payload?.totalChange,
        changePercents: latest.payload?.changePercents,
        historicalData: mergeTrafficHistorical(payloads),
        topSources: latest.payload?.topSources ?? [],
        topPages: latest.payload?.topPages ?? [],
        topLocations: latest.payload?.topLocations ?? [],
        topDevices: latest.payload?.topDevices ?? [],
        topBrowsers: latest.payload?.topBrowsers ?? [],
        availableCountries: latest.payload?.availableCountries ?? [],
      }
    : null

  return {
    day: latest.day,
    pulledAt: latest.pulledAt,
    source: latest.source,
    error: merged ? null : error,
    empty: !merged,
    payload: merged,
    freshness: { day: latest.day, pulledAt: latest.pulledAt },
  }
}

/** Concatenate per-day ai_crawlers snapshots across the selected range. */
export function mergeAiCrawlers(snapshots: ScreenSnapshot[]) {
  const snaps = snapshots
    .filter((s) => s.screen === 'ai_crawlers')
    .sort((a, b) => a.day.localeCompare(b.day))

  if (!snaps.length) {
    return {
      day: '',
      pulledAt: null,
      source: null,
      error: 'Snapshot not found for this day',
      empty: true,
      payload: null,
      freshness: { day: '', pulledAt: null },
    }
  }

  const normalized = snaps.map((s) => normalizeSnapshot(s, mapAiCrawlers))
  const payloads = normalized.map((n) => n.payload).filter(Boolean) as AiCrawlersPayload[]
  const latest = normalized.at(-1)!
  const error = payloads.length ? null : normalized.find((n) => n.error)?.error ?? null

  const botMap = new Map<string, { count: number; change: number | null }>()
  for (const payload of payloads) {
    for (const row of payload.byBot ?? []) {
      const rec = row as Record<string, unknown>
      const rawBot = String(rec.botName ?? rec.bot ?? rec.name ?? '')
      if (!rawBot) continue
      const bot = normalizeCrawlerBot(rawBot)
      const count = crawlerSeriesValue(rec)
      const change = typeof rec.changePercent === 'number' ? rec.changePercent : null
      const existing = botMap.get(bot)
      botMap.set(bot, {
        count: (existing?.count ?? 0) + count,
        change: existing?.change ?? change,
      })
    }
  }

  const merged: AiCrawlersPayload | null = payloads.length
    ? {
        totalRequests: [...botMap.values()].reduce((sum, b) => sum + b.count, 0),
        byBot: [...botMap.entries()].map(([botName, stats]) => ({
          botName,
          requests: stats.count,
          changePercent: stats.change ?? 0,
        })),
        timeSeriesData: mergeCrawlerTimeSeries(
          payloads,
          snaps.map((snap) => snap.day),
        ),
        topPaths: latest.payload?.topPaths ?? [],
        changePercents: latest.payload?.changePercents,
      }
    : null

  return {
    day: latest.day,
    pulledAt: latest.pulledAt,
    source: latest.source,
    error: merged ? null : error,
    empty: !merged,
    payload: merged,
    freshness: { day: latest.day, pulledAt: latest.pulledAt },
  }
}
