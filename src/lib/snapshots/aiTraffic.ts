import type { AiTrafficPayload } from '../../api/types'
import { AI_TRAFFIC_PROVIDER_ORDER } from '../../components/ai-traffic/constants'
import type { DateRange } from '../dates'

export interface TrafficProviderMetric {
  provider: string
  count: number
  change: number | null
  historicalData: Array<{ date: string; value: number }>
}

export interface TrafficBreakdownRow {
  label: string
  value: number
  countryCode?: string
  domain?: string
}

export interface AiTrafficViewModel {
  totalEntries: number
  totalChange: number | null
  providers: TrafficProviderMetric[]
  chartRows: Array<Record<string, string | number>>
  chartProviderKeys: string[]
  topSources: TrafficBreakdownRow[]
  topPages: TrafficBreakdownRow[]
  topLocations: TrafficBreakdownRow[]
  topDevices: TrafficBreakdownRow[]
  topBrowsers: TrafficBreakdownRow[]
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v) return v
    if (typeof v === 'number') return String(v)
  }
  return ''
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number' && !Number.isNaN(v)) return v
  }
  return null
}

function pickDate(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v) {
      const day = v.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
      const parsed = new Date(v)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const parsed = new Date(v)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    }
  }
  return ''
}

export function normalizeTrafficProvider(raw: string): string {
  const key = raw.toUpperCase().replace(/\s+/g, '_')
  if (key.includes('OPENAI') || key.includes('CHAT') || key === 'GPT') return 'OPENAI'
  if (key.includes('ANTHROPIC') || key.includes('CLAUDE')) return 'ANTHROPIC'
  if (key.includes('PERPLEXITY')) return 'PERPLEXITY'
  if (key.includes('GEMINI')) return 'GEMINI'
  if (key.includes('COPILOT')) return 'BD_COPILOT'
  return key
}

function inDateRange(date: string, range: DateRange): boolean {
  const day = date.slice(0, 10)
  return day >= range.startDate && day <= range.endDate
}

function isAggregateProvider(rawProvider: string, provider: string): boolean {
  const key = rawProvider.toUpperCase()
  return provider === 'TOTAL' || key === 'ALL_ENTRIES' || key === 'TOTAL'
}

function parseProviderRows(payload: AiTrafficPayload): Map<string, TrafficProviderMetric> {
  const map = new Map<string, TrafficProviderMetric>()
  const changePercents = (payload.changePercents ?? {}) as Record<string, number>

  for (const row of payload.llmProviders ?? []) {
    const rawProvider = pickString(row, ['provider', 'name', 'llm', 'engine', 'domain'])
    if (!rawProvider) continue
    const provider = normalizeTrafficProvider(rawProvider)
    if (isAggregateProvider(rawProvider, provider)) continue
    const count =
      pickNumber(row, ['entries', 'count', 'visits', 'sessions', 'users', 'value']) ?? 0
    const change =
      pickNumber(row, ['changePercent', 'percentChange', 'change', 'delta']) ??
      (typeof changePercents[provider] === 'number' ? changePercents[provider] : null) ??
      (typeof changePercents[rawProvider] === 'number' ? changePercents[rawProvider] : null)

    const rowHistory = (row.historicalData ?? []) as Array<Record<string, unknown>>
    const historicalData = rowHistory
      .map((h) => ({
        date: pickDate(h, ['date', 'day', 'timestamp']),
        value: pickNumber(h, ['value', 'count', 'visits', 'entries', 'sessions']) ?? 0,
      }))
      .filter((h) => h.date)

      map.set(provider, {
        provider,
        count,
        change,
        historicalData,
      })
  }

  return map
}

function addHistoryPoint(
  byProvider: Map<string, Map<string, number>>,
  provider: string,
  date: string,
  value: number,
) {
  if (!byProvider.has(provider)) byProvider.set(provider, new Map())
  byProvider.get(provider)!.set(date, (byProvider.get(provider)!.get(date) ?? 0) + value)
}

function asRowArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    for (const key of ['items', 'data', 'rows', 'values']) {
      if (Array.isArray(rec[key])) return asRowArray(rec[key])
    }
  }
  return []
}

