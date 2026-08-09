import type { AnalyticsMetric, AnalyticsRow } from '../../api/types'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { LoadingSpinner } from '../LoadingSpinner'
import { formatMetricValue, metricLabel, providerLabel } from '../../lib/format'
import { isPercentMetric } from '../../lib/format'

interface PlatformMetricListProps {
  title: string
  subtitle: string
  metric: AnalyticsMetric
  rows: AnalyticsRow[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
  metricOptions?: AnalyticsMetric[]
  onMetricChange?: (metric: AnalyticsMetric) => void
}

export function PlatformMetricList({
  title,
  subtitle,
  metric,
  rows,
  loading,
  error,
  onRetry,
  hasData,
  metricOptions,
  onMetricChange,
}: PlatformMetricListProps) {
  const max = Math.max(
    1,
    ...rows.map((r) => {
      const v = r[metric]
      return typeof v === 'number' ? v : 0
    }),
  )
  const percentScale = isPercentMetric(metric)

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
        <EmptyState title="No data available" message="No platform data for this period." />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const provider = String(row.provider ?? '')
            const value = (row[metric] as number | null | undefined) ?? null
            const barPct =
              value === null ? 0 : percentScale ? Math.min(100, value) : (value / max) * 100
            return (
              <li key={provider} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                      {providerLabel(provider).charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-800">
                      {providerLabel(provider)}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-slate-600">
                    {formatMetricValue(metric, value)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
