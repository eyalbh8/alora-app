import type { ResponseRow } from '../../api/types'
import { formatResponseDisplayText, formatResponsePreview } from '../../lib/responseBody'
import { sentimentOf } from '../../lib/snapshots/normalize'

export interface MentionBrand {
  name?: string | null
  logo?: string | null
  domain?: string | null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function responseRaw(row: ResponseRow & { raw?: unknown }): Record<string, unknown> | null {
  return asRecord(row.raw)
}

function pickString(raw: Record<string, unknown> | null, keys: string[]): string {
  if (!raw) return ''
  for (const key of keys) {
    const v = raw[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  const nested = asRecord(raw.json_response ?? raw.jsonResponse)
  if (nested) {
    for (const key of [...keys, 'content', 'text', 'answer']) {
      const v = nested[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return ''
}

function rawStoredText(row: ResponseRow & { raw?: unknown }): string {
  if (row.response) return row.response
  const raw = responseRaw(row)
  return pickString(raw, ['response', 'fullResponse', 'full_response', 'answer', 'text', 'content'])
}

export function responsePreviewText(row: ResponseRow & { raw?: unknown }): string {
  const stored = row.responsePreview || rawStoredText(row)
  if (!stored) {
    const fromRaw = pickString(responseRaw(row), [
      'responsePreview',
      'response_preview',
      'preview',
      'snippet',
      'shortResponse',
      'excerpt',
    ])
    if (fromRaw) return formatResponsePreview(fromRaw)
    return ''
  }
  return formatResponsePreview(stored)
}

export function responseFullText(row: ResponseRow & { raw?: unknown }): string {
  const stored = row.response || row.responsePreview || rawStoredText(row)
  if (!stored) {
    const fromRaw = pickString(responseRaw(row), [
      'responsePreview',
      'response_preview',
      'preview',
      'snippet',
      'response',
      'fullResponse',
      'answer',
      'text',
      'content',
    ])
    return fromRaw ? formatResponseDisplayText(fromRaw) : ''
  }
  return formatResponseDisplayText(stored)
}

/** @deprecated use responsePreviewText or responseFullText */
export function responseText(row: ResponseRow & { raw?: unknown }): string {
  return responsePreviewText(row) || responseFullText(row)
}

export function responseSentiment(row: ResponseRow & { raw?: unknown }): number | null {
  const direct = sentimentOf(row)
  if (direct != null) return direct
  const raw = responseRaw(row)
  const v = raw?.sentimentScore ?? raw?.sentinemtScore ?? raw?.avgSentimentScore
  return typeof v === 'number' && !Number.isNaN(v) ? v : null
}

export function responseBrands(row: ResponseRow & { raw?: unknown }): MentionBrand[] {
  const raw = responseRaw(row)
  if (!raw) return []
  const candidates = raw.companies ?? raw.mentionedCompanies ?? raw.brands ?? raw.entities
  if (!Array.isArray(candidates)) return []
  return candidates
    .map((item): MentionBrand | null => {
      if (typeof item === 'string') return { name: item }
      const obj = asRecord(item)
      if (!obj) return null
      return {
        name: (obj.name ?? obj.title ?? obj.entity ?? obj.company) as string | null,
        logo: (obj.logo ?? obj.image) as string | null,
        domain: (obj.domain ?? obj.site) as string | null,
      }
    })
    .filter((b): b is MentionBrand => Boolean(b?.name || b?.logo || b?.domain))
}

export function citationCount(row: ResponseRow): number {
  return row.sources?.length ?? 0
}

export function responseDateLabel(row: ResponseRow): string {
  const iso = row.timestamp || row.createdAt
  if (!iso) return '—'
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
}

export function responseDateTimeLabel(row: ResponseRow): string {
  const iso = row.timestamp || row.createdAt
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 10)
  }
}
