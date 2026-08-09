import { useMemo } from 'react'
import { formatRangeLabel, lastNDaysThroughToday } from '../../lib/dates'
import { ALL_PROVIDERS, PROVIDER_LABELS } from '../../lib/format'
import type { BrandMentionedFilter, Provider } from '../../api/types'
import {
  useAnalyticsFilters,
  type TimeseriesGrain,
} from '../../context/AnalyticsFiltersContext'
import { useBrandKit } from '../../context/BrandKitContext'

const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
}

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 60 days', days: 60 },
  { label: 'Last 90 days', days: 90 },
]

function ChipSelect({
  label,
  valueLabel,
  children,
}: {
  label: string
  valueLabel: string
  children: React.ReactNode
}) {
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm hover:border-slate-300">
      <span className="font-medium text-slate-400">{label}</span>
      <span className="max-w-[140px] truncate font-medium text-slate-700">{valueLabel}</span>
      {children}
    </label>
  )
}

export function AnalyticsFilterBar() {
  const {
    range,
    grain,
    countries,
    providers,
    brandMentioned,
    setRange,
    setGrain,
    setCountries,
    setProviders,
    setBrandMentioned,
    clearFilters,
    hasActiveFilters,
  } = useAnalyticsFilters()
  const { settings } = useBrandKit()

  const regionOptions = settings?.countries?.length
    ? settings.countries
    : Object.keys(COUNTRY_LABELS)

  const selectedPreset = useMemo(() => {
    for (const p of DATE_PRESETS) {
      const candidate = lastNDaysThroughToday(p.days)
      if (
        candidate.start_date === range.start_date &&
        candidate.end_date === range.end_date
      ) {
        return String(p.days)
      }
    }
    return '30'
  }, [range])

  const platformSummary =
    providers.length === ALL_PROVIDERS.length
      ? 'All platforms'
      : providers.length === 0
        ? 'None'
        : providers.length === 1
          ? PROVIDER_LABELS[providers[0]]
          : `${PROVIDER_LABELS[providers[0]]}, +${providers.length - 1}`

  const regionSummary =
    countries.length === 0
      ? 'All regions'
      : countries.length === 1
        ? (COUNTRY_LABELS[countries[0]] ?? countries[0])
        : `${COUNTRY_LABELS[countries[0]] ?? countries[0]}, +${countries.length - 1}`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipSelect label="Date" valueLabel={formatRangeLabel(range)}>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={selectedPreset}
          onChange={(e) => setRange(lastNDaysThroughToday(Number(e.target.value)))}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
      </ChipSelect>

      <ChipSelect label="Frequency" valueLabel={grain === 'daily' ? 'Daily' : 'Weekly'}>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={grain}
          onChange={(e) => setGrain(e.target.value as TimeseriesGrain)}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </ChipSelect>

      <ChipSelect label="Region" valueLabel={regionSummary}>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={countries[0] ?? ''}
          onChange={(e) => setCountries(e.target.value ? [e.target.value] : [])}
        >
          {regionOptions.map((code) => (
            <option key={code} value={code}>
              {COUNTRY_LABELS[code] ?? code}
            </option>
          ))}
        </select>
      </ChipSelect>

      <ChipSelect label="Platforms" valueLabel={platformSummary}>
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={providers.length === ALL_PROVIDERS.length ? 'all' : (providers[0] ?? '')}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'all') setProviders([...ALL_PROVIDERS] as Provider[])
            else setProviders([v as Provider])
          }}
        >
          <option value="all">All platforms</option>
          {ALL_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>
      </ChipSelect>

      <ChipSelect
        label="Prompt Type"
        valueLabel={brandMentioned === 'category' ? 'Category Related' : 'Brand Related'}
      >
        <select
          className="absolute inset-0 cursor-pointer opacity-0"
          value={brandMentioned}
          onChange={(e) => setBrandMentioned(e.target.value as BrandMentionedFilter)}
        >
          <option value="category">Category Related</option>
          <option value="brand">Brand Related</option>
        </select>
      </ChipSelect>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Clear Filters
        </button>
      )}
    </div>
  )
}
