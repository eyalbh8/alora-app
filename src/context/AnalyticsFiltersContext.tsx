import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AnalyticsGrain,
  AnalyticsParams,
  BrandKitSettings,
  BrandMentionedFilter,
  Provider,
} from '../api/types'
import type { AnalyticsFilterParams } from '../lib/analytics'
import { analyticsDateParams } from '../lib/analytics'
import { ALL_PROVIDERS } from '../lib/format'
import { lastNDaysThroughToday, type DateRange } from '../lib/dates'
import { useBrandKit } from './BrandKitContext'
import { Skeleton } from '../components/LoadingSpinner'

export type TimeseriesGrain = Extract<AnalyticsGrain, 'daily' | 'weekly'>

export interface AnalyticsFiltersState {
  range: DateRange
  grain: TimeseriesGrain
  countries: string[]
  providers: Provider[]
  brandMentioned: BrandMentionedFilter
  /** Common params for every analytics call (dates + filters). */
  filterParams: AnalyticsFilterParams
  setRange: (range: DateRange) => void
  setGrain: (grain: TimeseriesGrain) => void
  setCountries: (countries: string[]) => void
  setProviders: (providers: Provider[]) => void
  setBrandMentioned: (value: BrandMentionedFilter) => void
  clearFilters: () => void
  /** True when any filter differs from brand-kit defaults. */
  hasActiveFilters: boolean
}

const AnalyticsFiltersContext = createContext<AnalyticsFiltersState | null>(null)

function defaultState(kitCountries: string[]) {
  return {
    // Match AirOps UI: include today. /citations/list allows today;
    // withAnalyticsFilters clamps end_date for /analytics.
    range: lastNDaysThroughToday(30),
    grain: 'daily' as TimeseriesGrain,
    countries: kitCountries.length ? [...kitCountries] : (['US'] as string[]),
    providers: [...ALL_PROVIDERS] as Provider[],
    brandMentioned: 'category' as BrandMentionedFilter,
  }
}

/**
 * Inner provider — only mounted after brand kit settings resolve so countries
 * are seeded once (avoids a second full analytics refetch wave).
 */
function AnalyticsFiltersProviderReady({
  settings,
  children,
}: {
  settings: BrandKitSettings | null
  children: ReactNode
}) {
  const kitCountries = settings?.countries ?? []

  const defaults = useMemo(
    () => defaultState(kitCountries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kitCountries.join(',')],
  )

  const [range, setRange] = useState<DateRange>(() => defaults.range)
  const [grain, setGrain] = useState<TimeseriesGrain>(() => defaults.grain)
  const [countries, setCountries] = useState<string[]>(() => defaults.countries)
  const [providers, setProviders] = useState<Provider[]>(() => defaults.providers)
  const [brandMentioned, setBrandMentioned] = useState<BrandMentionedFilter>(
    () => defaults.brandMentioned,
  )

  const filterParams = useMemo<AnalyticsFilterParams>(() => {
    const params: AnalyticsFilterParams = {
      start_date: range.start_date,
      end_date: range.end_date,
      brand_mentioned: brandMentioned,
    }
    if (providers.length > 0 && providers.length < ALL_PROVIDERS.length) {
      params.providers = providers
    }
    if (countries.length > 0) {
      params.countries = countries
    }
    return params
  }, [range, brandMentioned, providers, countries])

  const clearFilters = useCallback(() => {
    const next = defaultState(kitCountries)
    setRange(next.range)
    setGrain(next.grain)
    setCountries(next.countries)
    setProviders(next.providers)
    setBrandMentioned(next.brandMentioned)
  }, [kitCountries])

  const hasActiveFilters = useMemo(() => {
    const sameCountries =
      countries.length === defaults.countries.length &&
      countries.every((c) => defaults.countries.includes(c))
    const sameProviders = providers.length === ALL_PROVIDERS.length
    return (
      !sameCountries ||
      !sameProviders ||
      brandMentioned !== 'category' ||
      grain !== 'daily' ||
      range.start_date !== defaults.range.start_date ||
      range.end_date !== defaults.range.end_date
    )
  }, [countries, providers, brandMentioned, grain, range, defaults])

  const value = useMemo<AnalyticsFiltersState>(
    () => ({
      range,
      grain,
      countries,
      providers,
      brandMentioned,
      filterParams,
      setRange,
      setGrain,
      setCountries,
      setProviders,
      setBrandMentioned,
      clearFilters,
      hasActiveFilters,
    }),
    [
      range,
      grain,
      countries,
      providers,
      brandMentioned,
      filterParams,
      clearFilters,
      hasActiveFilters,
    ],
  )

  return (
    <AnalyticsFiltersContext.Provider value={value}>{children}</AnalyticsFiltersContext.Provider>
  )
}

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const { settings, loading } = useBrandKit()

  // Wait for brand kit so filter defaults (countries) are correct on first fetch.
  if (loading && !settings) {
    return (
      <div className="flex flex-col gap-3 py-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-full max-w-3xl" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <AnalyticsFiltersProviderReady settings={settings}>{children}</AnalyticsFiltersProviderReady>
  )
}

export function useAnalyticsFilters(): AnalyticsFiltersState {
  const ctx = useContext(AnalyticsFiltersContext)
  if (!ctx) {
    throw new Error('useAnalyticsFilters must be used within AnalyticsFiltersProvider')
  }
  return ctx
}

/** Convenience: merge shared filters into a getAnalytics call.
 * Clamps end_date to yesterday — /analytics rejects today/future dates.
 */
export function withAnalyticsFilters(
  filters: AnalyticsFilterParams,
  rest: Omit<AnalyticsParams, keyof AnalyticsFilterParams>,
): AnalyticsParams {
  const { start_date, end_date, ...filterRest } = filters
  const dates = analyticsDateParams({ start_date, end_date })
  return { ...filterRest, ...dates, ...rest }
}
