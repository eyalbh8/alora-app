import { formatPulledAt } from '../lib/dates'

export function FreshnessBadge({
  day,
  pulledAt,
}: {
  day: string | null | undefined
  pulledAt?: string | null
}) {
  if (!day) return null
  return (
    <div className="inline-flex flex-wrap items-center gap-2 border border-line bg-surface px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
      <span>
        Snapshot day: <span className="text-ink">{day}</span>
      </span>
      {pulledAt && <span className="text-muted-dark">Pulled {formatPulledAt(pulledAt)}</span>}
    </div>
  )
}
