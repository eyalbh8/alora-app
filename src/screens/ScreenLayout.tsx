import { useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { FilterBar } from '../components/filters/FilterBar'
import {
  AnalyticsFiltersProvider,
  type FilterBarVariant,
} from '../context/AnalyticsFiltersContext'
import { useGeoMeta } from '../context/GeoMetaContext'
import { ScreenSubheaderProvider } from '../context/ScreenSubheaderContext'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/LoadingSpinner'
import { useSnapshots } from '../context/SnapshotContext'

function ScreenChrome({
  title,
  variant,
}: {
  title: string
  variant: FilterBarVariant
}) {
  const { loading: snapshotsLoading, error, retry } = useSnapshots()
  const { geoMode, loading: geoMetaLoading } = useGeoMeta()
  const [subheader, setSubheader] = useState<ReactNode>(null)

  const isGeoVariant = variant === 'geo'
  const showLoadingChrome = isGeoVariant
    ? geoMetaLoading || (!geoMode && snapshotsLoading)
    : snapshotsLoading
  const blockOnSnapshotError = !isGeoVariant && Boolean(error) && !snapshotsLoading

  return (
    <ScreenSubheaderProvider setSubheader={setSubheader}>
      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#101414]">{title}</h1>
        {subheader}
        <FilterBar variant={variant} />
        {blockOnSnapshotError ? (
          <ErrorState message={error ?? 'Unable to load snapshots'} onRetry={retry} />
        ) : showLoadingChrome ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </ScreenSubheaderProvider>
  )
}

/** Shared filter state across all GEO screens (Dashboard, Prompts, Mentions, Sentiment, Competitors). */
export function GeoFiltersShell() {
  return (
    <AnalyticsFiltersProvider>
      <Outlet />
    </AnalyticsFiltersProvider>
  )
}

export function GeoScreenLayout({ title }: { title: string }) {
  return <ScreenChrome title={title} variant="geo" />
}

export function AnalyticsScreenLayout({
  title,
  variant,
}: {
  title: string
  variant: Extract<FilterBarVariant, 'traffic' | 'crawlers'>
}) {
  return (
    <AnalyticsFiltersProvider>
      <ScreenChrome title={title} variant={variant} />
    </AnalyticsFiltersProvider>
  )
}
