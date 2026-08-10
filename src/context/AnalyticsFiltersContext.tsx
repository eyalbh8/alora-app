import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BrandedFilter, GeoFilters } from '../api/types'
import { lastNDaysEnding, TIME_PRESETS, type DateRange } from '../lib/dates'
import { useSnapshots } from './SnapshotContext'

export type FilterBarVariant = 'geo' | 'analytics'

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

interface AnalyticsFiltersState {
  range: DateRange
  setRange: (range: DateRange) => void
  setPresetDays: (days: number) => void
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
  /** Screen-provided option lists + availability; updated via setFilterMeta */
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

  const setPresetDays = useCallback(
    (days: number) => {
      const end = latestDay ?? range.endDate
      setRange(lastNDaysEnding(days, end))
    },
    [latestDay, range.endDate, setRange],
  )

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

  const filters: GeoFilters = useMemo(
    () => ({
      startDate: range.startDate,
      endDate: range.endDate,
      providers,
      topics,
      prompts,
      regions,
      tags,
      branded,
      promptTypes,
      crawlers,
    }),
    [range, providers, topics, prompts, regions, tags, branded, promptTypes, crawlers],
  )

  const setFilterMeta = useCallback(
    (meta: { options?: Partial<FilterOptions>; availability?: Partial<FilterAvailability> }) => {
      if (meta.options) {
        setOptions((prev) => ({
          providers: meta.options?.providers ?? prev.providers,
          topics: meta.options?.topics ?? prev.topics,
          prompts: meta.options?.prompts ?? prev.prompts,
          regions: meta.options?.regions ?? prev.regions,
          tags: meta.options?.tags ?? prev.tags,
          promptTypes: meta.options?.promptTypes ?? prev.promptTypes,
          crawlers: meta.options?.crawlers ?? prev.crawlers,
        }))
      }
      if (meta.availability) {
        setAvailability((prev) => ({ ...prev, ...meta.availability }))
      }
    },
    [],
  )

  const value = useMemo<AnalyticsFiltersState>(
    () => ({
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
      filters,
      options,
      availability,
      setFilterMeta,
    }),
    [
      range,
      setRange,
      setPresetDays,
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

export { TIME_PRESETS }
