const INTENT_CONFIG: Record<
  string,
  { letter: string; label: string; bg: string; text: string }
> = {
  INFORMATIONAL: { letter: 'I', label: 'Informational', bg: 'bg-sky-100', text: 'text-sky-700' },
  COMMERCIAL: { letter: 'C', label: 'Commercial', bg: 'bg-amber-100', text: 'text-amber-700' },
  NAVIGATIONAL: { letter: 'N', label: 'Navigational', bg: 'bg-violet-100', text: 'text-violet-700' },
  TRANSACTIONAL: { letter: 'T', label: 'Transactional', bg: 'bg-orange-100', text: 'text-orange-700' },
}

const FALLBACK = { letter: '?', label: 'Unknown', bg: 'bg-slate-100', text: 'text-slate-600' }

export function intentConfig(type: string | null | undefined) {
  if (!type) return FALLBACK
  return INTENT_CONFIG[type.toUpperCase()] ?? {
    ...FALLBACK,
    letter: type.slice(0, 1).toUpperCase(),
    label: type,
  }
}

export function IntentBadge({ type }: { type: string | null | undefined }) {
  const cfg = intentConfig(type)
  return (
    <span
      title={cfg.label}
      aria-label={cfg.label}
      className={`inline-flex h-6 w-6 items-center justify-center border border-current/15 text-[10px] font-bold tracking-wide ${cfg.bg} ${cfg.text}`}
    >
      {cfg.letter}
    </span>
  )
}

export const INTENT_ORDER = ['COMMERCIAL', 'NAVIGATIONAL', 'TRANSACTIONAL', 'INFORMATIONAL'] as const

export const INTENT_BAR_COLORS: Record<string, string> = {
  COMMERCIAL: '#fbbf24',
  NAVIGATIONAL: '#8b5cf6',
  TRANSACTIONAL: '#f97316',
  INFORMATIONAL: '#38bdf8',
}
