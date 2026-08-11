import { useEffect, useMemo } from 'react'
import { ErrorState } from '../components/ErrorState'
import { MentionsSummary } from '../components/mentions/MentionsSummary'
import { MentionsOverTimeChart } from '../components/mentions/MentionsOverTimeChart'
import { ResponsesTable } from '../components/mentions/ResponsesTable'
import { MentionsScreenSkeleton } from '../components/ScreenSkeletons'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import {
  collectFilterOptions,
  detectResponseFilterAvailability,
  filterProviderMentions,
  filterResponses,
} from '../lib/snapshots/filter'
import { mergeMentions, mergePrompts } from '../lib/snapshots/merge'
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
  const { snapshots } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()
  const geo = useGeoScreenData(queryKeys.geo.mentionsAndResponses, fetchMentionsAndResponses)

  const merged = useMemo(() => mergeMentions(snapshots), [snapshots])
  const promptsMerged = useMemo(() => mergePrompts(snapshots), [snapshots])
  const promptLookup = useMemo(() => {
    const map = new Map((promptsMerged.prompts.payload?.prompts ?? []).map((p) => [p.id, p]))
    return map
  }, [promptsMerged])

  const responses = merged.responses.payload?.responses ?? []
  const providers = merged.chart.payload?.providers ?? []

  useEffect(() => {
    if (geo.geoMode) return
    setFilterMeta({
      options: collectFilterOptions({
        providers: providers.map((p) => p.provider),
        prompts: promptsMerged.prompts.payload?.prompts,
        topics: promptsMerged.topics.payload ?? [],
        responses,
      }),
      availability: {
        ...detectResponseFilterAvailability(responses),
        branded:
          detectResponseFilterAvailability(responses).branded ||
          (promptsMerged.prompts.payload?.prompts ?? []).some((p) => p.meInPrompt != null),
      },
    })
  }, [geo.geoMode, providers, responses, promptsMerged, setFilterMeta])

  const filteredProviders = geo.data
    ? geo.data.mentions.data.providers
    : filterProviderMentions(providers, filters.providers)

  const filteredResponses: ResponseRow[] = geo.data
    ? (geo.data.responses.data.responses as unknown as ResponseRow[])
    : filterResponses(responses, filters, promptLookup)

  const responsesTotal = geo.data
    ? geo.data.responses.data.total
    : merged.responses.payload?.total

  if (geo.pending) {
    return <MentionsScreenSkeleton />
  }
  if (geo.geoMode && geo.error) {
    return <ErrorState message={geo.error} onRetry={geo.retry} />
  }
  if (!geo.geoMode && merged.chart.error && merged.responses.error) {
    return <ErrorState message={merged.chart.error || merged.responses.error || 'No data'} />
  }

  return (
    <div className={`flex flex-col gap-12${geo.geoMode && geo.loading ? ' opacity-70' : ''}`}>
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
