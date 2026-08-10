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
import type { ProviderMention } from '../../api/types'
import { daysInRange, shortDateLabel, type DateRange } from '../../lib/dates'
import { providerLabel } from '../../lib/format'
import { mergeProviderSeries } from '../../lib/snapshots/merge'
import { ProviderIcon } from '../ProviderIcon'
import { MENTIONS_CHART_HEIGHT, MENTIONS_PROVIDER_ORDER, mentionsProviderColor } from './constants'

interface MentionsOverTimeChartProps {
  providers: ProviderMention[]
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
  expanded = false,
}: {
  chartRows: Record<string, string | number>[]
  providerKeys: string[]
  yMax: number
  expanded?: boolean
}) {
  return (
    <div className={`relative ${expanded ? 'h-[480px]' : 'h-full min-h-[280px]'}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none font-serif text-5xl font-semibold tracking-tight text-slate-100">
          Alora
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            {providerKeys.map((p) => (
              <linearGradient key={p} id={`mentions-area-${p}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={mentionsProviderColor(p)} stopOpacity={0.35} />
                <stop offset="100%" stopColor={mentionsProviderColor(p)} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[0, yMax]} tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => [value ?? 0, providerLabel(String(name ?? ''))]}
            labelFormatter={(_, payload) => {
              const raw = payload?.[0]?.payload?.rawDate
              return typeof raw === 'string' ? raw : ''
            }}
          />
          {providerKeys.map((p) => (
            <Area
              key={p}
              type="monotone"
              dataKey={p}
              name={p}
              stroke={mentionsProviderColor(p)}
              strokeWidth={2}
              fill={`url(#mentions-area-${p})`}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MentionsOverTimeChart({ providers, range }: MentionsOverTimeChartProps) {
  const [expanded, setExpanded] = useState(false)
  const days = daysInRange(range)

  const { chartRows, providerKeys, yMax } = useMemo(() => {
    const series = mergeProviderSeries(providers)
    const keys: string[] = MENTIONS_PROVIDER_ORDER.filter((p) =>
      providers.some((m) => m.provider === p && (m.historicalData?.length ?? 0) > 0),
    )
    for (const p of providers) {
      if (!keys.includes(p.provider) && (p.historicalData?.length ?? 0) > 0) {
        keys.push(p.provider)
      }
    }

    const dates = [...new Set(series.map((s) => s.date))].sort()
    const rows = dates.map((date) => {
      const row: Record<string, string | number> = {
        date:
          days <= 7
            ? new Date(`${date}T00:00:00`).toLocaleDateString('en', { weekday: 'short' })
            : shortDateLabel(date),
        rawDate: date,
      }
      for (const p of keys) {
        const hit = series.find((s) => s.date === date && s.provider === p)
        row[p] = hit?.value ?? 0
      }
      return row
    })

    const maxValue = Math.max(0, ...series.map((s) => s.value))
    const computedMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 10
    const tickStep = computedMax <= 10 ? 2 : computedMax <= 35 ? 7 : Math.ceil(computedMax / 5)

    return {
      chartRows: rows,
      providerKeys: keys,
      yMax: Math.max(tickStep, Math.ceil(computedMax / tickStep) * tickStep),
    }
  }, [providers, days])

  const hasData = chartRows.length > 0 && providerKeys.length > 0

  return (
    <>
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
        style={{ height: MENTIONS_CHART_HEIGHT, minHeight: MENTIONS_CHART_HEIGHT }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-medium text-[#101414]">Mentions Over Time</h2>
            {hasData && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {providerKeys.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <ProviderIcon provider={p} size="sm" />
                    {providerLabel(p)}
                  </span>
                ))}
              </div>
            )}
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
              No mention trend data for the selected period.
            </div>
          ) : (
            <ChartBody chartRows={chartRows} providerKeys={providerKeys} yMax={yMax} />
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
                <h2 className="text-lg font-semibold text-[#101414]">Mentions Over Time</h2>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {providerKeys.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: mentionsProviderColor(p) }}
                      />
                      {providerLabel(p)}
                    </span>
                  ))}
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
              <ChartBody
                chartRows={chartRows}
                providerKeys={providerKeys}
                yMax={yMax}
                expanded
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
