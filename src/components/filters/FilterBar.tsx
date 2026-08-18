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

const FILTER_CHIP_BASE =
  'inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[11px] font-medium leading-[1.7] tracking-[0.1em] uppercase transition-colors'

function filterChipClass(disabled: boolean, active: boolean, open: boolean): string {
  if (disabled) return 'cursor-not-allowed border-line bg-surface text-muted-dark'
  if (active) return 'border-ink bg-surface text-ink hover:border-ink'
  if (open) return 'border-ink bg-paper-soft text-ink hover:border-ink'
  return 'border-line bg-surface text-muted hover:border-ink'
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
  fullWidth = false,
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
  fullWidth?: boolean
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
    const selected = values.some((v) => String(v) === String(value))
    onChange(selected ? values.filter((v) => String(v) !== String(value)) : [...values, value])
  }

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? 'w-full' : ''}`}>
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
        className={`${FILTER_CHIP_BASE} ${
          fullWidth ? 'w-full justify-between' : ''
        } ${filterChipClass(Boolean(disabled), hasSelection, open)}`}
      >
        <span>{disabled ? `${label} N/A` : label}</span>
        {hasSelection && values.length > 1 && (
          <span className="flex h-4 min-w-4 items-center justify-center bg-accent px-1 font-mono text-[10px] font-medium leading-none text-button-ink">
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
        <div
          className={`absolute left-0 top-full z-50 mt-1 border border-line bg-paper-soft py-1 ${
            fullWidth ? 'w-full max-w-none' : 'min-w-[220px] max-w-[320px]'
          }`}
        >
          {searchable && options.length > 6 && (
            <div className="form-field border-b border-line px-2 py-1.5">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="min-h-9"
              />
            </div>
          )}
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 font-mono text-[11px] text-muted-dark uppercase">No matches</p>
            ) : (
              filteredOptions.map((o) => (
                <label
                  key={String(o.value)}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-surface"
                >
                  <input
                    type="checkbox"
                    checked={values.some((v) => String(v) === String(o.value))}
                    onChange={() => toggle(o.value)}
                    className="accent-accent"
                  />
                  {renderOptionLeading?.(o.value)}
                  <span className="text-ink">{String(o.label)}</span>
                </label>
              ))
            )}
          </div>
          {values.length > 0 && (
            <div className="border-t border-line px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-link"
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

function SingleSelect({
  label,
  value,
  options,
  onChange,
  fullWidth = false,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (next: string) => void
  fullWidth?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const hasSelection = value !== ''
  const selectedLabel = options.find((o) => o.value === value)?.label

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <button
        type="button"
        title={hasSelection ? selectedLabel : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`${FILTER_CHIP_BASE} ${
          fullWidth ? 'w-full justify-between' : ''
        } ${filterChipClass(false, hasSelection, open)}`}
      >
        <span>{label}</span>
        <svg className="h-3 w-3 shrink-0 opacity-60" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-50 mt-1 border border-line bg-paper-soft py-1 ${
            fullWidth ? 'w-full max-w-none' : 'min-w-[220px] max-w-[320px]'
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value || 'all'}
              type="button"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={`flex w-full cursor-pointer items-center px-3 py-1.5 text-left text-[13px] hover:bg-surface ${
                o.value === value ? 'text-ink' : 'text-muted'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clear filters"
      aria-label="Clear filters"
      className="inline-flex shrink-0 items-center justify-center text-muted transition-colors hover:text-ink"
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

  const [sheetOpen, setSheetOpen] = useState(false)

  const dateMin = factDays?.min ?? undefined
  const dateMax = factDays?.max ?? presetEndDay ?? undefined

  const geo = variant === 'geo'
  const hasCollapsibleFilters = geo || (variant === 'crawlers' && availability.crawlers)

  const activeCount = useMemo(
    () =>
      [
        providers.length > 0,
        topics.length > 0,
        prompts.length > 0,
        regions.length > 0,
        tags.length > 0,
        branded != null,
        promptTypes.length > 0,
        crawlers.length > 0,
      ].filter(Boolean).length,
    [providers, topics, prompts, regions, tags, branded, promptTypes, crawlers],
  )

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (media.matches) setSheetOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!sheetOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [sheetOpen])

  const renderDatePicker = () => (
    <DateRangePicker
      range={range}
      endDay={presetEndDay ?? range.endDate}
      minDay={dateMin}
      maxDay={dateMax}
      onChange={setRange}
      onPreset={setPresetDays}
      onResetDefault={resetDateRange}
    />
  )

  const filterControls = (fullWidth: boolean) => (
    <>
      {geo && (
        <MultiSelect
          label="Providers"
          values={providers}
          options={options.providers.map((p) => ({ value: p, label: providerLabel(p) }))}
          onChange={setProviders}
          disabled={!availability.providers || options.providers.length === 0}
          unavailableReason="Not available in snapshot"
          formatOption={providerLabel}
          fullWidth={fullWidth}
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
            fullWidth={fullWidth}
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
            fullWidth={fullWidth}
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
          fullWidth={fullWidth}
        />
      )}

      {geo && (
        <MultiSelect
          label="Tags"
          values={tags}
          options={options.tags.map((t) => ({ value: t, label: t }))}
          onChange={setTags}
          disabled={!availability.tags || options.tags.length === 0}
          unavailableReason="No tags yet — add them on a prompt"
          searchable
          fullWidth={fullWidth}
        />
      )}

      {geo && (
        <>
          <SingleSelect
            label="Branded"
            value={branded ?? ''}
            options={[
              { value: '', label: 'All' },
              { value: 'AccountIncluded', label: 'Me in prompt' },
              { value: 'AccountNotIncluded', label: 'Not in prompt' },
            ]}
            onChange={(next) => setBranded((next || null) as BrandedFilter)}
            fullWidth={fullWidth}
          />

          <MultiSelect
            label="Prompt types"
            values={promptTypes}
            options={options.promptTypes.map((t) => ({ value: t, label: t }))}
            onChange={setPromptTypes}
            disabled={!availability.promptTypes || options.promptTypes.length === 0}
            unavailableReason="Not available in snapshot"
            fullWidth={fullWidth}
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
          fullWidth={fullWidth}
          renderOptionLeading={(value) => (
            <CrawlerIcon bot={value} size="sm" className="shrink-0" />
          )}
        />
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {filterControls(false)}
        {renderDatePicker()}
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        {renderDatePicker()}
        {hasCollapsibleFilters && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`${FILTER_CHIP_BASE} ${filterChipClass(false, activeCount > 0, sheetOpen)}`}
          >
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center bg-accent px-1 font-mono text-[10px] font-medium leading-none text-button-ink">
                {activeCount}
              </span>
            )}
          </button>
        )}
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-bg/80"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col border-t border-line bg-bg">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="eyebrow mb-0">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="text-link"
              >
                Done
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto px-4 py-4">
              {filterControls(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
