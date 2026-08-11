import type { CompetitorPerformance } from '../../api/types'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { formatNumber, formatScore } from '../../lib/format'
import { BrandLogo } from '../competitors/BrandLogo'
import { DashboardCard } from './DashboardCard'
import { DeltaBadge } from './DeltaBadge'

function BrandCell({ row }: { row: CompetitorPerformance }) {
  const isAccount = row.isAccount || row.id.toLowerCase() === 'account'

  return (
    <div className="flex items-center gap-2">
      <BrandLogo
        id={row.id}
        name={row.name}
        logo={row.logo}
        domain={row.domain}
        site={row.site}
        size="sm"
      />
      <span className="font-medium text-[#302d29]">{row.name}</span>
      {isAccount && (
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-brand-700">
          Your brand
        </span>
      )}
    </div>
  )
}

interface IndustryRankingCardProps {
  competitors: CompetitorPerformance[]
}

export function IndustryRankingCard({ competitors }: IndustryRankingCardProps) {
  const { hoveredCompetitor, setHoveredCompetitor } = useCompetitorHover()

  const rows = [...competitors]
    .filter((c) => (c.occurrences ?? 0) > 0)
    .sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0))
    .slice(0, 5)

  const isEmpty = rows.length === 0

  return (
    <DashboardCard
      title="Market position"
      subtitle="Who owns the narrative in AI answers"
      variant="editorial"
      contentClassName="overflow-x-auto"
    >
      {isEmpty ? (
        <div className="flex min-h-52 flex-col items-center justify-center border border-dashed border-[#d8d2c7] px-6 text-center">
          <p className="text-sm font-semibold text-[#302d29]">Add competitors to track share of voice</p>
          <p className="mt-1 text-xs text-[#8a847b]">Market signals will appear once competing brands are tracked.</p>
        </div>
      ) : (
        <table className="w-full min-w-[24rem] text-sm">
          <thead>
            <tr className="border-b-2 border-[#101414] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a847b]">
              <th className="pb-2.5 pr-3 text-left font-semibold">Position</th>
              <th className="px-3 pb-2.5 text-left font-semibold">Brand</th>
              <th className="px-3 pb-2.5 text-right font-semibold">Avg. rank</th>
              <th className="px-3 pb-2.5 text-right font-semibold">Mentions</th>
              <th className="pb-2.5 pl-3 text-right font-semibold">Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hovered = hoveredCompetitor === row.name
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#e4dfd6] transition-colors ${
                    hovered ? 'bg-[#f3f0ea]' : ''
                  }`}
                  onMouseEnter={() => setHoveredCompetitor(row.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                >
                  <td className="py-3.5 pr-3 text-[#6b655e]">{row.position ?? '—'}</td>
                  <td className="px-3 py-3.5">
                    <BrandCell row={row} />
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.avgRankDelta != null && (
                        <DeltaBadge value={row.avgRankDelta} mode="absolute" invert />
                      )}
                      <span className="font-medium text-[#302d29]">{formatScore(row.avgRank)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.occurrencesDelta != null && (
                        <DeltaBadge value={row.occurrencesDelta} mode="percent" />
                      )}
                      <span className="font-medium text-[#302d29]">
                        {formatNumber(row.occurrences, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 pl-3">
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
                      <span className="min-w-[2rem] text-right text-xs font-semibold text-brand-700">
                        {row.sentimentScore != null ? row.sentimentScore : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </DashboardCard>
  )
}
