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
  | 'coral'

const TONE_CLASSES: Record<PillTone, string> = {
  grey: 'text-muted-dark',
  blue: 'text-muted',
  green: 'text-accent',
  orange: 'text-muted',
  red: 'text-error',
  purple: 'text-muted',
  yellow: 'text-muted',
  pink: 'text-muted',
  teal: 'text-accent',
  coral: 'text-error',
}

/** Maps topic color token names onto pill tones. */
export function toneFromColor(color: string | null | undefined): PillTone {
  const normalized = (color ?? '').toLowerCase()
  if (normalized === 'gray') return 'grey'
  if (normalized === 'coral') return 'coral'
  if (normalized in TONE_CLASSES) return normalized as PillTone
  return 'grey'
}

export function Pill({ tone = 'grey', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-line bg-paper-soft px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
