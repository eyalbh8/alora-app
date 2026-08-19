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
import { providerLabel } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'
import { ProviderSeriesTooltip } from '../ProviderSeriesTooltip'
import { CHART_AXIS, CHART_GRID } from '../dashboard/constants'
import { AI_TRAFFIC_CHART_HEIGHT, trafficProviderColor } from './constants'

interface LlmVisitTrendsChartProps {
  chartRows: Array<Record<string, string | number>>
  providerKeys: string[]
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
  providerKeys,
  yMax,
  days,
  expanded = false,
}: {
  chartRows: Array<Record<string, string | number>>
  providerKeys: string[]
  yMax: number
  days: number
  expanded?: boolean
}) {
  const formattedRows = chartRows.map((row) => ({
    ...row,
    date:
      days <= 7
        ? new Date(`${String(row.rawDate ?? row.date).slice(0, 10)}T00:00:00`).toLocaleDateString(
            'en',
            { weekday: 'short', month: 'short', day: 'numeric' },
          )
        : shortDateLabel(String(row.rawDate ?? row.date).slice(0, 10)),
  }))

  return (
    <div className={`relative ${expanded ? 'h-[480px]' : 'h-[220px] sm:h-[280px]'}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none font-display text-5xl font-semibold tracking-tight text-ink-ghost">
          Alora
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedRows} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <defs>
            {providerKeys.map((p) => (
              <linearGradient key={p} id={`traffic-fill-${p}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trafficProviderColor(p)} stopOpacity={0.18} />
                <stop offset="100%" stopColor={trafficProviderColor(p)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={CHART_GRID} />
          <XAxis
            dataKey="date"
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_AXIS }}
            interval={days <= 7 ? 0 : 'preserveStartEnd'}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fill: CHART_AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={38}
            allowDecimals={false}
          />
          <Tooltip
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
                  valueLabel="visits"
                />
              )
            }}
          />
          {providerKeys.map((p) => (
            <Area
              key={p}
              type="monotone"
              dataKey={p}
              name={p}
              stroke={trafficProviderColor(p)}
              strokeWidth={2}
              fill={`url(#traffic-fill-${p})`}
              dot={
                formattedRows.length === 1
                  ? { r: 4, fill: trafficProviderColor(p), strokeWidth: 0 }
                  : false
              }
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LlmVisitTrendsChart({ chartRows, providerKeys, range }: LlmVisitTrendsChartProps) {
  const [expanded, setExpanded] = useState(false)
  const days = daysInRange(range)

  const { yMax, hasValues } = useMemo(() => {
    const values = chartRows.flatMap((row) =>
      providerKeys.map((p) => (typeof row[p] === 'number' ? (row[p] as number) : 0)),
    )
    const maxValue = Math.max(0, ...values)
    const computedMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 5
    const tickStep = computedMax <= 5 ? 1 : computedMax <= 10 ? 2 : Math.ceil(computedMax / 5)

    return {
      yMax: Math.max(tickStep, Math.ceil(computedMax / tickStep) * tickStep),
      hasValues: values.some((value) => value > 0),
    }
  }, [chartRows, providerKeys])

  const hasChart = chartRows.length > 0
  const legendKeys =
    providerKeys.length > 0
      ? providerKeys
      : ['OPENAI', 'ANTHROPIC', 'PERPLEXITY', 'GEMINI', 'BD_COPILOT']

  return (
    <>
      <section
        className="flex flex-col pt-1"
        style={{ minHeight: AI_TRAFFIC_CHART_HEIGHT }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 pb-4">
          <div>
            <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-ink">
              LLM Visit Trends
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Track visits from different LLM providers over time.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {legendKeys.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ backgroundColor: trafficProviderColor(p) }}
                  />
                  <ProviderIcon provider={p} size="sm" className="h-4 w-4" />
                  {providerLabel(p)}
                </span>
              ))}
            </div>
          </div>
          {hasValues && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="p-1.5 text-muted transition hover:bg-paper-soft hover:text-ink"
              title="Expand chart"
              aria-label="Expand chart"
            >
              <ExpandIcon />
            </button>
          )}
        </div>

        <div>
          {!hasChart ? (
            <div className="flex h-[220px] items-center justify-center border-y border-line px-6 text-sm text-muted sm:h-[280px]">
              No visit trend data for the selected period.
            </div>
          ) : (
            <ChartBody
              chartRows={chartRows}
              providerKeys={providerKeys}
              yMax={yMax}
              days={days}
            />
          )}
        </div>
      </section>

      {expanded && hasValues && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden border border-line bg-bg "
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <h2 className="text-[19px] font-semibold text-ink">LLM Visit Trends</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Track visits from different LLM providers over time.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {providerKeys.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                      <span
                        className="h-[7px] w-[7px] rounded-full"
                        style={{ backgroundColor: trafficProviderColor(p) }}
                      />
                      <ProviderIcon provider={p} size="sm" className="h-4 w-4" />
                      {providerLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="border border-line px-3 py-1.5 text-sm text-muted transition hover:bg-paper-soft"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-5">
              <ChartBody
                chartRows={chartRows}
                providerKeys={providerKeys}
                yMax={yMax}
                days={days}
                expanded
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
