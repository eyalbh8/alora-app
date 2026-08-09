import { useMemo } from 'react'
import { getAnalytics, listTopics } from '../api/airops'
import type { AnalyticsResponse } from '../api/types'
import { CompetitorLeaderboard } from '../components/analytics/CompetitorLeaderboard'
import { MetricOverTimeChart } from '../components/analytics/MetricOverTimeChart'
import { PlatformCompetitorChart } from '../components/analytics/PlatformCompetitorChart'
import { TopicMentionChart } from '../components/analytics/TopicMentionChart'
import { MetricCard } from '../components/MetricCard'
import { ErrorState } from '../components/ErrorState'
import {
  useAnalyticsFilters,
  withAnalyticsFilters,
} from '../context/AnalyticsFiltersContext'
import { useBrandKit } from '../context/BrandKitContext'
import { useApi, type ApiState } from '../hooks/useApi'
import {
  VISIBILITY_KPI_METRICS,
  buildCompetitorLeaderboard,
  pickTotalMetric,
  type CoreMetric,
  type LeaderboardEntry,
} from '../lib/analytics'
import { formatMetricValue, metricLabel } from '../lib/format'

function hasPeriodData(
  meta: AnalyticsResponse['meta'] | undefined,
  rowCount: number,
): boolean {
  return (meta?.data_availability.requested_period_has_data ?? false) && rowCount > 0
}

function MetricCompetitorPair({
  metric,
  brandName,
  chartSubtitle,
  listSubtitle,
  overTime,
  competitorApi,
  leaderboard,
  kpiLoading,
}: {
  metric: CoreMetric
  brandName: string
  chartSubtitle: string
  listSubtitle: string
  overTime: ApiState<AnalyticsResponse>
  competitorApi: ApiState<AnalyticsResponse>
  leaderboard: LeaderboardEntry[]
  kpiLoading: boolean
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <MetricOverTimeChart
        title={metricLabel(metric)}
        subtitle={chartSubtitle}
        metric={metric}
        brandName={brandName}
        rows={overTime.data?.data ?? []}
        loading={overTime.loading}
        error={overTime.error}
        onRetry={overTime.retry}
        hasData={hasPeriodData(overTime.data?.meta, overTime.data?.data.length ?? 0)}
      />
      <CompetitorLeaderboard
        title={`Competitor ${metricLabel(metric)}`}
        subtitle={listSubtitle}
        metric={metric}
        entries={leaderboard}
        loading={competitorApi.loading || kpiLoading}
        error={competitorApi.error}
        onRetry={competitorApi.retry}
        hasData={leaderboard.length > 0}
      />
    </div>
  )
}

