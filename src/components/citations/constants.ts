import type { PillTone } from '../Pill'

export const CITATIONS_CHART_HEIGHT = 220

export const DOMAIN_TYPE_COLORS: Record<string, string> = {
  corporate: '#1a8a4a',
  institutional: '#2ec37a',
  editorial: '#5c8f8a',
  ugc: '#2a3830',
  reference: '#7a857e',
  other: '#a3ada7',
  'category page': '#1a8a4a',
  'how-to guide': '#2ec37a',
  'how to guide': '#2ec37a',
  listicle: '#14201a',
}

export const DOMAIN_TYPE_TONES: Record<string, PillTone> = {
  corporate: 'orange',
  institutional: 'green',
  editorial: 'blue',
  ugc: 'purple',
  reference: 'teal',
  other: 'grey',
  'category page': 'orange',
  'how-to guide': 'green',
  'how to guide': 'green',
  listicle: 'pink',
}

export function typeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_]+/g, ' ')
}

export function humanizeType(value: string | null | undefined): string {
  const raw = String(value || '').trim()
  if (!raw) return 'Other'
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function typeColor(value: string, index = 0): string {
  return DOMAIN_TYPE_COLORS[typeKey(value)] ?? ['#1a8a4a', '#14201a', '#5c8f8a', '#2ec37a', '#cfe8d6', '#7a857e', '#2a3830'][index % 7]
}

export function typeTone(value: string): PillTone {
  return DOMAIN_TYPE_TONES[typeKey(value)] ?? 'grey'
}

export function citationGrowthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}
