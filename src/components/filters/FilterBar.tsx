import { useMemo } from 'react'
import {
  TIME_PRESETS,
  useAnalyticsFilters,
  type FilterBarVariant,
} from '../../context/AnalyticsFiltersContext'
import { formatRangeLabel } from '../../lib/dates'
import { providerLabel, regionLabel } from '../../lib/format'
import type { BrandedFilter } from '../../api/types'

function MultiSelect({
  label,
  values,
  options,
  onChange,
  disabled,
  unavailableReason,
  formatOption = (v: string) => v,
}: {
  label: string
  values: string[]
  options: Array<{ value: string; label: string }>
  onChange: (next: string[]) => void
  disabled?: boolean
  unavailableReason?: string
  formatOption?: (v: string) => string
}) {
  const summary =
    values.length === 0
      ? 'All'
      : values.length === 1
        ? formatOption(values[0])
        : `${formatOption(values[0])} +${values.length - 1}`

  return (
    <label
      className={`relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      title={disabled ? unavailableReason || 'Not available in snapshot' : undefined}
    >
      <span className="font-medium text-slate-400">{label}</span>
      <span className="max-w-[140px] truncate font-medium text-slate-700">
        {disabled ? 'N/A' : summary}
      </span>
      {!disabled && (
        <select
          multiple
          className="absolute inset-0 cursor-pointer opacity-0"
          value={values}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
            onChange(selected)
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {String(o.label)}
            </option>
          ))}
        </select>
      )}
    </label>
  )
}

function ChipSelect({
  label,
  valueLabel,
  disabled,
  title,
  children,
}: {
  label: string
  valueLabel: string
  disabled?: boolean
  title?: string
  children?: React.ReactNode
}) {
  return (
    <label
      className={`relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
      title={title}
    >
      <span className="font-medium text-slate-400">{label}</span>
      <span className="max-w-[160px] truncate font-medium text-slate-700">{valueLabel}</span>
      {!disabled && children}
    </label>
  )
}

export function FilterBar({ variant }: { variant: FilterBarVariant }) {
  const {
    range,
    setRange,
    setPresetDays,
    providers,
    setProviders,
    topics,
    setTopics,
    prompts,
    setPrompts,
    regions,
    setRegions,
    tags,
    setTags,
    branded,
    setBranded,
    promptTypes,
    setPromptTypes,
    crawlers,
    setCrawlers,
    clearFilters,
    hasActiveFilters,
    options,
    availability,
  } = useAnalyticsFilters()

  const presetValue = useMemo(() => {
    for (const days of TIME_PRESETS) {
      // Match by span length ending on current endDate
      const start = new Date(`${range.endDate}T00:00:00`)
      start.setDate(start.getDate() - (days - 1))
      const startIso = start.toISOString().slice(0, 10)
      if (startIso === range.startDate) return String(days)
    }
    return 'custom'
  }, [range])

  const geo = variant === 'geo'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ChipSelect label="Time" valueLabel={formatRangeLabel(range)}>
          <select
            className="absolute inset-0 cursor-pointer opacity-0"
            value={presetValue}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'custom') return
              setPresetDays(Number(v))
            }}
          >
            {TIME_PRESETS.map((d) => (
              <option key={d} value={d}>
                Last {d} day{d === 1 ? '' : 's'}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </ChipSelect>

        <label className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">
          <span className="text-slate-400">From</span>
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange({ ...range, startDate: e.target.value })}
            className="border-0 bg-transparent text-slate-700 outline-none"
          />
        </label>
        <label className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm">
          <span className="text-slate-400">To</span>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            onChange={(e) => setRange({ ...range, endDate: e.target.value })}
            className="border-0 bg-transparent text-slate-700 outline-none"
          />
        </label>

        <MultiSelect
          label="Providers"
          values={providers}
          options={options.providers.map((p) => ({ value: p, label: providerLabel(p) }))}
          onChange={setProviders}
          disabled={!availability.providers || options.providers.length === 0}
          unavailableReason="Not available in snapshot"
          formatOption={providerLabel}
        />

        {geo && (
          <>
            <MultiSelect
              label="Topics"
              values={topics}
              options={options.topics.map((t) => ({ value: t.id, label: t.name }))}
              onChange={setTopics}
              disabled={!availability.topics || options.topics.length === 0}
              unavailableReason="Not available in snapshot"
            />
            <MultiSelect
              label="Prompts"
              values={prompts}
              options={options.prompts.map((p) => ({
                value: p.id,
                label: p.text.slice(0, 60),
              }))}
              onChange={setPrompts}
              disabled={!availability.prompts || options.prompts.length === 0}
              unavailableReason="Not available in snapshot"
            />
          </>
        )}

        <MultiSelect
          label={geo ? 'Regions' : 'Countries'}
          values={regions}
          options={options.regions.map((r) => ({ value: r, label: regionLabel(r) }))}
          onChange={setRegions}
          disabled={!availability.regions || options.regions.length === 0}
          unavailableReason="Not available in snapshot"
          formatOption={regionLabel}
        />

        {geo && (
          <>
            <MultiSelect
              label="Tags"
              values={tags}
              options={options.tags.map((t) => ({ value: t, label: t }))}
              onChange={setTags}
              disabled={!availability.tags || options.tags.length === 0}
              unavailableReason="Not available in snapshot"
            />

            <ChipSelect
              label="Branded"
              valueLabel={
                !availability.branded
                  ? 'N/A'
                  : branded === 'AccountIncluded'
                    ? 'Me in prompt'
                    : branded === 'AccountNotIncluded'
                      ? 'Not in prompt'
                      : 'All'
              }
              disabled={!availability.branded}
              title={!availability.branded ? 'Not available in snapshot' : undefined}
            >
              <select
                className="absolute inset-0 cursor-pointer opacity-0"
                value={branded ?? ''}
                onChange={(e) =>
                  setBranded((e.target.value || null) as BrandedFilter)
                }
              >
                <option value="">All</option>
                <option value="AccountIncluded">Account included</option>
                <option value="AccountNotIncluded">Account not included</option>
              </select>
            </ChipSelect>

            <MultiSelect
              label="Prompt types"
              values={promptTypes}
              options={options.promptTypes.map((t) => ({ value: t, label: t }))}
              onChange={setPromptTypes}
              disabled={!availability.promptTypes || options.promptTypes.length === 0}
              unavailableReason="Not available in snapshot"
            />
          </>
        )}

        {variant === 'analytics' && availability.crawlers && (
          <MultiSelect
            label="AI Crawlers"
            values={crawlers}
            options={options.crawlers.map((c) => ({ value: c, label: c }))}
            onChange={setCrawlers}
            disabled={options.crawlers.length === 0}
            unavailableReason="Not available in snapshot"
          />
        )}

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
      <p className="text-[11px] text-slate-400">
        Empty filter = no restriction. Within a type: OR. Across types: AND.
        {presetValue === 'custom' ? ' Custom calendar range selected.' : ''}
      </p>
    </div>
  )
}
