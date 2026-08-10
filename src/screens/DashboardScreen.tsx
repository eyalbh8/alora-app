import { useEffect, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from '../components/ChartCard'
import { MetricCard } from '../components/MetricCard'
import { DataTable, type Column } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import { collectFilterOptions, filterCompetitors, filterProviderMentions } from '../lib/snapshots/filter'
import { mergeDashboard } from '../lib/snapshots/merge'
import { formatNumber, formatPercent, formatScore, providerLabel } from '../lib/format'
import type { CompetitorPerformance, TopSource } from '../api/types'

export function DashboardScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const merged = useMemo(() => mergeDashboard(snapshots), [snapshots])

  useEffect(() => {
    const providers = (merged.payload?.providerMentions ?? []).map((p) => p.provider)
    const competitors = merged.payload?.competitorsPerformance ?? []
    setFilterMeta({
      options: collectFilterOptions({ providers, competitors }),
      availability: {
        providers: providers.length > 0,
        topics: competitors.some((c) => (c.topics?.length ?? 0) > 0),
        prompts: false,
        regions: false,
        tags: false,
        branded: false,
        promptTypes: false,
        crawlers: false,
      },
    })
  }, [merged, setFilterMeta])

  if (merged.error) {
    return <ErrorState message={merged.error} />
  }
  if (!merged.payload) {
    return <EmptyState title="No dashboard snapshot" message="No payload for the selected day(s)." />
  }

  const providerRows = filterProviderMentions(
    merged.payload.providerMentions,
    filters.providers,
  )
  const competitorRows = filterCompetitors(
    merged.payload.competitorsPerformance ?? [],
    { topics: filters.topics },
  )
  const topSources = merged.topSources

  const chartData = providerRows.map((p) => ({
    provider: providerLabel(p.provider),
    count: p.count,
    change: p.countChange ?? null,
  }))

  const competitorColumns: Column<CompetitorPerformance>[] = [
    {
      key: 'position',
      header: 'Pos',
      render: (r) => r.position ?? '—',
    },
    {
      key: 'name',
      header: 'Competitor',
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.logo ? (
            <img src={r.logo} alt="" className="h-5 w-5 rounded object-contain" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
              {r.name.slice(0, 1)}
            </span>
          )}
          <span className="font-medium text-slate-800">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'occurrences',
      header: 'Mentions',
      align: 'right',
      render: (r) => formatNumber(r.occurrences, 0),
    },
    {
      key: 'avgRank',
      header: 'Avg rank',
      align: 'right',
      render: (r) => formatScore(r.avgRank),
    },
    {
      key: 'sentimentScore',
      header: 'Sentiment',
      align: 'right',
      render: (r) => formatScore(r.sentimentScore),
    },
  ]

  const sourceColumns: Column<TopSource>[] = [
    { key: 'domain', header: 'Domain', render: (r) => r.domain },
    {
      key: 'occurrences',
      header: 'Occurrences',
      align: 'right',
      render: (r) => formatNumber(r.occurrences, 0),
    },
    {
      key: 'pageCount',
      header: 'Pages',
      align: 'right',
      render: (r) => formatNumber(r.pageCount, 0),
    },
  ]

  const posts = merged.payload.agentPosts?.posts ?? []

  return (
    <div className="flex flex-col gap-5">
      <FreshnessBadge day={merged.freshness.day} pulledAt={merged.freshness.pulledAt} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Tracked prompts"
          value={formatNumber(merged.payload.promptsCount, 0)}
        />
        <MetricCard
          label="Provider mentions"
          value={formatNumber(
            providerRows.reduce((s, p) => s + (p.count ?? 0), 0),
            0,
          )}
        />
        <MetricCard
          label="Competitors"
          value={formatNumber(competitorRows.length, 0)}
        />
        <MetricCard
          label="Agent posts"
          value={formatNumber(merged.payload.agentPosts?.totalCount ?? posts.length, 0)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Mentions by provider"
          subtitle="From dashboard.providerMentions (client-filtered)"
          loading={false}
          hasData={chartData.length > 0}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="provider" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#148f85" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1">
            {providerRows.map((p) => (
              <li key={p.provider} className="flex justify-between text-xs text-slate-600">
                <span>{providerLabel(p.provider)}</span>
                <span>
                  {formatNumber(p.count, 0)}
                  {p.countChange != null && (
                    <span className="ml-2 text-slate-400">
                      ({formatPercent(p.countChange)} Δ)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[#101414]">Competitor performance</h2>
          <DataTable
            columns={competitorColumns}
            rows={competitorRows}
            rowKey={(r) => r.id}
            loading={false}
            emptyTitle="No competitors in snapshot"
            emptyMessage="Ranking data missing or filtered out."
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[#101414]">Top sources</h2>
        <DataTable
          columns={sourceColumns}
          rows={topSources}
          rowKey={(r) => r.domain}
          loading={false}
          emptyTitle="No top sources"
          emptyMessage="dashboard_top_sources was empty for this day."
        />
      </div>

      {posts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[#101414]">Recent agent posts</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white shadow-sm">
            {posts.slice(0, 8).map((p, i) => (
              <li key={p.generationId ?? i} className="px-4 py-3">
                <p className="text-sm font-medium text-slate-800">{p.prompt ?? '—'}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[p.topic, p.socialMediaProvider, p.createdAt?.slice(0, 10)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
