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
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ProviderIcon provider={mention.provider} size="md" />
          <span className="truncate text-sm font-medium text-slate-700">{label}</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <button
            type="button"
            disabled={!clickable}
            onClick={() => clickable && setOpen(true)}
            className={`text-left text-3xl font-semibold leading-none text-[#101414] transition ${
              clickable ? 'cursor-pointer hover:text-brand-700' : 'cursor-default opacity-60'
            }`}
          >
            {formatNumber(mention.count, 0)}
          </button>
          {mention.countChange != null && (
            <DeltaBadge value={mention.countChange} mode="percent" />
          )}
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Mentions in the{' '}
          {periodLabel(filters.startDate, filters.endDate, presetEndDay ?? filters.endDate, factDays?.min)}
        </p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={mention.provider} size="md" />
                <h3 className="text-lg font-semibold text-[#101414]">{label} mentions</h3>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {loading ? 'Loading prompts…' : `${prompts.length} prompts that mentioned your account`}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : prompts.length > 0 ? (
                <ul className="space-y-1">
                  {prompts.map((item, i) => (
                    <li key={item.promptId ?? i}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setProviders([mention.provider])
                          setOpen(false)
                          if (item.promptId) navigate(`/prompts?prompt=${item.promptId}`)
                          else navigate('/prompts')
                        }}
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        <span className="text-sm font-medium text-slate-800">{item.prompt}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">No prompts available for this provider.</p>
              )}
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
}

export function ProviderMentionCardsRow({ mentions, availableProviders }: ProviderMentionCardsRowProps) {
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
    <div className="flex flex-col gap-2 md:flex-row">
      {sorted.map((mention) => (
        <ProviderMentionCard key={mention.provider} mention={mention} />
      ))}
    </div>
  )
}
