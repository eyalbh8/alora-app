import type { PillTone } from '../Pill'

export const CITATIONS_CHART_HEIGHT = 220

export const DOMAIN_TYPE_COLORS: Record<string, string> = {
  corporate: '#2d4f9e',
  institutional: '#6f8fd8',
  editorial: '#8ca6e0',
  ugc: '#07080c',
  reference: '#6b7488',
  other: '#4d5568',
  'category page': '#2d4f9e',
  'how-to guide': '#6f8fd8',
  'how to guide': '#6f8fd8',
  listicle: '#07080c',
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
  return DOMAIN_TYPE_COLORS[typeKey(value)] ?? ['#2d4f9e', '#07080c', '#8ca6e0', '#6f8fd8', '#bfcdf0', '#6b7488', '#4d5568'][index % 7]
}

export function typeTone(value: string): PillTone {
  return DOMAIN_TYPE_TONES[typeKey(value)] ?? 'grey'
}

export function citationGrowthPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}
