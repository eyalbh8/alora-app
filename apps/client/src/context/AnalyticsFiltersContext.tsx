import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BrandedFilter, GeoFilters } from '../api/types'
import {
  lastNDaysEnding,
  matchActivePresetDays,
  presetRange,
  yesterdayISO,
  DEFAULT_TIME_PRESET_DAYS,
  type DateRange,
} from '../lib/dates'
import { useGeoMeta } from './GeoMetaContext'
import { useSnapshots } from './SnapshotContext'

export type FilterBarVariant = 'geo' | 'traffic' | 'crawlers'

export interface FilterAvailability {
  providers: boolean
  topics: boolean
  prompts: boolean
  regions: boolean
  tags: boolean
  branded: boolean
  promptTypes: boolean
  crawlers: boolean
}

export interface FilterOptions {
  providers: string[]
  topics: Array<{ id: string; name: string }>
  prompts: Array<{ id: string; text: string }>
  regions: string[]
  tags: string[]
  promptTypes: string[]
  crawlers: string[]
}

export interface FactDayBounds {
  min: string | null
  max: string | null
}

interface AnalyticsFiltersState {
  range: DateRange
  setRange: (range: DateRange) => void
  setPresetDays: (days: number) => void
  resetDateRange: () => void
  factDays: FactDayBounds | null
  presetEndDay: string | null
  providers: string[]
  setProviders: (v: string[]) => void
  topics: string[]
  setTopics: (v: string[]) => void
  prompts: string[]
  setPrompts: (v: string[]) => void
  regions: string[]
  setRegions: (v: string[]) => void
  tags: string[]
  setTags: (v: string[]) => void
  branded: BrandedFilter
  setBranded: (v: BrandedFilter) => void
  promptTypes: string[]
  setPromptTypes: (v: string[]) => void
  crawlers: string[]
  setCrawlers: (v: string[]) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  filters: GeoFilters
  options: FilterOptions
  availability: FilterAvailability
  setFilterMeta: (meta: { options?: Partial<FilterOptions>; availability?: Partial<FilterAvailability> }) => void
}

const EMPTY_OPTIONS: FilterOptions = {
  providers: [],
  topics: [],
  prompts: [],
  regions: [],
  tags: [],
  promptTypes: [],
  crawlers: [],
}

const ALL_AVAILABLE: FilterAvailability = {
  providers: true,
  topics: true,
  prompts: true,
  regions: true,
  tags: true,
  branded: true,
  promptTypes: true,
  crawlers: true,
}

