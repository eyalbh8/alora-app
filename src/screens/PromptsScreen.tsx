import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PromptsScreenSkeleton } from '../components/ScreenSkeletons'
import { DeltaLabel } from '../components/prompts/DeltaLabel'
import { IntentBadge } from '../components/prompts/IntentBadge'
import { IntentDistribution } from '../components/prompts/IntentDistribution'
import { TopicFilterCard } from '../components/prompts/TopicFilterCard'
import { VisibilityRing } from '../components/prompts/VisibilityRing'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  collectFilterOptions,
  detectPromptFilterAvailability,
  activePrompts,
  filterPrompts,
  filterResponses,
} from '../lib/snapshots/filter'
import { mergeMentions, mergePrompts } from '../lib/snapshots/merge'
import { formatNumber, formatScore, providerLabel } from '../lib/format'
import { regionFlag, regionShortLabel } from '../lib/regions'
import { ProviderIcon } from '../components/ProviderIcon'
import { getGeoPrompts, getGeoResponses } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useApi } from '../hooks/useApi'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import type { PromptRow, ResponseRow, TopicRow } from '../api/types'
import { sentimentOf } from '../lib/snapshots/normalize'

type SortKey = 'visibility' | 'sentiment' | 'rank'
type SortDir = 'asc' | 'desc'

function sortRows(rows: PromptRow[], key: SortKey, dir: SortDir): PromptRow[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av =
      key === 'visibility'
        ? a.avgVisibility
        : key === 'sentiment'
          ? a.avgSentimentScore
          : key === 'rank'
            ? a.avgRank
            : null
    const bv =
      key === 'visibility'
        ? b.avgVisibility
        : key === 'sentiment'
          ? b.avgSentimentScore
          : key === 'rank'
            ? b.avgRank
            : null
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return (av - bv) * mul
  })
}

