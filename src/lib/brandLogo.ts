export interface BrandLogoSource {
  id?: string
  name: string
  logo?: string | null
  domain?: string | null
  site?: string | null
}

export interface BrandLogoMeta {
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

function parentHosts(host: string): string[] {
  const parts = host.split('.').filter(Boolean)
  const out: string[] = []
  for (let i = 1; i < parts.length - 1; i++) {
    out.push(parts.slice(i).join('.'))
  }
  return out
}

function logoDevUrl(opts: { domain?: string | null; name?: string | null }): string | null {
  const token = import.meta.env.VITE_LOGO_DEV_API_KEY
  if (!token) return null

  const domain = brandDomain({
    name: opts.name ?? '',
    domain: opts.domain,
    site: opts.domain,
  })
  const params = `token=${encodeURIComponent(token)}&size=64&format=png`
  if (domain) return `https://img.logo.dev/${domain}?${params}`

  const name = opts.name?.trim()
  if (!name) return null
  return `https://img.logo.dev/name/${encodeURIComponent(name)}?${params}`
}

/** Ordered logo URL candidates — stored mark, then logo.dev (same as iGEO). */
export function brandLogoCandidates(row: BrandLogoSource, meta?: BrandLogoMeta | null): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (url: string | null | undefined) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    out.push(url)
  }

  add(row.logo)
  add(meta?.logo)

  const domain = brandDomain({
    ...row,
    domain: row.domain || meta?.domain,
    site: row.site || meta?.site,
  })
  const hosts = domain ? [domain, ...parentHosts(domain)] : []
  add(logoDevUrl({ domain, name: row.name }))
  for (const host of hosts) {
    add(logoDevUrl({ domain: host }))
    add(`https://logo.clearbit.com/${host}`)
  }
  for (const host of hosts) {
    add(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
  }

  return out
}

export function buildBrandLogoLookup(
  account:
    | { id: string; title: string; names?: string[]; domains?: string[]; logo: string | null }
    | null
    | undefined,
  competitors:
    | Array<{ id: string; name: string; logo: string | null; site?: string | null; domain?: string | null }>
    | undefined,
) {
  const byId = new Map<string, BrandLogoMeta>()
  const byName = new Map<string, BrandLogoMeta>()
  const byDomain = new Map<string, BrandLogoMeta>()

  const indexDomain = (host: string | null | undefined, meta: BrandLogoMeta) => {
    if (!host) return
    byDomain.set(host.replace(/^www\./i, '').toLowerCase(), meta)
  }

  if (account) {
    const meta: BrandLogoMeta = {
      logo: account.logo,
      domain: account.domains?.[0] ?? null,
      site: account.domains?.[0] ?? null,
    }
    byId.set(account.id, meta)
    byName.set(account.title.toLowerCase(), meta)
    for (const name of account.names ?? []) {
      if (name) byName.set(name.toLowerCase(), meta)
    }
    for (const domain of account.domains ?? []) {
      indexDomain(domain, meta)
    }
  }
  for (const c of competitors ?? []) {
    const meta: BrandLogoMeta = { logo: c.logo, domain: c.domain, site: c.site }
    byId.set(c.id, meta)
    byName.set(c.name.toLowerCase(), meta)
    indexDomain(c.domain, meta)
    indexDomain(brandDomain({ name: c.name, domain: c.domain, site: c.site }), meta)
  }

  return { byId, byName, byDomain }
}

export function metaLogoFor(
  row: BrandLogoSource,
  lookup: ReturnType<typeof buildBrandLogoLookup>,
): BrandLogoMeta | null {
  const domain = brandDomain(row)
  return (
    lookup.byId.get(row.id ?? '') ??
    lookup.byName.get(row.name.toLowerCase()) ??
    (domain ? lookup.byDomain.get(domain) : null) ??
    null
  )
}
