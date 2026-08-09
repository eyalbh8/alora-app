import type { AnalyticsRow, Topic } from '../../api/types'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { LoadingSpinner } from '../LoadingSpinner'
import { formatPercent } from '../../lib/format'

interface TopicMentionChartProps {
  title: string
  subtitle: string
  rows: AnalyticsRow[]
  topics: Topic[]
  brandName: string
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

export function TopicMentionChart({
  title,
  subtitle,
  rows,
  topics,
  brandName,
  loading,
  error,
  onRetry,
  hasData,
}: TopicMentionChartProps) {
  const topicById = new Map(topics.map((t) => [String(t.id), t]))

  const items = rows.map((row) => {
    const topicId = String(row.topic ?? '')
    const topic = topicById.get(topicId)
    return {
      id: topicId,
      name: topic?.name ?? topicId,
      value: row.mention_rate ?? null,
    }
  })

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData ? (
        <EmptyState title="No data available" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between px-[7.5rem] text-[10px] text-slate-400">
            {['0%', '25%', '50%', '75%', '100%'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const pct = item.value ?? 0
              return (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="flex w-28 shrink-0 items-center gap-2">
                    <div className="h-3 w-3 shrink-0 rounded-sm bg-teal-500" />
                    <span className="truncate text-xs font-medium text-slate-700" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <div className="relative h-6 flex-1 rounded bg-slate-50">
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                      <div
                        className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-slate-200"
                        aria-hidden
                      />
                      <div
                        className="absolute top-1/2 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-[9px] font-bold text-white shadow"
                        style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
                        title={`${brandName}: ${formatPercent(item.value)}`}
                      >
                        {brandName.charAt(0).toLowerCase()}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
