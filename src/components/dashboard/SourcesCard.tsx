import type { TopSource } from '../../api/types'
import { formatNumber } from '../../lib/format'
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

function DomainGlyph({ domain }: { domain: string }) {
  const host = hostLabel(domain)
  const letter = (host[0] || '?').toUpperCase()
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#efeae2] text-[10px] font-semibold text-[#6b655e]"
      title={host}
    >
      {letter}
    </span>
  )
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
                    <DomainGlyph domain={row.domain} />
                    <span className="font-medium text-[#302d29]">{hostLabel(row.domain)}</span>
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
