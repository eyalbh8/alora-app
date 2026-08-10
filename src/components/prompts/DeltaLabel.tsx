import { formatNumber } from '../../lib/format'

interface DeltaLabelProps {
  value: number | null | undefined
  percent?: boolean
  invert?: boolean
}

/** Compact +/- delta shown below a metric value. */
export function DeltaLabel({ value, percent = true, invert = false }: DeltaLabelProps) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-[11px] text-slate-300">—</span>
  }
  if (value === 0) {
    return <span className="text-[11px] text-slate-400">0{percent ? '%' : ''}</span>
  }
  const improving = invert ? value < 0 : value > 0
  const sign = value > 0 ? '+' : '−'
  const color = improving ? 'text-brand-600' : 'text-red-500'
  return (
    <span className={`text-[11px] font-medium ${color}`}>
      {sign}
      {formatNumber(Math.abs(value))}
      {percent ? '%' : ''}
    </span>
  )
}
