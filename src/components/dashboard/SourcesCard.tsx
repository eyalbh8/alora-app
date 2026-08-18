import type { TopSource } from '../../api/types'
import { formatNumber } from '../../lib/format'
import { BrandLogo } from '../competitors/BrandLogo'
import { DashboardCard } from './DashboardCard'

interface SourcesCardProps {
  sources: TopSource[]
}

function hostLabel(domain: string) {
  const raw = String(domain || '').trim()
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./i, '')
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || raw
  }
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
        <div className="flex min-h-52 items-center justify-center border border-dashed border-line px-6 text-xs text-muted">
          No citation data for this period.
        </div>
      ) : (
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[6.75rem]" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-ink text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              <th className="pb-2.5 text-left font-semibold">Domain</th>
              <th className="pb-2.5 text-right font-semibold">Cited pages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const host = hostLabel(row.domain)
              return (
                <tr key={row.domain} className="border-b border-line">
                  <td className="min-w-0 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="card-number shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <BrandLogo name={host} domain={host} size="md" shape="rounded" />
                      <span className="min-w-0 truncate font-medium text-ink" title={host}>
                        {host}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium text-muted">
                    {formatNumber(row.pageCount, 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </DashboardCard>
  )
}
