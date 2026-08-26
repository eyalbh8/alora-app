import { providerLabel } from '../lib/format'
import { ProviderIcon } from './ProviderIcon'

export interface ProviderSeriesEntry {
  provider: string
  value: unknown
  color?: string
}

interface ProviderSeriesTooltipProps {
  active?: boolean
  date?: string
  entries?: ProviderSeriesEntry[]
  valueLabel?: string
}

export function ProviderSeriesTooltip({
  active,
  date,
  entries = [],
  valueLabel,
}: ProviderSeriesTooltipProps) {
  if (!active || entries.length === 0) return null

  return (
    <div className="min-w-44 border border-line bg-surface px-3 py-2.5 text-xs ">
      {date && <p className="mb-2 font-semibold text-ink">{date}</p>}
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div key={entry.provider} className="flex items-center gap-2">
            <ProviderIcon provider={entry.provider} size="sm" />
            <span className="min-w-0 flex-1 truncate text-muted">
              {providerLabel(entry.provider)}
            </span>
            <span className="font-medium tabular-nums" style={{ color: entry.color }}>
              {String(entry.value ?? 0)}
              {valueLabel ? ` ${valueLabel}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
