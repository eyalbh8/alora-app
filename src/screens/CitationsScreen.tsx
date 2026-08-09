import { useMemo } from 'react'
import { getAnalytics, listCitations, listTopics } from '../api/airops'
import type { CitationRow } from '../api/types'
import { CitationRankTable } from '../components/analytics/CitationRankTable'
import { DomainCategoryBreakdown } from '../components/analytics/DomainCategoryBreakdown'
import { MetricOverTimeChart } from '../components/analytics/MetricOverTimeChart'
import { MultiSeriesRateChart } from '../components/analytics/MultiSeriesRateChart'
import { TopicPlatformCitationTable } from '../components/analytics/TopicPlatformCitationTable'
import { MetricCard } from '../components/MetricCard'
import { ErrorState } from '../components/ErrorState'
import {
  useAnalyticsFilters,
  withAnalyticsFilters,
} from '../context/AnalyticsFiltersContext'
import { useBrandKit } from '../context/BrandKitContext'
import { useApi } from '../hooks/useApi'
import {
  CITATIONS_KPI_METRICS,
  aggregateTopCitedDomains,
  buildDomainCategoryBreakdownFromCitations,
  buildMultiSeriesPoints,
  buildTopicPlatformMatrix,
  pickTopSeriesKeys,
  pickTotalMetric,
  type SeriesMeta,
} from '../lib/analytics'
import { shortDateLabel } from '../lib/dates'
import { ALL_PROVIDERS, formatMetricValue, metricLabel } from '../lib/format'

function hasPeriodData(
  meta: { data_availability?: { requested_period_has_data?: boolean } } | undefined,
  rowCount: number,
): boolean {
  return (meta?.data_availability?.requested_period_has_data ?? false) && rowCount > 0
}

/** Fetch all citation pages (list max 100/page). */
async function listAllCitations(params: {
  start_date?: string
  end_date?: string
}): Promise<CitationRow[]> {
  const all: CitationRow[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await listCitations({
      ...params,
      sort: '-citation_count',
      per_page: 100,
      page,
    })
    all.push(...res.data)
    totalPages = res.meta.total_pages || 1
    page += 1
  } while (page <= totalPages)
  return all
}

