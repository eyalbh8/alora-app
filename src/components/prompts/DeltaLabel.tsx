import { formatNumber } from '../../lib/format'

interface DeltaLabelProps {
  value: number | null | undefined
  percent?: boolean
  invert?: boolean
}

/** Compact +/- delta shown below a metric value. */
export function DeltaLabel({ value, percent = true, invert = false }: DeltaLabelProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-[10px] text-[#b8b1a7]">—</span>
  }
  if (value === 0) {
    return <span className="text-[10px] text-[#8b857c]">0{percent ? '%' : ''}</span>
  }
  const improving = invert ? value < 0 : value > 0
  const sign = value > 0 ? '+' : '−'
  const color = improving ? 'text-brand-700' : 'text-rose-600'
  return (
    <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
      {sign}
      {formatNumber(Math.abs(value))}
      {percent ? '%' : ''}
    </span>
  )
}
