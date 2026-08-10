import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useAnalyticsFilters,
  type FilterBarVariant,
} from '../../context/AnalyticsFiltersContext'
import { providerLabel, regionLabel } from '../../lib/format'
import type { BrandedFilter } from '../../api/types'
import { DateRangePicker } from './DateRangePicker'
import { CrawlerIcon } from '../ai-crawlers/CrawlerIcon'
import { ProviderIcon } from '../ProviderIcon'
import { getCrawlerBotDisplayName } from '../../lib/crawlerBots'

function filterChipClass(disabled: boolean, active: boolean, open: boolean): string {
  if (disabled) return 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
  if (active) return 'border-brand-300 bg-brand-50 text-brand-800 hover:border-brand-400'
  if (open) return 'border-brand-300 bg-brand-50/70 text-slate-700 hover:border-brand-400'
  return 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
}

function MultiSelect({
  label,
  values,
  options,
  onChange,
  disabled,
  unavailableReason,
  formatOption = (v: string) => v,
  searchable = false,
  renderOptionLeading,
}: {
  label: string
  values: string[]
  options: Array<{ value: string; label: string }>
  onChange: (next: string[]) => void
  disabled?: boolean
  unavailableReason?: string
  formatOption?: (v: string) => string
  searchable?: boolean
  renderOptionLeading?: (value: string) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, query])

  const resolveLabel = (value: string) => {
    const opt = options.find((o) => String(o.value) === String(value))
    return opt ? String(opt.label) : formatOption(value)
  }

  const hasSelection = values.length > 0 && !disabled
  const selectionTitle = hasSelection ? values.map(resolveLabel).join(', ') : undefined

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        title={
          disabled
            ? unavailableReason || 'Not available in snapshot'
            : selectionTitle
        }
        onClick={() => {
          if (disabled) return
          setOpen((o) => !o)
          if (open) setQuery('')
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${filterChipClass(Boolean(disabled), hasSelection, open)}`}
      >
        <span>{disabled ? `${label} N/A` : label}</span>
        {hasSelection && values.length > 1 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-none text-white">
            {values.length}
          </span>
        )}
        {!disabled && (
          <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        )}
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] max-w-[320px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {searchable && options.length > 6 && (
            <div className="border-b border-slate-100 px-2 py-1.5">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-400"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No matches</p>
            ) : (
              filteredOptions.map((o) => (
                <label
                  key={String(o.value)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={values.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="rounded border-slate-300 text-brand-600"
                  />
                  {renderOptionLeading?.(o.value)}
                  <span className="text-slate-700">{String(o.label)}</span>
                </label>
              ))
            )}
          </div>
          {values.length > 0 && (
            <div className="border-t border-slate-100 px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChipSelect({
  label,
  disabled,
  title,
  active,
  children,
}: {
  label: string
  disabled?: boolean
  title?: string
  active?: boolean
  children?: React.ReactNode
}) {
  return (
    <label
      className={`relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${filterChipClass(Boolean(disabled), Boolean(active), false)}`}
      title={title}
    >
      <span>{label}</span>
      {!disabled && (
        <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      )}
      {!disabled && children}
    </label>
  )
}

function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clear filters"
      aria-label="Clear filters"
      className="inline-flex shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    </button>
  )
}

export function FilterBar({ variant }: { variant: FilterBarVariant }) {
  const {
    range,
    setRange,
    setPresetDays,
    resetDateRange,
    factDays,
    presetEndDay,
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

  const dateMin = factDays?.min ?? undefined
  const dateMax = factDays?.max ?? presetEndDay ?? undefined

  const geo = variant === 'geo'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {geo && (
          <MultiSelect
            label="Providers"
            values={providers}
            options={options.providers.map((p) => ({ value: p, label: providerLabel(p) }))}
            onChange={setProviders}
            disabled={!availability.providers || options.providers.length === 0}
            unavailableReason="Not available in snapshot"
            formatOption={providerLabel}
            renderOptionLeading={(value) => (
              <ProviderIcon provider={value} size="sm" rounded className="shrink-0" />
            )}
          />
        )}

        {geo && (
          <>
            <MultiSelect
              label="Topics"
              values={topics}
              options={options.topics.map((t) => ({ value: t.id, label: t.name }))}
              onChange={setTopics}
              disabled={!availability.topics || options.topics.length === 0}
              unavailableReason="Not available in snapshot"
              searchable
            />
            <MultiSelect
              label="Prompts"
              values={prompts}
              options={options.prompts.map((p) => ({
                value: p.id,
                label: p.text.length > 60 ? `${p.text.slice(0, 57)}…` : p.text,
              }))}
              onChange={setPrompts}
              disabled={!availability.prompts || options.prompts.length === 0}
              unavailableReason="Not available in snapshot"
              searchable
            />
          </>
        )}

        {geo && (
          <MultiSelect
            label="Regions"
            values={regions}
            options={options.regions.map((r) => ({ value: r, label: regionLabel(r) }))}
            onChange={setRegions}
            disabled={!availability.regions || options.regions.length === 0}
            unavailableReason="Not available in snapshot"
            formatOption={regionLabel}
          />
        )}

        {geo && (
          <>
            <MultiSelect
              label="Tags"
              values={tags}
              options={options.tags.map((t) => ({ value: t, label: t }))}
              onChange={setTags}
              disabled={!availability.tags || options.tags.length === 0}
              unavailableReason="Not available in snapshot"
              searchable
            />

            <ChipSelect
              label="Branded"
              active={branded != null}
              title={
                branded === 'AccountIncluded'
                  ? 'Me in prompt'
                  : branded === 'AccountNotIncluded'
                    ? 'Not in prompt'
                    : undefined
              }
            >
              <select
                className="absolute inset-0 cursor-pointer opacity-0"
                value={branded ?? ''}
                onChange={(e) =>
                  setBranded((e.target.value || null) as BrandedFilter)
                }
              >
                <option value="">All</option>
                <option value="AccountIncluded">Me in prompt</option>
                <option value="AccountNotIncluded">Not in prompt</option>
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

        {variant === 'crawlers' && availability.crawlers && (
          <MultiSelect
            label="AI Crawlers"
            values={crawlers}
            options={options.crawlers.map((c) => ({
              value: c,
              label: getCrawlerBotDisplayName(c),
            }))}
            onChange={setCrawlers}
            disabled={options.crawlers.length === 0}
            unavailableReason="Not available in snapshot"
            formatOption={getCrawlerBotDisplayName}
            renderOptionLeading={(value) => (
              <CrawlerIcon bot={value} size="sm" className="shrink-0" />
            )}
          />
        )}

        <DateRangePicker
          range={range}
          endDay={presetEndDay ?? range.endDate}
          minDay={dateMin}
          maxDay={dateMax}
          onChange={setRange}
          onPreset={setPresetDays}
          onResetDefault={resetDateRange}
        />

        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>
    </div>
  )
}
