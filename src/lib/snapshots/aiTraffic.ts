import type { AiTrafficPayload } from '../../api/types'
import { AI_TRAFFIC_PROVIDER_ORDER } from '../../components/ai-traffic/constants'
import type { DateRange } from '../dates'

export interface TrafficProviderMetric {
  provider: string
  count: number
  change: number | null
  historicalData: Array<{ date: string; value: number }>
}

export interface AiTrafficViewModel {
  totalEntries: number
  totalChange: number | null
  providers: TrafficProviderMetric[]
  chartRows: Array<Record<string, string | number>>
  chartProviderKeys: string[]
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

function parseProviderRows(payload: AiTrafficPayload): Map<string, TrafficProviderMetric> {
  const map = new Map<string, TrafficProviderMetric>()
  const changePercents = (payload.changePercents ?? {}) as Record<string, number>

  for (const row of payload.llmProviders ?? []) {
    const rawProvider = pickString(row, ['provider', 'name', 'llm', 'engine'])
    if (!rawProvider) continue
    const provider = normalizeTrafficProvider(rawProvider)
    const count =
      pickNumber(row, ['entries', 'count', 'visits', 'sessions', 'users', 'value']) ?? 0
    const change =
      pickNumber(row, ['changePercent', 'percentChange', 'change', 'delta']) ??
      (typeof changePercents[provider] === 'number' ? changePercents[provider] : null) ??
      (typeof changePercents[rawProvider] === 'number' ? changePercents[rawProvider] : null)

    const rowHistory = (row.historicalData ?? []) as Array<Record<string, unknown>>
    const historicalData = rowHistory
      .map((h) => ({
        date: pickString(h, ['date', 'day', 'timestamp']),
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

function parseGlobalHistorical(
  payload: AiTrafficPayload,
  range: DateRange,
): Map<string, Array<{ date: string; value: number }>> {
  const byProvider = new Map<string, Map<string, number>>()

  for (const row of payload.historicalData ?? []) {
    const date = pickString(row, ['date', 'day', 'timestamp']).slice(0, 10)
    if (!date || !inDateRange(date, range)) continue

    const explicitProvider = pickString(row, ['provider', 'name', 'llm', 'engine'])
    const value = pickNumber(row, ['value', 'count', 'visits', 'entries', 'sessions']) ?? 0

    if (explicitProvider) {
      const provider = normalizeTrafficProvider(explicitProvider)
      if (!byProvider.has(provider)) byProvider.set(provider, new Map())
      byProvider.get(provider)!.set(date, (byProvider.get(provider)!.get(date) ?? 0) + value)
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
    const count = existing?.count ?? countFromHistory

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

  const totalEntries =
    typeof payload.totalEntries === 'number'
      ? payload.totalEntries
      : filteredProviders.reduce((sum, p) => sum + p.count, 0)

  const totalChange =
    typeof payload.totalChange === 'number'
      ? payload.totalChange
      : typeof payload.changePercents?.total === 'number'
        ? payload.changePercents.total
        : typeof payload.changePercents?.entries === 'number'
          ? payload.changePercents.entries
          : null

  const chartProviderKeys = filteredProviders
    .filter((p) => p.historicalData.length > 0)
    .map((p) => p.provider)

  const dates = [
    ...new Set(filteredProviders.flatMap((p) => p.historicalData.map((h) => h.date.slice(0, 10)))),
  ].sort()

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
  }
}
