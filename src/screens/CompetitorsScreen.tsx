import { useMemo } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { BrandVisibilityChart } from '../components/dashboard/BrandVisibilityChart'
import { CompetitorsListTable } from '../components/competitors/CompetitorsListTable'
import { ShareOfVoiceDonut } from '../components/competitors/ShareOfVoiceDonut'
import { CompetitorsScreenSkeleton } from '../components/ScreenSkeletons'
import { CompetitorHoverProvider } from '../context/CompetitorHoverContext'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { getGeoCompetitors } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'

export function CompetitorsScreen() {
  const { filters } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.competitors, getGeoCompetitors)

  const ranking = geo.data?.data.ranking ?? []

  const chartCompetitors = useMemo(
    () =>
      ranking.filter(
        (c) => (c.historicalData?.length ?? 0) > 0 || (c.occurrences ?? 0) > 0,
      ),
    [ranking],
  )

  if (geo.pending) {
    return <CompetitorsScreenSkeleton />
  }
  if (geo.error) return <ErrorState message={geo.error} onRetry={geo.retry} />
  if (!geo.data) {
    return <EmptyState title="No competitors" message="No competitor ranking for this range." />
  }

  return (
    <CompetitorHoverProvider>
      <div className={`flex flex-col gap-12${geo.loading ? ' opacity-70' : ''}`}>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <ShareOfVoiceDonut competitors={ranking} />
          <BrandVisibilityChart
            competitors={chartCompetitors}
            range={filters}
            subtitle="Percentage of chats mentioning each brand"
            variant="editorial"
          />
        </div>

        <CompetitorsListTable rows={ranking} />
      </div>
    </CompetitorHoverProvider>
  )
}
