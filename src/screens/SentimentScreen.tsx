import { ErrorState } from '../components/ErrorState'
import { CurrentSentimentScore } from '../components/sentiment/CurrentSentimentScore'
import { SentimentResponsesTable } from '../components/sentiment/SentimentResponsesTable'
import { SentimentTrendChart } from '../components/sentiment/SentimentTrendChart'
import { SentimentScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { getGeoSentiment } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import { usePaginatedResponses } from '../hooks/usePaginatedResponses'
import { sentimentPeriodScores } from '../lib/sentimentPeriod'

export function SentimentScreen() {
  const { filters } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.sentiment, getGeoSentiment)
  const responses = usePaginatedResponses({ sentiment: true })

  const filteredHistorical = geo.data?.data.historical ?? []
  const fromHistory = sentimentPeriodScores(filteredHistorical)
  const overall = fromHistory.current ?? geo.data?.data.overallScore ?? null
  const previousOverall = fromHistory.previous ?? geo.data?.data.previousOverallScore ?? null

  if (geo.pending || responses.pending) {
    return <SentimentScreenSkeleton />
  }
  if (geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }
  if (responses.error && responses.rows.length === 0) {
    return <ErrorState message={responses.error} onRetry={responses.retry} />
  }

  return (
    <div className={`flex flex-col gap-8 md:gap-10 lg:gap-14${geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[0.9fr_1.4fr]">
        <CurrentSentimentScore score={overall} />
        <SentimentTrendChart
          historical={filteredHistorical}
          currentScore={overall}
          previousScore={previousOverall}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
        />
      </div>

      <SentimentResponsesTable
        rows={responses.rows}
        total={responses.total}
        emptyMessage="No sentiment responses match the filters."
        loading={responses.fetching && !responses.pending}
        pagination={{
          pageSize: responses.pageSize,
          onPageSizeChange: responses.setPageSize,
          pageStart: responses.pageStart,
          pageEnd: responses.pageEnd,
          total: responses.total,
          currentPage: responses.page,
          totalPages: responses.totalPages,
          onPageChange: responses.setPage,
        }}
      />
    </div>
  )
}
