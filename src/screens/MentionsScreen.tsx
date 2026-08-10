import { useEffect, useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
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
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  collectFilterOptions,
  detectResponseFilterAvailability,
  filterProviderMentions,
  filterResponses,
} from '../lib/snapshots/filter'
import { mergeMentions, mergePrompts, mergeProviderSeries } from '../lib/snapshots/merge'
import { shortDateLabel } from '../lib/dates'
import { formatPercent, formatScore, providerLabel, regionLabel, truncateMiddle } from '../lib/format'
import { sentimentOf } from '../lib/snapshots/normalize'
import type { ResponseRow } from '../api/types'

const COLORS = ['#148f85', '#2fc9bc', '#0e3b3a', '#7fd4cc', '#f59e0b', '#6366f1']

export function MentionsScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const merged = useMemo(() => mergeMentions(snapshots), [snapshots])
  const promptsMerged = useMemo(() => mergePrompts(snapshots), [snapshots])
  const promptLookup = useMemo(() => {
    const map = new Map((promptsMerged.prompts.payload?.prompts ?? []).map((p) => [p.id, p]))
    return map
  }, [promptsMerged])

  const responses = merged.responses.payload?.responses ?? []
  const providers = merged.chart.payload?.providers ?? []

  useEffect(() => {
    setFilterMeta({
      options: collectFilterOptions({
        providers: providers.map((p) => p.provider),
        prompts: promptsMerged.prompts.payload?.prompts,
        topics: promptsMerged.topics.payload ?? [],
        responses,
      }),
      availability: {
        ...detectResponseFilterAvailability(responses),
        branded:
          detectResponseFilterAvailability(responses).branded ||
          (promptsMerged.prompts.payload?.prompts ?? []).some((p) => p.meInPrompt != null),
      },
    })
  }, [providers, responses, promptsMerged, setFilterMeta])

  const filteredProviders = filterProviderMentions(providers, filters.providers)
  const filteredResponses = filterResponses(responses, filters, promptLookup)

  const series = mergeProviderSeries(filteredProviders)
  const providerKeys = [...new Set(series.map((s) => s.provider))]
  const dates = [...new Set(series.map((s) => s.date))].sort()
  const chartRows = dates.map((date) => {
    const row: Record<string, string | number> = { date: shortDateLabel(date) }
    for (const p of providerKeys) {
      const hit = series.find((s) => s.date === date && s.provider === p)
      row[p] = hit?.value ?? 0
    }
    return row
  })

  const columns: Column<ResponseRow>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (r) => (r.timestamp || r.createdAt || '').slice(0, 10) || '—',
    },
    {
      key: 'provider',
      header: 'Provider',
      render: (r) => providerLabel(r.provider || r.model || '—'),
    },
    {
      key: 'prompt',
      header: 'Prompt',
      render: (r) => (
        <span title={r.promptText ?? undefined}>{truncateMiddle(r.promptText || '—', 48)}</span>
      ),
    },
    {
      key: 'topic',
      header: 'Topic',
      render: (r) => {
        const topic =
          r.topic ||
          (r.topicId ? promptsMerged.topics.payload?.find((t) => t.id === r.topicId)?.name : null)
        return topic ?? '—'
      },
    },
    {
      key: 'region',
      header: 'Region',
      render: (r) => (r.region ? regionLabel(r.region) : '—'),
    },
    {
      key: 'visibility',
      header: 'Visibility',
      align: 'right',
      render: (r) => formatPercent(r.visibilityAverage),
    },
    {
      key: 'rank',
      header: 'Rank',
      align: 'right',
      render: (r) => formatScore(r.myRank),
    },
    {
      key: 'sentiment',
      header: 'Sentiment',
      align: 'right',
      render: (r) => formatScore(sentimentOf(r)),
    },
    {
      key: 'snippet',
      header: 'Snippet',
      render: (r) => (
        <span className="line-clamp-2 max-w-xs text-slate-500" title={r.responsePreview || r.response || ''}>
          {truncateMiddle(r.responsePreview || r.response || '—', 80)}
        </span>
      ),
    },
  ]

  if (merged.chart.error && merged.responses.error) {
    return <ErrorState message={merged.chart.error || merged.responses.error || 'No data'} />
  }

  return (
    <div className="flex flex-col gap-5">
      <FreshnessBadge day={merged.freshness.day} pulledAt={merged.freshness.pulledAt} />

      <ChartCard
        title="Mentions over time"
        subtitle="From mentions_chart.providers.historicalData"
        loading={false}
        hasData={chartRows.length > 0}
        error={merged.chart.error}
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {providerKeys.map((p, i) => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={providerLabel(p)}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {(merged.chart.payload?.trackedRecommendations?.length ?? 0) > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-[#101414]">Tracked recommendations</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {merged.chart.payload!.trackedRecommendations!.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <p className="font-medium text-slate-800">{t.recommendationTitle}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Appearances: {t.totalAppearances ?? 0}
                  {t.urls?.[0] ? ` · ${t.urls[0]}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[#101414]">
          Responses ({filteredResponses.length}
          {merged.responses.payload?.total
            ? ` of ${merged.responses.payload.total} in snapshot`
            : ''}
          )
        </h2>
        {merged.responses.error && !responses.length ? (
          <ErrorState message={merged.responses.error} />
        ) : filteredResponses.length === 0 ? (
          <EmptyState title="No responses" message="No mention responses match the filters." />
        ) : (
          <DataTable
            columns={columns}
            rows={filteredResponses}
            rowKey={(r) => r.id}
            loading={false}
            totalCount={filteredResponses.length}
          />
        )}
      </div>
    </div>
  )
}
