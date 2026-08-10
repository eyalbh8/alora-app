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
      title="Sources"
      subtitle="The domains that are most frequently cited in your responses"
    >
      {isEmpty ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
          No source domains for the selected period.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-5 py-3 text-left font-medium">Source</th>
              <th className="px-5 py-3 text-center font-medium">Pages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.domain} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={faviconUrl(row.domain)}
                      alt=""
                      className="h-5 w-5 rounded object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <span className="font-medium text-slate-800">{row.domain}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-center font-medium text-slate-700">
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
