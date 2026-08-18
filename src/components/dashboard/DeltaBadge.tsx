interface DeltaBadgeProps {
  value: number | null | undefined
  /** Percent delta (default) or absolute numeric delta. */
  mode?: 'percent' | 'absolute'
  /** When true, lower/negative values are good (e.g. rank). */
  invert?: boolean
  className?: string
}

export function DeltaBadge({ value, mode = 'percent', invert = false, className = '' }: DeltaBadgeProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-xs text-slate-400">—</span>
  }

  const displayed = Math.round(value)
  const isNeutral = displayed === 0
  const isPositive = invert ? value < 0 : value > 0
  const tone = isNeutral
    ? 'bg-slate-100 text-slate-600'
    : isPositive
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-red-50 text-red-700'

  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓'
  const formatted =
    mode === 'percent'
      ? `${Math.round(Math.abs(value))}%`
      : Math.round(Math.abs(value)).toString()

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${tone} ${className}`}
    >
      {arrow} {formatted}
    </span>
  )
}
