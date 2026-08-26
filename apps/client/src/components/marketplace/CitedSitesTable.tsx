import type { MarketplaceSite } from '../../api/geo'
import { formatCompactNumber, formatNumber } from '../../lib/format'
import { Pill } from '../Pill'
import { formatMarketplacePrice } from './formatPrice'
import { SiteCell } from './SiteCell'

function CategoryList({ categories }: { categories: string[] }) {
  if (!categories.length) return <span className="text-muted-dark">—</span>
  return <span className="text-xs text-muted">{categories.join(', ')}</span>
}

interface CitedSitesTableProps {
  rows: MarketplaceSite[]
}

export function CitedSitesTable({ rows }: CitedSitesTableProps) {
  if (rows.length === 0) {
    return (
      <div className="border-y border-line px-6 py-12 text-center">
        <p className="text-base font-semibold text-ink">No cited marketplace sites</p>
        <p className="mt-1 text-sm text-muted">
          No catalog publishers have mention counts for this brand yet.
        </p>
      </div>
    )
  }

  return (
    <section aria-labelledby="cited-marketplace-title">
      <header className="mb-4">
        <h2 id="cited-marketplace-title" className="text-[17px] font-semibold text-ink">
          Cited in marketplace
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">
          Publishing sites that already mention this brand in AI answers.
        </p>
      </header>
      <div className="table-bleed">
      <div className="table-bleed__scroll">
        <table className="w-full min-w-0 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="min-w-0 pb-2.5 pr-3 text-left text-[12px] font-medium text-muted">
                Site
              </th>
              <th className="px-3 pb-2.5 text-right text-[12px] font-medium text-muted">
                Price
              </th>
              <th className="px-3 pb-2.5 text-right text-[12px] font-medium text-muted">
                Traffic
              </th>
              <th className="px-3 pb-2.5 text-right text-[12px] font-medium text-muted">
                Rank
              </th>
              <th className="pb-2.5 pl-3 text-right text-[12px] font-medium text-muted">
                Mentions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line">
                <td className="min-w-0 py-4 pr-3">
                  <SiteCell site={row} />
                  {row.categories.length ? (
                    <p className="mt-1.5 truncate text-[10px] text-muted">
                      <CategoryList categories={row.categories} />
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-4 text-right text-[13px] tabular-nums text-ink">
                  {formatMarketplacePrice(row.customerPriceCents, row.currency)}
                </td>
                <td className="px-3 py-4 text-right text-[13px] tabular-nums text-ink">
                  {formatCompactNumber(row.traffic)}
                </td>
                <td className="px-3 py-4 text-right text-[13px] tabular-nums text-ink">
                  {formatNumber(row.rank, 0)}
                </td>
                <td className="py-4 pl-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[13px] tabular-nums text-ink">
                      {formatNumber(row.mentions, 0)}
                    </span>
                    <Pill tone="green">Cited</Pill>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </section>
  )
}
