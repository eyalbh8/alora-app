import type {
  AiCrawlersPayload,
  AiTrafficPayload,
  CompetitorsData,
  CompetitorsPayload,
  DashboardData,
  DashboardPayload,
  MentionsChartData,
  MentionsChartPayload,
  PromptRow,
  PromptsPayload,
  ResponseRow,
  ResponsesEnvelope,
  ScreenSnapshot,
  SentimentHistoricalPayload,
  SentimentHistoricalPoint,
  TopSource,
  TopicRow,
} from '../../api/types'

export interface NormalizedScreen<T> {
  day: string
  pulledAt: string | null
  source: string | null
  error: string | null
  empty: boolean
  payload: T | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** Unwrap common `{ data: ... }` envelopes used by snapshot exports. */
export function unwrapData<T = unknown>(payload: unknown): T | null {
  if (payload == null) return null
  const obj = asRecord(payload)
  if (obj && 'data' in obj) return (obj.data as T) ?? null
  return payload as T
}

export function normalizeSnapshot<T>(
  snap: ScreenSnapshot | undefined,
  map: (payload: unknown) => T | null,
): NormalizedScreen<T> {
  if (!snap) {
    return {
      day: '',
      pulledAt: null,
      source: null,
      error: 'Snapshot not found for this day',
      empty: true,
      payload: null,
    }
  }
  if (snap.error) {
    return {
      day: snap.day,
      pulledAt: snap.pulledAt,
      source: snap.source,
      error: snap.error,
      empty: true,
      payload: null,
    }
  }
  if (snap.payload == null) {
    return {
      day: snap.day,
      pulledAt: snap.pulledAt,
      source: snap.source,
      error: null,
      empty: true,
      payload: null,
    }
  }

  // Error-shaped analytics payloads (403 MCP paths, etc.)
  const raw = asRecord(snap.payload)
  if (raw && raw.error === true) {
    return {
      day: snap.day,
      pulledAt: snap.pulledAt,
      source: snap.source,
      error: String(raw.message || raw.detail || 'Snapshot error'),
      empty: true,
      payload: null,
    }
  }

  const mapped = map(snap.payload)
  return {
    day: snap.day,
    pulledAt: snap.pulledAt,
    source: snap.source,
    error: null,
    empty: mapped == null,
    payload: mapped,
  }
}

export function mapDashboard(payload: unknown): DashboardData | null {
  const data = unwrapData<DashboardData>(payload)
  if (!data || typeof data !== 'object') return null
  return data
}

export function mapDashboardEnvelope(payload: unknown): DashboardPayload | null {
  return asRecord(payload) as DashboardPayload | null
}

export function mapTopSources(payload: unknown): TopSource[] {
  if (Array.isArray(payload)) return payload as TopSource[]
  const data = unwrapData(payload)
  if (Array.isArray(data)) return data as TopSource[]
  const obj = asRecord(data)
  if (Array.isArray(obj?.topSourceDomains)) return obj.topSourceDomains as TopSource[]
  return []
}

export function mapTopics(payload: unknown): TopicRow[] {
  if (Array.isArray(payload)) return payload as TopicRow[]
  const data = unwrapData(payload)
  if (Array.isArray(data)) return data as TopicRow[]
  return []
}

export function mapPrompts(payload: unknown): { total: number; prompts: PromptRow[] } {
  const obj = asRecord(payload)
  if (!obj) return { total: 0, prompts: [] }
  const prompts = Array.isArray(obj.prompts) ? (obj.prompts as PromptRow[]) : []
  const total = typeof obj.total === 'number' ? obj.total : prompts.length
  return { total, prompts }
}

export function mapMentionsChart(payload: unknown): MentionsChartData | null {
  return unwrapData<MentionsChartData>(payload)
}

export function mapResponses(payload: unknown): { total: number; responses: ResponseRow[] } {
  const data = unwrapData<ResponsesEnvelope['data']>(payload) ?? asRecord(payload)
  if (!data) return { total: 0, responses: [] }
  const responses = Array.isArray((data as { responses?: unknown }).responses)
    ? ((data as { responses: ResponseRow[] }).responses)
    : []
  const total =
    typeof (data as { total?: unknown }).total === 'number'
      ? (data as { total: number }).total
      : responses.length
  return { total, responses }
}

export function mapSentimentHistorical(payload: unknown): SentimentHistoricalPoint[] {
  const data = unwrapData(payload)
  if (Array.isArray(data)) return data as SentimentHistoricalPoint[]
  if (Array.isArray(payload)) return payload as SentimentHistoricalPoint[]
  return []
}

export function mapCompetitors(payload: unknown): CompetitorsData | null {
  return unwrapData<CompetitorsData>(payload)
}

export function mapAiTraffic(payload: unknown): AiTrafficPayload | null {
  return asRecord(payload) as AiTrafficPayload | null
}

export function mapAiCrawlers(payload: unknown): AiCrawlersPayload | null {
  return asRecord(payload) as AiCrawlersPayload | null
}

export function sentimentOf(row: ResponseRow): number | null {
  const v = row.sentimentScore ?? row.sentinemtScore
  return typeof v === 'number' ? v : null
}

export function providerOf(row: {
  provider?: string | null
  model?: string | null
}): string | null {
  return row.provider || row.model || null
}

export function indexByScreen(
  snapshots: ScreenSnapshot[],
): Map<string, Map<string, ScreenSnapshot>> {
  const byDay = new Map<string, Map<string, ScreenSnapshot>>()
  for (const snap of snapshots) {
    let dayMap = byDay.get(snap.day)
    if (!dayMap) {
      dayMap = new Map()
      byDay.set(snap.day, dayMap)
    }
    dayMap.set(snap.screen, snap)
  }
  return byDay
}

export function latestSnap(
  snapshots: ScreenSnapshot[],
  screen: string,
): ScreenSnapshot | undefined {
  const matches = snapshots.filter((s) => s.screen === screen)
  if (!matches.length) return undefined
  return matches.reduce((a, b) => (a.day >= b.day ? a : b))
}

// re-export payload types used by callers
export type {
  CompetitorsPayload,
  MentionsChartPayload,
  PromptsPayload,
  SentimentHistoricalPayload,
}
