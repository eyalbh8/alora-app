/**
 * AirOps topic `color` values are named tokens (e.g. "coral", "pink", "grey").
 * Map them to concrete hexes so Topic cells can show a colored square like the
 * AirOps Prompts UI. Unknown names fall back to a stable hash palette.
 */

const NAMED_TOPIC_COLORS: Record<string, string> = {
  grey: '#94a3b8',
  gray: '#94a3b8',
  slate: '#64748b',
  blue: '#3b82f6',
  sky: '#0ea5e9',
  cyan: '#06b6d4',
  teal: '#2fc9bc',
  green: '#22c55e',
  emerald: '#10b981',
  lime: '#84cc16',
  yellow: '#eab308',
  amber: '#f59e0b',
  orange: '#f97316',
  coral: '#ff7a59',
  red: '#ef4444',
  rose: '#f43f5e',
  pink: '#ec4899',
  fuchsia: '#d946ef',
  purple: '#a855f7',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  brown: '#a16207',
  black: '#0f172a',
  white: '#e2e8f0',
}

/** Stable fallback palette when a topic has no / unknown color. */
const FALLBACK_PALETTE = [
  '#3b82f6',
  '#2fc9bc',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#eab308',
  '#22c55e',
  '#6366f1',
  '#ff7a59',
  '#0ea5e9',
  '#f43f5e',
  '#84cc16',
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

/** Resolve a topic color name (or hex) to a CSS color. */
export function resolveTopicColor(
  color: string | null | undefined,
  fallbackKey?: string | number,
): string {
  const raw = (color ?? '').trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw

  const named = NAMED_TOPIC_COLORS[raw.toLowerCase()]
  if (named) return named

  const key = String(fallbackKey ?? (raw || 'topic'))
  return FALLBACK_PALETTE[hashString(key) % FALLBACK_PALETTE.length]
}

/** Dot color for prompt type (Category Related vs Brand Related). */
export function promptTypeDotColor(brandMentioned: boolean): string {
  return brandMentioned ? '#0e3b3a' : '#2fc9bc'
}

export function promptTypeLabel(brandMentioned: boolean): string {
  return brandMentioned ? 'Brand Related' : 'Category Related'
}
