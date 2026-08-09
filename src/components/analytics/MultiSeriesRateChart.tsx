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
import type { SeriesMeta } from '../../lib/analytics'
import type { MultiSeriesChartPoint } from '../../lib/analytics'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'
import { formatPercent } from '../../lib/format'

const SERIES_COLORS = ['#10b981', '#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

interface MultiSeriesRateChartProps {
  title: string
  subtitle: string
  points: MultiSeriesChartPoint[]
  series: SeriesMeta[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

export function MultiSeriesRateChart({
  title,
  subtitle,
  points,
  series,
  loading,
  error,
  onRetry,
  hasData,
}: MultiSeriesRateChartProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData || series.length === 0 || points.length === 0 ? (
        <EmptyState title="No data available" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(value, name) => [
                formatPercent(typeof value === 'number' ? value : Number(value)),
                String(name),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => {
                const meta = series.find((s) => s.key === value)
                return meta?.label ?? value
              }}
            />
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2.5, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
