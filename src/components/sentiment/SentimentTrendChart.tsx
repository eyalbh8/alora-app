import { useMemo, useState } from 'react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { daysInRange, shortDateLabel, type DateRange } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import { SENTIMENT_DIVIDER, SENTIMENT_TEAL } from './constants'

interface HistoricalPoint {
  date: string
  provider: string
  sentimentScore: number
}

interface SentimentTrendChartProps {
  historical: HistoricalPoint[]
  currentScore: number | null
  previousScore: number | null
  range: DateRange
}

function ExpandIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
      />
    </svg>
  )
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function aggregateDailySentiment(historical: HistoricalPoint[]) {
  const byDate = new Map<string, number[]>()
  for (const point of historical) {
    const day = point.date.slice(0, 10)
    const bucket = byDate.get(day) ?? []
    bucket.push(point.sentimentScore)
    byDate.set(day, bucket)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => ({
      date,
      score: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
    }))
}

function PeriodStat({
  value,
  label,
  delta,
}: {
  value: number | null
  label: string
  delta?: number | null
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[34px] font-semibold tracking-tight text-[#101414]">
          {value != null ? formatNumber(value, 0) : '—'}
        </span>
        {delta != null && (
          <span
            className={`text-xs font-medium ${delta >= 0 ? 'text-brand-700' : 'text-red-600'}`}
          >
            {delta >= 0 ? '+' : ''}
            {delta}% This period
          </span>
        )}
      </div>
      {label && <p className="mt-0.5 text-xs text-[#9a938a]">{label}</p>}
    </div>
  )
}

function ChartBody({
  chartRows,
  expanded = false,
}: {
  chartRows: Array<{ date: string; rawDate: string; score: number }>
  expanded?: boolean
}) {
  return (
    <div className={expanded ? 'h-[480px]' : 'h-[180px] w-full'}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="date"
            axisLine={{ stroke: SENTIMENT_DIVIDER }}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#9a938a' }}
            interval="preserveStartEnd"
            dy={8}
          />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            formatter={(value) => [value ?? 0, 'Sentiment']}
            labelFormatter={(_, payload) => {
              const raw = payload?.[0]?.payload?.rawDate
              return typeof raw === 'string' ? raw : ''
            }}
            contentStyle={{
              border: `1px solid ${SENTIMENT_DIVIDER}`,
              borderRadius: 0,
              boxShadow: 'none',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={SENTIMENT_TEAL}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 3, fill: SENTIMENT_TEAL, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SentimentTrendChart({
  historical,
  currentScore,
  previousScore,
  range,
}: SentimentTrendChartProps) {
  const [expanded, setExpanded] = useState(false)
  const days = daysInRange(range)
  const delta = pctChange(currentScore, previousScore)

  const chartRows = useMemo(() => {
    const daily = aggregateDailySentiment(historical)
    return daily.map(({ date, score }) => ({
      date:
        days <= 7
          ? new Date(`${date}T00:00:00`).toLocaleDateString('en', { weekday: 'short' })
          : shortDateLabel(date),
      rawDate: date,
      score,
    }))
  }, [historical, days])

  const hasData = chartRows.length > 0

  return (
    <>
      <section aria-labelledby="sentiment-trend-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sentiment-trend-title" className="text-[19px] font-semibold text-[#101414]">
              Sentiment Trend
            </h2>
            <div className="mt-0.5 flex flex-wrap items-end gap-x-8 gap-y-2">
              <PeriodStat
                value={currentScore != null ? Math.round(currentScore) : null}
                label=""
                delta={delta}
              />
              <PeriodStat
                value={previousScore != null ? Math.round(previousScore) : null}
                label="Previous period"
              />
            </div>
          </div>
          {hasData && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="p-1.5 text-[#9a938a] transition hover:text-[#101414]"
              title="Expand chart"
              aria-label="Expand chart"
            >
              <ExpandIcon />
            </button>
          )}
        </div>

        <div className="mt-3">
          {!hasData ? (
            <div className="flex h-[180px] items-center justify-center border-b border-[#eae6de] px-6 text-sm text-[#9a938a]">
              No sentiment trend data for the selected period.
            </div>
          ) : (
            <ChartBody chartRows={chartRows} />
          )}
        </div>
      </section>

      {expanded && hasData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#101414]">Sentiment Trend</h2>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                  <PeriodStat
                    value={currentScore != null ? Math.round(currentScore) : null}
                    label=""
                    delta={delta}
                  />
                  <PeriodStat
                    value={previousScore != null ? Math.round(previousScore) : null}
                    label="Previous period"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-4">
              <ChartBody chartRows={chartRows} expanded />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
