import { Skeleton } from './LoadingSpinner'
import { TrendBadge } from './TrendBadge'

interface MetricCardProps {
  label: string
  /** Pre-formatted display value ("12.3%", "1.8", "—"). */
  value: string
  /** Period-over-period delta for the trend arrow; null hides it. */
  trend?: number | null
  trendPercent?: boolean
  /** For metrics where lower is better (average position). */
  trendInvert?: boolean
  loading?: boolean
}

export function MetricCard({
  label,
  value,
  trend = null,
  trendPercent = true,
  trendInvert = false,
  loading = false,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-slate-900">{value}</span>
          <TrendBadge value={trend} percent={trendPercent} invert={trendInvert} />
        </div>
      )}
    </div>
  )
}