export function CitationsScreen() {
  const { filterParams, grain, providers, range } = useAnalyticsFilters()
  const { settings } = useBrandKit()
  const competitors = settings?.competitors ?? []

  // Primitive deps so object identity churn cannot retrigger fetches.
  const filterKey = [
    filterParams.start_date,
    filterParams.end_date,
    filterParams.brand_mentioned,
    (filterParams.countries ?? []).join(','),
    (filterParams.providers ?? []).join(','),
  ].join('|')

  const topics = useApi(listTopics, [])

  const kpi = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: [...CITATIONS_KPI_METRICS],
          grain: 'total',
        }),
      ),
    [filterKey],
  )

  const rateOverTime = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['citation_rate'],
          dimensions: ['date'],
          grain,
          limit: 500,
        }),
      ),
    [filterKey, grain],
  )

  const rateByDomain = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['citation_rate'],
          dimensions: ['date', 'domain'],
          grain,
          limit: 500,
        }),
      ),
    [filterKey, grain],
  )

  const rateByCompetitor = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['citation_rate'],
          dimensions: ['date', 'competitor'],
          grain,
          limit: 500,
        }),
      ),
    [filterKey, grain],
  )

  /**
   * Citation inventory (domain breakdown, top domains/URLs) lives on
   * /citations/list which allows end_date=today. Analytics rejects today and
   * currently has no finalized rows for this brand kit — matching AirOps KPIs
   * at 0% while inventory widgets still show data.
   */
  const citationInventory = useApi(
    () =>
      listAllCitations({
        start_date: range.start_date,
        end_date: range.end_date,
      }),
    [range.start_date, range.end_date],
  )

  const topicPlatform = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['citation_rate'],
          dimensions: ['topic', 'provider'],
          grain: 'total',
          limit: 500,
        }),
      ),
    [filterKey],
  )

  const kpiValues = useMemo(() => {
    const rows = kpi.data?.data
    return CITATIONS_KPI_METRICS.map((metric) => ({
      metric,
      value: pickTotalMetric(rows, metric),
    }))
  }, [kpi.data])

  const categoryBreakdown = useMemo(
    () => buildDomainCategoryBreakdownFromCitations(citationInventory.data ?? [], 3),
    [citationInventory.data],
  )

  const domainSeriesKeys = useMemo(
    () => pickTopSeriesKeys(rateByDomain.data?.data ?? [], 'domain', 'citation_rate', 5),
    [rateByDomain.data],
  )

  const domainSeries: SeriesMeta[] = useMemo(
    () =>
      domainSeriesKeys.map((key) => ({
        key,
        label: key,
      })),
    [domainSeriesKeys],
  )

  const domainPoints = useMemo(
    () =>
      buildMultiSeriesPoints(
        rateByDomain.data?.data ?? [],
        'domain',
        'citation_rate',
        domainSeriesKeys,
        shortDateLabel,
      ),
    [rateByDomain.data, domainSeriesKeys],
  )

  const competitorNameById = useMemo(
    () => new Map(competitors.map((c) => [String(c.id), c.name])),
    [competitors],
  )

  const competitorSeriesKeys = useMemo(
    () => pickTopSeriesKeys(rateByCompetitor.data?.data ?? [], 'competitor', 'citation_rate', 5),
    [rateByCompetitor.data],
  )

  const competitorSeries: SeriesMeta[] = useMemo(
    () =>
      competitorSeriesKeys.map((key) => ({
        key,
        label: competitorNameById.get(key) ?? key,
      })),
    [competitorSeriesKeys, competitorNameById],
  )

  const competitorPoints = useMemo(
    () =>
      buildMultiSeriesPoints(
        rateByCompetitor.data?.data ?? [],
        'competitor',
        'citation_rate',
        competitorSeriesKeys,
        shortDateLabel,
      ),
    [rateByCompetitor.data, competitorSeriesKeys],
  )

  const domainRankRows = useMemo(
    () =>
      aggregateTopCitedDomains(citationInventory.data ?? [], 10).map((d) => ({
        id: d.domainId,
        label: d.domainName,
        href: d.domainName.includes('.') ? d.domainName : null,
        logoUrl: d.logoUrl,
        citationShare: d.citationShare,
        citationCount: d.citationCount,
      })),
    [citationInventory.data],
  )

  const urlRankRows = useMemo(() => {
    const rows = [...(citationInventory.data ?? [])]
      .sort((a, b) => (b.citation_count ?? 0) - (a.citation_count ?? 0))
      .slice(0, 10)
    return rows.map((row, i) => ({
      id: `${row.url}-${i}`,
      label: row.url,
      href: row.url,
      logoUrl: row.logo_url,
      citationShare: row.citation_share,
      citationCount: row.citation_count,
    }))
  }, [citationInventory.data])

  const matrixProviders = useMemo(() => {
    if (providers.length > 0 && providers.length < ALL_PROVIDERS.length) {
      return providers
    }
    const fromData = [
      ...new Set(
        (topicPlatform.data?.data ?? []).map((r) => String(r.provider ?? '')).filter(Boolean),
      ),
    ]
    return fromData.length ? fromData : [...ALL_PROVIDERS]
  }, [providers, topicPlatform.data])

  const topicMatrixRows = useMemo(
    () =>
      buildTopicPlatformMatrix(
        topicPlatform.data?.data ?? [],
        topics.data ?? [],
        matrixProviders,
        'citation_rate',
      ),
    [topicPlatform.data, topics.data, matrixProviders],
  )

  const inventoryCount = citationInventory.data?.length ?? 0

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

      <DomainCategoryBreakdown
        slices={categoryBreakdown.slices}
        loading={citationInventory.loading}
        error={citationInventory.error}
        onRetry={citationInventory.retry}
        hasData={inventoryCount > 0}
      />

      <MetricOverTimeChart
        title="Citation Rate"
        subtitle="How often AI cites your sources in their responses."
        metric="citation_rate"
        brandName={settings?.brand_name ?? 'Brand'}
        rows={rateOverTime.data?.data ?? []}
        loading={rateOverTime.loading}
        error={rateOverTime.error}
        onRetry={rateOverTime.retry}
        hasData={hasPeriodData(rateOverTime.data?.meta, rateOverTime.data?.data.length ?? 0)}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <MultiSeriesRateChart
          title="Citation Rate by Domain"
          subtitle="How often top domains are cited in AI responses."
          points={domainPoints}
          series={domainSeries}
          loading={rateByDomain.loading}
          error={rateByDomain.error}
          onRetry={rateByDomain.retry}
          hasData={hasPeriodData(rateByDomain.data?.meta, rateByDomain.data?.data.length ?? 0)}
        />
        <MultiSeriesRateChart
          title="Citation Rate by Competitors"
          subtitle="How often your brand is cited vs your competitors."
          points={competitorPoints}
          series={competitorSeries}
          loading={rateByCompetitor.loading}
          error={rateByCompetitor.error}
          onRetry={rateByCompetitor.retry}
          hasData={hasPeriodData(
            rateByCompetitor.data?.meta,
            rateByCompetitor.data?.data.length ?? 0,
          )}
        />
        <CitationRankTable
          title="Top 10 Cited Domains"
          subtitle="Domains cited most often in answers."
          rows={domainRankRows}
          loading={citationInventory.loading}
          error={citationInventory.error}
          onRetry={citationInventory.retry}
          hasData={domainRankRows.length > 0}
        />
        <CitationRankTable
          title="Top 10 Cited URLs"
          subtitle="URLs cited most often in answers."
          rows={urlRankRows}
          loading={citationInventory.loading}
          error={citationInventory.error}
          onRetry={citationInventory.retry}
          hasData={urlRankRows.length > 0}
          urlMode
        />
      </div>

      <TopicPlatformCitationTable
        rows={topicMatrixRows}
        providers={matrixProviders}
        loading={topicPlatform.loading || topics.loading}
        error={topicPlatform.error}
        onRetry={topicPlatform.retry}
        hasData={hasPeriodData(topicPlatform.data?.meta, topicPlatform.data?.data.length ?? 0)}
      />
    </div>
  )
}
