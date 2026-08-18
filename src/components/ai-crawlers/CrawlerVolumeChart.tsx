import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { daysInRange, shortDateLabel, type DateRange } from '../../lib/dates'
import { formatNumber } from '../../lib/format'

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
    <div className={expanded ? 'h-[480px]' : 'h-[220px] sm:h-[260px]'}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedRows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(227, 220, 200, 0.12)" />
          <XAxis
            dataKey="date"
            axisLine={{ stroke: 'rgba(227, 220, 200, 0.12)' }}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#a79f8c' }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, yMax]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: '#a79f8c' }}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value ?? 0), 0), 'Entries']}
            labelFormatter={(_, payload) => {
              const raw = payload?.[0]?.payload?.rawDate
              return typeof raw === 'string' ? raw : ''
            }}
            contentStyle={{
              background: '#1a1a1a',
              color: '#e3dcc8',
              border: '1px solid rgba(227, 220, 200, 0.12)',
              borderRadius: 0,
              fontSize: 12,
            }}
            cursor={{ fill: 'rgba(66, 202, 128, 0.12)' }}
          />
          <Bar dataKey="value" fill="#42ca80" maxBarSize={56} radius={[2, 2, 0, 0]} />
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
      hasData: chartRows.some((row) => row.value > 0),
    }
  }, [chartRows])

  return (
    <>
      <section>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[19px] font-semibold text-ink">Crawler Volume</h2>
            <p className="mt-0.5 text-xs text-muted">
              AI crawler entries over time for the selected period.
            </p>
          </div>
          {hasData && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="p-1.5 text-muted transition hover:text-ink"
              title="Expand chart"
              aria-label="Expand chart"
            >
              <ExpandIcon />
            </button>
          )}
        </div>

        <div>
          {!hasData ? (
            <div className="flex h-[220px] items-center justify-center border-y border-dashed border-line px-6 text-sm text-muted sm:h-[260px]">
              No crawler volume data for the selected period.
            </div>
          ) : (
            <ChartBody chartRows={chartRows} yMax={yMax} days={days} />
          )}
        </div>
      </section>

      {expanded && hasData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden bg-bg "
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <h2 className="text-[19px] font-semibold text-ink">Crawler Volume</h2>
                <p className="mt-0.5 text-xs text-muted">
                  AI crawler entries over time for the selected period.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="border border-line px-3 py-1.5 text-sm text-muted hover:border-ink hover:text-ink"
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
