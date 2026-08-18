import { useEffect, useRef, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export interface TablePaginationProps {
  pageSize: PageSize
  onPageSizeChange: (size: PageSize) => void
  pageStart: number
  pageEnd: number
  total: number
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function TablePagination({
  pageSize,
  onPageSizeChange,
  pageStart,
  pageEnd,
  total,
  currentPage,
  totalPages,
  onPageChange,
}: TablePaginationProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const rangeLabel =
    total === 0
      ? '0–0 of 0'
      : `${(pageStart + 1).toLocaleString()}–${pageEnd.toLocaleString()} of ${total.toLocaleString()}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8d3ca] py-2.5 pl-1 text-sm text-[#5f5a53] sm:justify-end sm:gap-5">
      <div ref={rootRef} className="relative flex items-center gap-2">
        <span className="hidden sm:inline">Rows per page:</span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Rows per page"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm text-[#101414] hover:bg-[#ece8e1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {pageSize}
          <svg className="h-4 w-4 text-[#8b857c]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </button>
        {open && (
          <ul
            role="listbox"
            aria-label="Rows per page"
            className="absolute bottom-full left-1/2 z-50 mb-1 min-w-[4.5rem] -translate-x-1/2 rounded-lg bg-white p-1 shadow-lg ring-1 ring-black/5"
          >
            {[...PAGE_SIZE_OPTIONS].reverse().map((size) => {
              const selected = pageSize === size
              return (
                <li key={size} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onPageSizeChange(size)
                      setOpen(false)
                    }}
                    className={`flex w-full justify-center rounded-md px-3 py-1.5 text-sm ${
                      selected
                        ? 'bg-[#efe8f6] text-[#101414]'
                        : 'text-[#101414] hover:bg-[#f3f1ec]'
                    }`}
                  >
                    {size}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <span className="tabular-nums">{rangeLabel}</span>

      <div className="flex items-center">
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="rounded-full p-1.5 text-[#101414] hover:bg-[#ece8e1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:text-[#c5c0b8] disabled:hover:bg-transparent"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage >= totalPages || total === 0}
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded-full p-1.5 text-[#101414] hover:bg-[#ece8e1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:text-[#c5c0b8] disabled:hover:bg-transparent"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
