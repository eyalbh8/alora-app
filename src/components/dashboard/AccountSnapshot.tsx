import type { ReactNode } from 'react'
import type { BriefSnapshot } from '../../lib/dashboard/briefInsights'
import { formatNumber, formatPercent, formatScore } from '../../lib/format'
import { DeltaBadge } from './DeltaBadge'

interface SnapshotMetric {
  label: string
  value: string
  detail: string
  delta?: ReactNode
}

interface AccountSnapshotProps {
  snapshot: BriefSnapshot
  embedded?: boolean
}

export function AccountSnapshot({ snapshot, embedded = false }: AccountSnapshotProps) {
  const metrics: SnapshotMetric[] = [
    {
      label: 'Total AI mentions',
      value: formatNumber(snapshot.totalMentions, 0),
      detail: 'Across all tracked models',
    },
    {
      label: 'Your share of voice',
      value: formatPercent(snapshot.shareOfVoice, 1),
      detail: 'Of tracked category mentions',
    },
    {
      label: 'Average rank',
      value: formatScore(snapshot.averageRank),
      detail: 'Lower is better',
      delta:
        snapshot.rankDelta != null ? (
          <DeltaBadge value={snapshot.rankDelta} mode="absolute" invert />
        ) : undefined,
    },
    {
      label: 'Sentiment score',
      value: formatNumber(snapshot.sentiment, 0),
      detail: 'Out of 100',
      delta:
        snapshot.sentimentDelta != null ? (
          <DeltaBadge value={snapshot.sentimentDelta} mode="absolute" />
        ) : undefined,
    },
    {
      label: 'Prompts monitored',
      value: formatNumber(snapshot.promptsCount, 0),
      detail: 'Active questions in scope',
    },
  ]

  return (
    <section>
      {!embedded && (
        <header className="mb-5">
          <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">
            Period snapshot
          </h2>
          <p className="mt-0.5 text-xs text-muted">Headline performance for the selected range</p>
        </header>
      )}
      <div
        className={`overflow-x-auto border-line ${
          embedded ? 'border-t bg-surface/60' : 'border-y border-t-ink bg-bg'
        }`}
      >
        <div className="flex min-w-max md:min-w-full">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="flex min-w-[10.5rem] flex-1 flex-col border-r border-line px-5 py-5 last:border-r-0"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                {metric.label}
              </span>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="font-display text-[34px] font-normal leading-none tracking-[-0.02em] text-ink">
                  {metric.value}
                </span>
                {metric.delta}
              </div>
              <span className="mt-2 text-[11px] text-muted">{metric.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
