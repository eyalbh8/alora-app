/** Strip markdown code fences and parse upstream provider response payloads into readable prose. */

function stripLeadingFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json|html|markdown|md)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function unescapePythonString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\xa0/g, ' ')
    .replace(/\xa0/g, ' ')
}

function extractJsonStringField(text: string, field: string): string {
  const complete = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
  const completeMatch = text.match(complete)
  if (completeMatch?.[1]) return unescapeJsonString(completeMatch[1]).trim()

  const truncated = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]+)$`)
  const truncatedMatch = text.match(truncated)
  if (truncatedMatch?.[1]) return unescapeJsonString(truncatedMatch[1]).trim()

  return ''
}

function formatCompaniesPayload(obj: Record<string, unknown>): string | null {
  if (typeof obj.raw_response === 'string' && obj.raw_response.trim()) {
    return obj.raw_response.trim()
  }
  const companies = obj.companies
  if (!Array.isArray(companies) || companies.length === 0) return null

  const items = companies
    .map((item) => {
      const c = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
      if (!c) return null
      const name = String(c.company ?? c.name ?? '').trim()
      const detail = String(c.reason ?? c.description ?? '').trim()
      if (name && detail) return `${name} — ${detail}`
      return name || detail || null
    })
    .filter((line): line is string => Boolean(line))

  return items.length ? items.map((item) => `• ${item}`).join('\n') : null
}

function extractPartialCompaniesPreview(text: string): string | null {
  if (!/"companies"/.test(text)) return null
  const company = extractJsonStringField(text, 'company')
  const description = extractJsonStringField(text, 'description')
  const reason = extractJsonStringField(text, 'reason')
  const detail = reason || description
  if (company && detail) return `${company} — ${detail}`
  if (detail) return detail
  if (company) return company
  return null
}

function formatDomainListText(text: string): string | null {
  const match = text.match(/^Domain:\s*(.+)$/is)
  if (!match) return null
  const domains = match[1]
    .split(/,\s*/)
    .map((d) => d.trim())
    .filter(Boolean)
  if (!domains.length) return null
  const shown = domains.slice(0, 4).join(', ')
  const suffix = domains.length > 4 ? ` (+${domains.length - 4} more)` : ''
  return `Sources: ${shown}${suffix}`
}

function extractPythonDictText(dictStr: string): string {
  const match = dictStr.match(/['"]text['"]\s*:\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/)
  return match?.[2] ? unescapePythonString(match[2]).trim() : ''
}

function cleanCitationSuffix(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    // upstream inline source badges, e.g. "…sentence. Reddit +4" or "…sentence.\u00a0RunRepeat +2"
    .replace(/\s[\u00a0]?[A-Za-z][A-Za-z0-9 .-]{0,40}\s+\+\d+\s*$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function isGoogleAiOverviewFormat(text: string): boolean {
  return /\*\*Key Points:\*\*/.test(text) || /•\s*\{['"]text['"]/.test(text)
}

/** Google AI Overview stores bullets as Python dict literals — normalize to prose. */
function formatGoogleAiOverviewText(text: string): string {
  if (!isGoogleAiOverviewFormat(text)) return text

  const [introRaw = '', keyPointsRaw = ''] = text.split(/\*\*Key Points:\*\*\s*/)
  const intro = cleanCitationSuffix(introRaw.replace(/\n{3,}/g, '\n\n').trim())

  const bullets: string[] = []
  for (const line of keyPointsRaw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('•')) continue
    const dictPart = trimmed.slice(1).trim()
    if (!dictPart.startsWith('{')) continue
    const itemText = extractPythonDictText(dictPart)
    if (itemText) bullets.push(cleanCitationSuffix(itemText))
  }

  const parts: string[] = []
  if (intro) parts.push(intro)
  if (bullets.length) {
    parts.push('**Key Points:**')
    parts.push(...bullets.map((b) => `• ${b}`))
  }
  return parts.join('\n\n') || text
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function pickAnswer(obj: Record<string, unknown>): string {
  for (const key of ['raw_response', 'rawResponse', 'answer_text', 'answerText', 'answer', 'text', 'content', 'response']) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) {
      return v.includes('<') && v.includes('>') ? stripHtml(v) : v.trim()
    }
  }
  if (typeof obj.answer_html === 'string' && obj.answer_html.trim()) {
    return stripHtml(obj.answer_html)
  }
  return ''
}

function parseStructuredPayload(text: string): string | null {
  const body = stripLeadingFence(text)

  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const obj = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
        if (!obj) continue
        const hit = pickAnswer(obj)
        if (hit) return hit
      }
    }
    if (parsed && typeof parsed === 'object') {
      const companies = formatCompaniesPayload(parsed as Record<string, unknown>)
      if (companies) return companies
      const hit = pickAnswer(parsed as Record<string, unknown>)
      if (hit) return hit
    }
  } catch {
    /* truncated or malformed JSON — fall through to field extraction */
  }

  for (const field of ['raw_response', 'rawResponse', 'answer_text', 'answerText', 'answer', 'text', 'content']) {
    const extracted = extractJsonStringField(body, field)
    if (extracted) {
      return extracted.includes('<') && extracted.includes('>') ? stripHtml(extracted) : extracted
    }
  }

  const htmlField = extractJsonStringField(body, 'answer_html')
  if (htmlField) return stripHtml(htmlField)

  return null
}

export type ResponseDisplaySection =
  | { type: 'paragraph'; text: string }
  | { type: 'keyPoints'; items: string[]; label?: string }

/** Split formatted response text into intro + bullet sections for rich rendering. */
export function parseResponseDisplaySections(text: string): ResponseDisplaySection[] {
  if (!text.trim()) return []

  const bulletLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.slice(1).trim())
    .filter(Boolean)

  const hasKeyPointsHeader = /\*\*Key Points:\*\*/.test(text)
  if (bulletLines.length > 0 && !hasKeyPointsHeader) {
    const intro = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('•'))
      .join('\n\n')
      .trim()
    const sections: ResponseDisplaySection[] = []
    if (intro) sections.push({ type: 'paragraph', text: intro })
    sections.push({ type: 'keyPoints', items: bulletLines })
    return sections
  }

  const [introRaw = '', keyPointsRaw = ''] = text.split(/\*\*Key Points:\*\*\s*/)
  const sections: ResponseDisplaySection[] = []
  const intro = introRaw.trim()
  if (intro) sections.push({ type: 'paragraph', text: intro })

  const items = keyPointsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.slice(1).trim())
    .filter(Boolean)

  if (items.length) sections.push({ type: 'keyPoints', items, label: 'Key Points' })
  if (!sections.length) sections.push({ type: 'paragraph', text: text.trim() })
  return sections
}

function previewSource(text: string): string {
  const intro = text.split(/\*\*Key Points:\*\*/)[0]?.trim() ?? ''
  const bulletLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('•'))
    .map((line) => line.slice(1).trim())
  if (intro.length >= 20) return intro
  if (bulletLines[0]) return bulletLines[0]
  const firstBullet = text.match(/^•\s+(.+)$/m)?.[1]?.trim()
  if (firstBullet) return firstBullet
  return text.replace(/\*\*Key Points:\*\*\s*/g, '').trim()
}

/** Turn stored upstream response blobs into human-readable text for table + drawer. */
export function formatResponseDisplayText(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  const structured = parseStructuredPayload(raw)
  let base = structured ?? stripLeadingFence(raw)
  if (!structured) {
    const partialCompanies = extractPartialCompaniesPreview(raw)
    if (partialCompanies) base = partialCompanies
    else {
      const domains = formatDomainListText(base)
      if (domains) base = domains
    }
  }
  return formatGoogleAiOverviewText(base)
}

export function formatResponsePreview(raw: string | null | undefined, max = 400): string {
  const text = formatResponseDisplayText(raw)
  if (!text) return ''
  const source = previewSource(text)
  if (source.length <= max) return source
  return `${source.slice(0, max - 1)}…`
}
