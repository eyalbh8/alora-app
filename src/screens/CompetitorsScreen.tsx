import { useEffect, useMemo, useState } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  collectFilterOptions,
  detectCompetitorFilterAvailability,
  filterCompetitors,
} from '../lib/snapshots/filter'
import { mergeCompetitors, mergePrompts } from '../lib/snapshots/merge'
import { formatNumber, formatScore, truncateMiddle } from '../lib/format'
import type { CitationLink, CompetitorPerformance } from '../api/types'

export function CompetitorsScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const merged = useMemo(() => mergeCompetitors(snapshots), [snapshots])
  const promptsMerged = useMemo(() => mergePrompts(snapshots), [snapshots])

  const ranking = merged.payload?.ranking ?? merged.payload?.competitors ?? []
  const citations = merged.payload?.citations ?? {}
  const citationCounts = merged.payload?.citationCounts ?? {}

  useEffect(() => {
    setFilterMeta({
      options: collectFilterOptions({
        competitors: ranking,
        topics: promptsMerged.topics.payload ?? [],
        prompts: promptsMerged.prompts.payload?.prompts,
      }),
      availability: {
        ...detectCompetitorFilterAvailability(ranking),
        providers: false,
        prompts: false,
        regions: false,
        tags: false,
        branded: false,
        promptTypes: false,
        crawlers: false,
      },
    })
  }, [ranking, promptsMerged, setFilterMeta])

  const filtered = filterCompetitors(ranking, { topics: filters.topics })
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null
  const selectedCitations: CitationLink[] = selected ? citations[selected.id] ?? [] : []

  if (merged.error) return <ErrorState message={merged.error} />
  if (!merged.payload) {
    return <EmptyState title="No competitors snapshot" message="competitors payload was empty." />
  }

  const columns: Column<CompetitorPerformance>[] = [
    {
      key: 'position',
      header: 'Pos',
      render: (r) => r.position ?? '—',
    },
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedId(r.id)}
          className="flex items-center gap-2 text-left font-medium text-brand-800 hover:underline"
        >
          {r.logo ? (
            <img src={r.logo} alt="" className="h-5 w-5 rounded object-contain" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px]">
              {r.name.slice(0, 1)}
            </span>
          )}
          {r.name}
        </button>
      ),
    },
    {
      key: 'domain',
      header: 'Domain',
      render: (r) => r.domain || r.site || '—',
    },
    {
      key: 'occurrences',
      header: 'Visibility',
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
    {
      key: 'citations',
      header: 'Citations',
      align: 'right',
      render: (r) => formatNumber(citationCounts[r.id], 0),
    },
    {
      key: 'topics',
      header: 'Topics',
      render: (r) => (r.topics?.length ? r.topics.join(', ') : '—'),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <FreshnessBadge day={merged.freshness.day} pulledAt={merged.freshness.pulledAt} />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        loading={false}
        totalCount={filtered.length}
        emptyTitle="No competitors"
        emptyMessage="No ranking rows match the current filters."
      />

      {selected && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#101414]">
            Citations for {selected.name}
            <span className="ml-2 font-normal text-slate-400">
              ({formatNumber(citationCounts[selected.id] ?? selectedCitations.length, 0)})
            </span>
          </h2>
          {selectedCitations.length === 0 ? (
            <EmptyState title="No citations" message="No citation URLs for this competitor in the snapshot." />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {selectedCitations.map((c, i) => (
                <li key={`${c.url}-${i}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-800 hover:underline"
                    >
                      {c.title || truncateMiddle(c.url, 70)}
                    </a>
                    <p className="text-xs text-slate-400">{truncateMiddle(c.url, 90)}</p>
                  </div>
                  <div className="flex gap-1 text-[10px]">
                    {c.isMe && (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">me</span>
                    )}
                    {c.isTracked && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">tracked</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