export function PromptsScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta, topics: selectedTopics, setTopics } = useAnalyticsFilters()
  const [drawerPrompt, setDrawerPrompt] = useState<PromptRow | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('visibility')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const geo = useGeoScreenData(queryKeys.geo.prompts, getGeoPrompts)

  const { prompts, topics } = useMemo(() => mergePrompts(snapshots), [snapshots])
  const mentions = useMemo(() => mergeMentions(snapshots), [snapshots])

  const promptRows: PromptRow[] = useMemo(() => {
    const rows = geo.data
      ? (geo.data.prompts as unknown as PromptRow[])
      : prompts.payload?.prompts ?? []
    return activePrompts(rows)
  }, [geo.data, prompts.payload?.prompts])

  const topicRows: TopicRow[] = useMemo(() => {
    if (!geo.data) {
      const all = topics.payload ?? []
      const counts = new Map<string, number>()
      for (const p of promptRows) {
        const id = p.topicId ?? p.topic?.id
        if (!id) continue
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      return all
        .map((t) => ({ ...t, promptsCount: counts.get(t.id) ?? t.promptsCount ?? 0 }))
        .filter((t) => (t.promptsCount ?? 0) > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    const byId = new Map<string, TopicRow>()
    for (const p of promptRows) {
      if (!p.topic) continue
      const existing = byId.get(p.topic.id)
      if (existing) {
        existing.promptsCount = (existing.promptsCount ?? 0) + 1
      } else {
        byId.set(p.topic.id, {
          id: p.topic.id,
          name: p.topic.name,
          state: p.topic.state,
          promptsCount: 1,
        })
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [geo.data, topics.payload, promptRows])

  useEffect(() => {
    if (geo.geoMode) return
    setFilterMeta({
      options: collectFilterOptions({
        topics: topicRows,
        prompts: promptRows,
        responses: mentions.responses.payload?.responses,
      }),
      availability: detectPromptFilterAvailability(promptRows),
    })
  }, [geo.geoMode, promptRows, topicRows, mentions, setFilterMeta])

  const filtered = useMemo(() => {
    return geo.data ? promptRows : filterPrompts(promptRows, filters)
  }, [geo.data, promptRows, filters])

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = q ? filtered.filter((r) => r.prompt.toLowerCase().includes(q)) : filtered
    rows = sortRows(rows, sortKey, sortDir)
    return rows
  }, [filtered, search, sortKey, sortDir])

  const geoDetail = useApi(
    queryKeys.geo.responses(
      { ...filters, prompts: drawerPrompt ? [drawerPrompt.id] : [] },
      { take: 50 },
    ),
    () =>
      drawerPrompt
        ? getGeoResponses({ ...filters, prompts: [drawerPrompt.id] }, { take: 50 })
        : Promise.resolve(null),
    { enabled: geo.geoMode && Boolean(drawerPrompt) },
  )

  const detailResponses = useMemo(() => {
    if (!drawerPrompt) return [] as ResponseRow[]
    if (geo.geoMode) {
      return (geoDetail.data?.data.responses ?? []) as unknown as ResponseRow[]
    }
    const all = mentions.responses.payload?.responses ?? []
    return filterResponses(all, { ...filters, prompts: [drawerPrompt.id] })
  }, [drawerPrompt, geo.geoMode, geoDetail.data, mentions, filters])

  const toggleTopic = (topicId: string) => {
    setTopics(
      selectedTopics.includes(topicId)
        ? selectedTopics.filter((id) => id !== topicId)
        : [...selectedTopics, topicId],
    )
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const allSelected = tableRows.length > 0 && tableRows.every((r) => selectedIds.has(r.id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tableRows.map((r) => r.id)))
    }
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (geo.pending) {
    return <PromptsScreenSkeleton />
  }
  if (geo.geoMode && geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }
  if (!geo.geoMode && prompts.error && !promptRows.length) {
    return <ErrorState message={prompts.error} />
  }

  return (
    <div className={`flex flex-col gap-4${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <TopicFilterCard
          topics={topicRows}
          selectedTopicIds={selectedTopics}
          onToggleTopic={toggleTopic}
          onClearTopics={() => setTopics([])}
        />
        <IntentDistribution prompts={filtered} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm text-[#101414] placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <button
            type="button"
            disabled
            title="Manage prompts in iGEO"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white"
          >
            Manage Prompts
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    aria-label="Select all prompts"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Prompts
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Topic
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Regions
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Intent
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase select-none hover:text-slate-700"
                  onClick={() => toggleSort('visibility')}
                >
                  <span className="inline-flex items-center gap-1">
                    Visibility
                    {sortKey === 'visibility' && (
                      <span className="text-slate-700">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </span>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase select-none hover:text-slate-700"
                  onClick={() => toggleSort('sentiment')}
                >
                  <span className="inline-flex items-center gap-1">
                    Sentiment
                    {sortKey === 'sentiment' && (
                      <span className="text-slate-700">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </span>
                </th>
                <th
                  className="cursor-pointer px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase select-none hover:text-slate-700"
                  onClick={() => toggleSort('rank')}
                >
                  <span className="inline-flex items-center gap-1">
                    Rank
                    {sortKey === 'rank' && (
                      <span className="text-slate-700">{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </span>
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8">
                    <EmptyState
                      title="No prompts"
                      message="No prompts match the current filters or search."
                    />
                  </td>
                </tr>
              ) : (
                tableRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 transition hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Select ${r.prompt}`}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDrawerPrompt(r)}
                        className="line-clamp-2 text-left text-sm font-medium text-[#101414] hover:text-brand-700 hover:underline"
                      >
                        {r.prompt}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {r.topic?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.regions?.length ? (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <span className="text-base leading-none">{regionFlag(r.regions[0])}</span>
                          <span className="text-xs">{regionShortLabel(r.regions[0])}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <IntentBadge type={r.type} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-0.5">
                        <VisibilityRing value={r.avgVisibility} />
                        <DeltaLabel value={r.visibilityChange} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-semibold text-brand-700">
                          {formatScore(r.avgSentimentScore)}
                        </span>
                        <DeltaLabel value={r.sentimentChange} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-semibold text-[#101414]">
                          {formatScore(r.avgRank)}
                        </span>
                        <DeltaLabel value={r.rankChange} invert />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDrawerPrompt(r)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
                        title="View prompt detail"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {tableRows.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {tableRows.length.toLocaleString()} prompt{tableRows.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
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
              <MetricMini label="Visibility" value={drawerPrompt.avgVisibility != null ? `${formatNumber(drawerPrompt.avgVisibility, 0)}%` : '—'} />
              <MetricMini label="Sentiment" value={formatScore(drawerPrompt.avgSentimentScore)} />
              <MetricMini label="Rank" value={formatScore(drawerPrompt.avgRank)} />
              <MetricMini label="Intent" value={drawerPrompt.type ?? '—'} />
            </div>
            <div className="px-5 pb-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Related responses ({detailResponses.length})
              </h3>
              {detailResponses.length === 0 ? (
                <EmptyState
                  title="No responses in snapshot"
                  message="No response rows for this prompt in the selected range."
                />
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {detailResponses.slice(0, 25).map((resp) => (
                    <li key={resp.id} className="px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2 text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          {resp.provider || resp.model ? (
                            <>
                              <ProviderIcon provider={resp.provider || resp.model || ''} size="sm" />
                              {providerLabel(resp.provider || resp.model || '')}
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span>{(resp.timestamp || resp.createdAt || '').slice(0, 10)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-slate-700">
                        {resp.responsePreview || resp.response || '—'}
                      </p>
                      <p className="mt-1 text-slate-400">
                        Sentiment {formatScore(sentimentOf(resp))} · Visibility{' '}
                        {resp.visibilityAverage != null ? `${formatNumber(resp.visibilityAverage, 0)}%` : '—'}
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
