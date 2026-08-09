import type { TopicPlatformCell } from '../../lib/analytics'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'
import { formatPercent, providerLabel, truncateMiddle } from '../../lib/format'

interface TopicPlatformCitationTableProps {
  title?: string
  subtitle?: string
  rows: TopicPlatformCell[]
  providers: string[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

export function TopicPlatformCitationTable({
  title = 'Topic Citation Rate by Platform',
  subtitle = 'How often your brand is cited in AI responses across platforms for each topic.',
  rows,
  providers,
  loading,
  error,
  onRetry,
  hasData,
}: TopicPlatformCitationTableProps) {
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
        <EmptyState title="No topic citation data" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs font-medium text-slate-400">
              <tr className="border-b border-slate-100">
                <th className="pb-2 pr-3 font-medium">Topic</th>
                {providers.map((p) => (
                  <th key={p} className="pb-2 px-2 text-right font-medium">
                    {providerLabel(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.topicId} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-slate-700" title={row.topicName}>
                    {truncateMiddle(row.topicName, 36)}
                  </td>
                  {providers.map((p) => (
                    <td
                      key={p}
                      className="px-2 py-2.5 text-right tabular-nums text-slate-600"
                    >
                      {formatPercent(row.byProvider[p] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
