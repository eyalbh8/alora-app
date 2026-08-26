import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProviderMention } from '../../api/types'
import { useAnalyticsFilters } from '../../context/AnalyticsFiltersContext'
import { useProviderMentionPrompts } from '../../hooks/useProviderMentionPrompts'
import { daysInRange, matchActivePresetDays } from '../../lib/dates'
import { formatNumber, providerLabel } from '../../lib/format'
import { DeltaBadge } from './DeltaBadge'
import { PROVIDER_ORDER } from './constants'
import { ProviderIcon } from '../ProviderIcon'

function periodLabel(
  startDate: string,
  endDate: string,
  endDay: string,
  minDay?: string | null,
): string {
  const days = daysInRange({ startDate, endDate })
  const preset = matchActivePresetDays({ startDate, endDate }, endDay, minDay)
  if (preset === 1) return 'last 24 hours'
  if (preset) return `last ${preset} days`
  return `selected period (${days} days)`
}

interface ProviderMentionCardProps {
  mention: ProviderMention
}

function ProviderMentionCard({ mention }: ProviderMentionCardProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { filters, setProviders, presetEndDay, factDays } = useAnalyticsFilters()
  const { data, loading } = useProviderMentionPrompts(open ? mention.provider : null)
  const prompts = data?.prompts ?? []

  const label = providerLabel(mention.provider)
  const clickable = (mention.count ?? 0) > 0

  return (
    <>
      <div className="flex min-w-[10.5rem] flex-1 flex-col border-r border-line px-5 py-5 last:border-r-0">
        <div className="mb-3 flex items-center gap-2">
          <ProviderIcon provider={mention.provider} size="sm" />
          <span className="truncate text-[12px] font-medium text-muted">
            {label}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <button
            type="button"
            disabled={!clickable}
            onClick={() => clickable && setOpen(true)}
            className={`text-[34px] font-medium leading-none tracking-[-0.03em] text-ink tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
              clickable ? 'cursor-pointer hover:text-accent' : 'cursor-default opacity-60'
            }`}
          >
            {formatNumber(mention.count, 0)}
          </button>
          {mention.countChange != null && (
            <DeltaBadge value={mention.countChange} mode="percent" />
          )}
        </div>

        <p className="mt-2 whitespace-nowrap text-[11px] text-muted">
          Answers citing you,{' '}
          {periodLabel(filters.startDate, filters.endDate, presetEndDay ?? filters.endDate, factDays?.min)}
        </p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface "
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={mention.provider} size="md" />
                <h3 className="text-lg font-semibold text-ink">
                  Prompts driving {label} visibility
                </h3>
              </div>
              <p className="mt-1 text-sm text-muted">
                {loading ? 'Loading prompts…' : `${prompts.length} prompts where your brand appeared`}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-paper-soft" />
                  ))}
                </div>
              ) : prompts.length > 0 ? (
                <ul className="space-y-1">
                  {prompts.map((item, i) => (
                    <li key={item.promptId ?? i}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-paper-soft"
                        onClick={() => {
                          setProviders([mention.provider])
                          setOpen(false)
                          if (item.promptId) navigate(`/prompts?prompt=${item.promptId}`)
                          else navigate('/prompts')
                        }}
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-surface0" />
                        <span className="text-sm font-medium text-ink">{item.prompt}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-muted">No visibility-driving prompts for this platform.</p>
              )}
            </div>

            <div className="border-t border-line px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper-soft"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface ProviderMentionCardsRowProps {
  mentions: ProviderMention[]
  availableProviders?: string[]
  embedded?: boolean
}

export function ProviderMentionCardsRow({
  mentions,
  availableProviders,
  embedded = false,
}: ProviderMentionCardsRowProps) {
  const sorted = useMemo(() => {
    const order = availableProviders?.length
      ? PROVIDER_ORDER.filter((p) => availableProviders.includes(p))
      : [...PROVIDER_ORDER]

    return order.map((provider) => {
      const existing = mentions.find((m) => m.provider === provider)
      return (
        existing ?? {
          provider,
          count: 0,
          countChange: 0,
        }
      )
    })
  }, [mentions, availableProviders])

  if (sorted.length === 0) return null

  return (
    <section>
      <header
        className={
          embedded
            ? 'flex flex-col gap-0.5 border-t border-line bg-paper-soft px-5 py-3 sm:flex-row sm:items-baseline sm:gap-3'
            : 'mb-5'
        }
      >
        <h2
          className={
            embedded
              ? 'text-xs font-medium text-ink'
              : 'text-[17px] font-semibold tracking-[-0.01em] text-ink'
          }
        >
          By platform
        </h2>
        <p className="text-xs text-muted">Where AI models are choosing to surface your brand</p>
      </header>
      <div
        className={`overflow-x-auto border-line ${
          embedded ? 'border-t bg-surface' : 'rounded-lg border bg-surface shadow-soft'
        }`}
      >
        <div className="flex min-w-max md:min-w-full">
          {sorted.map((mention) => (
            <ProviderMentionCard key={mention.provider} mention={mention} />
          ))}
        </div>
      </div>
    </section>
  )
}
