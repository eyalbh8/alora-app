import type { ReactNode } from 'react'

interface EmptyStateProps {
  title?: string
  message?: string
  children?: ReactNode
}

/** Friendly empty state — used when requested_period_has_data is false or a list has 0 rows. */
export function EmptyState({
  title = 'No data for this period yet',
  message = 'Try a different date range, or check back once more answers have been collected.',
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <svg
        className="h-8 w-8 text-slate-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.5V19a1.5 1.5 0 001.5 1.5h15A1.5 1.5 0 0021 19v-5.5M3 13.5L5.7 5.6A1.5 1.5 0 017.1 4.5h9.8a1.5 1.5 0 011.4 1.1L21 13.5M3 13.5h5.1a1.5 1.5 0 011.4 1 2.6 2.6 0 004.9 0 1.5 1.5 0 011.5-1H21"
        />
      </svg>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="max-w-sm text-xs text-slate-400">{message}</p>
      {children}
    </div>
  )
}
