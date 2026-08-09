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
import type { AnalyticsRow } from '../../api/types'
import type { MultiSeriesChartPoint, SeriesMeta } from '../../lib/analytics'
import type { SentimentSeriesMode } from '../../lib/sentiment'
import { SERIES_MODE_LABELS } from '../../lib/sentiment'
import { shortDateLabel } from '../../lib/dates'
import { formatPercent } from '../../lib/format'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'

const SERIES_COLORS = ['#2fc9bc', '#0e3b3a', '#148f85', '#7fd4cc', '#ca8a04', '#0ea5e9', '#64748b']
const SERIES_MODES: SentimentSeriesMode[] = ['overall', 'provider', 'topic', 'theme']

interface SentimentOverTimeChartProps {
  mode: SentimentSeriesMode
  onModeChange: (mode: SentimentSeriesMode) => void
  brandName?: string
  overallRows: AnalyticsRow[]
  overallLoading: boolean
  overallError?: string | null
  overallOnRetry?: () => void
  overallHasData: boolean
  seriesPoints: MultiSeriesChartPoint[]
  seriesMeta: SeriesMeta[]
  seriesLoading: boolean
  seriesError?: string | null
  seriesOnRetry?: () => void
  seriesHasData: boolean
}

export function SentimentOverTimeChart({
  mode,
  onModeChange,
  brandName = 'Brand',
  overallRows,
  overallLoading,
  overallError,
  overallOnRetry,
  overallHasData,
  seriesPoints,
  seriesMeta,
  seriesLoading,
  seriesError,
  seriesOnRetry,
  seriesHasData,
}: SentimentOverTimeChartProps) {
  const loading = mode === 'overall' ? overallLoading : seriesLoading
  const error = mode === 'overall' ? overallError : seriesError
  const onRetry = mode === 'overall' ? overallOnRetry : seriesOnRetry

  const overallData = [...overallRows]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((row) => ({
      dateLabel: row.date ? shortDateLabel(row.date) : '',
      value: row.sentiment_score ?? null,
    }))

  const showOverall = mode === 'overall'
  const hasChartData = showOverall
    ? overallHasData
    : seriesHasData && seriesMeta.length > 0 && seriesPoints.length > 0

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sentiment Score Over Time</h2>
          <p className="text-xs text-slate-400">
            Your aggregate sentiment score across all captured brand mentions. Higher scores mean
            more positive sentiment.
          </p>
        </div>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as SentimentSeriesMode)}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm"
        >
          {SERIES_MODES.map((m) => (
            <option key={m} value={m}>
              {SERIES_MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasChartData ? (
        <EmptyState title="No data available" />
      ) : showOverall ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={overallData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
              formatter={(value) => [
                formatPercent(typeof value === 'number' ? value : Number(value)),
                brandName,
              ]}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={brandName}
              stroke="#2fc9bc"
              strokeWidth={2}
              dot={{ r: 3, fill: '#2fc9bc' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={seriesPoints} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesMeta.map((s, i) => (
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
