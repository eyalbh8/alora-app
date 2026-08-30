/** Pure HTML helpers for blog post preview / save (ported from iGEO BlogAgentPostPreview). */

export function stripTitleFromContent(content: string): string {
  return content
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/gi, '')
    .trim()
}

export function stripJsonLdSchema(content: string): string {
  return content
    .replace(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
      '',
    )
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim()
}

export function extractSchemaFromPost(body: string): string {
  if (!body) return ''

  const schemaMatch = body.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  )

  if (schemaMatch?.[1]) {
    try {
      const schemaJson = JSON.parse(schemaMatch[1].trim())
      return JSON.stringify(schemaJson, null, 2)
    } catch {
      const jsonMatch = schemaMatch[1].trim().match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.stringify(JSON.parse(jsonMatch[0]), null, 2)
        } catch {
          return schemaMatch[1].trim()
        }
      }
      return schemaMatch[1].trim()
    }
  }

  const graphMatch = body.match(/\{"@context"[\s\S]*?"@graph"[\s\S]*?\}/i)
  if (graphMatch) {
    try {
      return JSON.stringify(JSON.parse(graphMatch[0]), null, 2)
    } catch {
      /* ignore */
    }
  }

  return ''
}

export function extractPlainTextFromHtml(html: string): string {
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div')
    temp.innerHTML = html
    return (temp.textContent || temp.innerText || '').trim()
  }
  return html.replace(/<[^>]*>/g, '').trim()
}

export function buildBlogBody(titleHtml: string, bodyHtml: string, schemaText: string): string {
  const cleaned = stripJsonLdSchema(bodyHtml)
  const schemaScript = schemaText.trim()
    ? `<script type="application/ld+json">\n${schemaText.trim()}\n</script>`
    : ''
  return `<main><h1>${titleHtml}</h1>${cleaned}</main>${schemaScript ? `\n${schemaScript}` : ''}`
}

export function detectHebrew(text: string): boolean {
  if (!text) return false
  const textOnly = text.replace(/<[^>]*>/g, '')
  const hebrewChars = (textOnly.match(/[\u0590-\u05FF]/g) || []).length
  const totalChars = textOnly.replace(/\s/g, '').length
  return totalChars > 0 && hebrewChars / totalChars > 0.3
}

const UNSPLASH_CREDIT_RE =
  /\n*\s*Photo by \[.*?\]\(.*?\) via \[Unsplash\]\(.*?\)/gi

export function stripUnsplashCredit(text: string): string {
  return text.replace(UNSPLASH_CREDIT_RE, '').trim()
}
