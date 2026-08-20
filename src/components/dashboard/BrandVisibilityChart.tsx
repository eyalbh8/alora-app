import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CompetitorPerformance } from '../../api/types'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { daysInRange, type DateRange } from '../../lib/dates'
import { BrandLogo } from '../competitors/BrandLogo'
import { DashboardCard } from './DashboardCard'
import {
  CHART_AXIS,
  CHART_COLORS,
  CHART_GRID,
  PAIRED_BRAND_COUNT,
  PAIRED_LEGEND_HEIGHT_PX,
  PAIRED_PLOT_HEIGHT_PX,
  PAIRED_XAXIS_HEIGHT_PX,
} from './constants'

interface BrandVisibilityChartProps {
  competitors: CompetitorPerformance[]
  range: DateRange
  title?: string
  subtitle?: string
  variant?: 'card' | 'editorial'
  emptyMessage?: string
  valueLabel?: string
  heightClassName?: string
  showLegend?: boolean
  paired?: boolean
  framed?: boolean
}

export function BrandVisibilityChart({
  competitors,
  range,
  title = 'Brand Visibility Over Time',
  subtitle = 'Mentions trend for top brands',
  variant = 'card',
  emptyMessage = 'No visibility trend data for the selected period.',
  valueLabel,
  heightClassName,
  showLegend = false,
  paired = false,
  framed = true,
}: BrandVisibilityChartProps) {
  const { hoveredCompetitor } = useCompetitorHover()
  const days = daysInRange(range)

  const referencePoints = useMemo(
    () => competitors.find((c) => (c.historicalData?.length ?? 0) > 0)?.historicalData ?? [],
    [competitors],
  )

  const chartData = useMemo(() => {
    return referencePoints.map((point) => {
      const dateKey = point.date.split('T')[0]
      const row: Record<string, string | number> = {
        date: dateKey,
        label:
          days <= 7
            ? new Date(`${dateKey}T00:00:00`).toLocaleDateString('en', { weekday: 'short' })
            : new Date(`${dateKey}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      }
      for (const competitor of competitors) {
        const map = new Map(
          (competitor.historicalData ?? []).map((d) => [d.date.split('T')[0], d.value]),
        )
        row[competitor.name] = map.get(dateKey) ?? 0
      }
      return row
    })
  }, [competitors, referencePoints, days])

  const maxValue = Math.max(
    0,
    ...competitors.flatMap((c) => (c.historicalData ?? []).map((d) => d.value)),
  )
  const expandedMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 100
  const tickStep = Math.max(5, Math.ceil(expandedMax / 20) * 5)
  const yMax = paired
    ? Math.max(25, Math.ceil(expandedMax / 25) * 25)
    : Math.ceil(expandedMax / tickStep) * tickStep
  const yTicks = paired
    ? Array.from({ length: PAIRED_BRAND_COUNT }, (_, index) => (yMax / PAIRED_BRAND_COUNT) * index)
    : Array.from({ length: Math.ceil(yMax / tickStep) }, (_, index) => index * tickStep)

  const hasData = chartData.length > 0 && competitors.length > 0

  return (
    <DashboardCard
      title={title}
      subtitle={subtitle}
      variant={variant}
      fill={paired || variant === 'editorial'}
      framed={framed}
      contentClassName={
        paired
          ? ''
          : variant === 'editorial'
            ? (heightClassName ?? 'min-h-[180px] flex-1')
            : 'overflow-hidden'
      }
    >
      {!hasData ? (
        <div
          className={`flex items-center justify-center px-6 text-sm ${
            paired ? '' : 'h-full'
          } ${
            variant === 'editorial'
              ? 'border-y border-line text-muted'
              : 'text-muted'
          }`}
          style={
            paired
              ? {
                  height:
                    PAIRED_LEGEND_HEIGHT_PX +
                    PAIRED_PLOT_HEIGHT_PX +
                    PAIRED_XAXIS_HEIGHT_PX,
                }
              : undefined
          }
        >
          {emptyMessage}
        </div>
      ) : (
        <div className={`flex h-full flex-col ${variant === 'card' ? 'px-2 pb-4 pt-2' : ''}`}>
          {showLegend && (
            <div
              className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden border-b border-line"
              style={{ height: PAIRED_LEGEND_HEIGHT_PX }}
            >
              {competitors.map((competitor, index) => (
                <span
                  key={competitor.id}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] text-muted"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  {competitor.name}
                </span>
              ))}
            </div>
          )}
          <div
            className={paired ? 'shrink-0' : 'relative min-h-0 flex-1'}
            style={paired ? { height: PAIRED_PLOT_HEIGHT_PX + PAIRED_XAXIS_HEIGHT_PX } : undefined}
          >
            <div className={paired ? 'h-full' : 'absolute inset-0'}>
              <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={
                  paired
                    ? { top: 0, right: 4, left: -12, bottom: 0 }
                    : variant === 'editorial'
                      ? { top: 8, right: 4, left: -12, bottom: 0 }
                      : { top: 8, right: 12, left: 0, bottom: 0 }
                }
              >
                <CartesianGrid
                  strokeDasharray={variant === 'card' ? '3 3' : undefined}
                  vertical={false}
                  stroke={CHART_GRID}
                  syncWithTicks
                />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: variant === 'editorial' ? CHART_GRID : CHART_AXIS }}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: variant === 'editorial' ? CHART_AXIS : undefined }}
                  interval="preserveStartEnd"
                  height={paired ? PAIRED_XAXIS_HEIGHT_PX : undefined}
                  tickMargin={paired ? 4 : undefined}
                />
                <YAxis
                  domain={[0, yMax]}
                  ticks={paired ? yTicks : showLegend ? yTicks.slice(0, -1) : yTicks}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: variant === 'editorial' ? CHART_AXIS : undefined }}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const date = payload[0]?.payload?.date
                    return (
                      <div className="min-w-48 border border-line bg-surface px-3 py-2.5 text-xs ">
                        <p className="mb-2 font-semibold text-ink">{date}</p>
                        <div className="space-y-1.5">
                          {payload.map((entry) => {
                            const name = String(entry.name ?? entry.dataKey ?? '')
                            const competitor = competitors.find((item) => item.name === name)
                            return (
                              <div key={name} className="flex items-center gap-2">
                                {competitor && (
                                  <BrandLogo
                                    id={competitor.id}
                                    name={competitor.name}
                                    logo={competitor.logo}
                                    domain={competitor.domain}
                                    site={competitor.site}
                                    size="sm"
                                  />
                                )}
                                <span className="min-w-0 flex-1 truncate text-muted">{name}</span>
                                <span className="font-medium" style={{ color: entry.color }}>
                                  {Math.round(Number(entry.value ?? 0))}{' '}
                                  {valueLabel ?? (variant === 'editorial' ? '% visibility' : 'mentions')}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }}
                />
                {variant === 'card' && (
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    iconSize={7}
                    formatter={(value) => (
                      <span className="text-xs text-muted">{value}</span>
                    )}
                  />
                )}
                {competitors.map((competitor, index) => {
                  const color = CHART_COLORS[index % CHART_COLORS.length]
                  const faded =
                    hoveredCompetitor && hoveredCompetitor !== competitor.name ? 0.24 : 1
                  return (
                    <Line
                      key={competitor.id}
                      type="monotone"
                      dataKey={competitor.name}
                      stroke={color}
                      strokeWidth={hoveredCompetitor === competitor.name ? 3 : 2}
                      strokeOpacity={faded}
                      dot={false}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  )
                })}
              </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
