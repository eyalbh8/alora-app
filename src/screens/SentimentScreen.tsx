import { ErrorState } from '../components/ErrorState'
import { CurrentSentimentScore } from '../components/sentiment/CurrentSentimentScore'
import { SentimentResponsesTable } from '../components/sentiment/SentimentResponsesTable'
import { SentimentTrendChart } from '../components/sentiment/SentimentTrendChart'
import { SentimentScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { getGeoResponses, getGeoSentiment } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import type { GeoFilters, ResponseRow } from '../api/types'

async function fetchSentimentAndResponses(filters: GeoFilters) {
  const [sentiment, responses] = await Promise.all([
    getGeoSentiment(filters),
    getGeoResponses(filters, { take: 50 }),
  ])
  return { sentiment, responses }
}

export function SentimentScreen() {
  const { filters } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.sentimentAndResponses, fetchSentimentAndResponses)

  const filteredResponses: ResponseRow[] = (geo.data?.responses.data.responses ??
    []) as unknown as ResponseRow[]
  const filteredHistorical = geo.data?.sentiment.data.historical ?? []
  const overall = geo.data?.sentiment.data.overallScore ?? null
  const previousOverall = geo.data?.sentiment.data.previousOverallScore ?? null
  const responsesTotal = geo.data?.responses.data.total

  if (geo.pending) {
    return <SentimentScreenSkeleton />
  }
  if (geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }

  return (
    <div className={`flex flex-col gap-12${geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.4fr]">
        <CurrentSentimentScore score={overall} />
        <SentimentTrendChart
          historical={filteredHistorical}
          currentScore={overall}
          previousScore={previousOverall}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
        />
      </div>

      <SentimentResponsesTable
        rows={filteredResponses}
        total={responsesTotal}
        emptyMessage="No sentiment responses match the filters."
      />
    </div>
  )
}
