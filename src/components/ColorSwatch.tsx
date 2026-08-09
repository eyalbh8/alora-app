import { useState } from 'react'

interface ColorSwatchProps {
  name: string
  value: string
  usageInstructions?: string
  onUsageChange?: (value: string) => void
}

/** Hex swatch with name; click copies hex to clipboard. */
export function ColorSwatch({
  name,
  value,
  usageInstructions,
  onUsageChange,
}: ColorSwatchProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard may be unavailable
    }
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={() => void copy()}
        className="group flex w-full items-center gap-3 text-left"
        title="Copy hex"
      >
        <span
          className="h-12 w-12 shrink-0 rounded-lg border border-black/5 shadow-inner"
          style={{ backgroundColor: value }}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-900">{name}</span>
          <span className="font-mono text-xs text-slate-500 group-hover:text-brand-800">
            {copied ? 'Copied!' : value}
          </span>
        </span>
      </button>
      {usageInstructions != null && (
        onUsageChange ? (
          <textarea
            value={usageInstructions}
            onChange={(e) => onUsageChange(e.target.value)}
            rows={2}
            className="mt-3 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 outline-none ring-brand-700/30 focus:ring-2"
          />
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{usageInstructions}</p>
        )
      )}
    </div>
  )
}
