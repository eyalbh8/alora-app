import { useMemo, useState } from 'react'
import { getAnalytics } from '../api/airops'
import type { AnalyticsMetric } from '../api/types'
import { CompetitorLeaderboard } from '../components/analytics/CompetitorLeaderboard'
import { PlatformMetricList } from '../components/analytics/PlatformMetricList'
import { MetricCard } from '../components/MetricCard'
import { ErrorState } from '../components/ErrorState'
import {
  useAnalyticsFilters,
  withAnalyticsFilters,
} from '../context/AnalyticsFiltersContext'
import { useBrandKit } from '../context/BrandKitContext'
import { useApi } from '../hooks/useApi'
import {
  LEADERBOARD_METRICS,
  OVERVIEW_KPI_METRICS,
  buildCompetitorLeaderboard,
  pickTotalMetric,
  type CoreMetric,
} from '../lib/analytics'
import { formatMetricValue, metricLabel } from '../lib/format'

export function OverviewScreen() {
  const { filterParams } = useAnalyticsFilters()
  const { settings } = useBrandKit()
  const brandName = settings?.brand_name ?? 'Brand'
  const competitors = settings?.competitors ?? []

  const [platformMetric, setPlatformMetric] = useState<CoreMetric>('mention_rate')
  const [leaderboardMetric, setLeaderboardMetric] = useState<CoreMetric>('mention_rate')

  const kpi = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: [...OVERVIEW_KPI_METRICS],
          grain: 'total',
        }),
      ),
    [filterParams],
  )

  const byProvider = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: [platformMetric],
          dimensions: ['provider'],
          grain: 'total',
          limit: 50,
        }),
      ),
    [filterParams, platformMetric],
  )

  const byCompetitor = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: [leaderboardMetric],
          dimensions: ['competitor'],
          grain: 'total',
          limit: 50,
        }),
      ),
    [filterParams, leaderboardMetric],
  )

  const kpiValues = useMemo(() => {
    const rows = kpi.data?.data
    return OVERVIEW_KPI_METRICS.map((metric) => ({
      metric,
      value: pickTotalMetric(rows, metric),
    }))
  }, [kpi.data])

  const leaderboardEntries = useMemo(
    () =>
      buildCompetitorLeaderboard({
        metric: leaderboardMetric,
        ownValue: pickTotalMetric(kpi.data?.data, leaderboardMetric),
        ownName: brandName,
        competitorRows: byCompetitor.data?.data ?? [],
        competitors,
      }),
    [leaderboardMetric, kpi.data, byCompetitor.data, brandName, competitors],
  )

  const providerHasData =
    (byProvider.data?.meta.data_availability.requested_period_has_data ?? false) &&
    (byProvider.data?.data.length ?? 0) > 0

  const competitorHasData =
    (byCompetitor.data?.meta.data_availability.requested_period_has_data ?? false) ||
    pickTotalMetric(kpi.data?.data, leaderboardMetric) !== null

  return (
    <div className="flex flex-col gap-5">
      {kpi.error ? (
        <ErrorState message={kpi.error} onRetry={kpi.retry} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpiValues.map(({ metric, value }) => (
            <MetricCard
              key={metric}
              label={metricLabel(metric)}
              value={formatMetricValue(metric, value)}
              loading={kpi.loading}
              trend={null}
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <PlatformMetricList
          title={`${metricLabel(platformMetric)} by Platform`}
          subtitle="How often your brand is mentioned across platforms"
          metric={platformMetric}
          rows={byProvider.data?.data ?? []}
          loading={byProvider.loading}
          error={byProvider.error}
          onRetry={byProvider.retry}
          hasData={providerHasData}
          metricOptions={[...LEADERBOARD_METRICS] as AnalyticsMetric[]}
          onMetricChange={(m) => setPlatformMetric(m as CoreMetric)}
        />

        <CompetitorLeaderboard
          title={`${metricLabel(leaderboardMetric)} by Competitor`}
          subtitle="How often your brand is mentioned vs competitors"
          metric={leaderboardMetric}
          entries={leaderboardEntries}
          loading={byCompetitor.loading || kpi.loading}
          error={byCompetitor.error}
          onRetry={byCompetitor.retry}
          hasData={competitorHasData && leaderboardEntries.length > 0}
          metricOptions={[...LEADERBOARD_METRICS] as AnalyticsMetric[]}
          onMetricChange={(m) => setLeaderboardMetric(m as CoreMetric)}
        />
      </div>
    </div>
  )
}
