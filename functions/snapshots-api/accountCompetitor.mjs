function normalizeBrandName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeHost(value) {
  if (!value || typeof value !== 'string') return ''
  return value
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .trim()
    .toLowerCase()
}

export function isAccountRow(row, accountId, account) {
  if (row?.isAccount) return true
  const id = String(row?.id ?? '')
  if (id.toLowerCase() === 'account') return true
  if (accountId && id === accountId) return true
  if (account?.id && id === account.id) return true

  const names = new Set(
    [account?.title, ...(account?.names ?? [])].map(normalizeBrandName).filter(Boolean),
  )
  const name = normalizeBrandName(row?.name ?? row?.title)
  if (name && names.has(name)) return true

  const hosts = new Set((account?.domains ?? []).map(normalizeHost).filter(Boolean))
  const host = normalizeHost(row?.domain || row?.site)
  return Boolean(host && hosts.has(host))
}
