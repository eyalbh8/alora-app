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
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[#101414]">Prompt Intent Distribution</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Share of prompts by search intent type in the current view.
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="py-6 text-center text-xs text-slate-400">No intent data for the current filters.</p>
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full">
            {segments.map((s) =>
              s.pct > 0 ? (
                <div
                  key={s.type}
                  className="h-full transition-all"
                  style={{
                    width: `${s.pct}%`,
                    backgroundColor: INTENT_BAR_COLORS[s.type] ?? '#cbd5e1',
                  }}
                  title={`${s.label} ${s.pct}%`}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {segments.map((s) => (
              <li key={s.type} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: INTENT_BAR_COLORS[s.type] ?? '#cbd5e1' }}
                />
                <span>{s.label}</span>
                <span className="font-medium text-[#101414]">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
