const INTENT_CONFIG: Record<
  string,
  { letter: string; label: string; bg: string; text: string }
> = {
  INFORMATIONAL: { letter: 'I', label: 'Informational', bg: 'bg-surface', text: 'text-muted' },
  COMMERCIAL: { letter: 'C', label: 'Commercial', bg: 'bg-surface', text: 'text-ink' },
  NAVIGATIONAL: { letter: 'N', label: 'Navigational', bg: 'bg-surface', text: 'text-muted' },
  TRANSACTIONAL: { letter: 'T', label: 'Transactional', bg: 'bg-surface', text: 'text-accent' },
}

const FALLBACK = { letter: '?', label: 'Unknown', bg: 'bg-surface', text: 'text-muted-dark' }

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
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-line text-[11px] font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.letter}
    </span>
  )
}

export const INTENT_ORDER = ['COMMERCIAL', 'NAVIGATIONAL', 'TRANSACTIONAL', 'INFORMATIONAL'] as const

export const INTENT_BAR_COLORS: Record<string, string> = {
  COMMERCIAL: '#07080c',
  NAVIGATIONAL: '#8ca6e0',
  TRANSACTIONAL: '#4d5568',
  INFORMATIONAL: '#2d4f9e',
}
