import { useEffect, useMemo } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { BrandVisibilityChart } from '../components/dashboard/BrandVisibilityChart'
import { IndustryRankingCard } from '../components/dashboard/IndustryRankingCard'
import { ProviderMentionCardsRow } from '../components/dashboard/ProviderMentionCardsRow'
import { RecentAgentPostsCard } from '../components/dashboard/RecentAgentPostsCard'
import { SourcesCard } from '../components/dashboard/SourcesCard'
import { DashboardScreenSkeleton } from '../components/ScreenSkeletons'
import { CompetitorHoverProvider } from '../context/CompetitorHoverContext'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import { collectFilterOptions, filterCompetitors, filterProviderMentions } from '../lib/snapshots/filter'
import { mergeDashboard } from '../lib/snapshots/merge'
import { getGeoDashboard } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import type { CompetitorPerformance, DashboardData, TopSource } from '../api/types'

export function DashboardScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta, options } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.dashboard, getGeoDashboard)

  const merged = useMemo(() => mergeDashboard(snapshots), [snapshots])

  useEffect(() => {
    if (geo.geoMode) return
    const providers = (merged.payload?.providerMentions ?? []).map((p) => p.provider)
    const competitors = merged.payload?.competitorsPerformance ?? []
    setFilterMeta({
      options: collectFilterOptions({ providers, competitors }),
      availability: {
        providers: providers.length > 0,
        topics: competitors.some((c) => (c.topics?.length ?? 0) > 0),
        prompts: false,
        regions: false,
        tags: false,
        branded: false,
        promptTypes: false,
        crawlers: false,
      },
    })
  }, [geo.geoMode, merged, setFilterMeta])

  if (geo.pending) {
    return <DashboardScreenSkeleton />
  }
  if (geo.geoMode && geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }
  const geoPayload = geo.data?.data ?? null
  if (geo.geoMode) {
    if (!geoPayload) {
      return (
        <EmptyState
          title="No dashboard data"
          message="No facts match the selected date range and filters."
        />
      )
    }
  } else {
    if (merged.error) {
      return <ErrorState message={merged.error} />
    }
    if (!merged.payload) {
      return <EmptyState title="No dashboard snapshot" message="No payload for the selected day(s)." />
    }
  }

  const providerRows = geoPayload
    ? geoPayload.providerMentions
    : filterProviderMentions(merged.payload!.providerMentions, filters.providers)
  const competitorRows = geoPayload
    ? geoPayload.competitorsPerformance
    : filterCompetitors(merged.payload!.competitorsPerformance ?? [], { topics: filters.topics })
  const topSources: TopSource[] = geoPayload ? geoPayload.topSourceDomains : merged.topSources
  const basePayload: DashboardData = geoPayload ?? merged.payload!

  const top5ByOccurrences: CompetitorPerformance[] = [...competitorRows]
    .filter((c) => (c.occurrences ?? 0) > 0)
    .sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0))
    .slice(0, 5)

  const posts = basePayload.agentPosts?.posts ?? []
  const availableProviders = options.providers.length ? options.providers : undefined

  return (
    <CompetitorHoverProvider>
      <div className={`flex flex-col gap-4${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
        <ProviderMentionCardsRow mentions={providerRows} availableProviders={availableProviders} />

        <div className="grid gap-4 xl:grid-cols-2">
          <IndustryRankingCard competitors={competitorRows} />
          <BrandVisibilityChart competitors={top5ByOccurrences} range={filters} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <SourcesCard sources={topSources} />
          <RecentAgentPostsCard posts={posts} />
        </div>
      </div>
    </CompetitorHoverProvider>
  )
}
