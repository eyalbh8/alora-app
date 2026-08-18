import type { ReactNode } from 'react'
import { ChartSkeleton } from './LoadingSpinner'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

interface ChartCardProps {
  title: string
  subtitle?: string
  loading: boolean
  error?: string | null
  onRetry?: () => void
  /** When false (requested_period_has_data === false or 0 rows), shows an empty state. */
  hasData: boolean
  children: ReactNode
}

export function ChartCard({ title, subtitle, loading, error, onRetry, hasData, children }: ChartCardProps) {
  return (
    <div className="border border-line bg-surface p-[22px]">
      <div className="mb-4">
        <p className="eyebrow mb-1">{title}</p>
        {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
      </div>
      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : hasData ? (
        children
      ) : (
        <EmptyState />
      )}
    </div>
  )
}
