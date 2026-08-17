import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGeoMeta, type GeoMeta } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useAccountStore } from '../store/useAccountStore'

interface GeoMetaContextValue {
  /** null while loading or when the endpoint is unavailable */
  meta: GeoMeta | null
  loading: boolean
  error: string | null
  /** true when relational fact data exists and /geo/* endpoints should drive the GEO screens */
  geoMode: boolean
}

const GeoMetaContext = createContext<GeoMetaContextValue>({
  meta: null,
  loading: true,
  error: null,
  geoMode: false,
})

export function GeoMetaProvider({ children }: { children: ReactNode }) {
  const { selectedAccount } = useAccountStore()
  
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.geo.meta(selectedAccount?.id),
    queryFn: getGeoMeta,
    staleTime: 30 * 60 * 1000,
    retry: false,
    enabled: Boolean(selectedAccount),
  })

  const errorMessage =
    error instanceof Error ? error.message : error ? String(error) : null

  return (
    <GeoMetaContext.Provider
      value={{
        meta: data ?? null,
        loading: isLoading,
        error: errorMessage,
        geoMode: Boolean(data?.hasFacts),
      }}
    >
      {children}
    </GeoMetaContext.Provider>
  )
}

export function useGeoMeta(): GeoMetaContextValue {
  return useContext(GeoMetaContext)
}
