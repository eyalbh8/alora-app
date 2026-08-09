import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'
import { formatNumber, formatPercent, truncateMiddle } from '../../lib/format'

export interface CitationRankRow {
  id: string
  label: string
  href?: string | null
  logoUrl?: string | null
  citationShare: number | null
  citationCount: number | null
}

interface CitationRankTableProps {
  title: string
  subtitle: string
  rows: CitationRankRow[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
  /** When true, treat label as a URL (truncate + link). */
  urlMode?: boolean
}

export function CitationRankTable({
  title,
  subtitle,
  rows,
  loading,
  error,
  onRetry,
  hasData,
  urlMode = false,
}: CitationRankTableProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData || rows.length === 0 ? (
        <EmptyState title="No citations found" />
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs font-medium text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="pb-2 pr-2 font-medium">{urlMode ? 'URL' : 'Domain'}</th>
                <th className="pb-2 pr-2 text-right font-medium">% of Total</th>
                <th className="pb-2 text-right font-medium">Citations</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 shrink-0 text-xs text-slate-400">{i + 1}.</span>
                      {!urlMode && row.logoUrl ? (
                        <img
                          src={row.logoUrl}
                          alt=""
                          className="h-4 w-4 shrink-0 rounded object-contain"
                        />
                      ) : null}
                      {row.href ? (
                        <a
                          href={row.href.startsWith('http') ? row.href : `https://${row.href}`}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-slate-700 hover:text-emerald-700 hover:underline"
                          title={row.label}
                        >
                          {urlMode ? truncateMiddle(row.label, 48) : row.label}
                        </a>
                      ) : (
                        <span className="truncate text-slate-700" title={row.label}>
                          {urlMode ? truncateMiddle(row.label, 48) : row.label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-slate-600">
                    {formatPercent(row.citationShare)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600">
                    {formatNumber(row.citationCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
