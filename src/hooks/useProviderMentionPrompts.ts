import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useGeoMeta } from '../context/GeoMetaContext'
import { getGeoProviderMentionPrompts } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useApi } from './useApi'

export function useProviderMentionPrompts(provider: string | null) {
  const { filters } = useAnalyticsFilters()
  const { geoMode } = useGeoMeta()

  return useApi(
    provider ? queryKeys.geo.providerPrompts(provider, filters) : ['geo', 'providerPrompts', 'idle'],
    () =>
      provider
        ? getGeoProviderMentionPrompts(provider, filters)
        : Promise.resolve({ prompts: [] }),
    { enabled: Boolean(provider && geoMode) },
  )
}
