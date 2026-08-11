import type { AiCrawlersPayload } from '../../api/types'
import { CRAWLER_BOT_ORDER, normalizeCrawlerBot } from '../crawlerBots'
import type { DateRange } from '../dates'
import { filterByBot } from './filter'

export interface CrawlerBotMetric {
  bot: string
  count: number
  change: number | null
}

export interface DistributionRow {
  label: string
  value: number
  bot?: string
}

export interface AiCrawlersViewModel {
  totalEntries: number
  totalChange: number | null
  bots: CrawlerBotMetric[]
  chartRows: Array<{ date: string; rawDate: string; value: number }>
  pathDistribution: DistributionRow[]
  crawlerDistribution: DistributionRow[]
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

function botName(row: Record<string, unknown>): string {
  return pickString(row, ['bot', 'botName', 'name', 'crawler', 'aiCrawler'])
}

function inDateRange(date: string, range: DateRange): boolean {
  const day = date.slice(0, 10)
  return day >= range.startDate && day <= range.endDate
}

function parseBotRows(
  payload: AiCrawlersPayload,
  selectedCrawlers: string[],
): Map<string, CrawlerBotMetric> {
  const map = new Map<string, CrawlerBotMetric>()
  const changePercents = (payload.changePercents ?? {}) as Record<string, number>
  const rows = filterByBot(payload.byBot, selectedCrawlers)

  for (const row of rows) {
    const rawBot = botName(row)
    if (!rawBot) continue
    const bot = normalizeCrawlerBot(rawBot)
    const count =
      pickNumber(row, ['entries', 'requests', 'count', 'totalRequests', 'hits', 'value']) ?? 0
    const change =
      pickNumber(row, ['changePercent', 'percentChange', 'change', 'delta']) ??
      (typeof changePercents[bot] === 'number' ? changePercents[bot] : null) ??
      (typeof changePercents[rawBot] === 'number' ? changePercents[rawBot] : null)

    map.set(bot, { bot, count, change })
  }

  return map
}

function parseTimeSeries(
  payload: AiCrawlersPayload,
  range: DateRange,
  selectedCrawlers: string[],
): Array<{ date: string; rawDate: string; value: number }> {
  const rows = filterByBot(payload.timeSeriesData, selectedCrawlers)
  const byDate = new Map<string, number>()

  for (const row of rows) {
    const rawDate = pickString(row, ['date', 'day', 'timestamp']).slice(0, 10)
    if (!rawDate || !inDateRange(rawDate, range)) continue
    const value =
      pickNumber(row, ['entries', 'requests', 'count', 'value', 'hits', 'totalRequests']) ?? 0
    byDate.set(rawDate, (byDate.get(rawDate) ?? 0) + value)
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rawDate, value]) => ({ date: rawDate, rawDate, value }))
}

function parsePathDistribution(payload: AiCrawlersPayload): DistributionRow[] {
  return (payload.topPaths ?? [])
    .map((row) => {
      const label = pickString(row, ['path', 'url', 'page']) || '—'
      const value = pickNumber(row, ['entries', 'requests', 'count', 'hits', 'value']) ?? 0
      return { label, value }
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function buildAiCrawlersViewModel(
  payload: AiCrawlersPayload,
  range: DateRange,
  selectedCrawlers: string[],
): AiCrawlersViewModel {
  const botMap = parseBotRows(payload, selectedCrawlers)
  const chartRows = parseTimeSeries(payload, range, selectedCrawlers)

  const bots: CrawlerBotMetric[] = CRAWLER_BOT_ORDER.map((bot) => {
    const existing = botMap.get(bot)
    return existing ?? { bot, count: 0, change: 0 }
  })

  const totalFromChart = chartRows.reduce((sum, row) => sum + row.value, 0)
  const totalFromBots = [...botMap.values()].reduce((sum, b) => sum + b.count, 0)
  const hasRangeSeries = chartRows.length > 0
  const totalEntries = hasRangeSeries
    ? totalFromChart
    : typeof payload.totalRequests === 'number'
      ? payload.totalRequests
      : typeof (payload as Record<string, unknown>).totalEntries === 'number'
        ? ((payload as Record<string, unknown>).totalEntries as number)
        : totalFromBots

  const changePercents = payload.changePercents ?? {}
  const totalChange =
    typeof changePercents.total === 'number'
      ? changePercents.total
      : typeof changePercents.requests === 'number'
        ? changePercents.requests
        : typeof changePercents.entries === 'number'
          ? changePercents.entries
          : null

  const crawlerDistribution: DistributionRow[] = [...botMap.values()]
    .sort((a, b) => b.count - a.count)
    .map(({ bot, count }) => ({
      label: bot,
      value: count,
      bot,
    }))

  return {
    totalEntries,
    totalChange,
    bots,
    chartRows,
    pathDistribution: parsePathDistribution(payload),
    crawlerDistribution,
  }
}
