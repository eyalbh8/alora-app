import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { ProviderMention } from '../../api/types'
import { formatNumber, providerLabel } from '../../lib/format'
import {
  MENTIONS_CHART_HEIGHT,
  MENTIONS_DONUT,
  MENTIONS_PROVIDER_ORDER,
  mentionsDonutCenter,
  mentionsDonutOuterRadius,
  mentionsProviderColor,
} from './constants'
import { ProviderIcon } from '../ProviderIcon'

interface LlmMentionsDonutProps {
  providers: ProviderMention[]
}

interface DonutSlice {
  provider: string
  label: string
  value: number
  color: string
  angle: number
}

function buildSlices(providers: ProviderMention[]): Omit<DonutSlice, 'angle'>[] {
  const byProvider = new Map(providers.map((p) => [p.provider, p]))
  const ordered: Omit<DonutSlice, 'angle'>[] = MENTIONS_PROVIDER_ORDER.map((provider) => {
    const mention = byProvider.get(provider)
    return {
      provider,
      label: providerLabel(provider),
      value: mention?.count ?? 0,
      color: mentionsProviderColor(provider),
    }
  }).filter((s) => s.value > 0)

  for (const p of providers) {
    if (!ordered.some((s) => s.provider === p.provider) && (p.count ?? 0) > 0) {
      ordered.push({
        provider: p.provider,
        label: providerLabel(p.provider),
        value: p.count ?? 0,
        color: mentionsProviderColor(p.provider),
      })
    }
  }

  return ordered
}

/** Mid-angle of each pie slice in Recharts polar degrees (0 = 3 o'clock, 90 = top). */
function sliceMidAngles(
  slices: Array<{ value: number }>,
  startAngle = MENTIONS_DONUT.startAngle,
  paddingAngle = MENTIONS_DONUT.paddingAngle,
): number[] {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total === 0) return []

  const totalPadding = paddingAngle * slices.length
  const sweep = 360 - totalPadding
  let cursor = startAngle + paddingAngle / 2

  return slices.map((slice) => {
    const span = (slice.value / total) * sweep
    const mid = cursor + span / 2
    cursor += span + paddingAngle
    return mid
  })
}

function rechartsPolarPoint(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (-angleDeg * Math.PI) / 180
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  }
}

export function LlmMentionsDonut({ providers }: LlmMentionsDonutProps) {
  const slices = useMemo(() => {
    const base = buildSlices(providers)
    const angles = sliceMidAngles(base)
    return base.map((slice, index) => ({ ...slice, angle: angles[index] ?? 0 }))
  }, [providers])

  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const { cx, cy } = mentionsDonutCenter()
  const donutOuterR = mentionsDonutOuterRadius()

  if (slices.length === 0) {
    return (
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
        style={{ height: MENTIONS_CHART_HEIGHT, minHeight: MENTIONS_CHART_HEIGHT }}
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-medium text-[#101414]">LLM Mentions</h2>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
          No mention data for the selected period.
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
      style={{ height: MENTIONS_CHART_HEIGHT, minHeight: MENTIONS_CHART_HEIGHT }}
    >
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-medium text-[#101414]">LLM Mentions</h2>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-1">
        <div
          className="relative mx-auto w-full max-w-[400px]"
          style={{ aspectRatio: `${MENTIONS_DONUT.width} / ${MENTIONS_DONUT.height}` }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${MENTIONS_DONUT.width} ${MENTIONS_DONUT.height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <circle cx={cx} cy={cy} r={MENTIONS_DONUT.logoOrbit + 6} fill="#f8fafc" />
            <circle
              cx={cx}
              cy={cy}
              r={donutOuterR + 4}
              fill="none"
              stroke="#eef2f6"
              strokeWidth={1}
            />
            {slices.map((slice) => {
              const inner = rechartsPolarPoint(cx, cy, slice.angle, donutOuterR + 2)
              const outer = rechartsPolarPoint(cx, cy, slice.angle, MENTIONS_DONUT.logoOrbit - 18)
              return (
                <line
                  key={`line-${slice.provider}`}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#dde3ea"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(cx / MENTIONS_DONUT.width) * 100}%`,
              top: `${(cy / MENTIONS_DONUT.height) * 100}%`,
              width: `${(MENTIONS_DONUT.donutSize / MENTIONS_DONUT.width) * 100}%`,
              aspectRatio: '1',
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  startAngle={MENTIONS_DONUT.startAngle}
                  endAngle={MENTIONS_DONUT.startAngle + 360}
                  innerRadius={`${MENTIONS_DONUT.innerRadiusPct * 100}%`}
                  outerRadius={`${MENTIONS_DONUT.outerRadiusPct * 100}%`}
                  paddingAngle={MENTIONS_DONUT.paddingAngle}
                  cornerRadius={3}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.provider} fill={slice.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-500">Total Mentions</span>
              <span className="text-3xl font-semibold tracking-tight text-[#101414]">
                {formatNumber(total, 0)}
              </span>
            </div>
          </div>

          {slices.map((slice) => {
            const pos = rechartsPolarPoint(cx, cy, slice.angle, MENTIONS_DONUT.logoOrbit)
            return (
              <div
                key={slice.provider}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${(pos.x / MENTIONS_DONUT.width) * 100}%`,
                  top: `${(pos.y / MENTIONS_DONUT.height) * 100}%`,
                }}
                title={slice.label}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                  <ProviderIcon provider={slice.provider} size="md" />
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
