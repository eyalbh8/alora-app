/** Common country names upstream may send instead of ISO codes. */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  cyprus: 'CY',
  israel: 'IL',
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  britain: 'GB',
  canada: 'CA',
  australia: 'AU',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  netherlands: 'NL',
  india: 'IN',
  brazil: 'BR',
  japan: 'JP',
}

/** Resolve an ISO country code from a 2-letter code or country name. */
export function countryCodeFromLabel(label: string): string | null {
  const trimmed = label.trim()
  if (!trimmed) return null
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return trimmed.toUpperCase().replace(/^UK$/, 'GB')
  }
  return COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()] ?? null
}

export function countryDisplayName(codeOrName: string): string {
  const code = countryCodeFromLabel(codeOrName)
  if (code) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? codeOrName
    } catch {
      return codeOrName
    }
  }
  return codeOrName
}

/** ISO 3166-1 alpha-2 → flag emoji (works for most two-letter codes). */
export function regionFlag(code: string): string {
  const resolved = countryCodeFromLabel(code) ?? code.toUpperCase().replace(/^UK$/, 'GB').slice(0, 2)
  if (resolved.length !== 2 || !/^[A-Z]{2}$/.test(resolved)) return '🌐'
  const points = [...resolved].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  return String.fromCodePoint(...points)
}

export function regionShortLabel(code: string): string {
  const map: Record<string, string> = {
    us: 'US',
    gb: 'UK',
    uk: 'UK',
    ca: 'CA',
    au: 'AU',
    de: 'DE',
    fr: 'FR',
  }
  return map[code.toLowerCase()] ?? code.toUpperCase()
}