export function VisibilityScreen() {
  const { filterParams, grain } = useAnalyticsFilters()
  const { settings } = useBrandKit()
  const brandName = settings?.brand_name ?? 'Brand'
  const competitors = settings?.competitors ?? []

  const topics = useApi(listTopics, [])

  const kpi = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: [...VISIBILITY_KPI_METRICS],
          grain: 'total',
        }),
      ),
    [filterParams],
  )

  const mentionOverTime = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['mention_rate'],
          dimensions: ['date'],
          grain,
          limit: 500,
        }),
      ),
    [filterParams, grain],
  )

  const mentionCompetitors = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['mention_rate'],
          dimensions: ['competitor'],
          grain: 'total',
          limit: 50,
        }),
      ),
    [filterParams],
  )

  const sovOverTime = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['share_of_voice'],
          dimensions: ['date'],
          grain,
          limit: 500,
        }),
      ),
    [filterParams, grain],
  )

  const sovCompetitors = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['share_of_voice'],
          dimensions: ['competitor'],
          grain: 'total',
          limit: 50,
        }),
      ),
    [filterParams],
  )

  const positionOverTime = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['average_position'],
          dimensions: ['date'],
          grain,
          limit: 500,
        }),
      ),
    [filterParams, grain],
  )

  const positionCompetitors = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['average_position'],
          dimensions: ['competitor'],
          grain: 'total',
          limit: 50,
        }),
      ),
    [filterParams],
  )

  const byTopic = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['mention_rate'],
          dimensions: ['topic'],
          grain: 'total',
          limit: 100,
        }),
      ),
    [filterParams],
  )

  const byProviderOwn = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['mention_rate'],
          dimensions: ['provider'],
          grain: 'total',
          limit: 50,
        }),
      ),
    [filterParams],
  )

  const byProviderCompetitor = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['mention_rate'],
          dimensions: ['provider', 'competitor'],
          grain: 'total',
          limit: 500,
        }),
      ),
    [filterParams],
  )

  const kpiValues = useMemo(() => {
    const rows = kpi.data?.data
    return VISIBILITY_KPI_METRICS.map((metric) => ({
      metric,
      value: pickTotalMetric(rows, metric),
    }))
  }, [kpi.data])

  const mentionLeaderboard = useMemo(
    () =>
      buildCompetitorLeaderboard({
        metric: 'mention_rate',
        ownValue: pickTotalMetric(kpi.data?.data, 'mention_rate'),
        ownName: brandName,
        competitorRows: mentionCompetitors.data?.data ?? [],
        competitors,
      }),
    [kpi.data, mentionCompetitors.data, brandName, competitors],
  )

  const sovLeaderboard = useMemo(
    () =>
      buildCompetitorLeaderboard({
        metric: 'share_of_voice',
        ownValue: pickTotalMetric(kpi.data?.data, 'share_of_voice'),
        ownName: brandName,
        competitorRows: sovCompetitors.data?.data ?? [],
        competitors,
      }),
    [kpi.data, sovCompetitors.data, brandName, competitors],
  )

  const positionLeaderboard = useMemo(
    () =>
      buildCompetitorLeaderboard({
        metric: 'average_position',
        ownValue: pickTotalMetric(kpi.data?.data, 'average_position'),
        ownName: brandName,
        competitorRows: positionCompetitors.data?.data ?? [],
        competitors,
      }),
    [kpi.data, positionCompetitors.data, brandName, competitors],
  )

  return (
    <div className="flex flex-col gap-5">
      {kpi.error ? (
        <ErrorState message={kpi.error} onRetry={kpi.retry} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      <MetricCompetitorPair
        metric="mention_rate"
        brandName={brandName}
        chartSubtitle="How often your brand is mentioned in AI responses"
        listSubtitle="How often your brand is mentioned vs competitors"
        overTime={mentionOverTime}
        competitorApi={mentionCompetitors}
        leaderboard={mentionLeaderboard}
        kpiLoading={kpi.loading}
      />

      <MetricCompetitorPair
        metric="share_of_voice"
        brandName={brandName}
        chartSubtitle="Your share of mentions in AI responses"
        listSubtitle="Your mentions vs competitor mentions across all platforms"
        overTime={sovOverTime}
        competitorApi={sovCompetitors}
        leaderboard={sovLeaderboard}
        kpiLoading={kpi.loading}
      />

      <MetricCompetitorPair
        metric="average_position"
        brandName={brandName}
        chartSubtitle="Your average position in AI responses"
        listSubtitle="Where you rank vs competitors across all platforms"
        overTime={positionOverTime}
        competitorApi={positionCompetitors}
        leaderboard={positionLeaderboard}
        kpiLoading={kpi.loading}
      />

      <TopicMentionChart
        title="Mention Rate by Topic"
        subtitle="How often your brand appears vs competitors for each topic"
        rows={byTopic.data?.data ?? []}
        topics={topics.data ?? []}
        brandName={brandName}
        loading={byTopic.loading || topics.loading}
        error={byTopic.error}
        onRetry={byTopic.retry}
        hasData={hasPeriodData(byTopic.data?.meta, byTopic.data?.data.length ?? 0)}
      />

      <PlatformCompetitorChart
        title="Mention Rate by Platform"
        subtitle="How often your brand is mentioned vs competitors across platforms"
        competitorRows={byProviderCompetitor.data?.data ?? []}
        ownRows={byProviderOwn.data?.data ?? []}
        brandName={brandName}
        competitors={competitors}
        loading={byProviderOwn.loading || byProviderCompetitor.loading}
        error={byProviderOwn.error ?? byProviderCompetitor.error}
        onRetry={() => {
          byProviderOwn.retry()
          byProviderCompetitor.retry()
        }}
        hasData={
          hasPeriodData(byProviderOwn.data?.meta, byProviderOwn.data?.data.length ?? 0) ||
          hasPeriodData(
            byProviderCompetitor.data?.meta,
            byProviderCompetitor.data?.data.length ?? 0,
          )
        }
      />
    </div>
  )
}
