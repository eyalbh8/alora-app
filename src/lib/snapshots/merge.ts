import type {
  CompetitorPerformance,
  ProviderMention,
  ResponseRow,
  ScreenSnapshot,
  SentimentHistoricalPoint,
  TopSource,
} from '../../api/types'
import {
  latestSnap,
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
