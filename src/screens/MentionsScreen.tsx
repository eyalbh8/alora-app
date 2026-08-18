import { ErrorState } from '../components/ErrorState'
import { MentionsSummary } from '../components/mentions/MentionsSummary'
import { MentionsOverTimeChart } from '../components/mentions/MentionsOverTimeChart'
import { ResponsesTable } from '../components/mentions/ResponsesTable'
import { MentionsScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { getGeoMentions, getGeoResponses } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import type { GeoFilters, ResponseRow } from '../api/types'

async function fetchMentionsAndResponses(filters: GeoFilters) {
  const [mentions, responses] = await Promise.all([
    getGeoMentions(filters),
    getGeoResponses(filters, { take: 50 }),
  ])
  return { mentions, responses }
}

export function MentionsScreen() {
  const { filters } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.mentionsAndResponses, fetchMentionsAndResponses)

  const filteredProviders = geo.data?.mentions.data.providers ?? []
  const filteredResponses: ResponseRow[] = (geo.data?.responses.data.responses ??
    []) as unknown as ResponseRow[]
  const responsesTotal = geo.data?.responses.data.total

  if (geo.pending) {
    return <MentionsScreenSkeleton />
  }
  if (geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }

  return (
    <div className={`flex flex-col gap-12${geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <MentionsSummary
          providers={filteredProviders}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
        />
        <MentionsOverTimeChart
          providers={filteredProviders}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
        />
      </div>

      <ResponsesTable rows={filteredResponses} total={responsesTotal} variant="editorial" />
    </div>
  )
}
