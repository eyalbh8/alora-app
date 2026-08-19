import { useAnalyticsFilters } from '../../context/AnalyticsFiltersContext'
import { daysInRange, matchActivePresetDays } from '../../lib/dates'
import { formatNumber, providerLabel } from '../../lib/format'
import type { TrafficProviderMetric } from '../../lib/snapshots/aiTraffic'
import { ProviderIcon } from '../ProviderIcon'
import { AI_TRAFFIC_PROVIDER_ORDER } from './constants'

function periodLabel(
  startDate: string,
  endDate: string,
  endDay: string,
  minDay?: string | null,
): string {
  const days = daysInRange({ startDate, endDate })
  const preset = matchActivePresetDays({ startDate, endDate }, endDay, minDay)
  if (preset === 1) return 'last 24 hours'
  if (preset) return `last ${preset} days`
  return `selected period (${days} days)`
}

interface EntryCardProps {
  title: string
  value: number
  change: number | null
  periodText: string
  provider?: string
}

function EntryCard({ title, value, change, periodText, provider }: EntryCardProps) {
  const isNeutral = change === 0
  const isPositive = change !== null && change > 0
  const trendTone =
    change === null || isNeutral ? 'text-muted' : isPositive ? 'text-accent' : 'text-[#e07a6a]'
  const trendArrow = isNeutral ? '→' : isPositive ? '↑' : '↓'

  return (
    <div className="flex min-w-0 flex-col border-b border-r border-line px-5 py-5">
      <div className="mb-3 flex min-h-5 items-center gap-2">
        {provider ? (
          <>
            <ProviderIcon provider={provider} size="sm" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-dark">
              {providerLabel(provider)}
            </span>
          </>
        ) : (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-dark">
            {title}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
          {formatNumber(value, 0)}
        </span>
        <span className={`pb-0.5 text-[11.5px] font-medium ${trendTone}`}>
          {change === null ? '—' : `${trendArrow} ${Math.round(Math.abs(change))}%`}
        </span>
      </div>

      <p className="mt-2 text-[11.5px] text-muted">Entries in the {periodText}</p>
    </div>
  )
}

interface TrafficEntryCardsRowProps {
  totalEntries: number
  totalChange: number | null
  providers: TrafficProviderMetric[]
}

export function TrafficEntryCardsRow({
  totalEntries,
  totalChange,
  providers,
}: TrafficEntryCardsRowProps) {
  const { filters, presetEndDay, factDays } = useAnalyticsFilters()
  const periodText = periodLabel(
    filters.startDate,
    filters.endDate,
    presetEndDay ?? filters.endDate,
    factDays?.min,
  )

  const providerByKey = new Map(providers.map((p) => [p.provider, p]))

  return (
    <div className="grid grid-cols-1 border-t border-t-ink sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <EntryCard
        title="Total entries"
        value={totalEntries}
        change={totalChange}
        periodText={periodText}
      />
      {AI_TRAFFIC_PROVIDER_ORDER.map((provider) => {
        const metric = providerByKey.get(provider) ?? {
          provider,
          count: 0,
          change: 0,
          historicalData: [],
        }
        return (
          <EntryCard
            key={provider}
            title={providerLabel(provider)}
            value={metric.count}
            change={metric.change}
            periodText={periodText}
            provider={provider}
          />
        )
      })}
    </div>
  )
}
