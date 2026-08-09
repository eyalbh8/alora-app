import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyticsMetric, AnalyticsRow } from '../../api/types'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'
import { shortDateLabel } from '../../lib/dates'
import { formatMetricValue, isPercentMetric, metricLabel } from '../../lib/format'

interface MetricOverTimeChartProps {
  title: string
  subtitle: string
  metric: AnalyticsMetric
  brandName?: string
  rows: AnalyticsRow[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

export function MetricOverTimeChart({
  title,
  subtitle,
  metric,
  brandName = 'Brand',
  rows,
  loading,
  error,
  onRetry,
  hasData,
}: MetricOverTimeChartProps) {
  const data = [...rows]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((row) => ({
      dateLabel: row.date ? shortDateLabel(row.date) : '',
      value: (row[metric] as number | null | undefined) ?? null,
    }))

  const percent = isPercentMetric(metric)

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
      ) : !hasData ? (
        <EmptyState title="No data available" />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (percent ? `${v}%` : String(v))}
              domain={percent ? [0, 'auto'] : ['auto', 'auto']}
            />
            <Tooltip
              formatter={(value) => [
                formatMetricValue(metric, Number(value)),
                brandName || metricLabel(metric),
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={brandName}
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3, fill: '#10b981' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
