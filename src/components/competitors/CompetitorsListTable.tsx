import { useMemo } from 'react'
import type { CompetitorPerformance } from '../../api/types'
import { useGeoMeta } from '../../context/GeoMetaContext'
import { isAccountCompetitor } from '../../lib/accountCompetitor'
import { formatNumber } from '../../lib/format'
import { DeltaBadge } from '../dashboard/DeltaBadge'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { BrandLogo } from './BrandLogo'

const SENTIMENT_THRESHOLDS = {
  VERY_POSITIVE: 70,
  POSITIVE: 30,
  NEUTRAL: 30,
  NEGATIVE: -70,
} as const

function sentimentStyle(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) {
    return 'text-muted'
  }
  if (score >= SENTIMENT_THRESHOLDS.VERY_POSITIVE) {
    return 'text-accent'
  }
  if (score >= SENTIMENT_THRESHOLDS.POSITIVE) {
    return 'text-accent'
  }
  if (score >= -SENTIMENT_THRESHOLDS.NEUTRAL && score <= SENTIMENT_THRESHOLDS.NEUTRAL) {
    return 'text-ink'
  }
  if (score >= SENTIMENT_THRESHOLDS.NEGATIVE) {
    return 'text-red-700'
  }
  return 'text-red-800'
}

function BrandCell({ row }: { row: CompetitorPerformance }) {
  const { meta } = useGeoMeta()
  const mine = isAccountCompetitor(row, meta?.account)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandLogo
        id={row.id}
        name={row.name}
        logo={row.logo}
        domain={row.domain}
        site={row.site}
        size="md"
      />
      <span className={`min-w-0 truncate ${mine ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
        {row.name}
      </span>
    </div>
  )
}

function TopicTags({ topics }: { topics?: string[] }) {
  if (!topics?.length) return <span className="text-muted-dark">—</span>

  return <span className="text-xs text-muted">{topics.join(', ')}</span>
}

interface CompetitorsListTableProps {
  rows: CompetitorPerformance[]
}

export function CompetitorsListTable({ rows }: CompetitorsListTableProps) {
  const { hoveredCompetitor, setHoveredCompetitor } = useCompetitorHover()

  const rankedRows = useMemo(
    () =>
      [...rows]
        .sort((a, b) => {
          const mentionDiff = (b.occurrences ?? 0) - (a.occurrences ?? 0)
          if (mentionDiff !== 0) return mentionDiff
          return a.name.localeCompare(b.name)
        })
        .map((row, index) => ({ row, rank: index + 1 })),
    [rows],
  )

  if (rows.length === 0) {
    return (
      <div className="border-y border-line px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">No competitors</p>
        <p className="mt-1 text-sm text-muted">No ranking rows match the current filters.</p>
      </div>
    )
  }

  return (
    <section aria-labelledby="competitors-list-title">
      <h2 id="competitors-list-title" className="mb-4 text-[19px] font-semibold text-ink">
        Competitors List
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-0 border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="w-8 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Rank
              </th>
              <th className="min-w-0 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Brand
              </th>
              <th className="hidden px-3 pb-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted md:table-cell">
                Shared Topics
              </th>
              <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Mentions
              </th>
              <th className="pb-2.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Sentiment
              </th>
            </tr>
          </thead>
          <tbody>
            {rankedRows.map(({ row, rank }) => {
              const sentiment = sentimentStyle(row.sentimentScore)
              const hovered = hoveredCompetitor === row.name

              return (
                <tr
                  key={row.id}
                  className={`border-b border-line transition-colors ${
                    hovered ? 'bg-surface/50' : ''
                  }`}
                  onMouseEnter={() => setHoveredCompetitor(row.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                >
                  <td className="w-8 py-4 pr-3 text-[13px] tabular-nums text-muted">
                    {rank}
                  </td>
                  <td className="min-w-0 py-4 pr-3">
                    <BrandCell row={row} />
                    {row.topics?.length ? (
                      <p className="mt-1.5 truncate text-[10px] text-muted md:hidden">
                        {row.topics.join(', ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden max-w-xs px-3 py-4 md:table-cell">
                    <TopicTags topics={row.topics} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.occurrencesDelta != null && (
                        <DeltaBadge value={row.occurrencesDelta} mode="percent" />
                      )}
                      <span className="text-[13px] text-ink">
                        {formatNumber(row.occurrences, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 pl-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.sentimentScoreDelta != null && (
                        <span
                          className={`text-xs font-medium ${
                            (row.sentimentScoreDelta ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {(row.sentimentScoreDelta ?? 0) >= 0 ? '↑' : '↓'}{' '}
                          {Math.round(Math.abs(row.sentimentScoreDelta ?? 0))}
                        </span>
                      )}
                      <span className={`text-[13px] font-semibold ${sentiment}`}>
                        {row.sentimentScore != null ? row.sentimentScore : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
