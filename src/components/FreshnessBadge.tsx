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
    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
      <span>
        Snapshot day: <span className="font-semibold text-slate-800">{day}</span>
      </span>
      {pulledAt && (
        <span className="text-slate-400">Pulled {formatPulledAt(pulledAt)}</span>
      )}
    </div>
  )
}