function payloadRows(payload: AiTrafficPayload, keys: string[]): Array<Record<string, unknown>> {
  const rec = payload as Record<string, unknown>
  for (const key of keys) {
    const rows = asRowArray(rec[key])
    if (rows.length) return rows
  }
  return []
}

function hostFromLabel(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  try {
    const url = value.includes('://') ? new URL(value) : new URL(`https://${value}`)
    return url.hostname.replace(/^www\./i, '')
  } catch {
    return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || value
  }
}

function parseBreakdownRows(
  rows: Array<Record<string, unknown>>,
  labelKeys: string[],
  extra?: { domain?: boolean; country?: boolean },
): TrafficBreakdownRow[] {
  return rows
    .map((row) => {
      const label = pickString(row, labelKeys)
      const value =
        pickNumber(row, ['visitors', 'visits', 'entries', 'count', 'sessions', 'users', 'value']) ?? 0
      const domain = extra?.domain ? hostFromLabel(label) : undefined
      const countryCode = extra?.country
        ? pickString(row, ['countryCode', 'country_code', 'iso', 'iso2', 'code']) || label
        : undefined
      return {
        label: extra?.domain ? domain || label : label,
        value,
        ...(domain ? { domain } : {}),
        ...(countryCode ? { countryCode } : {}),
      }
    })
    .filter((row) => row.label && row.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function eachIsoDay(range: DateRange): string[] {
  const days: string[] = []
  const cursor = new Date(`${range.startDate}T00:00:00.000Z`)
  const end = new Date(`${range.endDate}T00:00:00.000Z`)
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return days
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function historicalRows(payload: AiTrafficPayload): Array<Record<string, unknown>> {
  const raw = payload.historicalData as unknown
  if (Array.isArray(raw)) return asRowArray(raw)
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).flatMap(([provider, value]) => {
      if (Array.isArray(value)) {
        return [{ provider, historicalData: value }]
      }
      return []
    })
  }
  return []
}

function parseGlobalHistorical(
  payload: AiTrafficPayload,
  range: DateRange,
): Map<string, Array<{ date: string; value: number }>> {
  const byProvider = new Map<string, Map<string, number>>()

  for (const row of historicalRows(payload)) {
    const explicitProvider = pickString(row, ['provider', 'name', 'llm', 'engine'])
    const nested = row.historicalData

    // iGEO shape: { provider, historicalData: [{ date, value }] }
    if (explicitProvider && Array.isArray(nested)) {
      const provider = normalizeTrafficProvider(explicitProvider)
      if (isAggregateProvider(explicitProvider, provider)) continue
      for (const point of nested) {
        const rec = point as Record<string, unknown>
        const date = pickDate(rec, ['date', 'day', 'timestamp'])
        if (!date || !inDateRange(date, range)) continue
        const value = pickNumber(rec, ['value', 'count', 'visits', 'entries', 'sessions']) ?? 0
        addHistoryPoint(byProvider, provider, date, value)
      }
      continue
    }

    const date = pickDate(row, ['date', 'day', 'timestamp'])
    if (!date || !inDateRange(date, range)) continue

    const value = pickNumber(row, ['value', 'count', 'visits', 'entries', 'sessions']) ?? 0

    if (explicitProvider) {
      const provider = normalizeTrafficProvider(explicitProvider)
      if (!isAggregateProvider(explicitProvider, provider)) {
        addHistoryPoint(byProvider, provider, date, value)
      }
      continue
    }

    for (const provider of AI_TRAFFIC_PROVIDER_ORDER) {
      const altKeys = [provider, provider.toLowerCase(), provider.replace('BD_', '')]
      let v: number | null = null
      for (const k of altKeys) {
        v = pickNumber(row, [k, k.toLowerCase()])
        if (v != null) break
      }
      if (v != null && v > 0) {
        if (!byProvider.has(provider)) byProvider.set(provider, new Map())
        byProvider.get(provider)!.set(date, (byProvider.get(provider)!.get(date) ?? 0) + v)
      }
    }

    if (value > 0 && !explicitProvider) {
      if (!byProvider.has('__total__')) byProvider.set('__total__', new Map())
      byProvider.get('__total__')!.set(date, (byProvider.get('__total__')!.get(date) ?? 0) + value)
    }
  }

  const result = new Map<string, Array<{ date: string; value: number }>>()
  for (const [provider, dateMap] of byProvider) {
    if (provider === '__total__') continue
    result.set(
      provider,
      [...dateMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, value: v })),
    )
  }
  return result
}

