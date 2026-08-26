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
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface px-6 py-10 shadow-soft">
      <p className="eyebrow mb-0">Empty</p>
      <p className="font-display text-[28px] leading-none tracking-[-0.03em] text-ink">{title}</p>
      <p className="max-w-lg text-[15px] leading-[1.7] text-muted">{message}</p>
      {children}
    </div>
  )
}
