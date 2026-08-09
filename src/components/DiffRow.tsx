import type { DiffChange } from '../api/types'

interface DiffRowProps {
  change: DiffChange
}

/** Review row: field label, old value struck through, new value highlighted. */
export function DiffRow({ change }: DiffRowProps) {
  const tone =
    change.kind === 'added'
      ? 'border-emerald-100 bg-emerald-50/60'
      : change.kind === 'removed'
        ? 'border-red-100 bg-red-50/50'
        : 'border-slate-200/80 bg-white'

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {change.entity}
        </span>
        <p className="text-sm font-medium text-slate-900">{change.label}</p>
      </div>
      {change.kind === 'updated' && (
        <div className="mt-2 space-y-1 text-xs leading-relaxed">
          {change.before != null && (
            <p className="text-slate-400 line-through">{change.before}</p>
          )}
          {change.after != null && (
            <p className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">{change.after}</p>
          )}
        </div>
      )}
      {change.kind === 'added' && change.after && (
        <p className="mt-2 text-xs text-emerald-800">{change.after}</p>
      )}
      {change.kind === 'removed' && change.before && (
        <p className="mt-2 text-xs text-red-700 line-through">{change.before}</p>
      )}
    </div>
  )
}
