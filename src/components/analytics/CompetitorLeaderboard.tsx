import type { AnalyticsMetric } from '../../api/types'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { LoadingSpinner } from '../LoadingSpinner'
import {
  type LeaderboardEntry,
  isLowerBetter,
} from '../../lib/analytics'
import { formatMetricValue, metricLabel, ordinalRank } from '../../lib/format'

interface CompetitorLeaderboardProps {
  title: string
  subtitle: string
  metric: AnalyticsMetric
  entries: LeaderboardEntry[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
  /** Optional metric dropdown (Overview card control). */
  metricOptions?: AnalyticsMetric[]
  onMetricChange?: (metric: AnalyticsMetric) => void
}

function BrandAvatar({ name, isYou }: { name: string; isYou: boolean }) {
  return (
    <div
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
        isYou ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export function CompetitorLeaderboard({
  title,
  subtitle,
  metric,
  entries,
  loading,
  error,
  onRetry,
  hasData,
  metricOptions,
  onMetricChange,
}: CompetitorLeaderboardProps) {
  const yourRank = entries.findIndex((e) => e.isYou) + 1
  const lowerBetter = isLowerBetter(metric)

  return (
    <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        {metricOptions && onMetricChange && (
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as AnalyticsMetric)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm"
          >
            {metricOptions.map((m) => (
              <option key={m} value={m}>
                {metricLabel(m)}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData ? (
        <EmptyState title="No data available" message="No competitor data for this period." />
      ) : (
        <>
          {yourRank > 0 && (
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight text-slate-900">
                {ordinalRank(yourRank)}
              </span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                +0
              </span>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-2 font-medium">Brand</th>
                  <th className="pb-2 text-right font-medium">{metricLabel(metric)}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="border-t border-slate-50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-xs text-slate-400">{index + 1}</span>
                        <BrandAvatar name={entry.name} isYou={entry.isYou} />
                        <span className="font-medium text-slate-800">{entry.name}</span>
                        {entry.isYou && (
                          <span className="rounded bg-pink-50 px-1.5 py-0.5 text-[10px] font-semibold text-pink-600">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-slate-700">
                      {formatMetricValue(metric, entry.value)}
                      {entry.value === null && lowerBetter ? null : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
