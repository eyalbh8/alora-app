import { useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ProviderMention, TrackedRecommendation } from '../../api/types'
import { daysInRange, shortDateLabel, type DateRange } from '../../lib/dates'
import { mergeProviderSeries } from '../../lib/snapshots/merge'
import { groupRecommendationsByDay } from '../../lib/trackedRecommendations'
import { ProviderSeriesTooltip } from '../ProviderSeriesTooltip'
import { MENTIONS_CHART_HEIGHT, MENTIONS_PROVIDER_ORDER, mentionsProviderColor } from './constants'
import { TrackedRecommendationAxis } from './TrackedRecommendationPins'

interface MentionsOverTimeChartProps {
  providers: ProviderMention[]
  range: DateRange
  trackedRecommendations?: TrackedRecommendation[]
}

function ExpandIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function ChartBody({
  chartRows,
  providerKeys,
  yMax,
  pinsByDay,
  expanded = false,
}: {
  chartRows: Record<string, string | number>[]
  providerKeys: string[]
  yMax: number
  pinsByDay: Map<string, TrackedRecommendation[]>
  expanded?: boolean
}) {
  const hasPins = pinsByDay.size > 0
  const dates = chartRows.map((row) => String(row.rawDate ?? ''))

  return (
    <div className="relative overflow-visible">
      <div style={{ height: expanded ? 480 : MENTIONS_CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartRows}
          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="date"
            axisLine={{ stroke: '#eae6de' }}
            tickLine={false}
            tick={{ fill: '#9a938a', fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis hide width={0} domain={[0, yMax]} allowDecimals={false} />
          <ReferenceLine y={0} stroke="#eae6de" />
          <Tooltip
            cursor={{ stroke: '#d8d2c7', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const raw = payload?.[0]?.payload?.rawDate
              return (
                <ProviderSeriesTooltip
                  active={active}
                  date={typeof raw === 'string' ? raw : undefined}
                  entries={payload?.map((entry) => ({
                    provider: String(entry.name ?? entry.dataKey ?? ''),
                    value: entry.value,
                    color: entry.color,
                  }))}
                />
              )
            }}
          />
          {providerKeys.map((provider) => (
            <Line
              key={provider}
              type="monotone"
              dataKey={provider}
              name={provider}
              stroke={mentionsProviderColor(provider)}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 3,
                fill: mentionsProviderColor(provider),
                stroke: '#faf9f7',
                strokeWidth: 1,
              }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      {hasPins && (
        <div className="relative mt-1 h-8 overflow-visible">
          <TrackedRecommendationAxis dates={dates} pinsByDay={pinsByDay} />
        </div>
      )}
    </div>
  )
}

export function MentionsOverTimeChart({
  providers,
  range,
  trackedRecommendations = [],
}: MentionsOverTimeChartProps) {
  const [expanded, setExpanded] = useState(false)
  const days = daysInRange(range)

  const { chartRows, providerKeys, yMax, pinsByDay } = useMemo(() => {
    const series = mergeProviderSeries(providers)
    const keys: string[] = MENTIONS_PROVIDER_ORDER.filter((provider) =>
      providers.some(
        (mention) => mention.provider === provider && (mention.historicalData?.length ?? 0) > 0,
      ),
    )

    for (const provider of providers) {
      if (!keys.includes(provider.provider) && (provider.historicalData?.length ?? 0) > 0) {
        keys.push(provider.provider)
      }
    }

    const dates = [...new Set(series.map((point) => point.date))].sort()
    const rows = dates.map((date) => {
      const row: Record<string, string | number> = {
        date:
          days <= 7
            ? new Date(`${date}T00:00:00`).toLocaleDateString('en', { weekday: 'short' })
            : shortDateLabel(date),
        rawDate: date,
      }

      for (const provider of keys) {
        row[provider] =
          series.find((point) => point.date === date && point.provider === provider)?.value ?? 0
      }

      return row
    })

    const maxValue = Math.max(0, ...series.map((point) => point.value))
    return {
      chartRows: rows,
      providerKeys: keys,
      yMax: maxValue > 0 ? Math.ceil(maxValue * 1.08) : 10,
      pinsByDay: groupRecommendationsByDay(trackedRecommendations, new Set(dates)),
    }
  }, [providers, days, trackedRecommendations])

  const hasData = chartRows.length > 0 && providerKeys.length > 0
  const periodLabel = days === 1 ? 'Selected day' : `Last ${days} days`

  return (
    <>
      <section aria-labelledby="mentions-trend-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="mentions-trend-heading" className="text-[19px] font-semibold text-[#101414]">
              Mentions Over Time
            </h2>
            <p className="mt-1 text-xs text-[#9a938a]">{periodLabel}</p>
          </div>
          {hasData && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="p-1.5 text-[#9a938a] transition-colors hover:text-[#101414]"
              title="Expand chart"
              aria-label="Expand mentions chart"
            >
              <ExpandIcon />
            </button>
          )}
        </div>

        <div className="mt-4">
          {hasData ? (
            <ChartBody
              chartRows={chartRows}
              providerKeys={providerKeys}
              yMax={yMax}
              pinsByDay={pinsByDay}
            />
          ) : (
            <div
              className="flex items-center justify-center border-b border-[#eae6de] text-sm text-[#9a938a]"
              style={{ height: MENTIONS_CHART_HEIGHT }}
            >
              No mention trend data for the selected period.
            </div>
          )}
        </div>
      </section>

      {expanded && hasData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101414]/35 p-4"
          onClick={() => setExpanded(false)}
        >
          <section
            className="w-full max-w-5xl border border-[#eae6de] bg-[#faf9f7] p-6 shadow-2xl"
            aria-modal="true"
            role="dialog"
            aria-labelledby="expanded-mentions-heading"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#eae6de] pb-4">
              <div>
                <h2
                  id="expanded-mentions-heading"
                  className="font-serif text-2xl font-semibold tracking-tight text-[#101414]"
                >
                  Mentions Over Time
                </h2>
                <p className="mt-1 text-xs text-[#9a938a]">{periodLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1.5 text-[#9a938a] transition-colors hover:text-[#101414]"
                aria-label="Close expanded chart"
              >
                <CloseIcon />
              </button>
            </div>
            <ChartBody
              chartRows={chartRows}
              providerKeys={providerKeys}
              yMax={yMax}
              pinsByDay={pinsByDay}
              expanded
            />
          </section>
        </div>
      )}
    </>
  )
}
