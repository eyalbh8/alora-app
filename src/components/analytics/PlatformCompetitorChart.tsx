import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyticsRow, BrandKitCompetitor } from '../../api/types'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'
import { formatPercent, providerLabel } from '../../lib/format'

interface PlatformCompetitorChartProps {
  title: string
  subtitle: string
  /** Rows with dimensions provider + competitor. */
  competitorRows: AnalyticsRow[]
  /** Rows with dimension provider only (own brand). */
  ownRows: AnalyticsRow[]
  brandName: string
  competitors: BrandKitCompetitor[]
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

const COLORS = ['#10b981', '#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6']

export function PlatformCompetitorChart({
  title,
  subtitle,
  competitorRows,
  ownRows,
  brandName,
  competitors,
  loading,
  error,
  onRetry,
  hasData,
}: PlatformCompetitorChartProps) {
  const nameById = new Map(competitors.map((c) => [String(c.id), c.name]))
  const seriesKeys = new Set<string>([brandName])
  competitorRows.forEach((r) => {
    seriesKeys.add(nameById.get(String(r.competitor)) ?? String(r.competitor ?? 'Unknown'))
  })
  const keys = [...seriesKeys]

  const providers = [
    ...new Set([
      ...ownRows.map((r) => String(r.provider ?? '')),
      ...competitorRows.map((r) => String(r.provider ?? '')),
    ]),
  ].filter(Boolean)

  const data = providers.map((provider) => {
    const point: Record<string, string | number | null> = {
      label: providerLabel(provider),
    }
    const own = ownRows.find((r) => String(r.provider) === provider)
    point[brandName] = own?.mention_rate ?? null
    for (const c of competitors) {
      const row = competitorRows.find(
        (r) => String(r.provider) === provider && String(r.competitor) === String(c.id),
      )
      point[c.name] = row?.mention_rate ?? null
    }
    return point
  })

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
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip formatter={(value) => [formatPercent(Number(value)), '']} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {keys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[i % COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
