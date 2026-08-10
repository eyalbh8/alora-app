import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { formatNumber } from '../../lib/format'
import { SENTIMENT_CHART_HEIGHT, SENTIMENT_GREEN, SENTIMENT_GREEN_LIGHT } from './constants'

interface CurrentSentimentScoreProps {
  score: number | null
}

export function CurrentSentimentScore({ score }: CurrentSentimentScoreProps) {
  const value = score != null && !Number.isNaN(score) ? Math.min(100, Math.max(0, Math.round(score))) : null
  const slices =
    value != null
      ? [
          { name: 'score', value },
          { name: 'remainder', value: 100 - value },
        ]
      : [{ name: 'empty', value: 100 }]

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
      style={{ height: SENTIMENT_CHART_HEIGHT, minHeight: SENTIMENT_CHART_HEIGHT }}
    >
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-medium text-[#101414]">Current Sentiment Score</h2>
      </div>

      <div className="relative min-h-0 flex-1 px-4 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="78%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {value != null ? (
                <>
                  <Cell fill={SENTIMENT_GREEN} />
                  <Cell fill={SENTIMENT_GREEN_LIGHT} />
                </>
              ) : (
                <Cell fill="#e2e8f0" />
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {value != null ? (
            <p className="text-3xl font-semibold tracking-tight">
              <span className="text-emerald-500">{formatNumber(value, 0)}</span>
              <span className="text-slate-400"> / 100</span>
            </p>
          ) : (
            <span className="text-2xl font-semibold text-slate-400">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
