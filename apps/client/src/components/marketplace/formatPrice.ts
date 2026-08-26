export function formatMarketplacePrice(
  cents: number | null | undefined,
  currency = 'USD',
): string {
  if (cents == null || Number.isNaN(cents)) return '—'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency || 'USD'}`
  }
}
