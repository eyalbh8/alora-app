import type { PromptTag, PromptTagObject } from '../api/types'

export const TAG_COLOR_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const

export type TagColorRow = (typeof TAG_COLOR_ROWS)[number]

const TAG_ROW_COLORS: Record<TagColorRow, string> = {
  A: '#8a8a8a',
  B: '#e07a6a',
  C: '#d9793d',
  D: '#e3c76b',
  E: '#2d4f9e',
  F: '#6f8fd8',
  G: '#8ca6e0',
  H: '#7a5fb0',
  I: '#d47ab0',
  J: '#a67c52',
}

export interface NormalizedTag {
  name: string
  tagId: string
  colorRow: string | null
}

export function normalizeTag(tag: PromptTag | null | undefined): NormalizedTag | null {
  if (tag == null) return null
  if (typeof tag === 'string') {
    const name = tag.trim()
    return name ? { name, tagId: name, colorRow: null } : null
  }
  const name = typeof tag.name === 'string' ? tag.name.trim() : ''
  const tagId = typeof tag.tagId === 'string' && tag.tagId.trim() ? tag.tagId.trim() : name
  const colorRow = typeof tag.colorRow === 'string' && tag.colorRow.trim() ? tag.colorRow.trim() : null
  if (!name && !tagId) return null
  return { name: name || tagId, tagId, colorRow }
}

export function normalizeTags(tags: PromptTag[] | null | undefined): NormalizedTag[] {
  if (!tags?.length) return []
  const seen = new Set<string>()
  const out: NormalizedTag[] = []
  for (const tag of tags) {
    const mapped = normalizeTag(tag)
    if (!mapped) continue
    const key = mapped.tagId.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(mapped)
  }
  return out
}

export function tagColor(colorRow: string | null | undefined): string {
  if (!colorRow) return TAG_ROW_COLORS.E
  const key = colorRow.trim()
  if (key.startsWith('#')) return key
  const letter = key.toUpperCase() as TagColorRow
  return TAG_ROW_COLORS[letter] ?? TAG_ROW_COLORS.E
}

export function toPromptTag(tag: NormalizedTag): PromptTagObject {
  return { name: tag.name, tagId: tag.tagId, colorRow: tag.colorRow }
}
