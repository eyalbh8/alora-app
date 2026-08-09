import type { DomainCategorySlice } from '../../lib/analytics'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'

const CATEGORY_COLORS = [
  '#2fc9bc', // turquoise — Educational
  '#0e3b3a', // deep teal — Products
  '#ca8a04', // gold — Reviews
  '#64748b', // slate — +N more / Other
  '#148f85',
  '#7fd4cc',
  '#be123c',
]

interface DomainCategoryBreakdownProps {
  title?: string
  subtitle?: string
  slices: DomainCategorySlice[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

export function DomainCategoryBreakdown({
  title = 'Domain Type Breakdown',
  subtitle = 'Types of domains getting cited in answers.',
  slices,
  loading,
  error,
  onRetry,
  hasData,
}: DomainCategoryBreakdownProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData || slices.length === 0 ? (
        <EmptyState title="No domain categories yet" />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {slices.map((slice, i) => (
              <div
                key={slice.category}
                className="h-full"
                style={{
                  width: `${Math.max(slice.share, 0.5)}%`,
                  backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                }}
                title={`${slice.category}: ${slice.share.toFixed(0)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {slices.map((slice, i) => (
              <div key={slice.category} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
                <span className="font-medium text-slate-700">{slice.category}</span>
                <span className="text-slate-400">{slice.share.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
