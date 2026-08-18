import type { CompetitorPerformance } from '../../api/types'
import { formatNumber, formatScore } from '../../lib/format'
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
    return 'text-slate-500'
  }
  if (score >= SENTIMENT_THRESHOLDS.VERY_POSITIVE) {
    return 'text-brand-700'
  }
  if (score >= SENTIMENT_THRESHOLDS.POSITIVE) {
    return 'text-brand-700'
  }
  if (score >= -SENTIMENT_THRESHOLDS.NEUTRAL && score <= SENTIMENT_THRESHOLDS.NEUTRAL) {
    return 'text-slate-700'
  }
  if (score >= SENTIMENT_THRESHOLDS.NEGATIVE) {
    return 'text-red-700'
  }
  return 'text-red-800'
}

function BrandCell({ row }: { row: CompetitorPerformance }) {
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
      <span
        className={`min-w-0 truncate ${
          row.isAccount || row.id === 'account'
            ? 'font-semibold text-[#101414]'
            : 'font-medium text-slate-800'
        }`}
      >
        {row.name}
      </span>
    </div>
  )
}

function TopicTags({ topics }: { topics?: string[] }) {
  if (!topics?.length) return <span className="text-slate-400">—</span>

  return <span className="text-xs text-slate-500">{topics.join(', ')}</span>
}

interface CompetitorsListTableProps {
  rows: CompetitorPerformance[]
}

export function CompetitorsListTable({ rows }: CompetitorsListTableProps) {
  const { hoveredCompetitor, setHoveredCompetitor } = useCompetitorHover()

  if (rows.length === 0) {
    return (
      <div className="border-y border-slate-200 px-6 py-12 text-center">
        <p className="text-base font-semibold text-slate-800">No competitors</p>
        <p className="mt-1 text-sm text-slate-500">No ranking rows match the current filters.</p>
      </div>
    )
  }

  return (
    <section aria-labelledby="competitors-list-title">
      <h2 id="competitors-list-title" className="mb-4 text-[19px] font-semibold text-[#101414]">
        Competitors List
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-0 border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[#101414]">
              <th className="min-w-0 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Brand
              </th>
              <th className="hidden px-3 pb-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 md:table-cell">
                Shared Topics
              </th>
              <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Rank
              </th>
              <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Mentions
              </th>
              <th className="pb-2.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Sentiment
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sentiment = sentimentStyle(row.sentimentScore)
              const hovered = hoveredCompetitor === row.name

              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#eae6de] transition-colors ${
                    hovered ? 'bg-brand-50/50' : ''
                  }`}
                  onMouseEnter={() => setHoveredCompetitor(row.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                >
                  <td className="min-w-0 py-4 pr-3">
                    <BrandCell row={row} />
                    {row.topics?.length ? (
                      <p className="mt-1.5 truncate text-[10px] text-slate-500 md:hidden">
                        {row.topics.join(', ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden max-w-xs px-3 py-4 md:table-cell">
                    <TopicTags topics={row.topics} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.avgRankDelta != null && (
                        <DeltaBadge value={row.avgRankDelta} mode="absolute" invert />
                      )}
                      <span className="text-[13px] text-slate-700">{formatScore(row.avgRank)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.occurrencesDelta != null && (
                        <DeltaBadge value={row.occurrencesDelta} mode="percent" />
                      )}
                      <span className="text-[13px] text-slate-700">
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
