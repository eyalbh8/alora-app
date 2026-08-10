export interface BrandLogoSource {
  id?: string
  name: string
  logo?: string | null
  domain?: string | null
  site?: string | null
}

const KNOWN_BRAND_DOMAINS: Record<string, string> = {
  'new balance': 'newbalance.com',
  nike: 'nike.com',
  adidas: 'adidas.com',
  asics: 'asics.com',
  hoka: 'hoka.com',
  brooks: 'brooksrunning.com',
  saucony: 'saucony.com',
  lululemon: 'lululemon.com',
  'under armour': 'underarmour.com',
  on: 'on-running.com',
  puma: 'puma.com',
}

export function brandDomain(row: BrandLogoSource): string | null {
  if (row.domain) {
    return row.domain.replace(/^www\./i, '').toLowerCase()
  }
  if (row.site) {
    try {
      const url = row.site.startsWith('http') ? row.site : `https://${row.site}`
      return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
    } catch {
      return row.site.replace(/^www\./i, '').toLowerCase()
    }
  }
  const trimmed = row.name.trim()
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return trimmed.replace(/^www\./i, '').toLowerCase()
  }
  return KNOWN_BRAND_DOMAINS[trimmed.toLowerCase()] ?? null
}

/** Ordered logo URL candidates — Clearbit first for recognizable brand marks. */
export function brandLogoCandidates(row: BrandLogoSource, metaLogo?: string | null): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (url: string | null | undefined) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    out.push(url)
  }

  add(row.logo)
  add(metaLogo)

  const domain = brandDomain(row)
  if (domain) {
    add(`https://logo.clearbit.com/${domain}`)
    add(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`)
  }

  return out
}

export function buildBrandLogoLookup(
  account: { id: string; title: string; logo: string | null } | null | undefined,
  competitors: Array<{ id: string; name: string; logo: string | null }> | undefined,
) {
  const byId = new Map<string, string | null>()
  const byName = new Map<string, string | null>()

  if (account) {
    byId.set(account.id, account.logo)
    byName.set(account.title.toLowerCase(), account.logo)
  }
  for (const c of competitors ?? []) {
    byId.set(c.id, c.logo)
    byName.set(c.name.toLowerCase(), c.logo)
  }

  return { byId, byName }
}

export function metaLogoFor(
  row: BrandLogoSource,
  lookup: ReturnType<typeof buildBrandLogoLookup>,
): string | null {
  return lookup.byId.get(row.id ?? '') ?? lookup.byName.get(row.name.toLowerCase()) ?? null
}
