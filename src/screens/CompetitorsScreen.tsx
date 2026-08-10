import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { BrandVisibilityChart } from '../components/dashboard/BrandVisibilityChart'
import { CompetitorTabs, type CompetitorTab } from '../components/competitors/CompetitorTabs'
import { CompetitorsListTable } from '../components/competitors/CompetitorsListTable'
import { ShareOfVoiceDonut } from '../components/competitors/ShareOfVoiceDonut'
import { CompetitorsScreenSkeleton } from '../components/ScreenSkeletons'
import { CompetitorHoverProvider } from '../context/CompetitorHoverContext'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useScreenSubheader } from '../context/ScreenSubheaderContext'
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
  const [activeTab, setActiveTab] = useState<CompetitorTab>('overview')
  const geo = useGeoScreenData(queryKeys.geo.competitors, getGeoCompetitors)

  const tabBar = useMemo(
    () => <CompetitorTabs active={activeTab} onChange={setActiveTab} />,
    [activeTab],
  )
  useScreenSubheader(tabBar)

  const merged = useMemo(() => mergeCompetitors(snapshots), [snapshots])
  const promptsMerged = useMemo(() => mergePrompts(snapshots), [snapshots])

  const ranking = geo.data
    ? geo.data.data.ranking
    : merged.payload?.ranking ?? merged.payload?.competitors ?? []
  const citations = merged.payload?.citations ?? {}
  const citationCounts = merged.payload?.citationCounts ?? {}

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

  if (activeTab === 'suggested') {
    return (
      <div className={`flex flex-col gap-5${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
        <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">No suggested competitors</p>
          <p className="mt-1 text-sm text-slate-500">
            Suggested competitors will appear here based on your industry and prompts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <CompetitorHoverProvider>
      <div className={`flex flex-col gap-4${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
        <div className="grid gap-4 xl:grid-cols-2">
          <ShareOfVoiceDonut competitors={filtered} />
          <BrandVisibilityChart
            competitors={chartCompetitors}
            range={filters}
            subtitle="Percentage of chats mentioning each brand across all prompts"
          />
        </div>

        <CompetitorsListTable
          rows={filtered}
          citations={citations}
          citationCounts={citationCounts}
        />
      </div>
    </CompetitorHoverProvider>
  )
}
