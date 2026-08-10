import { useEffect, useMemo, useState } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { Pill } from '../components/Pill'
import { TrendBadge } from '../components/TrendBadge'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  collectFilterOptions,
  detectPromptFilterAvailability,
  filterPrompts,
  filterResponses,
  tagLabels,
} from '../lib/snapshots/filter'
import { mergeMentions, mergePrompts } from '../lib/snapshots/merge'
import { formatNumber, formatPercent, formatScore, regionLabel } from '../lib/format'
import type { PromptRow, ResponseRow } from '../api/types'
import { sentimentOf } from '../lib/snapshots/normalize'

export function PromptsScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [drawerPrompt, setDrawerPrompt] = useState<PromptRow | null>(null)

  const { prompts, topics, freshness } = useMemo(() => mergePrompts(snapshots), [snapshots])
  const mentions = useMemo(() => mergeMentions(snapshots), [snapshots])

  const promptRows = prompts.payload?.prompts ?? []
  const topicRows = topics.payload ?? []

  useEffect(() => {
    setFilterMeta({
      options: collectFilterOptions({
        topics: topicRows,
        prompts: promptRows,
        responses: mentions.responses.payload?.responses,
      }),
      availability: detectPromptFilterAvailability(promptRows),
    })
  }, [promptRows, topicRows, mentions, setFilterMeta])

  const filtered = useMemo(() => {
    let rows = filterPrompts(promptRows, filters)
    if (selectedTopic) {
      rows = rows.filter((r) => r.topicId === selectedTopic || r.topic?.id === selectedTopic)
    }
    return rows
  }, [promptRows, filters, selectedTopic])

  const detailResponses = useMemo(() => {
    if (!drawerPrompt) return [] as ResponseRow[]
    const all = mentions.responses.payload?.responses ?? []
    return filterResponses(all, { ...filters, prompts: [drawerPrompt.id] })
  }, [drawerPrompt, mentions, filters])

  if (prompts.error && !promptRows.length) {
    return <ErrorState message={prompts.error} />
  }

  const columns: Column<PromptRow>[] = [
    {
      key: 'prompt',
      header: 'Prompt',
      render: (r) => (
        <button
          type="button"
          onClick={() => setDrawerPrompt(r)}
          className="max-w-md text-left font-medium text-brand-800 hover:underline"
        >
          {r.prompt}
        </button>
      ),
    },
    {
      key: 'topic',
      header: 'Topic',
      render: (r) => r.topic?.name ?? '—',
    },
    {
      key: 'regions',
      header: 'Regions',
      render: (r) =>
        r.regions?.length ? (
          <span className="flex flex-wrap gap-1">
            {r.regions.map((reg) => (
              <Pill key={reg} tone="blue">
                {regionLabel(reg)}
              </Pill>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'meInPrompt',
      header: 'Branded',
      render: (r) =>
        r.meInPrompt == null ? '—' : r.meInPrompt ? (
          <Pill tone="green">Yes</Pill>
        ) : (
          <Pill tone="grey">No</Pill>
        ),
    },
    {
      key: 'avgVisibility',
      header: 'Visibility',
      align: 'right',
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {formatPercent(r.avgVisibility)}
          <TrendBadge value={r.visibilityChange} percent />
        </span>
      ),
    },
    {
      key: 'avgSentimentScore',
      header: 'Sentiment',
      align: 'right',
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {formatScore(r.avgSentimentScore)}
          <TrendBadge value={r.sentimentChange} percent />
        </span>
      ),
    },
    {
      key: 'avgRank',
      header: 'Avg rank',
      align: 'right',
      render: (r) => formatScore(r.avgRank),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => r.type ?? '—',
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (r) => {
        const labels = tagLabels(r.tags)
        return labels.length ? labels.join(', ') : '—'
      },
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <FreshnessBadge day={freshness.day} pulledAt={freshness.pulledAt} />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Topics
          </p>
          {topics.error ? (
            <p className="text-xs text-red-500">{topics.error}</p>
          ) : topicRows.length === 0 ? (
            <EmptyState title="No topics" message="topics snapshot was empty." />
          ) : (
            <ul className="flex flex-col gap-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                    !selectedTopic ? 'bg-brand-50 text-brand-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All topics ({promptRows.length})
                </button>
              </li>
              {topicRows.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(t.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                      selectedTopic === t.id
                        ? 'bg-brand-50 text-brand-900'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block truncate">{t.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {formatNumber(t.promptsCount, 0)} prompts
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          loading={false}
          totalCount={filtered.length}
          emptyTitle="No prompts"
          emptyMessage="No prompts match the current filters."
        />
      </div>

      {drawerPrompt && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close"
            onClick={() => setDrawerPrompt(null)}
          />
          <div className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[#101414]">Prompt detail</h2>
                <p className="mt-1 text-sm text-slate-700">{drawerPrompt.prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerPrompt(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              <MetricMini label="Visibility" value={formatPercent(drawerPrompt.avgVisibility)} />
              <MetricMini label="Sentiment" value={formatScore(drawerPrompt.avgSentimentScore)} />
              <MetricMini label="Avg rank" value={formatScore(drawerPrompt.avgRank)} />
              <MetricMini
                label="Branded"
                value={drawerPrompt.meInPrompt ? 'Yes' : drawerPrompt.meInPrompt === false ? 'No' : '—'}
              />
            </div>
            <div className="px-5 pb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Related responses ({detailResponses.length})
              </h3>
              {detailResponses.length === 0 ? (
                <EmptyState
                  title="No responses in snapshot"
                  message="mentions_sentiment had no rows for this promptId."
                />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {detailResponses.slice(0, 25).map((r) => (
                    <li key={r.id} className="px-3 py-2.5 text-xs">
                      <div className="flex justify-between gap-2 text-slate-500">
                        <span>{r.provider || r.model}</span>
                        <span>{(r.timestamp || r.createdAt || '').slice(0, 10)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-slate-700">
                        {r.responsePreview || r.response || '—'}
                      </p>
                      <p className="mt-1 text-slate-400">
                        Sentiment {formatScore(sentimentOf(r))} · Visibility{' '}
                        {formatPercent(r.visibilityAverage)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}
