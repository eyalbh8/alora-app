function stripLeadingFence(text) {
  return text
    .trim()
    .replace(/^```(?:json|html|markdown|md)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}

function unescapeJsonString(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function unescapePythonString(value) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\xa0/g, ' ')
    .replace(/\xa0/g, ' ')
}

function extractJsonStringField(text, field) {
  const complete = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
  const completeMatch = text.match(complete)
  if (completeMatch?.[1]) return unescapeJsonString(completeMatch[1]).trim()

  const truncated = new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]+)$`)
  const truncatedMatch = text.match(truncated)
  if (truncatedMatch?.[1]) return unescapeJsonString(truncatedMatch[1]).trim()

  return ''
}

function formatCompaniesPayload(obj) {
  if (typeof obj.raw_response === 'string' && obj.raw_response.trim()) {
    return obj.raw_response.trim()
  }
  const companies = obj.companies
  if (!Array.isArray(companies) || companies.length === 0) return null

  const items = companies
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const name = String(item.company ?? item.name ?? '').trim()
      const detail = String(item.reason ?? item.description ?? '').trim()
      if (name && detail) return `${name} — ${detail}`
      return name || detail || null
    })
    .filter(Boolean)

  return items.length ? items.map((item) => `• ${item}`).join('\n') : null
}

function extractPartialCompaniesPreview(text) {
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

function formatDomainListText(text) {
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

function extractPythonDictText(dictStr) {
  const match = dictStr.match(/['"]text['"]\s*:\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/)
  return match?.[2] ? unescapePythonString(match[2]).trim() : ''
}

function cleanCitationSuffix(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s[\u00a0]?[A-Za-z][A-Za-z0-9 .-]{0,40}\s+\+\d+\s*$/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function isGoogleAiOverviewFormat(text) {
  return /\*\*Key Points:\*\*/.test(text) || /•\s*\{['"]text['"]/.test(text)
}

function formatGoogleAiOverviewText(text) {
  if (!isGoogleAiOverviewFormat(text)) return text

  const [introRaw = '', keyPointsRaw = ''] = text.split(/\*\*Key Points:\*\*\s*/)
  const intro = cleanCitationSuffix(introRaw.replace(/\n{3,}/g, '\n\n').trim())

  const bullets = []
  for (const line of keyPointsRaw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('•')) continue
    const dictPart = trimmed.slice(1).trim()
    if (!dictPart.startsWith('{')) continue
    const itemText = extractPythonDictText(dictPart)
    if (itemText) bullets.push(cleanCitationSuffix(itemText))
  }

  const parts = []
  if (intro) parts.push(intro)
  if (bullets.length) {
    parts.push('**Key Points:**')
    parts.push(...bullets.map((b) => `• ${b}`))
  }
  return parts.join('\n\n') || text
}

function stripHtml(html) {
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

function pickAnswer(obj) {
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

function parseStructuredPayload(text) {
  const body = stripLeadingFence(text)

  try {
    const parsed = JSON.parse(body)
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue
        const hit = pickAnswer(item)
        if (hit) return hit
      }
    }
    if (parsed && typeof parsed === 'object') {
      const companies = formatCompaniesPayload(parsed)
      if (companies) return companies
      const hit = pickAnswer(parsed)
      if (hit) return hit
    }
  } catch {
    /* truncated or malformed JSON */
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

function previewSource(text) {
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

export function formatResponseDisplayText(raw) {
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

export function formatResponsePreview(raw, max = 400) {
  const text = formatResponseDisplayText(raw)
  if (!text) return ''
  const source = previewSource(text)
  if (source.length <= max) return source
  return `${source.slice(0, max - 1)}…`
}
