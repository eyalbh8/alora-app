import { ErrorState } from '../components/ErrorState'
import { MentionsSummary } from '../components/mentions/MentionsSummary'
import { MentionsOverTimeChart } from '../components/mentions/MentionsOverTimeChart'
import { ResponsesTable } from '../components/mentions/ResponsesTable'
import { PageLoader } from '../components/loading'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { getGeoMentions } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import { usePaginatedResponses } from '../hooks/usePaginatedResponses'
import { collectTrackedRecommendations } from '../lib/trackedRecommendations'

export function MentionsScreen() {
  const { filters } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.mentions, getGeoMentions)
  const responses = usePaginatedResponses({ sentiment: true })

  const filteredProviders = geo.data?.data.providers ?? []
  const trackedRecommendations = collectTrackedRecommendations(
    geo.data?.data.trackedRecommendations,
    geo.data?.data.posts,
  )

  if (geo.pending || responses.pending) {
    return <PageLoader />
  }
  if (geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }
  if (responses.error && responses.rows.length === 0) {
    return <ErrorState message={responses.error} onRetry={responses.retry} />
  }

  return (
    <div className={`flex flex-col gap-8 md:gap-10 lg:gap-14${geo.loading ? ' opacity-70' : ''}`}>
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <MentionsSummary
          providers={filteredProviders}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
        />
        <MentionsOverTimeChart
          providers={filteredProviders}
          range={{ startDate: filters.startDate, endDate: filters.endDate }}
          trackedRecommendations={trackedRecommendations}
        />
      </div>

      <ResponsesTable
        rows={responses.rows}
        total={responses.total}
        variant="editorial"
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
