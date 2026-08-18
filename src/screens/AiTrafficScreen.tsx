import { useMemo, useState } from 'react'
import { AiTrafficSettings } from '../components/ai-traffic/AiTrafficSettings'
import { AiTrafficTabs, type AiTrafficTab } from '../components/ai-traffic/AiTrafficTabs'
import { LlmVisitTrendsChart } from '../components/ai-traffic/LlmVisitTrendsChart'
import { TrafficBreakdownCards } from '../components/ai-traffic/TrafficBreakdownCards'
import { TrafficEntryCardsRow } from '../components/ai-traffic/TrafficEntryCardsRow'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { AiTrafficScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useScreenSubheader } from '../context/ScreenSubheaderContext'
import { useAccountStore } from '../store/useAccountStore'
import { getTraffic } from '../api/traffic'
import { queryKeys } from '../api/queryKeys'
import { useApi } from '../hooks/useApi'
import { buildAiTrafficViewModel } from '../lib/snapshots/aiTraffic'

export function AiTrafficScreen() {
  const { selectedAccount } = useAccountStore()
  const { filters } = useAnalyticsFilters()
  const [activeTab, setActiveTab] = useState<AiTrafficTab>('traffic')

  const tabBar = useMemo(
    () => <AiTrafficTabs active={activeTab} onChange={setActiveTab} />,
    [activeTab],
  )
  useScreenSubheader(tabBar)

  const { data: payload, loading, error, retry } = useApi(
    queryKeys.traffic(selectedAccount?.id, filters),
    () => getTraffic(filters),
    { enabled: Boolean(selectedAccount) },
  )

  const viewModel = useMemo(() => {
    if (!payload) return null
    return buildAiTrafficViewModel(payload, filters, filters.providers)
  }, [payload, filters])

  if (loading && !payload) {
    return <AiTrafficScreenSkeleton />
  }
  if (error) {
    return <ErrorState message={error} onRetry={retry} />
  }
  if (!payload) {
    return <EmptyState title="No AI traffic data" message="No traffic events for the selected range." />
  }

  if (activeTab === 'settings') {
    return <AiTrafficSettings preferences={payload.preferences} />
  }

  return (
    <div className="flex flex-col gap-10">
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
      <TrafficBreakdownCards
        topSources={viewModel?.topSources ?? []}
        topPages={viewModel?.topPages ?? []}
        topLocations={viewModel?.topLocations ?? []}
        topDevices={viewModel?.topDevices ?? []}
        topBrowsers={viewModel?.topBrowsers ?? []}
      />
    </div>
  )
}
