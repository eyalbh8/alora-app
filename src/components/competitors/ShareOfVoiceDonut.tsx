import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import type { CompetitorPerformance } from '../../api/types'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { formatNumber } from '../../lib/format'
import { DashboardCard } from '../dashboard/DashboardCard'
import { BrandLogo } from './BrandLogo'
import {
  SOV_CHART,
  SOV_COLORS,
  sovChartCenter,
  sovDonutOuterRadius,
} from './constants'

interface ShareOfVoiceDonutProps {
  competitors: CompetitorPerformance[]
}

interface DonutSlice {
  id: string
  name: string
  logo?: string | null
  domain?: string | null
  site?: string | null
  value: number
  color: string
  angle: number
}

function sliceMidAngle(index: number, total: number) {
  return ((index + 0.5) / total) * 360 - 90
}

function polarPoint(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  }
}

export function ShareOfVoiceDonut({ competitors }: ShareOfVoiceDonutProps) {
  const { hoveredCompetitor, setHoveredCompetitor } = useCompetitorHover()
  const [activeId, setActiveId] = useState<string | null>(null)

  const slices = useMemo(() => {
    const active = competitors.filter((c) => (c.occurrences ?? 0) > 0)
    return active.map((c, index) => ({
      id: c.id,
      name: c.name,
      logo: c.logo,
      domain: c.domain,
      site: c.site,
      value: c.occurrences ?? 0,
      color: SOV_COLORS[index % SOV_COLORS.length],
      angle: sliceMidAngle(index, active.length),
    })) satisfies DonutSlice[]
  }, [competitors])

  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const account =
    competitors.find((c) => c.isAccount || c.id === 'account') ??
    competitors.find((c) => (c.occurrences ?? 0) > 0)
  const myShare =
    total > 0 && account ? Math.round(((account.occurrences ?? 0) / total) * 100) : 0

  const { cx, cy } = sovChartCenter()
  const donutOuterR = sovDonutOuterRadius()
  const highlightName = hoveredCompetitor ?? slices.find((s) => s.id === activeId)?.name ?? null

  return (
    <DashboardCard title="Share of Voice" contentClassName="overflow-hidden">
      {slices.length === 0 ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
          No mention data for the selected period.
        </div>
      ) : (
        <div className="flex h-full items-center justify-center overflow-hidden px-2 py-1">
          <div
            className="relative mx-auto w-full max-w-[400px]"
            style={{ aspectRatio: `${SOV_CHART.width} / ${SOV_CHART.height}` }}
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${SOV_CHART.width} ${SOV_CHART.height}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              {/* Soft backdrop disc */}
              <circle
                cx={cx}
                cy={cy}
                r={SOV_CHART.logoOrbit + 8}
                fill="#f8fafc"
              />
              <circle
                cx={cx}
                cy={cy}
                r={donutOuterR + 6}
                fill="none"
                stroke="#eef2f6"
                strokeWidth={1}
              />

              {/* Leader lines */}
              {slices.map((slice) => {
                const inner = polarPoint(cx, cy, slice.angle, donutOuterR + 2)
                const outer = polarPoint(cx, cy, slice.angle, SOV_CHART.logoOrbit - 22)
                const lit = !highlightName || highlightName === slice.name
                return (
                  <line
                    key={`line-${slice.id}`}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={lit ? '#dde3ea' : '#eef2f6'}
                    strokeWidth={1}
                    strokeLinecap="round"
                  />
                )
              })}
            </svg>

            {/* Donut — 50% of chart width, scales with container */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(cx / SOV_CHART.width) * 100}%`,
                top: `${(cy / SOV_CHART.height) * 100}%`,
                width: `${(SOV_CHART.donutSize / SOV_CHART.width) * 100}%`,
                aspectRatio: '1',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={`${SOV_CHART.innerRadiusPct * 100}%`}
                    outerRadius={`${SOV_CHART.outerRadiusPct * 100}%`}
                    paddingAngle={1.2}
                    cornerRadius={4}
                    stroke="#fff"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                  >
                    {slices.map((slice) => {
                      const lit = !highlightName || highlightName === slice.name
                      return (
                        <Cell
                          key={slice.id}
                          fill={slice.color}
                          fillOpacity={lit ? 1 : 0.28}
                          stroke="#fff"
                          strokeOpacity={lit ? 1 : 0.6}
                        />
                      )
                    })}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center hub */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className="flex flex-col items-center justify-center rounded-full border border-slate-200/70 bg-white text-center shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
                  style={{
                    width: `${(SOV_CHART.centerHub / SOV_CHART.donutSize) * 100}%`,
                    height: `${(SOV_CHART.centerHub / SOV_CHART.donutSize) * 100}%`,
                  }}
                >
                  <span className="max-w-[70%] text-[clamp(8px,1.6vw,10px)] leading-snug text-slate-500">
                    My Share of Voice
                  </span>
                  <span className="mt-0.5 text-[clamp(18px,4vw,26px)] font-semibold leading-none tracking-tight text-[#101414]">
                    {formatNumber(myShare, 0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Logo callouts */}
            {slices.map((slice) => {
              const pos = polarPoint(cx, cy, slice.angle, SOV_CHART.logoOrbit)
              const lit = !highlightName || highlightName === slice.name
              return (
                <div
                  key={slice.id}
                  className="absolute z-10 transition-all duration-150"
                  style={{
                    left: `${(pos.x / SOV_CHART.width) * 100}%`,
                    top: `${(pos.y / SOV_CHART.height) * 100}%`,
                    opacity: lit ? 1 : 0.45,
                    transform: `translate(-50%, -50%) scale(${lit && highlightName === slice.name ? 1.1 : 1})`,
                  }}
                  onMouseEnter={() => {
                    setActiveId(slice.id)
                    setHoveredCompetitor(slice.name)
                  }}
                  onMouseLeave={() => {
                    setActiveId(null)
                    setHoveredCompetitor(null)
                  }}
                >
                  <BrandLogo
                    id={slice.id}
                    name={slice.name}
                    logo={slice.logo}
                    domain={slice.domain}
                    site={slice.site}
                    size="lg"
                    badge
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
