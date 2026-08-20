import type { PromptRow } from '../../api/types'
import { INTENT_BAR_COLORS, INTENT_ORDER, intentConfig } from './IntentBadge'

function computeDistribution(prompts: PromptRow[]) {
  const counts: Record<string, number> = {}
  for (const p of prompts) {
    const key = (p.type ?? '').toUpperCase()
    if (!key) continue
    counts[key] = (counts[key] ?? 0) + 1
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return INTENT_ORDER.map((type) => ({
    type,
    count: counts[type] ?? 0,
    pct: total ? Math.round(((counts[type] ?? 0) / total) * 100) : 0,
    ...intentConfig(type),
  })).filter((s) => s.count > 0 || total === 0)
}

export function IntentDistribution({ prompts }: { prompts: PromptRow[] }) {
  const segments = computeDistribution(prompts)
  const hasData = segments.some((s) => s.count > 0)

  return (
    <section className="border-y border-line py-5" aria-labelledby="intent-distribution-heading">
      <div className="mb-5 flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-muted">
            Current view
          </p>
          <h2 id="intent-distribution-heading" className="mt-1 font-display text-xl text-ink">
            Intent distribution
          </h2>
          <p className="mt-1 text-xs text-muted-dark">
            Share of filtered prompts by search intent.
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="py-5 text-xs text-muted-dark">No intent data for the current filters.</p>
      ) : (
        <>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-paper-soft"
            role="img"
            aria-label={segments.map((segment) => `${segment.label} ${segment.pct}%`).join(', ')}
          >
            {segments.map((s) =>
              s.pct > 0 ? (
                <div
                  key={s.type}
                  className="h-full transition-all"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: INTENT_BAR_COLORS[s.type] ?? '#7a857e',
                  }}
                  title={`${s.label} ${s.pct}%`}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {segments.map((s) => (
              <li key={s.type} className="flex items-center gap-2 text-xs text-muted">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: INTENT_BAR_COLORS[s.type] ?? '#7a857e' }}
                />
                <span>{s.label}</span>
                <span className="text-sm font-medium tabular-nums text-ink">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
