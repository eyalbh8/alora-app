import { useEffect, useMemo, useState } from 'react'
import { listCitations, listDomains } from '../api/airops'
import type { ApiFilter, CitationRow, DomainRow } from '../api/types'
import { DataTable, type Column } from '../components/DataTable'
import { Pill, type PillTone } from '../components/Pill'
import { useApi } from '../hooks/useApi'
import { lastNDaysEndingYesterday } from '../lib/dates'
import { formatNumber, formatPercent, truncateMiddle } from '../lib/format'

const DOMAIN_CATEGORIES = [
  'Social',
  'Communities',
  'Reviews',
  'Media',
  'Educational',
  'Marketplaces',
  'Products',
  'Affiliates',
  'Other',
  'Owned',
  'Competitors',
  'No Category',
]

const CATEGORY_TONES: Record<string, PillTone> = {
  Social: 'blue',
  Communities: 'purple',
  Reviews: 'yellow',
  Media: 'pink',
  Educational: 'teal',
  Marketplaces: 'orange',
  Products: 'green',
  Affiliates: 'red',
  Owned: 'blue',
  Competitors: 'red',
  Other: 'grey',
}

function CategoryPill({ category }: { category: string | null }) {
  if (!category) return <span className="text-slate-300">—</span>
  return <Pill tone={CATEGORY_TONES[category] ?? 'grey'}>{category}</Pill>
}

function DomainCell({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-5 w-5 shrink-0 rounded-sm object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-slate-100 text-[10px] font-semibold text-slate-400">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="font-medium text-slate-800">{name}</span>
    </div>
  )
}

function InfluenceScoreCell({ row }: { row: CitationRow }) {
  const breakdown = row.influence_score_breakdown
  const tooltip = breakdown
    ? `Coverage: ${breakdown.coverage_score} · Impact: ${breakdown.impact_score} · Domain authority: ${breakdown.da_score}`
    : undefined
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 font-medium ${breakdown ? 'cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2' : ''}`}
    >
      {formatNumber(row.influence_score)}
    </span>
  )
}

function CitationsTab() {
  const range = useMemo(() => lastNDaysEndingYesterday(30), [])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-citation_count')
  const [category, setCategory] = useState('')

  // The citations endpoint only supports EQUALS/EQ/IN operators.
  const filters = useMemo(() => {
    const list: ApiFilter[] = []
    if (category) list.push({ field: 'domain_category', operator: 'EQUALS', value: category })
    return list
  }, [category])

  useEffect(() => setPage(1), [filters, sort])

  const citations = useApi(
    () =>
      listCitations({
        ...range,
        filters: filters.length ? filters : undefined,
        sort,
        page,
        per_page: 25,
      }),
    [range, filters, sort, page],
  )

  const columns: Column<CitationRow>[] = [
    {
      key: 'domain_name',
      header: 'Domain',
      render: (row) => <DomainCell name={row.domain_name} logoUrl={row.logo_url} />,
    },
    {
      key: 'url',
      header: 'URL',
      render: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          title={row.url}
          className="text-indigo-600 hover:underline"
        >
          {truncateMiddle(row.url, 48)}
        </a>
      ),
    },
    {
      key: 'domain_category',
      header: 'Category',
      render: (row) => <CategoryPill category={row.domain_category} />,
    },
    {
      key: 'citation_count',
      header: 'Citations',
      sortable: true,
      align: 'right',
      render: (row) => formatNumber(row.citation_count),
    },
    {
      key: 'citation_share',
      header: 'Citation Share',
      sortable: true,
      align: 'right',
      render: (row) => formatPercent(row.citation_share),
    },
    {
      key: 'citation_rate',
      header: 'Citation Rate',
      sortable: true,
      align: 'right',
      render: (row) => formatPercent(row.citation_rate),
    },
    {
      key: 'influence_score',
      header: 'Influence',
      sortable: true,
      align: 'right',
      render: (row) => <InfluenceScoreCell row={row} />,
    },
    {
      key: 'domain_authority',
      header: 'DA',
      align: 'right',
      render: (row) => formatNumber(row.domain_authority),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All categories</option>
          {DOMAIN_CATEGORIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={citations.data?.data ?? []}
        rowKey={(row) => row.url}
        loading={citations.loading}
        error={citations.error}
        onRetry={citations.retry}
        sort={sort}
        onSortChange={setSort}
        page={page}
        totalPages={citations.data?.meta.total_pages ?? 1}
        totalCount={citations.data?.meta.total_count}
        onPageChange={setPage}
        emptyTitle="No citations found"
        emptyMessage="No URLs have been cited in AI answers for this period and filter."
      />
    </div>
  )
}

function DomainsTab() {
  const range = useMemo(() => lastNDaysEndingYesterday(30), [])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-citation_count')

  useEffect(() => setPage(1), [sort])

  const domains = useApi(
    () => listDomains({ ...range, sort, page, per_page: 25 }),
    [range, sort, page],
  )

  const columns: Column<DomainRow>[] = [
    {
      key: 'domain_name',
      header: 'Domain',
      render: (row) => <DomainCell name={row.domain_name} logoUrl={row.logo_url} />,
    },
    {
      key: 'domain_category',
      header: 'Category',
      render: (row) => <CategoryPill category={row.domain_category} />,
    },
    {
      key: 'citation_count',
      header: 'Citations',
      sortable: true,
      align: 'right',
      render: (row) => formatNumber(row.citation_count),
    },
    {
      key: 'url_count',
      header: 'URLs',
      align: 'right',
      render: (row) => formatNumber(row.url_count),
    },
    {
      key: 'citation_share',
      header: 'Citation Share',
      sortable: true,
      align: 'right',
      render: (row) => formatPercent(row.citation_share),
    },
    {
      key: 'citation_rate',
      header: 'Citation Rate',
      sortable: true,
      align: 'right',
      render: (row) => formatPercent(row.citation_rate),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={domains.data?.data ?? []}
      rowKey={(row) => row.domain_id}
      loading={domains.loading}
      error={domains.error}
      onRetry={domains.retry}
      sort={sort}
      onSortChange={setSort}
      page={page}
      totalPages={domains.data?.meta.total_pages ?? 1}
      totalCount={domains.data?.meta.total_count}
      onPageChange={setPage}
      emptyTitle="No domains found"
      emptyMessage="No domains have been cited in AI answers for this period."
    />
  )
}

export function OffsiteScreen() {
  const [tab, setTab] = useState<'citations' | 'domains'>('citations')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm self-start">
        {(['citations', 'domains'] as const).map((name) => (
          <button
            key={name}
            onClick={() => setTab(name)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === name
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'citations' ? <CitationsTab /> : <DomainsTab />}
    </div>
  )
}
