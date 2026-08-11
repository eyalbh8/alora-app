import { getCrawlerBotDisplayName } from '../../lib/crawlerBots'
import { formatNumber } from '../../lib/format'
import type { DistributionRow } from '../../lib/snapshots/aiCrawlers'
import { CrawlerIcon } from './CrawlerIcon'

interface DistributionCardProps {
  title: string
  subtitle: string
  rows: DistributionRow[]
  showBotIcons?: boolean
  accent?: 'light' | 'dark'
}

function DistributionRowItem({
  row,
  maxValue,
  showBotIcon,
  accent,
}: {
  row: DistributionRow
  maxValue: number
  showBotIcon?: boolean
  accent: 'light' | 'dark'
}) {
  const widthPct = maxValue > 0 ? Math.max(4, (row.value / maxValue) * 100) : 0
  const label = row.bot ? getCrawlerBotDisplayName(row.bot) : row.label

  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between gap-4 text-[12.5px]">
        <div className="flex min-w-0 items-center gap-2">
          {showBotIcon && row.bot && <CrawlerIcon bot={row.bot} size="sm" />}
          <span className="truncate text-[#101414]" title={label}>
            {label}
          </span>
        </div>
        <span className="shrink-0 font-semibold text-[#5c554c]">
          {formatNumber(row.value, 0)}
        </span>
      </div>
      <div className="h-0.5 w-full bg-[#eae6de]">
        <div
          className={`h-full ${accent === 'light' ? 'bg-brand-400' : 'bg-brand-600'}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  )
}

export function DistributionCard({
  title,
  subtitle,
  rows,
  showBotIcons = false,
  accent = 'dark',
}: DistributionCardProps) {
  const visibleRows = rows.slice(0, 10)
  const maxValue = visibleRows.reduce((max, row) => Math.max(max, row.value), 0)
  const isEmpty = visibleRows.length === 0

  return (
    <section>
      <div className="mb-[18px]">
        <h2 className="text-[19px] font-semibold text-[#101414]">{title}</h2>
        <p className="mt-0.5 text-xs text-[#9a938a]">{subtitle}</p>
      </div>
      {isEmpty ? (
        <div className="flex min-h-36 items-center justify-center border-y border-dashed border-[#d8d2c7] px-6 text-sm text-[#9a938a]">
          No data for the selected period.
        </div>
      ) : (
        <div>
          {visibleRows.map((row) => (
            <DistributionRowItem
              key={`${row.label}-${row.bot ?? ''}`}
              row={row}
              maxValue={maxValue}
              showBotIcon={showBotIcons}
              accent={accent}
            />
          ))}
        </div>
      )}
    </section>
  )
}
