import { useEffect } from 'react'
import type { GeoFilters } from '../api/types'
import { useAnalyticsFilters, type FilterAvailability } from '../context/AnalyticsFiltersContext'
import { useGeoMeta } from '../context/GeoMetaContext'
import { useSnapshots } from '../context/SnapshotContext'
import { useApi, type ApiState } from './useApi'

/**
 * Drives a GEO screen from a /geo/* aggregation endpoint when relational fact
 * data exists (geoMode), seeding the filter bar options from /geo/meta.
 * When geoMode is off the screen falls back to its snapshot-based rendering
 * and `data` stays null.
 */
export function useGeoScreenData<T>(
  queryKey: (filters: GeoFilters) => readonly unknown[],
  fetcher: (filters: GeoFilters) => Promise<T>,
  availability?: Partial<FilterAvailability>,
): ApiState<T | null> & { geoMode: boolean; pending: boolean } {
  const { meta, geoMode, loading: geoMetaLoading } = useGeoMeta()
  const { loading: snapshotsLoading } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const state = useApi<T | null>(
    queryKey(filters),
    () => fetcher(filters),
    { enabled: geoMode },
  )

  const pending =
    geoMetaLoading ||
    (geoMode ? state.loading && state.data == null : snapshotsLoading)

  useEffect(() => {
    if (!geoMode || !meta) return
    setFilterMeta({
      options: {
        providers: meta.options.providers,
        topics: meta.options.topics,
        prompts: meta.options.prompts,
        regions: meta.options.regions,
        tags: meta.options.tags,
        promptTypes: meta.options.promptTypes,
      },
      availability: {
        providers: meta.options.providers.length > 0,
        topics: meta.options.topics.length > 0,
        prompts: meta.options.prompts.length > 0,
        regions: meta.options.regions.length > 0,
        tags: meta.options.tags.length > 0,
        branded: true,
        promptTypes: meta.options.promptTypes.length > 0,
        ...availability,
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoMode, meta, setFilterMeta])

  return { ...state, geoMode, pending }
}
