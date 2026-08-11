import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PromptsScreenSkeleton } from '../components/ScreenSkeletons'
import { ResponseDrawer } from '../components/mentions/ResponseDrawer'
import { DeltaLabel } from '../components/prompts/DeltaLabel'
import { IntentBadge } from '../components/prompts/IntentBadge'
import { IntentDistribution } from '../components/prompts/IntentDistribution'
import { TopicFilterCard } from '../components/prompts/TopicFilterCard'
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

function tagLabel(tag: NonNullable<PromptRow['tags']>[number]) {
  return typeof tag === 'string' ? tag : tag.name
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerPrompt, setDrawerPrompt] = useState<PromptRow | null>(null)
  const [drawerResponse, setDrawerResponse] = useState<ResponseRow | null>(null)
  const [search, setSearch] = useState('')
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

  useEffect(() => {
    const promptId = searchParams.get('prompt')
    if (!promptId) {
      if (drawerPrompt) {
        setDrawerPrompt(null)
        setDrawerResponse(null)
      }
      return
    }
    if (drawerPrompt?.id === promptId) return
    const matchingPrompt = promptRows.find((prompt) => prompt.id === promptId)
    if (matchingPrompt) setDrawerPrompt(matchingPrompt)
  }, [drawerPrompt, promptRows, searchParams])

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

  const openPrompt = (prompt: PromptRow) => {
    setDrawerPrompt(prompt)
    const next = new URLSearchParams(searchParams)
    next.set('prompt', prompt.id)
    setSearchParams(next, { replace: true })
  }

  const closePrompt = () => {
    setDrawerPrompt(null)
    setDrawerResponse(null)
    const next = new URLSearchParams(searchParams)
    next.delete('prompt')
    setSearchParams(next, { replace: true })
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
    <div className={`flex flex-col gap-8${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TopicFilterCard
          topics={topicRows}
          selectedTopicIds={selectedTopics}
          onToggleTopic={toggleTopic}
          onClearTopics={() => setTopics([])}
        />
        <IntentDistribution prompts={filtered} />
      </div>

      <section aria-labelledby="prompts-table-heading">
        <div className="flex flex-col gap-4 border-b-2 border-[#101414] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-[#8b857c] uppercase">
              Prompt library
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 id="prompts-table-heading" className="font-serif text-2xl text-[#101414]">
                Tracked prompts
              </h2>
              <span className="font-serif text-sm text-[#8b857c]">
                {tableRows.length.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <svg
              className="pointer-events-none absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-[#8b857c]"
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
              aria-label="Search prompts"
              className="w-full border-0 border-b border-[#b8b1a7] bg-transparent py-2 pr-2 pl-7 text-sm text-[#101414] placeholder:text-[#9a938a] focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d8d3ca]">
                <th className="py-3 pr-6 text-left text-[10px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase">
                  Prompt
                </th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase md:table-cell">
                  Topic
                </th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase sm:table-cell">
                  Intent
                </th>
                <th
                  aria-sort={sortKey === 'visibility' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className="px-3 py-3 text-right text-[10px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-[#101414] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    onClick={() => toggleSort('visibility')}
                  >
                    Visibility
                    <span aria-hidden="true">{sortKey === 'visibility' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
                <th
                  aria-sort={sortKey === 'sentiment' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className="hidden px-3 py-3 text-right text-[10px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase sm:table-cell"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-[#101414] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    onClick={() => toggleSort('sentiment')}
                  >
                    Sentiment
                    <span aria-hidden="true">{sortKey === 'sentiment' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
                <th
                  aria-sort={sortKey === 'rank' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className="px-3 py-3 text-right text-[10px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-[#101414] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                    onClick={() => toggleSort('rank')}
                  >
                    Rank
                    <span aria-hidden="true">{sortKey === 'rank' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10">
                    <EmptyState
                      title="No prompts"
                      message="No prompts match the current filters or search."
                    />
                  </td>
                </tr>
              ) : (
                tableRows.map((r) => (
                  <tr key={r.id} className="group border-b border-[#e4e0d9] transition hover:bg-white/70">
                    <td className="max-w-sm py-4 pr-6">
                      <button
                        type="button"
                        onClick={() => openPrompt(r)}
                        className="line-clamp-2 text-left text-sm font-medium leading-5 text-[#101414] group-hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        {r.prompt}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#8b857c] md:hidden">
                        <span>{r.topic?.name ?? 'No topic'}</span>
                        {r.regions?.slice(0, 2).map((region) => (
                          <span key={region}>
                            {regionFlag(region)} {regionShortLabel(region)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 hidden flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#8b857c] md:flex">
                        {r.regions?.slice(0, 2).map((region) => (
                          <span key={region}>
                            {regionFlag(region)} {regionShortLabel(region)}
                          </span>
                        ))}
                        {r.tags
                          ?.map(tagLabel)
                          .filter((tag): tag is string => Boolean(tag))
                          .slice(0, 2)
                          .map((tag) => <span key={tag}>#{tag}</span>)}
                      </div>
                    </td>
                    <td className="hidden max-w-40 px-4 py-4 text-xs text-[#5f5a53] md:table-cell">
                      {r.topic?.name ?? '—'}
                    </td>
                    <td className="hidden px-4 py-4 sm:table-cell">
                      <IntentBadge type={r.type} />
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-serif text-base tabular-nums text-[#101414]">
                          {r.avgVisibility != null ? `${formatNumber(r.avgVisibility, 0)}%` : '—'}
                        </span>
                        <DeltaLabel value={r.visibilityChange} />
                      </div>
                    </td>
                    <td className="hidden px-3 py-4 text-right sm:table-cell">
                      <div className="flex flex-col items-end">
                        <span className="font-serif text-base tabular-nums text-brand-800">
                          {formatScore(r.avgSentimentScore)}
                        </span>
                        <DeltaLabel value={r.sentimentChange} />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-serif text-base tabular-nums text-[#101414]">
                          {formatScore(r.avgRank)}
                        </span>
                        <DeltaLabel value={r.rankChange} invert />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-3 text-[10px] tracking-wide text-[#8b857c] uppercase">
          <span>
            {tableRows.length.toLocaleString()} prompt{tableRows.length === 1 ? '' : 's'}
          </span>
          <span>Managed in iGEO</span>
        </div>
      </section>

      {drawerPrompt && (
        <div className="fixed inset-0 z-40 flex justify-end bg-[#101414]/25">
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close prompt detail"
            onClick={closePrompt}
          />
          <aside
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-[#d8d3ca] bg-[#faf9f7] shadow-2xl"
            aria-labelledby="prompt-detail-heading"
          >
            <div className="flex items-start justify-between gap-5 border-b-2 border-[#101414] px-6 py-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-[#8b857c] uppercase">
                  Prompt detail
                </p>
                <h2 id="prompt-detail-heading" className="mt-2 font-serif text-2xl leading-tight text-[#101414]">
                  {drawerPrompt.prompt}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8b857c]">
                  {drawerPrompt.topic?.name && <span>{drawerPrompt.topic.name}</span>}
                  {drawerPrompt.regions?.map((region) => (
                    <span key={region}>
                      {regionFlag(region)} {regionShortLabel(region)}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={closePrompt}
                className="shrink-0 border-b border-transparent py-1 text-xs font-medium tracking-wide text-[#5f5a53] uppercase hover:border-[#101414] hover:text-[#101414] focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 border-b border-[#d8d3ca] sm:grid-cols-4">
              <MetricMini label="Visibility" value={drawerPrompt.avgVisibility != null ? `${formatNumber(drawerPrompt.avgVisibility, 0)}%` : '—'} />
              <MetricMini label="Sentiment" value={formatScore(drawerPrompt.avgSentimentScore)} />
              <MetricMini label="Rank" value={formatScore(drawerPrompt.avgRank)} />
              <MetricMini label="Intent" value={drawerPrompt.type ?? '—'} />
            </div>
            <div className="px-6 py-6">
              <h3 className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-[#8b857c] uppercase">
                Related responses ({detailResponses.length})
              </h3>
              {geo.geoMode && geoDetail.loading ? (
                <p className="border-y border-[#d8d3ca] py-8 text-center text-sm text-[#8b857c]">
                  Loading responses…
                </p>
              ) : geo.geoMode && geoDetail.error ? (
                <ErrorState message={geoDetail.error} onRetry={geoDetail.retry} />
              ) : detailResponses.length === 0 ? (
                <EmptyState
                  title="No responses"
                  message="No response rows for this prompt in the selected range."
                />
              ) : (
                <ul className="border-t border-[#d8d3ca]">
                  {detailResponses.slice(0, 25).map((resp) => (
                    <li key={resp.id} className="border-b border-[#d8d3ca]">
                      <button
                        type="button"
                        onClick={() => setDrawerResponse(resp)}
                        className="w-full py-4 text-left transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-[#8b857c]">
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
                        <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#5f5a53]">
                          {resp.responsePreview || resp.response || '—'}
                        </p>
                        <p className="mt-2 text-[10px] tracking-wide text-[#8b857c] uppercase">
                          Sentiment {formatScore(sentimentOf(resp))} · Visibility{' '}
                          {resp.visibilityAverage != null ? `${formatNumber(resp.visibilityAverage, 0)}%` : '—'}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {drawerResponse && (
        <ResponseDrawer row={drawerResponse} onClose={() => setDrawerResponse(null)} />
      )}
    </div>
  )
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-b border-[#d8d3ca] px-4 py-4 last:border-r-0 sm:border-b-0">
      <p className="text-[9px] font-semibold tracking-[0.16em] text-[#8b857c] uppercase">{label}</p>
      <p className="mt-1 font-serif text-lg text-[#101414]">{value}</p>
    </div>
  )
}
