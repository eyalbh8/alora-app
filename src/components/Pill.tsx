import type { ReactNode } from 'react'

export type PillTone =
  | 'grey'
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'yellow'
  | 'pink'
  | 'teal'

const TONE_CLASSES: Record<PillTone, string> = {
  grey: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-brand-50 text-brand-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
  yellow: 'bg-amber-50 text-amber-700',
  pink: 'bg-pink-50 text-pink-700',
  teal: 'bg-brand-50 text-brand-700',
}

/** Maps AirOps topic `color` values onto our pill tones. */
export function toneFromColor(color: string | null | undefined): PillTone {
  const normalized = (color ?? '').toLowerCase()
  if (normalized in TONE_CLASSES) return normalized as PillTone
  return 'grey'
}

export function Pill({ tone = 'grey', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
