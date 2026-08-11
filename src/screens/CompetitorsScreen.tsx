import { useEffect, useMemo } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { BrandVisibilityChart } from '../components/dashboard/BrandVisibilityChart'
import { CompetitorsListTable } from '../components/competitors/CompetitorsListTable'
import { ShareOfVoiceDonut } from '../components/competitors/ShareOfVoiceDonut'
import { CompetitorsScreenSkeleton } from '../components/ScreenSkeletons'
import { CompetitorHoverProvider } from '../context/CompetitorHoverContext'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  collectFilterOptions,
  detectCompetitorFilterAvailability,
  filterCompetitors,
} from '../lib/snapshots/filter'
import { mergeCompetitors, mergePrompts } from '../lib/snapshots/merge'
import { getGeoCompetitors } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'

export function CompetitorsScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.competitors, getGeoCompetitors)

  const merged = useMemo(() => mergeCompetitors(snapshots), [snapshots])
  const promptsMerged = useMemo(() => mergePrompts(snapshots), [snapshots])

  const ranking = geo.data
    ? geo.data.data.ranking
    : merged.payload?.ranking ?? merged.payload?.competitors ?? []

  useEffect(() => {
    if (geo.geoMode) return
    setFilterMeta({
      options: collectFilterOptions({
        competitors: ranking,
        topics: promptsMerged.topics.payload ?? [],
        prompts: promptsMerged.prompts.payload?.prompts,
      }),
      availability: {
        ...detectCompetitorFilterAvailability(ranking),
        providers: false,
        prompts: false,
        regions: false,
        tags: false,
        branded: false,
        promptTypes: false,
        crawlers: false,
      },
    })
  }, [geo.geoMode, ranking, promptsMerged, setFilterMeta])

  const filtered = geo.data ? ranking : filterCompetitors(ranking, { topics: filters.topics })

  const chartCompetitors = useMemo(
    () =>
      filtered.filter(
        (c) => (c.historicalData?.length ?? 0) > 0 || (c.occurrences ?? 0) > 0,
      ),
    [filtered],
  )

  if (geo.pending) {
    return <CompetitorsScreenSkeleton />
  }
  if (geo.geoMode && geo.error) return <ErrorState message={geo.error} onRetry={geo.retry} />
  if (!geo.data) {
    if (merged.error) return <ErrorState message={merged.error} />
    if (!merged.payload) {
      return <EmptyState title="No competitors snapshot" message="competitors payload was empty." />
    }
  }

  return (
    <CompetitorHoverProvider>
      <div className={`flex flex-col gap-12${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
        <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <ShareOfVoiceDonut competitors={filtered} />
          <BrandVisibilityChart
            competitors={chartCompetitors}
            range={filters}
            subtitle="Percentage of chats mentioning each brand"
            variant="editorial"
          />
        </div>

        <CompetitorsListTable rows={filtered} />
      </div>
    </CompetitorHoverProvider>
  )
}
