import type { CompetitorPerformance } from '../../api/types'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { formatNumber, formatScore } from '../../lib/format'
import { BrandLogo } from '../competitors/BrandLogo'
import { DashboardCard } from './DashboardCard'
import { DeltaBadge } from './DeltaBadge'
import {
  PAIRED_BRAND_COUNT,
  PAIRED_LEGEND_HEIGHT_PX,
  PAIRED_ROW_HEIGHT_PX,
  PAIRED_XAXIS_HEIGHT_PX,
} from './constants'

function BrandCell({ row }: { row: CompetitorPerformance }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <BrandLogo
        id={row.id}
        name={row.name}
        logo={row.logo}
        domain={row.domain}
        site={row.site}
        size="sm"
      />
      <span className="truncate font-medium text-ink">{row.name}</span>
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

  const displayRows = Array.from({ length: PAIRED_BRAND_COUNT }, (_, index) => rows[index] ?? null)

  return (
    <DashboardCard
      title="Market position"
      subtitle="Who owns the narrative in AI answers"
      variant="editorial"
      fill
      framed={false}
      contentClassName="min-w-0 overflow-hidden"
    >
      {isEmpty ? (
        <div
          className="flex flex-col items-center justify-center border border-dashed border-line px-6 text-center"
          style={{
            minHeight:
              PAIRED_LEGEND_HEIGHT_PX +
              PAIRED_ROW_HEIGHT_PX * PAIRED_BRAND_COUNT +
              PAIRED_XAXIS_HEIGHT_PX,
          }}
        >
          <p className="text-sm font-semibold text-ink">Add competitors to track share of voice</p>
          <p className="mt-1 text-xs text-muted">Market signals will appear once competing brands are tracked.</p>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col />
              <col className="w-[5.75rem]" />
              <col className="w-[6.25rem]" />
              <col className="w-[5.5rem]" />
            </colgroup>
            <thead>
              <tr
                className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                style={{ height: PAIRED_LEGEND_HEIGHT_PX }}
              >
                <th className="border-b-2 border-ink pr-2 text-left font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <span>Position</span>
                    <span>Brand</span>
                  </span>
                </th>
                <th className="border-b-2 border-ink px-1.5 text-right font-semibold">Avg. rank</th>
                <th className="border-b-2 border-ink px-1.5 text-right font-semibold">Mentions</th>
                <th className="border-b-2 border-ink pl-1.5 text-right font-semibold">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, index) => {
                if (!row) {
                  return (
                    <tr key={`empty-${index}`} style={{ height: PAIRED_ROW_HEIGHT_PX }}>
                      <td colSpan={4} className="border-b border-line" />
                    </tr>
                  )
                }
                const hovered = hoveredCompetitor === row.name
                return (
                  <tr
                    key={row.id}
                    className={hovered ? 'bg-paper-soft' : ''}
                    style={{ height: PAIRED_ROW_HEIGHT_PX }}
                    onMouseEnter={() => setHoveredCompetitor(row.name)}
                    onMouseLeave={() => setHoveredCompetitor(null)}
                  >
                    <td className="min-w-0 border-b border-line pr-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="card-number w-8 shrink-0">
                          {String(row.position ?? index + 1).padStart(2, '0')}
                        </span>
                        <BrandCell row={row} />
                      </div>
                    </td>
                    <td className="border-b border-line px-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-ink">{formatScore(row.avgRank)}</span>
                        {row.avgRankDelta != null && (
                          <DeltaBadge value={row.avgRankDelta} mode="absolute" invert />
                        )}
                      </div>
                    </td>
                    <td className="border-b border-line px-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-ink">
                          {formatNumber(row.occurrences, 0)}
                        </span>
                        {row.occurrencesDelta != null && (
                          <DeltaBadge value={row.occurrencesDelta} mode="percent" />
                        )}
                      </div>
                    </td>
                    <td className="border-b border-line pl-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs font-semibold text-accent">
                          {row.sentimentScore != null ? row.sentimentScore : '—'}
                        </span>
                        {row.sentimentScoreDelta != null && (
                          <DeltaBadge value={row.sentimentScoreDelta} mode="absolute" />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div aria-hidden className="shrink-0" style={{ height: PAIRED_XAXIS_HEIGHT_PX }} />
        </div>
      )}
    </DashboardCard>
  )
}
