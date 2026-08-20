import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { Skeleton } from './LoadingSpinner'

export interface Column<T> {
  key: string
  header: string
  /** Sortable columns map header clicks to the API `sort` param ("field" / "-field"). */
  sortable?: boolean
  align?: 'left' | 'right'
  render: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  loading: boolean
  error?: string | null
  onRetry?: () => void
  /** Current API sort string, e.g. "-citations_count". */
  sort?: string
  onSortChange?: (sort: string) => void
  page?: number
  totalPages?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  emptyTitle?: string
  emptyMessage?: string
}

function SortIndicator({ active, descending }: { active: boolean; descending: boolean }) {
  if (!active) return <span className="text-muted-dark">↕</span>
  return <span className="text-ink">{descending ? '↓' : '↑'}</span>
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  page = 1,
  totalPages = 1,
  totalCount,
  onPageChange,
  emptyTitle = 'No rows found',
  emptyMessage = 'Try adjusting filters or the date range.',
}: DataTableProps<T>) {
  const sortField = sort?.startsWith('-') ? sort.slice(1) : sort
  const sortDescending = sort?.startsWith('-') ?? false

  const handleHeaderClick = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return
    // First click sorts descending (dashboard convention), second toggles.
    if (sortField === column.key) {
      onSortChange(sortDescending ? column.key : `-${column.key}`)
    } else {
      onSortChange(`-${column.key}`)
    }
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-soft">
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleHeaderClick(column)}
                  className={`px-4 py-3 text-[12px] font-medium whitespace-nowrap text-muted ${
                    column.align === 'right' ? 'text-right' : 'text-left'
                  } ${column.sortable ? 'cursor-pointer select-none hover:text-ink' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.header}
                    {column.sortable && (
                      <SortIndicator active={sortField === column.key} descending={sortDescending} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-line">
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-line transition hover:bg-paper-soft/70">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 text-ink ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length === 0 && (
        <div className="p-4">
          <EmptyState title={emptyTitle} message={emptyMessage} />
        </div>
      )}

      {(totalPages > 1 || totalCount !== undefined) && (
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
          <span className="text-[12px] text-muted-dark">
            {totalCount !== undefined ? `${totalCount.toLocaleString()} total` : ''}
          </span>
          {totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(page - 1)}
                className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[12px] text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
                className="rounded-full border border-line px-3 py-1 text-[13px] font-medium text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
