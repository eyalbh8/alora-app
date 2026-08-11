import { useMemo, useState } from 'react'
import { AiTrafficSettings } from '../components/ai-traffic/AiTrafficSettings'
import { AiTrafficTabs, type AiTrafficTab } from '../components/ai-traffic/AiTrafficTabs'
import { LlmVisitTrendsChart } from '../components/ai-traffic/LlmVisitTrendsChart'
import { TrafficEntryCardsRow } from '../components/ai-traffic/TrafficEntryCardsRow'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { AiTrafficScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useScreenSubheader } from '../context/ScreenSubheaderContext'
import { useSnapshots } from '../context/SnapshotContext'
import { buildAiTrafficViewModel } from '../lib/snapshots/aiTraffic'
import { mergeAiTraffic } from '../lib/snapshots/merge'

export function AiTrafficScreen() {
  const { snapshots, loading } = useSnapshots()
  const { filters } = useAnalyticsFilters()
  const [activeTab, setActiveTab] = useState<AiTrafficTab>('traffic')

  const tabBar = useMemo(
    () => <AiTrafficTabs active={activeTab} onChange={setActiveTab} />,
    [activeTab],
  )
  useScreenSubheader(tabBar)

  const snap = useMemo(() => mergeAiTraffic(snapshots), [snapshots])

  const payload = snap.payload

  const viewModel = useMemo(() => {
    if (!payload) return null
    return buildAiTrafficViewModel(payload, filters, [])
  }, [payload, filters])

  if (loading && !payload) {
    return <AiTrafficScreenSkeleton />
  }
  if (snap.error) {
    return <ErrorState message={snap.error} />
  }
  if (!payload) {
    return <EmptyState title="No AI traffic snapshot" message="ai_traffic payload was empty." />
  }

  if (activeTab === 'settings') {
    return <AiTrafficSettings preferences={payload.preferences} />
  }

  return (
    <div className="flex flex-col gap-5">
      <TrafficEntryCardsRow
        totalEntries={viewModel?.totalEntries ?? 0}
        totalChange={viewModel?.totalChange ?? null}
        providers={viewModel?.providers ?? []}
      />
      <LlmVisitTrendsChart
        chartRows={viewModel?.chartRows ?? []}
        providerKeys={viewModel?.chartProviderKeys ?? []}
        range={{ startDate: filters.startDate, endDate: filters.endDate }}
      />
    </div>
  )
}
