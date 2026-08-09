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
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
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