const AnalyticsFiltersContext = createContext<AnalyticsFiltersState | null>(null)

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const { range, setRange, latestDay } = useSnapshots()
  const { meta, geoMode } = useGeoMeta()

  const [providers, setProviders] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [prompts, setPrompts] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [branded, setBranded] = useState<BrandedFilter>(null)
  const [promptTypes, setPromptTypes] = useState<string[]>([])
  const [crawlers, setCrawlers] = useState<string[]>([])
  const [options, setOptions] = useState<FilterOptions>(EMPTY_OPTIONS)
  const [availability, setAvailability] = useState<FilterAvailability>(ALL_AVAILABLE)

  const factDays = geoMode ? (meta?.factDays ?? null) : null
  const presetEndDay = factDays?.max ?? latestDay ?? yesterdayISO()
  const geoRangeInitialized = useRef(false)

  // Default geo range to last 7 days ending on latest fact day (once).
  useEffect(() => {
    if (!geoMode || !factDays?.max || geoRangeInitialized.current) return
    geoRangeInitialized.current = true
    setRange(lastNDaysEnding(7, factDays.max))
  }, [geoMode, factDays?.max, setRange])

  // Clamp custom range to available fact days in geo mode.
  useEffect(() => {
    if (!geoMode || !factDays?.max) return
    const { min, max } = factDays
    let { startDate, endDate } = range
    let changed = false
    if (endDate > max) {
      endDate = max
      changed = true
    }
    if (min && startDate < min) {
      startDate = min
      changed = true
    }
    if (startDate > endDate) {
      startDate = endDate
      changed = true
    }
    if (changed) setRange({ startDate, endDate })
  }, [geoMode, factDays, range, setRange])

  const setPresetDays = useCallback(
    (days: number) => {
      setRange(presetRange(days, presetEndDay, factDays?.min))
    },
    [presetEndDay, factDays?.min, setRange],
  )

  const resetDateRange = useCallback(() => {
    setRange(presetRange(DEFAULT_TIME_PRESET_DAYS, presetEndDay, factDays?.min))
  }, [presetEndDay, factDays?.min, setRange])

  const clearFilters = useCallback(() => {
    setProviders([])
    setTopics([])
    setPrompts([])
    setRegions([])
    setTags([])
    setBranded(null)
    setPromptTypes([])
    setCrawlers([])
  }, [])

  // Drop selections that no longer exist in the current option lists.
  useEffect(() => {
    const topicIds = new Set(options.topics.map((t) => String(t.id)))
    const promptIds = new Set(options.prompts.map((p) => String(p.id)))
    const providerSet = new Set(options.providers)
    const regionSet = new Set(options.regions)
    const tagSet = new Set(options.tags)
    const typeSet = new Set(options.promptTypes)

    setProviders((prev) => (prev.length && providerSet.size ? prev.filter((v) => providerSet.has(v)) : prev))
    setTopics((prev) => (prev.length && topicIds.size ? prev.filter((v) => topicIds.has(String(v))) : prev))
    setPrompts((prev) => (prev.length && promptIds.size ? prev.filter((v) => promptIds.has(String(v))) : prev))
    setRegions((prev) => (prev.length && regionSet.size ? prev.filter((v) => regionSet.has(v)) : prev))
    setTags((prev) => (prev.length && tagSet.size ? prev.filter((v) => tagSet.has(v)) : prev))
    setPromptTypes((prev) => (prev.length && typeSet.size ? prev.filter((v) => typeSet.has(v)) : prev))
  }, [options])

  const hasActiveFilters = useMemo(
    () =>
      providers.length > 0 ||
      topics.length > 0 ||
      prompts.length > 0 ||
      regions.length > 0 ||
      tags.length > 0 ||
      branded != null ||
      promptTypes.length > 0 ||
      crawlers.length > 0,
    [providers, topics, prompts, regions, tags, branded, promptTypes, crawlers],
  )

  const rangeDays = useMemo(
    () => matchActivePresetDays(range, presetEndDay, factDays?.min),
    [range, presetEndDay, factDays?.min],
  )

  const filters: GeoFilters = useMemo(
    () => ({
      startDate: range.startDate,
      endDate: range.endDate,
      rangeDays,
      providers,
      topics,
      prompts,
      regions,
      tags,
      branded,
      promptTypes,
      crawlers,
    }),
    [range, rangeDays, providers, topics, prompts, regions, tags, branded, promptTypes, crawlers],
  )

  const setFilterMeta = useCallback(
    (metaUpdate: { options?: Partial<FilterOptions>; availability?: Partial<FilterAvailability> }) => {
      if (metaUpdate.options) {
        setOptions((prev) => ({
          providers: metaUpdate.options?.providers ?? prev.providers,
          topics: metaUpdate.options?.topics ?? prev.topics,
          prompts: metaUpdate.options?.prompts ?? prev.prompts,
          regions: metaUpdate.options?.regions ?? prev.regions,
          tags: metaUpdate.options?.tags ?? prev.tags,
          promptTypes: metaUpdate.options?.promptTypes ?? prev.promptTypes,
          crawlers: metaUpdate.options?.crawlers ?? prev.crawlers,
        }))
      }
      if (metaUpdate.availability) {
        setAvailability((prev) => ({ ...prev, ...metaUpdate.availability }))
      }
    },
    [],
  )

  const value = useMemo<AnalyticsFiltersState>(
    () => ({
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
      filters,
      options,
      availability,
      setFilterMeta,
    }),
    [
      range,
      setRange,
      setPresetDays,
      resetDateRange,
      factDays,
      presetEndDay,
      providers,
      topics,
      prompts,
      regions,
      tags,
      branded,
      promptTypes,
      crawlers,
      clearFilters,
      hasActiveFilters,
      filters,
      options,
      availability,
      setFilterMeta,
    ],
  )

  return (
    <AnalyticsFiltersContext.Provider value={value}>{children}</AnalyticsFiltersContext.Provider>
  )
}

export function useAnalyticsFilters(): AnalyticsFiltersState {
  const ctx = useContext(AnalyticsFiltersContext)
  if (!ctx) throw new Error('useAnalyticsFilters must be used within AnalyticsFiltersProvider')
  return ctx
}

export { TIME_PRESETS, DEFAULT_TIME_PRESET_DAYS } from '../lib/dates'
