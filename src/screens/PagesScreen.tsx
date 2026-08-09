import { useEffect, useMemo, useState } from 'react'
import { listWebPages } from '../api/airops'
import type { ApiFilter, WebPageRow } from '../api/types'
import { DataTable, type Column } from '../components/DataTable'
import { NotConnectedBadge } from '../components/NotConnectedBadge'
import { TrendBadge } from '../components/TrendBadge'
import { useApi } from '../hooks/useApi'
import { lastNDaysEndingYesterday } from '../lib/dates'
import { formatNumber, formatPercent, truncateMiddle } from '../lib/format'

/**
 * GSC/GA4 cell: null means the integration isn't connected — render a
 * "Not connected" pill, never 0 or a blank.
 */
function IntegrationCell({
  value,
  diff,
  source,
  percent = false,
}: {
  value: number | null
  diff?: number | null
  source: 'GSC' | 'GA4'
  percent?: boolean
}) {
  if (value === null) return <NotConnectedBadge source={source} />
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span>{percent ? formatPercent(value) : formatNumber(value)}</span>
      {diff !== undefined && <TrendBadge value={diff} percent={percent} />}
    </div>
  )
}

export function PagesScreen() {
  const range = useMemo(() => lastNDaysEndingYesterday(30), [])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-citations_count')
  const [urlQuery, setUrlQuery] = useState('')
  const [debouncedUrlQuery, setDebouncedUrlQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [folderOptions, setFolderOptions] = useState<string[]>([])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUrlQuery(urlQuery), 350)
    return () => clearTimeout(timer)
  }, [urlQuery])

  const filters = useMemo(() => {
    const list: ApiFilter[] = []
    if (debouncedUrlQuery) list.push({ field: 'url', operator: 'CONTAINS', value: debouncedUrlQuery })
    if (folder) list.push({ field: 'folder_name', operator: 'EQUALS', value: folder })
    return list
  }, [debouncedUrlQuery, folder])

  // Reset to page 1 whenever the query changes.
  useEffect(() => setPage(1), [filters, sort])

  const pages = useApi(
    () =>
      listWebPages({
        ...range,
        filters: filters.length ? filters : undefined,
        sort,
        page,
        per_page: 25,
      }),
    [range, filters, sort, page],
  )

  // There is no folders endpoint — accumulate folder names seen in results.
  useEffect(() => {
    const names = (pages.data?.data ?? [])
      .map((row) => row.folder_name)
      .filter((name): name is string => Boolean(name))
    if (names.length) {
      setFolderOptions((prev) => [...new Set([...prev, ...names])].sort())
    }
  }, [pages.data])

  const columns: Column<WebPageRow>[] = [
    {
      key: 'url',
      header: 'URL',
      sortable: true,
      render: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          title={row.url}
          className="font-medium text-indigo-600 hover:underline"
        >
          {truncateMiddle(row.url, 52)}
        </a>
      ),
    },
    {
      key: 'folder_name',
      header: 'Folder',
      render: (row) => <span className="text-slate-500">{row.folder_name ?? '—'}</span>,
    },
    {
      key: 'primary_keyword',
      header: 'Primary Keyword',
      render: (row) => <span className="text-slate-500">{row.primary_keyword || '—'}</span>,
    },
    {
      key: 'citations_count',
      header: 'Citations',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <span>{formatNumber(row.citations_count)}</span>
          <TrendBadge value={row.citations_count_diff} />
        </div>
      ),
    },
    {
      key: 'citation_rate',
      header: 'Citation Rate',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <span>{formatPercent(row.citation_rate)}</span>
          <TrendBadge value={row.citation_rate_diff} percent />
        </div>
      ),
    },
    {
      key: 'prompts_count',
      header: 'Prompts',
      sortable: true,
      align: 'right',
      render: (row) => formatNumber(row.prompts_count),
    },
    {
      key: 'clicks',
      header: 'Clicks',
      sortable: true,
      align: 'right',
      render: (row) => <IntegrationCell value={row.clicks} diff={row.clicks_diff} source="GSC" />,
    },
    {
      key: 'impressions',
      header: 'Impressions',
      sortable: true,
      align: 'right',
      render: (row) => (
        <IntegrationCell value={row.impressions} diff={row.impressions_diff} source="GSC" />
      ),
    },
    {
      key: 'ctr',
      header: 'CTR',
      align: 'right',
      render: (row) => <IntegrationCell value={row.ctr} diff={row.ctr_diff} source="GSC" percent />,
    },
    {
      key: 'position',
      header: 'Position',
      sortable: true,
      align: 'right',
      render: (row) =>
        row.position === null ? (
          <NotConnectedBadge source="GSC" />
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            <span>{formatNumber(row.position)}</span>
            {/* Lower position is better */}
            <TrendBadge value={row.position_diff} invert />
          </div>
        ),
    },
    {
      key: 'traffic',
      header: 'Traffic',
      sortable: true,
      align: 'right',
      render: (row) => <IntegrationCell value={row.traffic} diff={row.traffic_diff} source="GA4" />,
    },
    {
      key: 'sessions',
      header: 'Sessions',
      align: 'right',
      render: (row) => (
        <IntegrationCell value={row.sessions} diff={row.sessions_diff} source="GA4" />
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement',
      align: 'right',
      render: (row) => (
        <IntegrationCell value={row.engagement} diff={row.engagement_diff} source="GA4" />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={urlQuery}
          onChange={(e) => setUrlQuery(e.target.value)}
          placeholder="Filter by URL…"
          className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
        />
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All folders</option>
          {folderOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={pages.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={pages.loading}
        error={pages.error}
        onRetry={pages.retry}
        sort={sort}
        onSortChange={setSort}
        page={page}
        totalPages={pages.data?.meta.total_pages ?? 1}
        totalCount={pages.data?.meta.total_count}
        onPageChange={setPage}
        emptyTitle="No pages found"
        emptyMessage="No tracked pages match the current filters. Pages appear here once AirOps starts tracking your site."
      />
    </div>
  )
}
