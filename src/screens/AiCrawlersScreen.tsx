import { useEffect, useMemo } from 'react'
import { CrawlerEntryCardsRow } from '../components/ai-crawlers/CrawlerEntryCardsRow'
import { CrawlerVolumeChart } from '../components/ai-crawlers/CrawlerVolumeChart'
import { DistributionCard } from '../components/ai-crawlers/DistributionCard'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { AiCrawlersScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useAccountStore } from '../store/useAccountStore'
import { getCrawlers } from '../api/traffic'
import { queryKeys } from '../api/queryKeys'
import { useApi } from '../hooks/useApi'
import { buildAiCrawlersViewModel } from '../lib/snapshots/aiCrawlers'

function botName(row: Record<string, unknown>): string {
  for (const k of ['bot', 'botName', 'name', 'crawler', 'aiCrawler']) {
    const v = row[k]
    if (typeof v === 'string' && v) return v
  }
  return '—'
}

export function AiCrawlersScreen() {
  const { selectedAccount } = useAccountStore()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const { data: payload, loading, error, retry } = useApi(
    queryKeys.crawlers(selectedAccount?.id, filters),
    () => getCrawlers(filters),
    { enabled: Boolean(selectedAccount) },
  )

  const viewModel = useMemo(() => {
    if (!payload) return null
    return buildAiCrawlersViewModel(payload, filters, filters.crawlers)
  }, [payload, filters])

  useEffect(() => {
    const bots = (payload?.byBot ?? []).map(botName).filter((b) => b !== '—')
    setFilterMeta({
      options: {
        crawlers: [...new Set(bots)],
      },
      availability: {
        crawlers: bots.length > 0,
      },
    })
  }, [payload, setFilterMeta])

  if (loading && !payload) {
    return <AiCrawlersScreenSkeleton />
  }
  if (error) {
    return <ErrorState message={error} onRetry={retry} />
  }
  if (!payload) {
    return <EmptyState title="No AI crawlers data" message="No crawler analytics for the selected range." />
  }

  return (
    <div className="flex flex-col gap-12">
      <CrawlerEntryCardsRow
        totalEntries={viewModel?.totalEntries ?? 0}
        totalChange={viewModel?.totalChange ?? null}
        bots={viewModel?.bots ?? []}
      />
      <CrawlerVolumeChart
        chartRows={viewModel?.chartRows ?? []}
        range={{ startDate: filters.startDate, endDate: filters.endDate }}
      />
      <div className="grid gap-10 xl:grid-cols-2">
        <DistributionCard
          title="Path Distribution"
          subtitle="Most crawled URL paths in the selected period"
          rows={viewModel?.pathDistribution ?? []}
          accent="light"
        />
        <DistributionCard
          title="Crawler Distribution"
          subtitle="AI crawlers ranked by entry volume"
          rows={viewModel?.crawlerDistribution ?? []}
          showBotIcons
        />
      </div>
    </div>
  )
}
