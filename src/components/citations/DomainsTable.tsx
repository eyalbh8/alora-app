import { useEffect, useMemo, useState } from 'react'
import type { CitationDomain } from '../../api/geo'
import { formatNumber, formatPercent } from '../../lib/format'
import { BrandLogo } from '../competitors/BrandLogo'
import { Pill } from '../Pill'
import { TablePagination, type PageSize } from '../TablePagination'
import { humanizeType, typeTone } from './constants'

interface DomainsTableProps {
  rows: CitationDomain[]
  total?: number
  onSelect: (domain: string) => void
}

export function DomainsTable({ rows, total, onSelect }: DomainsTableProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.domain.toLowerCase().includes(q) ||
        row.domainType.toLowerCase().includes(q),
    )
  }, [rows, search])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, rows])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(pageStart, pageStart + pageSize)

  return (
    <section aria-labelledby="citations-domains-title">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="citations-domains-title" className="text-[19px] font-semibold text-ink">
            Sources
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Domains cited in AI answers. Open a row to see its pages.
            {total != null && total > rows.length
              ? ` Showing the top ${rows.length.toLocaleString()} of ${total.toLocaleString()}.`
              : ''}
          </p>
        </div>
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
            placeholder="Search domains…"
            aria-label="Search cited domains"
            className="w-full border-0 border-b border-muted-dark bg-transparent py-2 pr-2 pl-7 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border-y border-line px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">No domains match</p>
          <p className="mt-1 text-sm text-muted">Try a different search or date range.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="w-10 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    #
                  </th>
                  <th className="min-w-0 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Source
                  </th>
                  <th className="px-3 pb-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Domain type
                  </th>
                  <th className="px-3 pb-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Used
                  </th>
                  <th className="pb-2.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Avg citations
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => (
                  <tr
                    key={row.domain}
                    className="cursor-pointer border-b border-line hover:bg-paper-soft/70"
                    onClick={() => onSelect(row.domain)}
                  >
                    <td className="py-4 pr-3 font-mono text-[11px] tabular-nums text-muted">
                      {String(pageStart + index + 1).padStart(2, '0')}
                    </td>
                    <td className="min-w-0 py-4 pr-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <BrandLogo name={row.domain} domain={row.domain} size="md" shape="rounded" />
                        <span className="min-w-0 truncate font-medium text-ink">{row.domain}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <Pill tone={typeTone(row.domainType)}>{humanizeType(row.domainType)}</Pill>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-ink">
                      {formatPercent(row.usedPercent, 1)}
                    </td>
                    <td className="py-4 pl-3 text-right tabular-nums text-ink">
                      {formatNumber(row.avgCitations, 1)}
                    </td>
                  </tr>
                ))}
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
