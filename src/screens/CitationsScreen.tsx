import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getGeoCitationDomain,
  getGeoCitations,
  type CitationUrl,
} from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import { CitationHoverProvider } from '../components/citations/CitationHoverContext'
import { CitationsDonut } from '../components/citations/CitationsDonut'
import { CitationsTrendChart } from '../components/citations/CitationsTrendChart'
import { CitationUrlDrawer } from '../components/citations/CitationUrlDrawer'
import { DomainsTable } from '../components/citations/DomainsTable'
import { DomainUrlsTable } from '../components/citations/DomainUrlsTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { CitationsScreenSkeleton } from '../components/ScreenSkeletons'
import { useGeoScreenData } from '../hooks/useGeoScreen'
import { useAccountStore } from '../store/useAccountStore'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useApi } from '../hooks/useApi'

export function CitationsScreen() {
  const navigate = useNavigate()
  const { domain: rawDomain } = useParams<{ domain?: string }>()
  const domain = rawDomain ? decodeURIComponent(rawDomain) : ''
  const { selectedAccount } = useAccountStore()
  const { filters } = useAnalyticsFilters()
  const [selectedUrl, setSelectedUrl] = useState<CitationUrl | null>(null)

  const list = useGeoScreenData(queryKeys.geo.citations, getGeoCitations)
  const drill = useApi(
    queryKeys.geo.citationDomain(selectedAccount?.id, domain, filters),
    () => getGeoCitationDomain(domain, filters),
    { enabled: Boolean(domain) && list.geoMode },
  )

  if (!domain && list.pending) return <CitationsScreenSkeleton />
  if (domain && drill.loading && drill.data == null) return <CitationsScreenSkeleton />
  if (!domain && list.error) return <ErrorState message={list.error} onRetry={list.retry} />
  if (domain && drill.error && drill.data == null) {
    return <ErrorState message={drill.error} onRetry={drill.retry} />
  }

  if (domain) {
    const payload = drill.data?.data
    const summary = payload?.summary
    const urls = payload?.urls ?? []
    if (!payload || !summary || (!summary.totalCitations && urls.length === 0)) {
      return (
        <EmptyState
          title="No pages for this domain"
          message="No cited URLs were returned for the selected source."
        />
      )
    }

    const donutSegments =
      summary.distributionByUrlType.length > 0
        ? summary.distributionByUrlType
        : summary.distributionByDomainType

    return (
      <CitationHoverProvider>
      <div className={`flex flex-col gap-8 md:gap-10 lg:gap-14${drill.fetching ? ' opacity-70' : ''}`}>
        <p className="text-xs text-muted">
          Citations / <span className="text-ink">{domain}</span>
        </p>
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <CitationsDonut title="Total citations" total={summary.totalCitations} segments={donutSegments} />
          <CitationsTrendChart title="Source usage by URLs" trend={summary.trend} />
        </div>
        <DomainUrlsTable
          domain={domain}
          rows={urls}
          onSelect={setSelectedUrl}
          onBack={() => navigate('/citations')}
        />
        {selectedUrl ? (
          <CitationUrlDrawer row={selectedUrl} onClose={() => setSelectedUrl(null)} />
        ) : null}
      </div>
      </CitationHoverProvider>
    )
  }

  const summary = list.data?.data.summary
  const domains = list.data?.data.domains ?? []
  if (!list.data || !summary || (!summary.totalCitations && domains.length === 0)) {
    return (
      <EmptyState
        title="No citations"
        message="No cited domains were returned for the selected period."
      />
    )
  }

  return (
    <CitationHoverProvider>
    <div className={`flex flex-col gap-8 md:gap-10 lg:gap-14${list.loading ? ' opacity-70' : ''}`}>
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <CitationsDonut
          title="Total citations"
          total={summary.totalCitations}
          segments={summary.distributionByDomainType}
        />
        <CitationsTrendChart title="Source usage by URLs" trend={summary.trend} />
      </div>
      <DomainsTable
        rows={domains}
        total={list.data.data.total}
        onSelect={(next) => navigate(`/citations/${encodeURIComponent(next)}`)}
      />
    </div>
    </CitationHoverProvider>
  )
}
