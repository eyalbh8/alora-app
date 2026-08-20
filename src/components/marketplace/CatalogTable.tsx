import { useEffect, useMemo, useState } from 'react'
import type { MarketplaceSite } from '../../api/geo'
import { formatCompactNumber, formatNumber } from '../../lib/format'
import { TablePagination, type PageSize } from '../TablePagination'
import { Pill } from '../Pill'
import { formatMarketplacePrice } from './formatPrice'
import { SiteCell } from './SiteCell'

function CategoryList({ categories }: { categories: string[] }) {
  if (!categories.length) return <span className="text-muted-dark">—</span>
  return <span className="text-xs text-muted">{categories.join(', ')}</span>
}

interface CatalogTableProps {
  rows: MarketplaceSite[]
  citedIds: Set<string>
}

export function CatalogTable({ rows, citedIds }: CatalogTableProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  const categories = useMemo(() => {
    const unique = new Set<string>()
    for (const row of rows) {
      for (const item of row.categories) unique.add(item)
    }
    return [...unique].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (category !== 'all' && !row.categories.includes(category)) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        (row.domain ?? '').toLowerCase().includes(q) ||
        (row.publisher ?? '').toLowerCase().includes(q) ||
        row.categories.some((item) => item.toLowerCase().includes(q))
      )
    })
  }, [rows, search, category])

  useEffect(() => {
    setPage(1)
  }, [search, category, pageSize, rows])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)

  return (
    <section aria-labelledby="marketplace-catalog-title">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="marketplace-catalog-title" className="text-[19px] font-semibold text-ink">
            All sites
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Full catalog of publishing sites available for placement.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {categories.length > 0 ? (
            <label className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="border-0 border-b border-muted-dark bg-transparent py-1.5 text-sm font-medium normal-case tracking-normal text-ink focus:border-accent focus:outline-none"
              >
                <option value="all">All</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="relative w-full sm:w-64">
            <svg
              className="pointer-events-none absolute top-1/2 left-0 h-4 w-4 -translate-y-1/2 text-muted-dark"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sites…"
              aria-label="Search marketplace sites"
              className="w-full border-0 border-b border-muted-dark bg-transparent py-2 pr-2 pl-7 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border-y border-line px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">No sites match</p>
          <p className="mt-1 text-sm text-muted">Try a different search or category.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="min-w-0 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Site
                  </th>
                  <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Price
                  </th>
                  <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Traffic
                  </th>
                  <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Rank
                  </th>
                  <th className="pb-2.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Mentions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const cited = citedIds.has(row.id) || (row.domain != null && citedIds.has(row.domain))
                  const inactive = row.status === 'INACTIVE'
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-line ${inactive ? 'opacity-50' : ''}`}
                    >
                      <td className="min-w-0 py-4 pr-3">
                        <SiteCell site={row} />
                        {row.categories.length ? (
                          <p className="mt-1.5 truncate text-[10px] text-muted">
                            <CategoryList categories={row.categories} />
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-right text-[13px] tabular-nums text-ink">
                        {formatMarketplacePrice(row.customerPriceCents, row.currency)}
                      </td>
                      <td className="px-3 py-4 text-right text-[13px] tabular-nums text-ink">
                        {formatCompactNumber(row.traffic)}
                      </td>
                      <td className="px-3 py-4 text-right text-[13px] tabular-nums text-ink">
                        {formatNumber(row.rank, 0)}
                      </td>
                      <td className="py-4 pl-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[13px] tabular-nums text-ink">
                            {formatNumber(row.mentions, 0)}
                          </span>
                          {cited ? <Pill tone="green">Cited</Pill> : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageStart={pageStart}
            pageEnd={Math.min(pageStart + pageSize, filtered.length)}
            total={filtered.length}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  )
}
