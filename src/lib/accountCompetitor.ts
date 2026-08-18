export interface AccountIdentity {
  id?: string | null
  title?: string | null
  names?: string[] | null
  domains?: string[] | null
}

export interface CompetitorIdentity {
  id?: string | null
  name?: string | null
  title?: string | null
  domain?: string | null
  site?: string | null
  isAccount?: boolean | null
}

function normalizeBrandName(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeHost(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim()
    .toLowerCase()
}

function accountNames(account: AccountIdentity | null | undefined): Set<string> {
  return new Set(
    [account?.title, ...(account?.names ?? [])]
      .map((name) => normalizeBrandName(name))
      .filter(Boolean),
  )
}

function accountHosts(account: AccountIdentity | null | undefined): Set<string> {
  return new Set((account?.domains ?? []).map((domain) => normalizeHost(domain)).filter(Boolean))
}

/** True when a ranking row is the tracked account brand, not a competitor. */
export function isAccountCompetitor(
  row: CompetitorIdentity,
  account?: AccountIdentity | null,
): boolean {
  if (row.isAccount) return true
  const id = String(row.id ?? '')
  if (id.toLowerCase() === 'account') return true
  if (account?.id && id && id === account.id) return true

  const name = normalizeBrandName(row.name ?? row.title)
  if (name && accountNames(account).has(name)) return true

  const host = normalizeHost(row.domain || row.site)
  return Boolean(host && accountHosts(account).has(host))
}

export function findAccountCompetitor<T extends CompetitorIdentity>(
  rows: T[],
  account?: AccountIdentity | null,
): T | null {
  return rows.find((row) => isAccountCompetitor(row, account)) ?? null
}
