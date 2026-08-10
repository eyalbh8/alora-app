import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { daysInRange, shortDateLabel, type DateRange } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import { SENTIMENT_CHART_HEIGHT, SENTIMENT_GREEN } from './constants'

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
        <span className="text-2xl font-semibold text-[#101414]">
          {value != null ? formatNumber(value, 0) : '—'}
        </span>
        {delta != null && (
          <span
            className={`text-sm font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {delta >= 0 ? '+' : ''}
            {delta}% This period
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
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
    <div className={`relative ${expanded ? 'h-[480px]' : 'h-full min-h-[240px]'}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none font-serif text-5xl font-semibold tracking-tight text-slate-100">
          Alora
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sentiment-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SENTIMENT_GREEN} stopOpacity={0.35} />
              <stop offset="100%" stopColor={SENTIMENT_GREEN} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [value ?? 0, 'Sentiment']}
            labelFormatter={(_, payload) => {
              const raw = payload?.[0]?.payload?.rawDate
              return typeof raw === 'string' ? raw : ''
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke={SENTIMENT_GREEN}
            strokeWidth={2}
            fill="url(#sentiment-area-fill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
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
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
        style={{ height: SENTIMENT_CHART_HEIGHT, minHeight: SENTIMENT_CHART_HEIGHT }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-medium text-[#101414]">Sentiment Trend</h2>
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
          {hasData && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              title="Expand chart"
              aria-label="Expand chart"
            >
              <ExpandIcon />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 px-2 pb-4 pt-1">
          {!hasData ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
              No sentiment trend data for the selected period.
            </div>
          ) : (
            <ChartBody chartRows={chartRows} />
          )}
        </div>
      </div>

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
