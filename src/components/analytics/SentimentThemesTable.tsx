import { useEffect, useState } from 'react'
import { listSentimentThemeAnswers } from '../../api/airops'
import type { SentimentThemeAnswer } from '../../api/types'
import type { AnalyticsFilterParams } from '../../lib/analytics'
import { analyticsDateParams } from '../../lib/analytics'
import type { SentimentFilter, SentimentThemeRow } from '../../lib/sentiment'
import {
  SENTIMENT_FILTER_LABELS,
  sentimentBand,
  sentimentBandColor,
} from '../../lib/sentiment'
import { formatNumber, formatPercent, providerLabel } from '../../lib/format'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { LoadingSpinner } from '../LoadingSpinner'

interface SentimentThemesTableProps {
  themes: SentimentThemeRow[]
  filter: SentimentFilter
  onFilterChange: (filter: SentimentFilter) => void
  filterParams: AnalyticsFilterParams
  loading: boolean
  error?: string | null
  onRetry?: () => void
  hasData: boolean
}

function ScoreBadge({ score }: { score: number | null }) {
  const band = sentimentBand(score)
  const color = sentimentBandColor(band)
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {formatPercent(score)}
    </span>
  )
}

function ThemeAnswers({
  themeId,
  filterParams,
}: {
  themeId: number
  filterParams: AnalyticsFilterParams
}) {
  const [answers, setAnswers] = useState<SentimentThemeAnswer[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const startDate = filterParams.start_date
  const endDate = filterParams.end_date
  const providersKey = (filterParams.providers ?? []).join(',')
  const countriesKey = (filterParams.countries ?? []).join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const dates = analyticsDateParams(filterParams)
    listSentimentThemeAnswers({
      sentiment_theme_id: themeId,
      start_date: dates.start_date,
      end_date: dates.end_date,
      providers: filterParams.providers,
      countries: filterParams.countries,
      per_page: 20,
    })
      .then((res) => {
        if (cancelled) return
        setAnswers(res.answers ?? [])
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId, startDate, endDate, providersKey, countriesKey])

  if (loading) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-3">
          <LoadingSpinner />
        </td>
      </tr>
    )
  }
  if (error) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-3 text-xs text-red-600">
          {error}
        </td>
      </tr>
    )
  }
  if (!answers?.length) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-3 text-xs text-slate-400">
          No answers found for this theme.
        </td>
      </tr>
    )
  }

  return (
    <>
      {answers.map((a) => (
        <tr key={a.answer_id} className="bg-slate-50/60">
          <td colSpan={4} className="border-t border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">{providerLabel(a.provider)}</span>
              <span>·</span>
              <span>{a.date}</span>
              <span>·</span>
              <span
                className={
                  a.sentiment === 'positive'
                    ? 'text-brand-600'
                    : a.sentiment === 'negative'
                      ? 'text-red-600'
                      : 'text-slate-500'
                }
              >
                {a.sentiment}
              </span>
            </div>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-700">
              {a.answer_text}
            </p>
          </td>
        </tr>
      ))}
    </>
  )
}

export function SentimentThemesTable({
  themes,
  filter,
  onFilterChange,
  filterParams,
  loading,
  error,
  onRetry,
  hasData,
}: SentimentThemesTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Themes</h2>
          <p className="text-xs text-slate-400">Top sentiment drivers, based on themes in answers.</p>
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
        <LoadingSpinner />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !hasData || themes.length === 0 ? (
        <EmptyState
          title="No themes found"
          message="Sentiment themes will appear here once data is available."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3 font-medium">Theme</th>
                <th className="pb-2 pr-3 font-medium">Sentiment Score</th>
                <th className="pb-2 pr-3 font-medium">Volume</th>
                <th className="pb-2 font-medium">Occurrences</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => {
                const open = expandedId === theme.id
                return (
                  <FragmentRow key={theme.id}>
                    <tr className="border-b border-slate-50 hover:bg-slate-50/80">
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : theme.id)}
                          className="flex items-center gap-2 text-left font-medium text-slate-800"
                        >
                          <svg
                            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                          </svg>
                          {theme.name}
                        </button>
                      </td>
                      <td className="py-3 pr-3">
                        <ScoreBadge score={theme.sentiment_score} />
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{formatPercent(theme.volume)}</td>
                      <td className="py-3 text-slate-600">{formatNumber(theme.answer_count)}</td>
                    </tr>
                    {open && theme.id > 0 && (
                      <ThemeAnswers themeId={theme.id} filterParams={filterParams} />
                    )}
                  </FragmentRow>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Tiny wrapper so theme row + expanded answers share one React key. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
