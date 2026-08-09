import { useMemo, useState } from 'react'
import { getAnalytics, listTopics } from '../api/airops'
import type { AnalyticsDimension, AnalyticsResponse } from '../api/types'
import { SentimentOverTimeChart } from '../components/analytics/SentimentOverTimeChart'
import { SentimentThemesTable } from '../components/analytics/SentimentThemesTable'
import { SentimentTreemap } from '../components/analytics/SentimentTreemap'
import {
  useAnalyticsFilters,
  withAnalyticsFilters,
} from '../context/AnalyticsFiltersContext'
import { useBrandKit } from '../context/BrandKitContext'
import { useApi } from '../hooks/useApi'
import {
  buildMultiSeriesPoints,
  pickTopSeriesKeys,
  type SeriesMeta,
} from '../lib/analytics'
import { shortDateLabel } from '../lib/dates'
import { providerLabel } from '../lib/format'
import {
  filterThemesBySentiment,
  normalizeThemeRows,
  type SentimentFilter,
  type SentimentSeriesMode,
} from '../lib/sentiment'

function hasPeriodData(
  meta: AnalyticsResponse['meta'] | undefined,
  rowCount: number,
): boolean {
  return (meta?.data_availability.requested_period_has_data ?? false) && rowCount > 0
}

export function SentimentScreen() {
  const { filterParams, grain } = useAnalyticsFilters()
  const { settings } = useBrandKit()
  const brandName = settings?.brand_name ?? 'Brand'

  const [seriesMode, setSeriesMode] = useState<SentimentSeriesMode>('overall')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')

  const topics = useApi(listTopics, [])

  const overallOverTime = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['sentiment_score'],
          dimensions: ['date'],
          grain,
          limit: 500,
        }),
      ),
    [filterParams, grain],
  )

  const seriesDimension: AnalyticsDimension | null =
    seriesMode === 'overall' ? null : seriesMode

  const breakdownOverTime = useApi(
    () => {
      if (!seriesDimension) {
        return Promise.resolve({
          data: [],
          meta: {
            row_count: 0,
            total_count: 0,
            execution_time_ms: 0,
            data_availability: {
              earliest_data_date: null,
              latest_data_date: null,
              requested_period_has_data: false,
            },
            start_date: '',
            end_date: '',
          },
          query: {
            metrics: ['sentiment_score'],
            dimensions: [],
            filters: {},
            grain,
            limit: 0,
            offset: 0,
          },
          chart_image_url: null,
        } satisfies AnalyticsResponse)
      }
      return getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['sentiment_score'],
          dimensions: ['date', seriesDimension],
          grain,
          limit: 1000,
        }),
      )
    },
    [filterParams, grain, seriesDimension],
  )

  const themesApi = useApi(
    () =>
      getAnalytics(
        withAnalyticsFilters(filterParams, {
          metrics: ['sentiment_score', 'answer_count'],
          dimensions: ['theme'],
          grain: 'total',
          order_by: 'answer_count DESC',
          limit: 100,
        }),
      ),
    [filterParams],
  )

  const themes = useMemo(
    () => normalizeThemeRows(themesApi.data?.data ?? []),
    [themesApi.data],
  )

  const filteredThemes = useMemo(
    () => filterThemesBySentiment(themes, sentimentFilter),
    [themes, sentimentFilter],
  )

  const themesHaveData = hasPeriodData(
    themesApi.data?.meta,
    themesApi.data?.data.length ?? 0,
  )

  const seriesMeta: SeriesMeta[] = useMemo(() => {
    if (!seriesDimension) return []
    const rows = breakdownOverTime.data?.data ?? []
    const keys = pickTopSeriesKeys(rows, seriesDimension, 'sentiment_score', 6)
    const topicNameById = new Map((topics.data ?? []).map((t) => [String(t.id), t.name]))
    const themeNameById = new Map(themes.map((t) => [String(t.id), t.name]))

    return keys.map((key) => {
      let label = key
      if (seriesDimension === 'provider') label = providerLabel(key)
      else if (seriesDimension === 'topic') label = topicNameById.get(key) ?? key
      else if (seriesDimension === 'theme') label = themeNameById.get(key) ?? key
      return { key, label }
    })
  }, [breakdownOverTime.data, seriesDimension, topics.data, themes])

  const seriesPoints = useMemo(() => {
    if (!seriesDimension) return []
    const rows = breakdownOverTime.data?.data ?? []
    const keys = seriesMeta.map((s) => s.key)
    return buildMultiSeriesPoints(rows, seriesDimension, 'sentiment_score', keys, shortDateLabel)
  }, [breakdownOverTime.data, seriesDimension, seriesMeta])

  return (
    <div className="flex flex-col gap-4">
      <SentimentOverTimeChart
        mode={seriesMode}
        onModeChange={setSeriesMode}
        brandName={brandName}
        overallRows={overallOverTime.data?.data ?? []}
        overallLoading={overallOverTime.loading}
        overallError={overallOverTime.error}
        overallOnRetry={overallOverTime.retry}
        overallHasData={hasPeriodData(
          overallOverTime.data?.meta,
          overallOverTime.data?.data.length ?? 0,
        )}
        seriesPoints={seriesPoints}
        seriesMeta={seriesMeta}
        seriesLoading={breakdownOverTime.loading}
        seriesError={breakdownOverTime.error}
        seriesOnRetry={breakdownOverTime.retry}
        seriesHasData={hasPeriodData(
          breakdownOverTime.data?.meta,
          breakdownOverTime.data?.data.length ?? 0,
        )}
      />

      <SentimentTreemap
        themes={filteredThemes}
        filter={sentimentFilter}
        onFilterChange={setSentimentFilter}
        loading={themesApi.loading}
        error={themesApi.error}
        onRetry={themesApi.retry}
        hasData={themesHaveData}
      />

      <SentimentThemesTable
        themes={filteredThemes}
        filter={sentimentFilter}
        onFilterChange={setSentimentFilter}
        filterParams={filterParams}
        loading={themesApi.loading}
        error={themesApi.error}
        onRetry={themesApi.retry}
        hasData={themesHaveData}
      />
    </div>
  )
}
