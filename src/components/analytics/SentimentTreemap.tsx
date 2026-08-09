import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import type { SentimentFilter, SentimentThemeRow } from '../../lib/sentiment'
import { SENTIMENT_FILTER_LABELS, sentimentTreemapColor } from '../../lib/sentiment'
import { formatNumber, formatPercent } from '../../lib/format'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { ChartSkeleton } from '../LoadingSpinner'

interface SentimentTreemapProps {
  themes: SentimentThemeRow[]
  filter: SentimentFilter
  onFilterChange: (filter: SentimentFilter) => void
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

type TreemapNode = {
  name: string
  size: number
  score: number | null
  fill: string
}

function TreemapContent(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  fill?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', fill = '#e2e8f0' } = props
  if (width < 4 || height < 4) return null
  const showLabel = width > 56 && height > 28
  const maxChars = Math.max(4, Math.floor(width / 7))
  const label = name.length > maxChars ? `${name.slice(0, maxChars)}…` : name
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill, stroke: '#fff', strokeWidth: 2 }}
        rx={4}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 18}
          fill="#0f172a"
          fontSize={11}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {label}
        </text>
      )}
    </g>
  )
}

export function SentimentTreemap({
  themes,
  filter,
  onFilterChange,
  loading,
  error,
  onRetry,
  hasData,
}: SentimentTreemapProps) {
  const data: TreemapNode[] = themes.map((t) => ({
    name: t.name,
    size: Math.max(t.answer_count, 1),
    score: t.sentiment_score,
    fill: sentimentTreemapColor(t.sentiment_score),
  }))

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sentiment Chart</h2>
          <p className="text-xs text-slate-400">
            Each tile is a theme. Size shows how often it appears. Color shows net sentiment.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as SentimentFilter)}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm"
        >
          {(Object.keys(SENTIMENT_FILTER_LABELS) as SentimentFilter[]).map((key) => (
            <option key={key} value={key}>
              {SENTIMENT_FILTER_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData || data.length === 0 ? (
        <EmptyState title="No data available" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#fff"
            content={<TreemapContent />}
          >
            <Tooltip
              content={({ payload }) => {
                const item = payload?.[0]?.payload as TreemapNode | undefined
                if (!item) return null
                const score =
                  item.score === null || item.score === undefined
                    ? '—'
                    : formatPercent(item.score)
                return (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-slate-500">Score: {score}</p>
                    <p className="text-slate-500">Occurrences: {formatNumber(item.size)}</p>
                  </div>
                )
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  )
}
