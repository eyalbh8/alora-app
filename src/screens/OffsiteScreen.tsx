import { useEffect, useMemo, useState } from 'react'
import { listCitations, listDomains } from '../api/airops'
import type { ApiFilter, CitationRow, DomainRow } from '../api/types'
import { CitationRankTable } from '../components/analytics/CitationRankTable'
import { ChartCard } from '../components/ChartCard'
import { DataTable, type Column } from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { MetricCard } from '../components/MetricCard'
import { Pill, type PillTone } from '../components/Pill'
import { useApi } from '../hooks/useApi'
import { summarizeRedditCommunity } from '../lib/community'
import { lastNDaysThroughToday } from '../lib/dates'
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

const OFFSITE_TABS = ['citations', 'domains', 'community'] as const
type OffsiteTab = (typeof OFFSITE_TABS)[number]

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

/** Fetch every citations page for community aggregation. */
async function listAllCitationsForRange(range: {
  start_date: string
  end_date: string
}): Promise<CitationRow[]> {
  const all: CitationRow[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await listCitations({
      ...range,
      sort: '-citation_count',
      per_page: 100,
      page,
    })
    all.push(...res.data)
    totalPages = res.meta.total_pages || 1
    page += 1
  } while (page <= totalPages)
  return all
}

function CitationsTab() {
  const range = useMemo(() => lastNDaysThroughToday(30), [])
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
          className="text-brand-700 hover:underline"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm focus:border-brand-400 focus:outline-none"
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
  const range = useMemo(() => lastNDaysThroughToday(30), [])
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

function CommunityTab() {
  const range = useMemo(() => lastNDaysThroughToday(30), [])
  const inventory = useApi(() => listAllCitationsForRange(range), [range.start_date, range.end_date])

  const summary = useMemo(
    () => summarizeRedditCommunity(inventory.data ?? []),
    [inventory.data],
  )

  const topUrlRows = useMemo(
    () =>
      summary.urls.slice(0, 10).map((row, i) => ({
        id: `${row.url}-${i}`,
        label: row.url,
        href: row.url,
        logoUrl: row.logo_url,
        citationShare: row.citation_share,
        citationCount: row.citation_count,
      })),
    [summary.urls],
  )

  const maxSubredditRate = Math.max(1, ...summary.subreddits.map((s) => s.citationRate))

  return (
    <div className="flex flex-col gap-4">
      {inventory.error ? (
        <ErrorState message={inventory.error} onRetry={inventory.retry} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricCard
            label="Reddit Citation Rate"
            value={formatPercent(summary.citationRate)}
            loading={inventory.loading}
            trend={null}
          />
          <MetricCard
            label="Reddit Citations"
            value={formatNumber(summary.citationCount)}
            loading={inventory.loading}
            trend={null}
            trendPercent={false}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-[#101414]">Citation Rate by Subreddit</h2>
            <p className="text-xs text-slate-400">
              How often the top subreddits are cited in AI responses
            </p>
          </div>
          {inventory.loading ? (
            <LoadingSpinner />
          ) : inventory.error ? (
            <ErrorState message={inventory.error} onRetry={inventory.retry} />
          ) : summary.subreddits.length === 0 ? (
            <EmptyState
              title="No subreddit citations"
              message="No Reddit threads were cited in AI answers for this period."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.subreddits.map((sub) => (
                <li key={sub.subreddit} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                      <a
                        href={`https://www.reddit.com/r/${sub.subreddit}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {sub.label}
                      </a>
                    </div>
                    <span className="text-sm tabular-nums text-slate-600">
                      {formatPercent(sub.citationRate)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-400 transition-all"
                      style={{ width: `${(sub.citationRate / maxSubredditRate) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CitationRankTable
          title="Top Reddit URLs"
          subtitle="Reddit posts cited more often"
          rows={topUrlRows}
          loading={inventory.loading}
          error={inventory.error}
          onRetry={inventory.retry}
          hasData={topUrlRows.length > 0}
          urlMode
        />
      </div>

      <ChartCard
        title="Subreddit Citation Rate"
        subtitle="Citation rate across subreddits cited in AI answers."
        loading={inventory.loading}
        error={inventory.error}
        onRetry={inventory.retry}
        hasData={summary.subreddits.length > 0}
      >
        <ul className="flex flex-col gap-3 pt-1">
          {summary.subreddits.map((sub) => (
            <li key={sub.subreddit} className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-3">
              <span className="truncate text-sm font-medium text-slate-700" title={sub.label}>
                {sub.label}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${(sub.citationRate / maxSubredditRate) * 100}%` }}
                />
              </div>
              <span className="text-right text-sm tabular-nums text-slate-600">
                {formatPercent(sub.citationRate)}
              </span>
            </li>
          ))}
        </ul>
      </ChartCard>
    </div>
  )
}

export function OffsiteScreen() {
  const [tab, setTab] = useState<OffsiteTab>('citations')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#101414]">Offsite</h1>

      <div className="flex gap-5 border-b border-slate-200">
        {OFFSITE_TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-medium capitalize transition ${
              tab === name
                ? 'border-brand-400 text-[#101414]'
                : 'border-transparent text-slate-500 hover:text-[#101414]'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'citations' ? (
        <CitationsTab />
      ) : tab === 'domains' ? (
        <DomainsTab />
      ) : (
        <CommunityTab />
      )}
    </div>
  )
}
