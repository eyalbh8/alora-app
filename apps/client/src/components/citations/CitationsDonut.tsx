import { useMemo } from 'react'
import type { CitationTypeCount } from '../../api/geo'
import { formatNumber } from '../../lib/format'
import { useCitationHover } from './CitationHoverContext'
import { humanizeType, typeColor } from './constants'

interface CitationsDonutProps {
  title: string
  total: number
  segments: CitationTypeCount[]
}

export function CitationsDonut({ title, total, segments }: CitationsDonutProps) {
  const rows = useMemo(
    () =>
      [...segments]
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((row, index) => ({
          ...row,
          label: humanizeType(row.type),
          color: typeColor(row.type, index),
        })),
    [segments],
  )
  const { setHoveredType, isLit } = useCitationHover()
  const sum = rows.reduce((acc, row) => acc + row.count, 0) || total
  const radius = 54
  const stroke = 14
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <section aria-labelledby="citations-donut-title">
      <h2 id="citations-donut-title" className="text-[17px] font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-5 flex items-center gap-6">
        <div className="relative h-[148px] w-[148px] shrink-0">
          <svg viewBox="0 0 148 148" className="h-full w-full -rotate-90" aria-hidden>
            <circle
              cx="74"
              cy="74"
              r={radius}
              fill="none"
              stroke="var(--color-line, #e5e5e5)"
              strokeWidth={stroke}
            />
            {rows.map((row) => {
              const length = sum > 0 ? (row.count / sum) * circumference : 0
              const dash = `${length} ${circumference - length}`
              const lit = isLit(row.type)
              const circle = (
                <circle
                  key={row.type}
                  cx="74"
                  cy="74"
                  r={radius}
                  fill="none"
                  stroke={row.color}
                  strokeWidth={lit ? stroke + 1 : stroke}
                  strokeOpacity={lit ? 1 : 0.22}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  className="cursor-pointer transition-[stroke-opacity,stroke-width]"
                  onMouseEnter={() => setHoveredType(row.type)}
                  onMouseLeave={() => setHoveredType(null)}
                />
              )
              offset += length
              return circle
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-medium leading-none tracking-tight text-ink tabular-nums">
              {formatNumber(total, 0)}
            </span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {rows.length === 0 ? (
            <li className="text-sm text-muted">No citation types for this period.</li>
          ) : (
            rows.map((row) => {
              const lit = isLit(row.type)
              return (
                <li key={row.type}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 text-left text-[13px] transition-opacity ${
                      lit ? 'opacity-100' : 'opacity-30'
                    }`}
                    onMouseEnter={() => setHoveredType(row.type)}
                    onMouseLeave={() => setHoveredType(null)}
                    onFocus={() => setHoveredType(row.type)}
                    onBlur={() => setHoveredType(null)}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <span className="min-w-0 flex-1 truncate text-muted">{row.label}</span>
                    <span className="tabular-nums text-ink">{formatNumber(row.count, 0)}</span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </section>
  )
}
