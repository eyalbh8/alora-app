import { useEffect, useMemo } from 'react'
import { ErrorState } from '../components/ErrorState'
import { ResponsesTable } from '../components/mentions/ResponsesTable'
import { CurrentSentimentScore } from '../components/sentiment/CurrentSentimentScore'
import { SentimentTrendChart } from '../components/sentiment/SentimentTrendChart'
import { SentimentScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  averageSentiment,
  collectFilterOptions,
  detectResponseFilterAvailability,
  filterHistoricalSentiment,
  filterResponses,
} from '../lib/snapshots/filter'
import { mergePrompts, mergeSentiment } from '../lib/snapshots/merge'
import { previousPeriodRange } from '../lib/dates'
import { getGeoResponses, getGeoSentiment } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import type { GeoFilters, ResponseRow } from '../api/types'

async function fetchSentimentAndResponses(filters: GeoFilters) {
  const [sentiment, responses] = await Promise.all([
    getGeoSentiment(filters),
    getGeoResponses(filters, { take: 200 }),
  ])
  return { sentiment, responses }
}

function previousScoreFromHistorical(
  historical: Array<{ date: string; provider: string; sentimentScore: number }>,
  range: { startDate: string; endDate: string },
): number | null {
  const prev = previousPeriodRange(range)
  const points = historical.filter((p) => {
    const day = p.date.slice(0, 10)
    return day >= prev.startDate && day <= prev.endDate
  })
  if (!points.length) return null
  return Math.round(points.reduce((sum, p) => sum + p.sentimentScore, 0) / points.length)
}

export function SentimentScreen() {
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.sentimentAndResponses, fetchSentimentAndResponses)

  const merged = useMemo(() => mergeSentiment(snapshots), [snapshots])
  const promptsMerged = useMemo(() => mergePrompts(snapshots), [snapshots])
  const promptLookup = useMemo(
    () => new Map((promptsMerged.prompts.payload?.prompts ?? []).map((p) => [p.id, p])),
    [promptsMerged],
  )

  const responses = merged.responses.payload?.responses ?? []
  const historical = merged.historical.payload ?? []

  useEffect(() => {
    if (geo.geoMode) return
    setFilterMeta({
      options: collectFilterOptions({
        providers: historical.map((h) => h.provider).filter((p) => p.toUpperCase() !== 'ALL'),
        prompts: promptsMerged.prompts.payload?.prompts,
        topics: promptsMerged.topics.payload ?? [],
        responses,
      }),
      availability: {
        ...detectResponseFilterAvailability(responses),
        providers: historical.length > 0 || detectResponseFilterAvailability(responses).providers,
        branded:
          detectResponseFilterAvailability(responses).branded ||
          (promptsMerged.prompts.payload?.prompts ?? []).some((p) => p.meInPrompt != null),
      },
    })
  }, [geo.geoMode, historical, responses, promptsMerged, setFilterMeta])

  const filteredResponses: ResponseRow[] = geo.data
    ? (geo.data.responses.data.responses as unknown as ResponseRow[])
    : filterResponses(responses, filters, promptLookup)
  const filteredHistorical = geo.data
    ? geo.data.sentiment.data.historical
    : filterHistoricalSentiment(historical, filters.providers)
  const overall = geo.data
    ? geo.data.sentiment.data.overallScore
    : averageSentiment(filteredResponses)
  const previousOverall = geo.data
    ? geo.data.sentiment.data.previousOverallScore
    : previousScoreFromHistorical(filteredHistorical, filters)

  const responsesTotal = geo.data
    ? geo.data.responses.data.total
    : merged.responses.payload?.total

  if (geo.pending) {
    return <SentimentScreenSkeleton />
  }
  if (geo.geoMode && geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }

  return (
    <div className={`flex flex-col gap-5${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid gap-4 xl:grid-cols-2">
        <CurrentSentimentScore score={overall} />
        <SentimentTrendChart
          historical={filteredHistorical}
          currentScore={overall}
          previousScore={previousOverall}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
        />
      </div>

      <ResponsesTable
        rows={filteredResponses}
        total={responsesTotal}
        emptyMessage="No sentiment responses match the filters."
      />
    </div>
  )
}
