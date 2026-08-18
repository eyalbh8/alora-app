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
    <div className="border border-line bg-surface p-[22px]">
      <p className="eyebrow mb-3">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[32px] font-normal leading-none tracking-[-0.02em] text-ink">
            {value}
          </span>
          <TrendBadge value={trend} percent={trendPercent} invert={trendInvert} />
        </div>
      )}
    </div>
  )
}