export function buildAiTrafficViewModel(
  payload: AiTrafficPayload,
  range: DateRange,
  selectedProviders: string[],
): AiTrafficViewModel {
  const providerMap = parseProviderRows(payload)
  const globalHistory = parseGlobalHistorical(payload, range)

  const providers: TrafficProviderMetric[] = AI_TRAFFIC_PROVIDER_ORDER.map((provider) => {
    const existing = providerMap.get(provider)
    const history =
      (existing?.historicalData.filter((h) => inDateRange(h.date, range)) ?? []).length > 0
        ? existing!.historicalData.filter((h) => inDateRange(h.date, range))
        : (globalHistory.get(provider) ?? [])

    const countFromHistory = history.reduce((sum, h) => sum + h.value, 0)
    const hasPositiveHistory = history.some((h) => h.value > 0)
    // Prefer daily history summed for the selected range — llmProviders[].visits is the
    // full snapshot window (typically 90d), not the UI date filter.
    const count = hasPositiveHistory ? countFromHistory : (existing?.count ?? 0)

    return {
      provider,
      count,
      change: existing?.change ?? null,
      historicalData: history,
    }
  })

  const filteredProviders =
    selectedProviders.length > 0
      ? providers.filter((p) =>
          selectedProviders.some((s) => normalizeTrafficProvider(s) === p.provider),
        )
      : providers

  const totalRow = (payload.llmProviders ?? []).find(
    (row) => pickString(row as Record<string, unknown>, ['provider']).toUpperCase() === 'TOTAL',
  ) as Record<string, unknown> | undefined

  const summedProviderCounts = filteredProviders.reduce((sum, p) => sum + p.count, 0)
  const hasRangeHistory = filteredProviders.some((p) =>
    p.historicalData.some((h) => h.value > 0),
  )

  const totalEntries =
    typeof payload.totalEntries === 'number' && !hasRangeHistory
      ? payload.totalEntries
      : hasRangeHistory
        ? summedProviderCounts
        : (pickNumber(totalRow ?? {}, ['visits', 'entries', 'count']) ?? summedProviderCounts)

  const totalChange =
    typeof payload.totalChange === 'number' && !hasRangeHistory
      ? payload.totalChange
      : (pickNumber(totalRow ?? {}, ['changePercent', 'percentChange', 'change']) ??
        (typeof payload.changePercents?.total === 'number'
          ? payload.changePercents.total
          : typeof payload.changePercents?.entries === 'number'
            ? payload.changePercents.entries
            : null))

  const chartProviderKeys = filteredProviders.map((p) => p.provider)
  const dates = eachIsoDay(range)
  const chartRows = dates.map((date) => {
    const row: Record<string, string | number> = { date, rawDate: date }
    for (const p of chartProviderKeys) {
      const hit = filteredProviders
        .find((m) => m.provider === p)
        ?.historicalData.find((h) => h.date.slice(0, 10) === date)
      row[p] = hit?.value ?? 0
    }
    return row
  })

  return {
    totalEntries,
    totalChange,
    providers: filteredProviders,
    chartRows,
    chartProviderKeys,
    topSources: parseBreakdownRows(
      payloadRows(payload, ['topSources', 'sources', 'topSourceDomains', 'referrers']),
      ['source', 'domain', 'referrer', 'name', 'url', 'host'],
      { domain: true },
    ),
    topPages: parseBreakdownRows(
      payloadRows(payload, ['topPages', 'pages', 'topPaths', 'paths']),
      ['page', 'path', 'url', 'name'],
    ),
    topLocations: parseBreakdownRows(
      payloadRows(payload, ['topLocations', 'locations', 'countries', 'topCountries']),
      ['country', 'countryName', 'name', 'region', 'code'],
      { country: true },
    ),
    topDevices: parseBreakdownRows(
      payloadRows(payload, ['topDevices', 'devices']),
      ['device', 'deviceType', 'type', 'name'],
    ),
    topBrowsers: parseBreakdownRows(
      payloadRows(payload, ['topBrowsers', 'browsers']),
      ['browser', 'browserName', 'name'],
    ),
  }
}
