import type { TopSource } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { DashboardCard } from './DashboardCard'

interface SourcesCardProps {
  sources: TopSource[]
}

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

export function SourcesCard({ sources }: SourcesCardProps) {
  const rows = sources.slice(0, 8)
  const isEmpty = rows.length === 0

  return (
    <DashboardCard
      title="Citation landscape"
      subtitle="Domains shaping AI answers in your category"
      variant="editorial"
      contentClassName="overflow-x-auto"
    >
      {isEmpty ? (
        <div className="flex min-h-52 items-center justify-center border border-dashed border-[#d8d2c7] px-6 text-xs text-[#8a847b]">
          No citation data for this period.
        </div>
      ) : (
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b-2 border-[#101414] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a847b]">
              <th className="pb-2.5 text-left font-semibold">Domain</th>
              <th className="pb-2.5 text-right font-semibold">Cited pages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.domain} className="border-b border-[#e4dfd6]">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={faviconUrl(row.domain)}
                      alt=""
                      className="h-5 w-5 rounded object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <span className="font-medium text-[#302d29]">{row.domain}</span>
                  </div>
                </td>
                <td className="py-3 text-right font-medium text-[#6b655e]">
                  {formatNumber(row.pageCount, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardCard>
  )
}
