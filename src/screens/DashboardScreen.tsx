import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { BrandVisibilityChart } from '../components/dashboard/BrandVisibilityChart'
import { AccountSnapshot } from '../components/dashboard/AccountSnapshot'
import { IndustryRankingCard } from '../components/dashboard/IndustryRankingCard'
import { ProviderMentionCardsRow } from '../components/dashboard/ProviderMentionCardsRow'
import { SourcesCard } from '../components/dashboard/SourcesCard'
import { DashboardScreenSkeleton } from '../components/ScreenSkeletons'
import { CompetitorHoverProvider } from '../context/CompetitorHoverContext'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { buildAccountBrief } from '../lib/dashboard/briefInsights'
import { getGeoDashboard } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import type { CompetitorPerformance, DashboardData, TopSource } from '../api/types'

export function DashboardScreen() {
  const { filters, options } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.dashboard, getGeoDashboard)

  if (geo.pending) {
    return <DashboardScreenSkeleton />
  }
  if (geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }
  const geoPayload = geo.data?.data ?? null
  console.info('[dashboard-ui] screen payload', {
    hasEnvelope: Boolean(geo.data),
    envelopeKeys: geo.data && typeof geo.data === 'object' ? Object.keys(geo.data) : [],
    hasInnerData: Boolean(geoPayload),
    promptsCount: geoPayload?.promptsCount,
    mentionCount: geoPayload?.providerMentions?.length ?? 0,
    competitorCount: geoPayload?.competitorsPerformance?.length ?? 0,
    sourceCount: geoPayload?.topSourceDomains?.length ?? 0,
  })
  if (!geoPayload) {
    return (
      <EmptyState
        title="No dashboard data"
        message="No facts match the selected date range and filters."
      />
    )
  }

  const providerRows = geoPayload.providerMentions
  const competitorRows = geoPayload.competitorsPerformance
  const topSources: TopSource[] = geoPayload.topSourceDomains
  const basePayload: DashboardData = geoPayload

  const top5ByOccurrences: CompetitorPerformance[] = [...competitorRows]
    .filter((c) => (c.occurrences ?? 0) > 0)
    .sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0))
    .slice(0, 5)

  const availableProviders = options.providers.length ? options.providers : undefined
  const brief = buildAccountBrief(basePayload, providerRows, competitorRows)

  return (
    <CompetitorHoverProvider>
      <div
        className={`flex flex-col gap-8 pb-4 transition-opacity md:gap-10 lg:gap-14${geo.loading ? ' opacity-70' : ''}`}
      >
        <section className="overflow-hidden border border-[#d8d2c7] border-t-2 border-t-brand-800 bg-[#faf9f7] shadow-[0_12px_32px_rgba(16,20,20,0.05)]">
          <header className="px-5 py-5 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">
              Selected period
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-[-0.02em] text-[#101414]">
              AI visibility overview
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#6b655e]">
              Brand presence, competitive position, and coverage across the models you track.
            </p>
          </header>
          <AccountSnapshot snapshot={brief.snapshot} embedded />
          <ProviderMentionCardsRow
            mentions={providerRows}
            availableProviders={availableProviders}
            embedded
          />
        </section>

        <div className="grid items-stretch gap-10 lg:grid-cols-2">
          <IndustryRankingCard competitors={competitorRows} />
          <BrandVisibilityChart
            competitors={top5ByOccurrences}
            range={filters}
            title="Visibility trajectory"
            subtitle="How brand presence shifted across the period"
            variant="editorial"
            emptyMessage="Not enough history to show a trajectory yet."
            valueLabel="mentions"
            showLegend
            paired
          />
        </div>

        <div>
          <SourcesCard sources={topSources} />
        </div>
      </div>
    </CompetitorHoverProvider>
  )
}
