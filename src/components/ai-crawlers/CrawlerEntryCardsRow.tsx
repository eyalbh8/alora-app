import { useAnalyticsFilters } from '../../context/AnalyticsFiltersContext'
import { getCrawlerBotDisplayName } from '../../lib/crawlerBots'
import { daysInRange, matchActivePresetDays } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import type { CrawlerBotMetric } from '../../lib/snapshots/aiCrawlers'
import { CrawlerIcon } from './CrawlerIcon'

function periodLabel(
  startDate: string,
  endDate: string,
  endDay: string,
  minDay?: string | null,
): string {
  const days = daysInRange({ startDate, endDate })
  const preset = matchActivePresetDays({ startDate, endDate }, endDay, minDay)
  if (preset === 1) return 'last 24 hours'
  if (preset) return `last ${preset} days`
  return `selected period (${days} days)`
}

interface EntryCardProps {
  title: string
  value: number
  change: number | null
  periodText: string
  bot?: string
}

function EntryCard({ title, value, change, periodText, bot }: EntryCardProps) {
  const trend =
    change == null
      ? { arrow: '—', value: 'No comparison', className: 'text-muted' }
      : change > 0
        ? {
            arrow: '↑',
            value: `${formatNumber(Math.abs(change), 1)}%`,
            className: 'text-accent',
          }
        : change < 0
          ? {
              arrow: '↓',
              value: `${formatNumber(Math.abs(change), 1)}%`,
              className: 'text-red-600',
            }
          : { arrow: '→', value: '0%', className: 'text-muted' }

  return (
    <div className="flex w-[13.5rem] shrink-0 flex-col border-r border-line px-4 py-5 last:border-r-0 md:px-5">
      <div className="mb-3 flex min-h-4 items-center gap-2">
        {bot && <CrawlerIcon bot={bot} size="sm" />}
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
          {title}
        </span>
      </div>

      <span className="font-display text-[28px] font-semibold leading-none tracking-tight text-ink">
        {formatNumber(value, 0)}
      </span>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px]">
        <span className={trend.className}>
          {trend.arrow} {trend.value}
        </span>
        <span className="truncate text-muted" title={`Entries in the ${periodText}`}>
          {periodText}
        </span>
      </div>
    </div>
  )
}

interface CrawlerEntryCardsRowProps {
  totalEntries: number
  totalChange: number | null
  bots: CrawlerBotMetric[]
}

export function CrawlerEntryCardsRow({
  totalEntries,
  totalChange,
  bots,
}: CrawlerEntryCardsRowProps) {
  const { filters, presetEndDay, factDays } = useAnalyticsFilters()
  const periodText = periodLabel(
    filters.startDate,
    filters.endDate,
    presetEndDay ?? filters.endDate,
    factDays?.min,
  )

  return (
    <div className="overflow-x-auto border-y border-b-line border-t-ink">
      <div className="flex min-w-max">
        <EntryCard
          title="Total entries"
          value={totalEntries}
          change={totalChange}
          periodText={periodText}
        />
        {bots.map((metric) => (
          <EntryCard
            key={metric.bot}
            title={getCrawlerBotDisplayName(metric.bot)}
            value={metric.count}
            change={metric.change}
            periodText={periodText}
            bot={metric.bot}
          />
        ))}
      </div>
    </div>
  )
}
