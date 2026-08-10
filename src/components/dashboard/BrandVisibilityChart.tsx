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
import { DashboardCard } from './DashboardCard'
import { CHART_COLORS } from './constants'

interface BrandVisibilityChartProps {
  competitors: CompetitorPerformance[]
  range: DateRange
  subtitle?: string
}

export function BrandVisibilityChart({
  competitors,
  range,
  subtitle = 'Mentions trend for top brands',
}: BrandVisibilityChartProps) {
  const { hoveredCompetitor } = useCompetitorHover()
  const days = daysInRange(range)

  const referencePoints =
    competitors.find((c) => (c.historicalData?.length ?? 0) > 0)?.historicalData ?? []

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
  const yMax = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 100

  const hasData = chartData.length > 0 && competitors.length > 0

  return (
    <DashboardCard title="Brand Visibility Over Time" subtitle={subtitle}>
      {!hasData ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
          No visibility trend data for the selected period.
        </div>
      ) : (
        <div className="flex h-full flex-col px-2 pb-4 pt-2">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis domain={[0, yMax]} tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  formatter={(value) => [`${Math.round(Number(value ?? 0))} mentions`, '']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs text-slate-600">{value}</span>
                  )}
                />
                {competitors.map((competitor, index) => {
                  const color = CHART_COLORS[index % CHART_COLORS.length]
                  const faded =
                    hoveredCompetitor && hoveredCompetitor !== competitor.name ? 0.35 : 1
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
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
