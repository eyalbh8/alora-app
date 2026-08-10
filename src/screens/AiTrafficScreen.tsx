import { useEffect, useMemo } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { MetricCard } from '../components/MetricCard'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useSnapshots } from '../context/SnapshotContext'
import { latestSnap, mapAiTraffic, normalizeSnapshot } from '../lib/snapshots/normalize'
import { formatNumber } from '../lib/format'
import { providerLabel, regionLabel } from '../lib/format'

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v) return v
    if (typeof v === 'number') return String(v)
  }
  return '—'
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number') return v
  }
  return null
}

export function AiTrafficScreen() {
  const { snapshots, freshness } = useSnapshots()
  const { filters, setFilterMeta } = useAnalyticsFilters()

  const snap = useMemo(() => {
    const latest = latestSnap(snapshots, 'ai_traffic')
    return normalizeSnapshot(latest, mapAiTraffic)
  }, [snapshots])

  const payload = snap.payload

  useEffect(() => {
    const providers = (payload?.llmProviders ?? [])
      .map((r) => pickString(r, ['provider', 'name', 'llm', 'engine']))
      .filter((v) => v !== '—')
    const countries =
      payload?.availableCountries ??
      (payload?.topLocations ?? [])
        .map((r) => pickString(r, ['country', 'region', 'code', 'name']))
        .filter((v) => v !== '—')

    setFilterMeta({
      options: {
        providers: [...new Set(providers)],
        topics: [],
        prompts: [],
        regions: [...new Set(countries)],
        tags: [],
        promptTypes: [],
        crawlers: [],
      },
      availability: {
        providers: providers.length > 0,
        topics: false,
        prompts: false,
        regions: countries.length > 0,
        tags: false,
        branded: false,
        promptTypes: false,
        crawlers: false,
      },
    })
  }, [payload, setFilterMeta])

  if (snap.error) {
    return (
      <div className="flex flex-col gap-4">
        <FreshnessBadge day={snap.day || freshness.day} pulledAt={snap.pulledAt || freshness.pulledAt} />
        <ErrorState message={snap.error} />
      </div>
    )
  }
  if (!payload) {
    return <EmptyState title="No AI traffic snapshot" message="ai_traffic payload was empty." />
  }

  const providerRows = (payload.llmProviders ?? []).filter((r) => {
    if (!filters.providers.length) return true
    const name = pickString(r, ['provider', 'name', 'llm', 'engine'])
    return filters.providers.some((p) => p.toLowerCase() === name.toLowerCase())
  })

  const locationRows = (payload.topLocations ?? []).filter((r) => {
    if (!filters.regions.length) return true
    const name = pickString(r, ['country', 'region', 'code', 'name'])
    return filters.regions.some((p) => p.toLowerCase() === name.toLowerCase())
  })

  const genericColumns = (labelKeys: string[], valueKeys: string[]): Column<Record<string, unknown>>[] => [
    {
      key: 'name',
      header: 'Name',
      render: (r) => {
        const raw = pickString(r, labelKeys)
        if (labelKeys.includes('provider') || labelKeys.includes('llm')) return providerLabel(raw)
        if (labelKeys.includes('country') || labelKeys.includes('region')) return regionLabel(raw)
        return raw
      },
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      render: (r) => formatNumber(pickNumber(r, valueKeys), 0),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <FreshnessBadge day={snap.day || freshness.day} pulledAt={snap.pulledAt || freshness.pulledAt} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricCard
          label="Has events"
          value={payload.hasEvents == null ? '—' : payload.hasEvents ? 'Yes' : 'No'}
        />
        <MetricCard label="Providers" value={formatNumber(providerRows.length, 0)} />
        <MetricCard label="Locations" value={formatNumber(locationRows.length, 0)} />
      </div>

      <Section
        title="LLM providers"
        rows={providerRows}
        columns={genericColumns(['provider', 'name', 'llm', 'engine'], ['sessions', 'users', 'count', 'visits', 'value'])}
      />
      <Section
        title="Top sources"
        rows={payload.topSources ?? []}
        columns={genericColumns(['source', 'name', 'referrer', 'domain'], ['sessions', 'users', 'count', 'visits', 'value'])}
      />
      <Section
        title="Top pages"
        rows={payload.topPages ?? []}
        columns={genericColumns(['page', 'path', 'url', 'name'], ['sessions', 'users', 'count', 'visits', 'value'])}
      />
      <Section
        title="Top locations"
        rows={locationRows}
        columns={genericColumns(['country', 'region', 'code', 'name'], ['sessions', 'users', 'count', 'visits', 'value'])}
      />
      <Section
        title="Top devices"
        rows={payload.topDevices ?? []}
        columns={genericColumns(['device', 'name', 'type'], ['sessions', 'users', 'count', 'visits', 'value'])}
      />
      <Section
        title="Top browsers"
        rows={payload.topBrowsers ?? []}
        columns={genericColumns(['browser', 'name'], ['sessions', 'users', 'count', 'visits', 'value'])}
      />
    </div>
  )
}

function Section({
  title,
  rows,
  columns,
}: {
  title: string
  rows: Array<Record<string, unknown>>
  columns: Column<Record<string, unknown>>[]
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-[#101414]">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()}`} message="Not present in this snapshot." />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) =>
            `${pickString(r, ['id', 'name', 'path', 'url', 'source', 'page', 'domain', 'device', 'browser'])}-${pickString(r, ['sessions', 'users', 'count', 'visits', 'value'])}`
          }
          loading={false}
        />
      )}
    </div>
  )
}
