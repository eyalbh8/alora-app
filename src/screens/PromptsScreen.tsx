import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PromptsScreenSkeleton } from '../components/ScreenSkeletons'
import { TablePagination, type PageSize } from '../components/TablePagination'
import { ResponseDrawer } from '../components/mentions/ResponseDrawer'
import { DeltaLabel } from '../components/prompts/DeltaLabel'
import { IntentBadge } from '../components/prompts/IntentBadge'
import { IntentDistribution } from '../components/prompts/IntentDistribution'
import { TopicFilterCard } from '../components/prompts/TopicFilterCard'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { activePrompts } from '../lib/snapshots/filter'
import { formatNumber, formatScore, providerLabel } from '../lib/format'
import { regionFlag, regionShortLabel } from '../lib/regions'
import { ProviderIcon } from '../components/ProviderIcon'
import { getGeoPrompts, getGeoResponses } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useApi } from '../hooks/useApi'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import { useAccountStore } from '../store/useAccountStore'
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
  const { selectedAccount } = useAccountStore()
  const { filters, topics: selectedTopics, setTopics } = useAnalyticsFilters()
  const [searchParams, setSearchParams] = useSearchParams()
  const [drawerPrompt, setDrawerPrompt] = useState<PromptRow | null>(null)
  const [drawerResponse, setDrawerResponse] = useState<ResponseRow | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('visibility')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)
  const geo = useGeoScreenData(queryKeys.geo.prompts, getGeoPrompts)

  const promptRows: PromptRow[] = useMemo(() => {
    return activePrompts((geo.data?.prompts ?? []) as unknown as PromptRow[])
  }, [geo.data])

  const topicRows: TopicRow[] = useMemo(() => {
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
  }, [promptRows])

  const filtered = promptRows

  const tableRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = q ? filtered.filter((r) => r.prompt.toLowerCase().includes(q)) : filtered
    rows = sortRows(rows, sortKey, sortDir)
    return rows
  }, [filtered, search, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = tableRows.length === 0 ? 0 : (currentPage - 1) * pageSize
  const pagedRows = tableRows.slice(pageStart, pageStart + pageSize)
  const pageEnd = pageStart + pagedRows.length

  useEffect(() => {
    setPage(1)
  }, [search, sortKey, sortDir, filtered, pageSize])

  const geoDetail = useApi(
    queryKeys.geo.responses(
      selectedAccount?.id,
      { ...filters, prompts: drawerPrompt ? [drawerPrompt.id] : [] },
      { take: 50 },
    ),
    () =>
      drawerPrompt
        ? getGeoResponses({ ...filters, prompts: [drawerPrompt.id] }, { take: 50 })
        : Promise.resolve(null),
    { enabled: Boolean(drawerPrompt) },
  )

  const detailResponses = useMemo(() => {
    if (!drawerPrompt) return [] as ResponseRow[]
    return (geoDetail.data?.data.responses ?? []) as unknown as ResponseRow[]
  }, [drawerPrompt, geoDetail.data])

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
  if (geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }

  return (
    <div className={`flex flex-col gap-8 md:gap-10 lg:gap-14${geo.loading ? ' opacity-70' : ''}`}>
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
        <div className="flex flex-col gap-4 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-dark uppercase">
              Prompt library
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h2 id="prompts-table-heading" className="font-display text-2xl text-ink">
                Tracked prompts
              </h2>
              <span className="font-display text-sm text-muted-dark">
                {tableRows.length.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <svg
              className="pointer-events-none absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-muted-dark"
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
              className="w-full border-0 border-b border-muted-dark bg-transparent py-2 pr-2 pl-7 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-3 pr-6 text-left text-[10px] font-semibold tracking-[0.16em] text-muted-dark uppercase">
                  Prompt
                </th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-semibold tracking-[0.16em] text-muted-dark uppercase md:table-cell">
                  Topic
                </th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-semibold tracking-[0.16em] text-muted-dark uppercase sm:table-cell">
                  Intent
                </th>
                <th
                  aria-sort={sortKey === 'visibility' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className="px-3 py-3 text-right text-[10px] font-semibold tracking-[0.16em] text-muted-dark uppercase"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => toggleSort('visibility')}
                  >
                    Visibility
                    <span aria-hidden="true">{sortKey === 'visibility' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
                <th
                  aria-sort={sortKey === 'sentiment' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className="hidden px-3 py-3 text-right text-[10px] font-semibold tracking-[0.16em] text-muted-dark uppercase sm:table-cell"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={() => toggleSort('sentiment')}
                  >
                    Sentiment
                    <span aria-hidden="true">{sortKey === 'sentiment' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</span>
                  </button>
                </th>
                <th
                  aria-sort={sortKey === 'rank' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                  className="px-3 py-3 text-right text-[10px] font-semibold tracking-[0.16em] text-muted-dark uppercase"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
                pagedRows.map((r) => (
                  <tr key={r.id} className="group border-b border-line transition hover:bg-surface/70">
                    <td className="max-w-sm py-4 pr-6">
                      <button
                        type="button"
                        onClick={() => openPrompt(r)}
                        className="line-clamp-2 text-left text-sm font-medium leading-5 text-ink group-hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        {r.prompt}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-dark md:hidden">
                        <span>{r.topic?.name ?? 'No topic'}</span>
                        {r.regions?.slice(0, 2).map((region) => (
                          <span key={region}>
                            {regionFlag(region)} {regionShortLabel(region)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 hidden flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-dark md:flex">
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
                    <td className="hidden max-w-40 px-4 py-4 text-xs text-muted md:table-cell">
                      {r.topic?.name ?? '—'}
                    </td>
                    <td className="hidden px-4 py-4 sm:table-cell">
                      <IntentBadge type={r.type} />
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-display text-base tabular-nums text-ink">
                          {r.avgVisibility != null ? `${formatNumber(r.avgVisibility, 0)}%` : '—'}
                        </span>
                        <DeltaLabel value={r.visibilityChange} />
                      </div>
                    </td>
                    <td className="hidden px-3 py-4 text-right sm:table-cell">
                      <div className="flex flex-col items-end">
                        <span className="font-display text-base tabular-nums text-ink">
                          {formatScore(r.avgSentimentScore)}
                        </span>
                        <DeltaLabel value={r.sentimentChange} />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-display text-base tabular-nums text-ink">
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

        <TablePagination
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageStart={pageStart}
          pageEnd={pageEnd}
          total={tableRows.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </section>

      {drawerPrompt && (
        <div className="fixed inset-0 z-40 flex justify-end bg-bg/80">
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close prompt detail"
            onClick={closePrompt}
          />
          <aside
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-bg "
            aria-labelledby="prompt-detail-heading"
          >
            <div className="flex items-start justify-between gap-5 border-b-2 border-ink px-6 py-6">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-dark uppercase">
                  Prompt detail
                </p>
                <h2 id="prompt-detail-heading" className="mt-2 font-display text-2xl leading-tight text-ink">
                  {drawerPrompt.prompt}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-dark">
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
                className="shrink-0 border-b border-transparent py-1 text-xs font-medium tracking-wide text-muted uppercase hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
              <MetricMini label="Visibility" value={drawerPrompt.avgVisibility != null ? `${formatNumber(drawerPrompt.avgVisibility, 0)}%` : '—'} />
              <MetricMini label="Sentiment" value={formatScore(drawerPrompt.avgSentimentScore)} />
              <MetricMini label="Rank" value={formatScore(drawerPrompt.avgRank)} />
              <MetricMini label="Intent" value={drawerPrompt.type ?? '—'} />
            </div>
            <div className="px-6 py-6">
              <h3 className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-muted-dark uppercase">
                Related responses ({detailResponses.length})
              </h3>
              {geoDetail.loading ? (
                <p className="border-y border-line py-8 text-center text-sm text-muted-dark">
                  Loading responses…
                </p>
              ) : geoDetail.error ? (
                <ErrorState message={geoDetail.error} onRetry={geoDetail.retry} />
              ) : detailResponses.length === 0 ? (
                <EmptyState
                  title="No responses"
                  message="No response rows for this prompt in the selected range."
                />
              ) : (
                <ul className="border-t border-line">
                  {detailResponses.slice(0, 25).map((resp) => (
                    <li key={resp.id} className="border-b border-line">
                      <button
                        type="button"
                        onClick={() => setDrawerResponse(resp)}
                        className="w-full py-4 text-left transition hover:bg-surface/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-dark">
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
                        <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">
                          {resp.responsePreview || resp.response || '—'}
                        </p>
                        <p className="mt-2 text-[10px] tracking-wide text-muted-dark uppercase">
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
    <div className="border-r border-b border-line px-4 py-4 last:border-r-0 sm:border-b-0">
      <p className="text-[9px] font-semibold tracking-[0.16em] text-muted-dark uppercase">{label}</p>
      <p className="mt-1 font-display text-lg text-ink">{value}</p>
    </div>
  )
}
