import { useAnalyticsFilters } from '../../context/AnalyticsFiltersContext'
import { CRAWLER_BOT_ORDER, getCrawlerBotDisplayName } from '../../lib/crawlerBots'
import { daysInRange, matchActivePresetDays } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import type { CrawlerBotMetric } from '../../lib/snapshots/aiCrawlers'
import { DeltaBadge } from '../dashboard/DeltaBadge'
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
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {bot ? (
          <CrawlerIcon bot={bot} size="sm" showLabel />
        ) : (
          <span className="text-sm font-medium text-slate-700">{title}</span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <span className="text-3xl font-semibold leading-none text-[#101414]">
          {formatNumber(value, 0)}
        </span>
        <DeltaBadge value={change ?? 0} mode="percent" />
      </div>

      <p className="mt-2 text-sm text-slate-500">Entries in the {periodText}</p>
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

  const botByKey = new Map(bots.map((b) => [b.bot, b]))

  return (
    <div className="flex flex-col gap-2 xl:flex-row">
      <EntryCard
        title="Total entries"
        value={totalEntries}
        change={totalChange}
        periodText={periodText}
      />
      {CRAWLER_BOT_ORDER.map((bot) => {
        const metric = botByKey.get(bot) ?? { bot, count: 0, change: 0 }
        return (
          <EntryCard
            key={bot}
            title={getCrawlerBotDisplayName(bot)}
            value={metric.count}
            change={metric.change}
            periodText={periodText}
            bot={bot}
          />
        )
      })}
    </div>
  )
}
