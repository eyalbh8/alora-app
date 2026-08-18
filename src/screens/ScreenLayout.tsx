import { useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { FilterBar } from '../components/filters/FilterBar'
import {
  AnalyticsFiltersProvider,
  type FilterBarVariant,
} from '../context/AnalyticsFiltersContext'
import { useGeoMeta } from '../context/GeoMetaContext'
import { ScreenSubheaderProvider } from '../context/ScreenSubheaderContext'
import { Skeleton } from '../components/LoadingSpinner'

function GhostTitle({ title }: { title: string }) {
  const space = title.indexOf(' ')
  if (space === -1) {
    return <h1 className="screen-title">{title}</h1>
  }
  return (
    <h1 className="screen-title">
      <span>{title.slice(0, space)}</span>{' '}
      <span className="screen-title__rest">{title.slice(space + 1)}</span>
    </h1>
  )
}

function ScreenChrome({
  title,
  variant,
}: {
  title: string
  variant: FilterBarVariant
}) {
  const { loading: geoMetaLoading } = useGeoMeta()
  const [subheader, setSubheader] = useState<ReactNode>(null)

  const isGeoVariant = variant === 'geo'
  const showLoadingChrome = isGeoVariant && geoMetaLoading
  const isCrawlerVariant = variant === 'crawlers'

  return (
    <ScreenSubheaderProvider setSubheader={setSubheader}>
      <div className={`flex flex-col ${isCrawlerVariant ? 'gap-7' : 'gap-4'}`}>
        <GhostTitle title={title} />
        {subheader}
        <FilterBar variant={variant} />
        {showLoadingChrome ? (
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
