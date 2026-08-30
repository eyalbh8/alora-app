import { useState, type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { FilterBar } from '../components/filters/FilterBar'
import {
  AnalyticsFiltersProvider,
  type FilterBarVariant,
} from '../context/AnalyticsFiltersContext'
import { ScreenSubheaderProvider } from '../context/ScreenSubheaderContext'

function ScreenTitle({ title }: { title: string }) {
  return <h1 className="screen-title">{title}</h1>
}

function ScreenChrome({
  title,
  variant,
}: {
  title: string
  variant: FilterBarVariant
}) {
  const [subheader, setSubheader] = useState<ReactNode>(null)
  const isCrawlerVariant = variant === 'crawlers'

  return (
    <ScreenSubheaderProvider setSubheader={setSubheader}>
      <div className={`screen-chrome flex flex-col ${isCrawlerVariant ? 'gap-7' : 'gap-4'}`}>
        <ScreenTitle title={title} />
        {subheader}
        <div className="screen-chrome__filters">
          <FilterBar variant={variant} />
        </div>
        <Outlet />
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
