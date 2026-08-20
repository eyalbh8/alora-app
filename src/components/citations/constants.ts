import type { PillTone } from '../Pill'

export const CITATIONS_CHART_HEIGHT = 220

export const DOMAIN_TYPE_COLORS: Record<string, string> = {
  corporate: '#d9793d',
  institutional: '#42ca80',
  editorial: '#2f6fb0',
  ugc: '#7a5fb0',
  reference: '#5c8f8a',
  other: '#8a8a8a',
  'category page': '#d9793d',
  'how-to guide': '#42ca80',
  'how to guide': '#42ca80',
  listicle: '#c45b8a',
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
  return DOMAIN_TYPE_COLORS[typeKey(value)] ?? ['#42ca80', '#111111', '#e07a6a', '#d9793d', '#7a5fb0', '#5c5c5c', '#2f6fb0'][index % 7]
}

export function typeTone(value: string): PillTone {
  return DOMAIN_TYPE_TONES[typeKey(value)] ?? 'grey'
}

export function citationGrowthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}
