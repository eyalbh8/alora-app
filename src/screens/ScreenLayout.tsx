import { Outlet } from 'react-router-dom'
import { FilterBar } from '../components/filters/FilterBar'
import {
  AnalyticsFiltersProvider,
  type FilterBarVariant,
} from '../context/AnalyticsFiltersContext'
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
  const { loading, error, retry } = useSnapshots()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#101414]">{title}</h1>
      <FilterBar variant={variant} />
      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  )
}

export function GeoScreenLayout({ title }: { title: string }) {
  return (
    <AnalyticsFiltersProvider>
      <ScreenChrome title={title} variant="geo" />
    </AnalyticsFiltersProvider>
  )
}

export function AnalyticsScreenLayout({ title }: { title: string }) {
  return (
    <AnalyticsFiltersProvider>
      <ScreenChrome title={title} variant="analytics" />
    </AnalyticsFiltersProvider>
  )
}
