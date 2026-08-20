import { useEffect, useMemo, useState } from 'react'
import type { CitationUrl } from '../../api/geo'
import { formatRelativeTime } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import { BrandLogo } from '../competitors/BrandLogo'
import { Pill } from '../Pill'
import { TablePagination, type PageSize } from '../TablePagination'
import { humanizeType, typeTone } from './constants'

interface DomainUrlsTableProps {
  domain: string
  rows: CitationUrl[]
  onSelect: (row: CitationUrl) => void
  onBack: () => void
}

export function DomainUrlsTable({ domain, rows, onSelect, onBack }: DomainUrlsTableProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.url.toLowerCase().includes(q) ||
        row.urlType.toLowerCase().includes(q),
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
    <section aria-labelledby="citations-urls-title">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 border border-line px-2 py-1 text-sm text-muted hover:border-ink hover:text-ink"
            aria-label="Back to domains"
          >
            ←
          </button>
          <div>
            <h2 id="citations-urls-title" className="text-[17px] font-semibold text-ink">
              {domain}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">Pages cited from this domain.</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-dark"
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
            placeholder="Search pages…"
            aria-label="Search cited pages"
            className="w-full rounded-full border border-line bg-surface py-2 pr-3 pl-9 text-sm text-ink placeholder:text-muted shadow-soft focus:border-ink focus:outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface px-6 py-12 text-center shadow-soft">
          <p className="text-base font-semibold text-ink">No pages found</p>
          <p className="mt-1 text-sm text-muted">This domain has no cited URLs in the selected period.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface px-4 shadow-soft">
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-soft">
                  <th className="min-w-0 pb-2.5 pr-3 text-left text-[12px] font-medium text-muted">
                    URL
                  </th>
                  <th className="px-3 pb-2.5 text-left text-[12px] font-medium text-muted">
                    URL type
                  </th>
                  <th className="px-3 pb-2.5 text-right text-[12px] font-medium text-muted">
                    Mentions
                  </th>
                  <th className="px-3 pb-2.5 text-right text-[12px] font-medium text-muted">
                    Avg citations
                  </th>
                  <th className="pb-2.5 pl-3 text-right text-[12px] font-medium text-muted">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.url}
                    className="cursor-pointer border-b border-line hover:bg-paper-soft/70"
                    onClick={() => onSelect(row)}
                  >
                    <td className="min-w-0 py-4 pr-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <BrandLogo
                          name={row.domain || domain}
                          domain={row.domain || domain}
                          size="md"
                          shape="rounded"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{row.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted">{row.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <Pill tone={typeTone(row.urlType)}>{humanizeType(row.urlType)}</Pill>
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-ink">
                      {formatNumber(row.mentions, 0)}
                    </td>
                    <td className="px-3 py-4 text-right tabular-nums text-ink">
                      {formatNumber(row.avgCitations, 1)}
                    </td>
                    <td className="py-4 pl-3 text-right text-xs text-muted">
                      {formatRelativeTime(row.lastUpdated)}
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
