import { getCrawlerBotDisplayName } from '../../lib/crawlerBots'
import { formatNumber } from '../../lib/format'
import type { DistributionRow } from '../../lib/snapshots/aiCrawlers'
import { DashboardCard } from '../dashboard/DashboardCard'
import { CrawlerIcon } from './CrawlerIcon'

interface DistributionCardProps {
  title: string
  subtitle: string
  rows: DistributionRow[]
  showBotIcons?: boolean
}

function DistributionRowItem({
  row,
  maxValue,
  showBotIcon,
}: {
  row: DistributionRow
  maxValue: number
  showBotIcon?: boolean
}) {
  const widthPct = maxValue > 0 ? Math.max(4, (row.value / maxValue) * 100) : 0
  const label = row.bot ? getCrawlerBotDisplayName(row.bot) : row.label

  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showBotIcon && row.bot && <CrawlerIcon bot={row.bot} size="sm" />}
        <span className="truncate text-sm text-slate-700" title={label}>
          {label}
        </span>
      </div>
      <div className="flex min-w-[140px] flex-1 items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600"
            style={{ width: `${widthPct}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-sm font-medium text-slate-800">
          {formatNumber(row.value, 0)}
        </span>
      </div>
    </div>
  )
}

export function DistributionCard({
  title,
  subtitle,
  rows,
  showBotIcons = false,
}: DistributionCardProps) {
  const visibleRows = rows.slice(0, 10)
  const maxValue = visibleRows.reduce((max, row) => Math.max(max, row.value), 0)
  const isEmpty = visibleRows.length === 0

  return (
    <DashboardCard title={title} subtitle={subtitle} contentClassName="overflow-auto py-2">
      {isEmpty ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
          No data for the selected period.
        </div>
      ) : (
        <div className="divide-y divide-slate-50">
          {visibleRows.map((row) => (
            <DistributionRowItem
              key={`${row.label}-${row.bot ?? ''}`}
              row={row}
              maxValue={maxValue}
              showBotIcon={showBotIcons}
            />
          ))}
        </div>
      )}
    </DashboardCard>
  )
}
