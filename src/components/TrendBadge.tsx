import { formatNumber } from '../lib/format'

interface TrendBadgeProps {
  /** Period-over-period delta. null/undefined renders a neutral dash. */
  value: number | null | undefined
  /** Append a % sign to the delta (for rate metrics). */
  percent?: boolean
  /** For metrics where a decrease is good (e.g. average position). */
  invert?: boolean
}

/** ↑ / ↓ with the delta — green when improving, red when declining, grey when flat/unknown. */
export function TrendBadge({ value, percent = false, invert = false }: TrendBadgeProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="font-mono text-[11px] text-muted-dark">–</span>
  }
  if (value === 0) {
    return (
      <span className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-dark">
        0{percent ? '%' : ''}
      </span>
    )
  }
  const improving = invert ? value < 0 : value > 0
  const arrow = value > 0 ? '↑' : '↓'
  const color = improving ? 'text-accent' : 'text-error'
  return (
    <span className={`font-mono text-[11px] font-medium tracking-[0.08em] ${color}`}>
      {arrow} {formatNumber(Math.abs(value))}
      {percent ? '%' : ''}
    </span>
  )
}
