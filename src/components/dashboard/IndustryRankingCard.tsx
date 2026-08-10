import type { CompetitorPerformance } from '../../api/types'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { formatNumber, formatScore } from '../../lib/format'
import { BrandLogo } from '../competitors/BrandLogo'
import { DashboardCard } from './DashboardCard'
import { DeltaBadge } from './DeltaBadge'

const SENTIMENT_THRESHOLDS = {
  VERY_POSITIVE: 70,
  POSITIVE: 30,
  NEUTRAL: 30,
  NEGATIVE: -70,
} as const

function sentimentStyle(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) {
    return { bg: 'bg-white', text: 'text-slate-600' }
  }
  if (score >= SENTIMENT_THRESHOLDS.VERY_POSITIVE) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-900' }
  }
  if (score >= SENTIMENT_THRESHOLDS.POSITIVE) {
    return { bg: 'bg-lime-50', text: 'text-lime-900' }
  }
  if (score >= -SENTIMENT_THRESHOLDS.NEUTRAL && score <= SENTIMENT_THRESHOLDS.NEUTRAL) {
    return { bg: 'bg-slate-100', text: 'text-slate-700' }
  }
  if (score >= SENTIMENT_THRESHOLDS.NEGATIVE) {
    return { bg: 'bg-red-50', text: 'text-red-800' }
  }
  return { bg: 'bg-red-50', text: 'text-red-900' }
}

function BrandCell({ row }: { row: CompetitorPerformance }) {
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
      <span className="font-medium text-slate-800">{row.name}</span>
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
    <DashboardCard title="Industry Ranking" subtitle="Top brands by visibility">
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <p className="text-base font-semibold text-slate-800">Set up your competitors</p>
          <p className="mt-1 text-sm text-slate-500">Ranking data will appear once competitors have mentions.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">Brand</th>
              <th className="px-4 py-3 text-center font-medium">Rank</th>
              <th className="px-4 py-3 text-center font-medium">Mentions</th>
              <th className="px-4 py-3 text-center font-medium">Sentiment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sentiment = sentimentStyle(row.sentimentScore)
              const hovered = hoveredCompetitor === row.name
              return (
                <tr
                  key={row.id}
                  className={`border-b border-slate-50 transition-colors last:border-0 ${
                    hovered ? 'bg-slate-50' : ''
                  }`}
                  onMouseEnter={() => setHoveredCompetitor(row.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                >
                  <td className="px-4 py-3 text-slate-600">{row.position ?? '—'}</td>
                  <td className="px-4 py-3">
                    <BrandCell row={row} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.avgRankDelta != null && (
                        <DeltaBadge value={row.avgRankDelta} mode="absolute" invert />
                      )}
                      <span className="font-medium text-slate-800">{formatScore(row.avgRank)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.occurrencesDelta != null && (
                        <DeltaBadge value={row.occurrencesDelta} mode="percent" />
                      )}
                      <span className="font-medium text-slate-800">
                        {formatNumber(row.occurrences, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
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
                      <span
                        className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${sentiment.bg} ${sentiment.text}`}
                      >
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
