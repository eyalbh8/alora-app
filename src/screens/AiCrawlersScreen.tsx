import { useEffect, useMemo } from 'react'
import { CrawlerEntryCardsRow } from '../components/ai-crawlers/CrawlerEntryCardsRow'
import { CrawlerVolumeChart } from '../components/ai-crawlers/CrawlerVolumeChart'
import { DistributionCard } from '../components/ai-crawlers/DistributionCard'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { AiCrawlersScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import { buildAiCrawlersViewModel } from '../lib/snapshots/aiCrawlers'
import { mergeAiCrawlers } from '../lib/snapshots/merge'

function botName(row: Record<string, unknown>): string {
  for (const k of ['bot', 'botName', 'name', 'crawler', 'aiCrawler']) {
    const v = row[k]
    if (typeof v === 'string' && v) return v
  }
  return '—'
}

export function AiCrawlersScreen() {
  const { snapshots, loading } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const snap = useMemo(() => mergeAiCrawlers(snapshots), [snapshots])

  const payload = snap.payload

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

  const viewModel = useMemo(() => {
    if (!payload) return null
    return buildAiCrawlersViewModel(payload, filters, filters.crawlers)
  }, [payload, filters])

  if (loading && !payload) {
    return <AiCrawlersScreenSkeleton />
  }
  if (snap.error) {
    return <ErrorState message={snap.error} />
  }
  if (!payload) {
    return <EmptyState title="No AI crawlers snapshot" message="ai_crawlers payload was empty." />
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
