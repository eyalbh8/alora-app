import { useMemo } from 'react'
import type { ProviderMention } from '../../api/types'
import { daysInRange, type DateRange } from '../../lib/dates'
import { formatNumber, providerLabel } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'
import { MENTIONS_PROVIDER_ORDER } from './constants'

interface MentionsSummaryProps {
  providers: ProviderMention[]
  range: DateRange
}

function orderedProviders(providers: ProviderMention[]): ProviderMention[] {
  const order = new Map<string, number>(
    MENTIONS_PROVIDER_ORDER.map((provider, index) => [provider, index]),
  )

  return [...providers]
    .filter((provider) => provider.count > 0)
    .sort((a, b) => {
      const aIndex = order.get(a.provider) ?? Number.MAX_SAFE_INTEGER
      const bIndex = order.get(b.provider) ?? Number.MAX_SAFE_INTEGER
      return aIndex - bIndex || b.count - a.count
    })
}

export function MentionsSummary({ providers, range }: MentionsSummaryProps) {
  const rows = useMemo(() => orderedProviders(providers), [providers])
  const total = rows.reduce((sum, provider) => sum + provider.count, 0)
  const days = daysInRange(range)
  const periodLabel = days === 1 ? 'selected day' : `last ${days} days`

  return (
    <section aria-labelledby="llm-mentions-heading">
      <h2 id="llm-mentions-heading" className="text-[19px] font-semibold text-ink">
        LLM Mentions
      </h2>
      <p className="mt-5 font-display text-[40px] font-semibold leading-none tracking-tight text-ink sm:text-[52px]">
        {formatNumber(total, 0)}
      </p>
      <p className="mt-2 text-xs text-muted">Total mentions, {periodLabel}</p>

      {rows.length > 0 ? (
        <div className="mt-4" role="list" aria-label="Mentions by provider">
          {rows.map((provider) => (
            <div
              key={provider.provider}
              className="flex items-center gap-2.5 border-b border-line/70 py-2 last:border-b-0"
              role="listitem"
            >
              <ProviderIcon provider={provider.provider} size="sm" />
              <span className="min-w-0 flex-1 text-[13px] text-ink">
                {providerLabel(provider.provider)}
              </span>
              <span className="font-display text-[15px] font-semibold tabular-nums text-ink">
                {formatNumber(provider.count, 0)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
          No mention data for the selected period.
        </p>
      )}
    </section>
  )
}
