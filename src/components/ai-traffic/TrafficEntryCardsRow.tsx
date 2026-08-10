import { useAnalyticsFilters } from '../../context/AnalyticsFiltersContext'
import { daysInRange, matchActivePresetDays } from '../../lib/dates'
import { formatNumber, providerLabel } from '../../lib/format'
import type { TrafficProviderMetric } from '../../lib/snapshots/aiTraffic'
import { ProviderIcon } from '../ProviderIcon'
import { DeltaBadge } from '../dashboard/DeltaBadge'
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
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {provider ? (
          <ProviderIcon provider={provider} size="sm" showLabel />
        ) : (
          <span className="text-sm font-medium text-slate-700">{title}</span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <span className="text-3xl font-semibold leading-none text-[#101414]">
          {formatNumber(value, 0)}
        </span>
        <DeltaBadge value={change ?? 0} mode="percent" />
      </div>

      <p className="mt-2 text-sm text-slate-500">Entries in the {periodText}</p>
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
    <div className="flex flex-col gap-2 xl:flex-row">
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
