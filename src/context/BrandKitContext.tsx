import { createContext, useContext, type ReactNode } from 'react'
import { getBrandKitSettings } from '../api/airops'
import type { BrandKitSettings } from '../api/types'
import { useApi } from '../hooks/useApi'

interface BrandKitContextValue {
  settings: BrandKitSettings | null
  loading: boolean
  error: string | null
  retry: () => void
}

const BrandKitContext = createContext<BrandKitContextValue>({
  settings: null,
  loading: true,
  error: null,
  retry: () => {},
})

/** Fetches brand kit settings once and shares them app-wide (header, competitor labels, etc.). */
export function BrandKitProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, retry } = useApi(getBrandKitSettings, [])
  return (
    <BrandKitContext.Provider value={{ settings: data, loading, error, retry }}>
      {children}
    </BrandKitContext.Provider>
  )
}

export function useBrandKit(): BrandKitContextValue {
  return useContext(BrandKitContext)
}
