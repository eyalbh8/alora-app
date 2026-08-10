import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { daysInRange, shortDateLabel, type DateRange } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import { AI_CRAWLERS_CHART_HEIGHT, CRAWLER_BAR_COLORS } from './constants'

interface CrawlerVolumeChartProps {
  chartRows: Array<{ date: string; rawDate: string; value: number }>
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

function ChartBody({
  chartRows,
  yMax,
  days,
  expanded = false,
}: {
  chartRows: Array<{ date: string; rawDate: string; value: number }>
  yMax: number
  days: number
  expanded?: boolean
}) {
  const formattedRows = chartRows.map((row) => ({
    ...row,
    date:
      days <= 7
        ? new Date(`${row.rawDate.slice(0, 10)}T00:00:00`).toLocaleDateString('en', {
            weekday: 'short',
          })
        : shortDateLabel(row.rawDate),
  }))

  return (
    <div className={`relative ${expanded ? 'h-[480px]' : 'h-full min-h-[280px]'}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none font-serif text-5xl font-semibold tracking-tight text-slate-100">
          Alora
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[0, yMax]} tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value ?? 0), 0), 'Entries']}
            labelFormatter={(_, payload) => {
              const raw = payload?.[0]?.payload?.rawDate
              return typeof raw === 'string' ? raw : ''
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {formattedRows.map((_, index) => (
              <Cell
                key={index}
                fill={index % 2 === 0 ? CRAWLER_BAR_COLORS.primary : CRAWLER_BAR_COLORS.alternate}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CrawlerVolumeChart({ chartRows, range }: CrawlerVolumeChartProps) {
  const [expanded, setExpanded] = useState(false)
  const days = daysInRange(range)

  const { yMax, hasData } = useMemo(() => {
    const values = chartRows.map((row) => row.value)
    const maxValue = Math.max(0, ...values)
    const computedMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 5
    const tickStep = computedMax <= 5 ? 1 : computedMax <= 10 ? 2 : Math.ceil(computedMax / 5)

    return {
      yMax: Math.max(tickStep, Math.ceil(computedMax / tickStep) * tickStep),
      hasData: chartRows.length > 0,
    }
  }, [chartRows])

  return (
    <>
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
        style={{ height: AI_CRAWLERS_CHART_HEIGHT, minHeight: AI_CRAWLERS_CHART_HEIGHT }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-medium text-[#101414]">Crawler Volume</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              AI crawler entries over time for the selected period.
            </p>
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
              No crawler volume data for the selected period.
            </div>
          ) : (
            <ChartBody chartRows={chartRows} yMax={yMax} days={days} />
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
                <h2 className="text-lg font-semibold text-[#101414]">Crawler Volume</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  AI crawler entries over time for the selected period.
                </p>
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
              <ChartBody chartRows={chartRows} yMax={yMax} days={days} expanded />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
