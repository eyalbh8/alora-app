import type { CitationLink, CompetitorPerformance } from '../../api/types'
import { formatNumber, formatScore } from '../../lib/format'
import { DeltaBadge } from '../dashboard/DeltaBadge'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { BrandLogo } from './BrandLogo'

const SENTIMENT_THRESHOLDS = {
  VERY_POSITIVE: 70,
  POSITIVE: 30,
  NEUTRAL: 30,
  NEGATIVE: -70,
} as const

function sentimentStyle(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) {
    return { bg: 'bg-white', text: 'text-slate-600' }
  }
  if (score >= SENTIMENT_THRESHOLDS.VERY_POSITIVE) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-900' }
  }
  if (score >= SENTIMENT_THRESHOLDS.POSITIVE) {
    return { bg: 'bg-lime-50', text: 'text-lime-900' }
  }
  if (score >= -SENTIMENT_THRESHOLDS.NEUTRAL && score <= SENTIMENT_THRESHOLDS.NEUTRAL) {
    return { bg: 'bg-slate-100', text: 'text-slate-700' }
  }
  if (score >= SENTIMENT_THRESHOLDS.NEGATIVE) {
    return { bg: 'bg-red-50', text: 'text-red-800' }
  }
  return { bg: 'bg-red-50', text: 'text-red-900' }
}

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function BrandCell({ row }: { row: CompetitorPerformance }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandLogo
        id={row.id}
        name={row.name}
        logo={row.logo}
        domain={row.domain}
        site={row.site}
        size="md"
      />
      <span className="font-medium text-slate-800">{row.name}</span>
    </div>
  )
}

function TopicTags({ topics }: { topics?: string[] }) {
  if (!topics?.length) return <span className="text-slate-400">—</span>

  const visible = topics.slice(0, 2)
  const remaining = topics.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((topic) => (
        <span
          key={topic}
          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700"
        >
          {topic}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-xs text-slate-500">+{remaining} more</span>
      )}
    </div>
  )
}

function CitationsCell({
  count,
  links,
}: {
  count: number
  links: CitationLink[]
}) {
  if (count <= 0 && links.length === 0) {
    return <span className="text-slate-400">—</span>
  }

  const domains = [
    ...new Set(
      links.map((l) => domainFromUrl(l.url)).filter((d): d is string => Boolean(d)),
    ),
  ].slice(0, 3)

  const total = count || links.length

  return (
    <div className="flex items-center justify-center gap-1.5">
      {domains.length > 0 && (
        <div className="flex -space-x-1.5">
          {domains.map((domain) => (
            <img
              key={domain}
              src={faviconUrl(domain)}
              alt=""
              className="h-5 w-5 rounded-full border border-white bg-white object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ))}
        </div>
      )}
      {total > 0 && (
        <span className="text-xs font-medium text-slate-600">+{formatNumber(total, 0)}</span>
      )}
    </div>
  )
}

interface CompetitorsListTableProps {
  rows: CompetitorPerformance[]
  citations: Record<string, CitationLink[]>
  citationCounts: Record<string, number>
}

export function CompetitorsListTable({
  rows,
  citations,
  citationCounts,
}: CompetitorsListTableProps) {
  const { hoveredCompetitor, setHoveredCompetitor } = useCompetitorHover()

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-12 text-center shadow-sm">
        <p className="text-base font-semibold text-slate-800">No competitors</p>
        <p className="mt-1 text-sm text-slate-500">No ranking rows match the current filters.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-medium text-[#101414]">Competitors List</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-4 py-3 text-left font-medium">#</th>
              <th className="px-4 py-3 text-left font-medium">Brand</th>
              <th className="px-4 py-3 text-left font-medium">Shared Topics</th>
              <th className="px-4 py-3 text-center font-medium">Citations</th>
              <th className="px-4 py-3 text-center font-medium">Rank</th>
              <th className="px-4 py-3 text-center font-medium">Mentions</th>
              <th className="px-4 py-3 text-center font-medium">Sentiment</th>
              <th className="w-12 px-4 py-3 text-center font-medium" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sentiment = sentimentStyle(row.sentimentScore)
              const hovered = hoveredCompetitor === row.name
              const rowCitations = citations[row.id] ?? []
              const citationCount = citationCounts[row.id] ?? rowCitations.length

              return (
                <tr
                  key={row.id}
                  className={`border-b border-slate-50 transition-colors last:border-0 ${
                    hovered ? 'bg-slate-50' : ''
                  }`}
                  onMouseEnter={() => setHoveredCompetitor(row.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                >
                  <td className="px-4 py-3.5 text-slate-600">{row.position ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <BrandCell row={row} />
                  </td>
                  <td className="max-w-xs px-4 py-3.5">
                    <TopicTags topics={row.topics} />
                  </td>
                  <td className="px-4 py-3.5">
                    <CitationsCell count={citationCount} links={rowCitations} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.avgRankDelta != null && (
                        <DeltaBadge value={row.avgRankDelta} mode="absolute" invert />
                      )}
                      <span className="font-medium text-slate-800">{formatScore(row.avgRank)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.occurrencesDelta != null && (
                        <DeltaBadge value={row.occurrencesDelta} mode="percent" />
                      )}
                      <span className="font-medium text-slate-800">
                        {formatNumber(row.occurrences, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      {row.sentimentScoreDelta != null && (
                        <span
                          className={`text-xs font-medium ${
                            (row.sentimentScoreDelta ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {(row.sentimentScoreDelta ?? 0) >= 0 ? '↑' : '↓'}{' '}
                          {Math.round(Math.abs(row.sentimentScoreDelta ?? 0))}
                        </span>
                      )}
                      <span
                        className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${sentiment.bg} ${sentiment.text}`}
                      >
                        {row.sentimentScore != null ? row.sentimentScore : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      disabled
                      title="Remove competitor (coming soon)"
                      className="rounded p-1 text-slate-300"
                      aria-label={`Remove ${row.name}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
