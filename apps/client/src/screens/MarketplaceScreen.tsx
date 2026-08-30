import { useMemo } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { CatalogTable } from '../components/marketplace/CatalogTable'
import { CitedSitesTable } from '../components/marketplace/CitedSitesTable'
import { PageLoader } from '../components/loading'
import { getGeoMarketplace } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'

export function MarketplaceScreen() {
  const geo = useGeoScreenData(queryKeys.geo.marketplace, getGeoMarketplace)

  const matches = geo.data?.data.matches ?? []
  const sites = geo.data?.data.sites ?? []
  const citedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of matches) {
      ids.add(row.id)
      if (row.domain) ids.add(row.domain)
    }
    return ids
  }, [matches])

  if (geo.pending) {
    return <PageLoader />
  }
  if (geo.error) return <ErrorState message={geo.error} onRetry={geo.retry} />
  if (!geo.data || sites.length === 0) {
    return (
      <EmptyState
        title="No marketplace sites"
        message="No publishing sites are available in the catalog yet."
      />
    )
  }

  return (
    <div className={`flex flex-col gap-8 md:gap-10 lg:gap-14${geo.loading ? ' opacity-70' : ''}`}>
      <CitedSitesTable rows={matches} />
      <CatalogTable rows={sites} citedIds={citedIds} />
    </div>
  )
}
