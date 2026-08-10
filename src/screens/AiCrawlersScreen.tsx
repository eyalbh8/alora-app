import { useEffect, useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { MetricCard } from '../components/MetricCard'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import { filterByBot } from '../lib/snapshots/filter'
import { latestSnap, mapAiCrawlers, normalizeSnapshot } from '../lib/snapshots/normalize'
import { formatBytes, formatNumber, formatPercent } from '../lib/format'
import { shortDateLabel } from '../lib/dates'

function botName(row: Record<string, unknown>): string {
  for (const k of ['bot', 'botName', 'name', 'crawler', 'aiCrawler']) {
    const v = row[k]
    if (typeof v === 'string' && v) return v
  }
  return '—'
}

function num(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (typeof row[k] === 'number') return row[k] as number
  }
  return null
}

export function AiCrawlersScreen() {
  const { snapshots, freshness } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const snap = useMemo(() => {
    const latest = latestSnap(snapshots, 'ai_crawlers')
    return normalizeSnapshot(latest, mapAiCrawlers)
  }, [snapshots])

  const payload = snap.payload

  useEffect(() => {
    const bots = (payload?.byBot ?? []).map(botName).filter((b) => b !== '—')
    setFilterMeta({
      options: {
        providers: [],
        topics: [],
        prompts: [],
        regions: [],
        tags: [],
        promptTypes: [],
        crawlers: [...new Set(bots)],
      },
      availability: {
        providers: false,
        topics: false,
        prompts: false,
        regions: false,
        tags: false,
        branded: false,
        promptTypes: false,
        crawlers: bots.length > 0,
      },
    })
  }, [payload, setFilterMeta])

  if (snap.error) {
    return (
      <div className="flex flex-col gap-4">
        <FreshnessBadge day={snap.day || freshness.day} pulledAt={snap.pulledAt || freshness.pulledAt} />
        <ErrorState message={snap.error} />
      </div>
    )
  }
  if (!payload) {
    return <EmptyState title="No AI crawlers snapshot" message="ai_crawlers payload was empty." />
  }

  const byBot = filterByBot(payload.byBot, filters.crawlers)
  const timeSeries = filterByBot(
    (payload.timeSeriesData ?? []) as Array<Record<string, unknown>>,
    filters.crawlers,
  )

  const botColumns: Column<Record<string, unknown>>[] = [
    { key: 'bot', header: 'Crawler', render: (r) => botName(r) },
    {
      key: 'requests',
      header: 'Requests',
      align: 'right',
      render: (r) => formatNumber(num(r, ['requests', 'count', 'totalRequests']), 0),
    },
    {
      key: 'bytes',
      header: 'Bytes',
      align: 'right',
      render: (r) => formatBytes(num(r, ['bytes', 'totalBytes', 'bandwidth'])),
    },
  ]

  const pathColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'path',
      header: 'Path',
      render: (r) => String(r.path ?? r.url ?? r.page ?? '—'),
    },
    {
      key: 'requests',
      header: 'Requests',
      align: 'right',
      render: (r) => formatNumber(num(r, ['requests', 'count', 'hits']), 0),
    },
  ]

  const chartData = timeSeries.map((r) => ({
    date: shortDateLabel(String(r.date ?? r.day ?? r.timestamp ?? '').slice(0, 10) || '—'),
    value: num(r, ['requests', 'count', 'value', 'hits']) ?? 0,
    bot: botName(r),
  }))

  const change = payload.changePercents ?? {}

  return (
    <div className="flex flex-col gap-5">
      <FreshnessBadge day={snap.day || freshness.day} pulledAt={snap.pulledAt || freshness.pulledAt} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total requests" value={formatNumber(payload.totalRequests, 0)} />
        <MetricCard label="Total bytes" value={formatBytes(payload.totalBytes)} />
        <MetricCard
          label="Requests Δ"
          value={formatPercent(typeof change.requests === 'number' ? change.requests : null)}
        />
        <MetricCard
          label="Bytes Δ"
          value={formatPercent(typeof change.bytes === 'number' ? change.bytes : null)}
        />
      </div>

      <ChartCard
        title="Crawl volume over time"
        subtitle="timeSeriesData (client-filtered by bot when available)"
        loading={false}
        hasData={chartData.length > 0}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#148f85" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[#101414]">By bot</h2>
        {byBot.length === 0 ? (
          <EmptyState title="No bot breakdown" message="byBot was empty or filtered out." />
        ) : (
          <DataTable
            columns={botColumns}
            rows={byBot}
            rowKey={(r) => botName(r)}
            loading={false}
          />
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[#101414]">Top paths</h2>
        {(payload.topPaths ?? []).length === 0 ? (
          <EmptyState title="No paths" message="topPaths was empty in this snapshot." />
        ) : (
          <DataTable
            columns={pathColumns}
            rows={payload.topPaths ?? []}
            rowKey={(r) => String(r.path ?? r.url ?? JSON.stringify(r))}
            loading={false}
          />
        )}
      </div>
    </div>
  )
}
