import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CitationTrend } from '../../api/geo'
import { shortDateLabel } from '../../lib/dates'
import { formatNumber } from '../../lib/format'
import { CHART_AXIS, CHART_GRID } from '../dashboard/constants'
import { DeltaLabel } from '../prompts/DeltaLabel'
import { CITATIONS_CHART_HEIGHT, citationGrowthPercent, humanizeType, typeColor } from './constants'

interface CitationsTrendChartProps {
  title: string
  trend: CitationTrend
}

export function CitationsTrendChart({ title, trend }: CitationsTrendChartProps) {
  const series = trend.chartSeries
  const rows = useMemo(() => {
    return trend.chartCategories.map((category, index) => {
      const rawDate = String(category).slice(0, 10)
      const point: Record<string, string | number> = {
        rawDate,
        date: /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? shortDateLabel(rawDate) : String(category),
      }
      for (const item of series) {
        point[item.name] = item.data[index] ?? 0
      }
      return point
    })
  }, [series, trend.chartCategories])

  const growth = citationGrowthPercent(trend.currentTotal, trend.previousTotal)
  const hasData = rows.length > 0 && series.some((item) => item.data.some((value) => value > 0))

  return (
    <section aria-labelledby="citations-trend-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="citations-trend-title" className="text-[17px] font-semibold text-ink">
            {title}
          </h2>
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <div>
              <p className="text-[28px] font-medium leading-none tracking-tight text-ink tabular-nums">
                {formatNumber(trend.currentTotal, 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted">This period</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums text-muted">
                {formatNumber(trend.previousTotal, 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted">Previous period</p>
            </div>
            <DeltaLabel value={growth} />
          </div>
        </div>
      </div>

      {hasData ? (
        <div className="mt-4" style={{ height: CITATIONS_CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                axisLine={{ stroke: CHART_GRID }}
                tickLine={false}
                tick={{ fill: CHART_AXIS, fontSize: 10 }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis hide width={0} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="border border-line bg-surface px-3 py-2 text-xs shadow-sm">
                      <p className="mb-1 font-medium text-ink">{label}</p>
                      {payload.map((entry) => (
                        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-muted">
                          <span className="h-1.5 w-1.5" style={{ backgroundColor: String(entry.color) }} />
                          <span>{humanizeType(String(entry.name))}</span>
                          <span className="ml-auto tabular-nums text-ink">
                            {formatNumber(typeof entry.value === 'number' ? entry.value : null, 0)}
                          </span>
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              {series.map((item, index) => (
                <Area
                  key={item.name}
                  type="monotone"
                  dataKey={item.name}
                  name={item.name}
                  stackId="citations"
                  stroke={typeColor(item.name, index)}
                  fill={typeColor(item.name, index)}
                  fillOpacity={0.18}
                  strokeWidth={1.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-5 border-y border-line py-12 text-sm text-muted">
          No source usage trend for the selected period.
        </div>
      )}
    </section>
  )
}
