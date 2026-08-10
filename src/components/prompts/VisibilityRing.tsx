import { formatNumber } from '../../lib/format'

interface VisibilityRingProps {
  value: number | null | undefined
  size?: number
}

/** Circular progress ring for visibility percentage (iGEO-style). */
export function VisibilityRing({ value, size = 44 }: VisibilityRingProps) {
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = value == null || Number.isNaN(value) ? null : Math.min(100, Math.max(0, value))
  const offset = pct == null ? circumference : circumference - (pct / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        {pct != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#148f85"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>
      <span className="absolute text-[11px] font-semibold text-[#101414]">
        {pct == null ? '—' : `${formatNumber(pct, 0)}%`}
      </span>
    </div>
  )
}
