/** ISO 3166-1 alpha-2 → flag emoji (works for most two-letter codes). */
export function regionFlag(code: string): string {
  const cc = code.toUpperCase().replace(/^UK$/, 'GB').slice(0, 2)
  if (cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return '🌐'
  const points = [...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
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
