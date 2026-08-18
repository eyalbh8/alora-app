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
    return <span className="font-mono text-[11px] text-muted-dark">—</span>
  }

  const displayed = Math.round(value)
  const isNeutral = displayed === 0
  const isPositive = invert ? value < 0 : value > 0
  const tone = isNeutral ? 'text-muted-dark' : isPositive ? 'text-accent' : 'text-error'

  const arrow = isNeutral ? '→' : isPositive ? '↑' : '↓'
  const formatted =
    mode === 'percent'
      ? `${Math.round(Math.abs(value))}%`
      : Math.round(Math.abs(value)).toString()

  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] font-medium tracking-[0.1em] uppercase ${tone} ${className}`}
    >
      {arrow} {formatted}
    </span>
  )
}
