import { useState } from 'react'
import type { ResponseRow } from '../../api/types'
import { useGeoMeta } from '../../context/GeoMetaContext'
import { formatNumber } from '../../lib/format'
import { EmptyState } from '../EmptyState'
import { ProviderIcon } from '../ProviderIcon'
import { TablePagination, type TablePaginationProps } from '../TablePagination'
import { ResponseDrawer } from './ResponseDrawer'
import {
  citationCount,
  responseBrands,
  responseDateLabel,
  responsePreviewText,
  responseSentiment,
} from './responseHelpers'

interface ResponsesTableProps {
  rows: ResponseRow[]
  total?: number
  emptyMessage?: string
  variant?: 'default' | 'editorial'
  loading?: boolean
  pagination?: TablePaginationProps
}

function SentimentBadge({
  score,
  editorial = false,
}: {
  score: number | null
  editorial?: boolean
}) {
  if (score == null) return <span className="text-muted-dark">—</span>
  if (editorial) {
    return (
      <span className="text-[13px] tabular-nums text-muted">
        {formatNumber(score, 0)}
      </span>
    )
  }
  const tone = score >= 70 ? 'text-accent' : score >= 40 ? 'text-muted' : 'text-error'
  return (
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center text-[12px] font-medium tabular-nums ${tone}`}>
      {formatNumber(score, 0)}
    </span>
  )
}

function BrandAvatar({
  name,
  logo,
  fallback,
}: {
  name?: string | null
  logo?: string | null
  fallback?: string
}) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name ?? 'Brand'}
        className="h-6 w-6 rounded-full border border-line bg-surface object-contain p-0.5"
      />
    )
  }
  const initial = (name ?? fallback ?? '?').slice(0, 1).toUpperCase()
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-paper-soft text-[10px] font-bold text-muted">
      {initial}
    </span>
  )
}

export function ResponsesTable({
  rows,
  total,
  emptyMessage,
  variant = 'default',
  loading = false,
  pagination,
}: ResponsesTableProps) {
  const { meta } = useGeoMeta()
  const [selectedRow, setSelectedRow] = useState<(ResponseRow & { raw?: unknown }) | null>(null)
  const editorial = variant === 'editorial'
  const accountLogo = meta?.account?.logo ?? null
  const accountTitle = meta?.account?.title ?? null
  const competitorLogos = new Map(
    (meta?.competitors ?? []).map((c) => [c.name.toLowerCase(), c.logo]),
  )

  if (rows.length === 0) {
    if (editorial) {
      return (
        <section aria-labelledby="recent-responses-heading">
          <h2
            id="recent-responses-heading"
            className="mb-4 text-[17px] font-semibold text-ink"
          >
            Recent Responses
          </h2>
          <div className="border-y border-line py-10 text-center">
            <p className="text-sm font-medium text-muted">No responses</p>
            <p className="mt-1 text-xs text-muted">
              {emptyMessage ?? 'No mention responses match the filters.'}
            </p>
          </div>
        </section>
      )
    }
    return (
      <EmptyState title="No responses" message={emptyMessage ?? 'No mention responses match the filters.'} />
    )
  }

  const headers = editorial
    ? ['Response', 'Model', 'Rank', 'Citations', 'Sentiment']
    : ['Response', 'Model', 'Rank', 'Brands', 'Citations', 'Sentiment', 'Date']

  return (
    <>
      <section aria-labelledby={editorial ? 'recent-responses-heading' : undefined}>
        {editorial && (
          <h2
            id="recent-responses-heading"
            className="mb-4 text-[17px] font-semibold text-ink"
          >
            Recent Responses
          </h2>
        )}
        <div
          className={`table-bleed${loading ? ' opacity-70' : ''}`}
        >
        <div className="table-bleed__scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {headers.map((header) => (
                  <th
                    key={header}
                    className={`whitespace-nowrap text-[12px] font-medium text-muted ${
                      editorial ? 'px-3 py-3' : 'px-4 py-3'
                    } ${header === 'Response' ? 'min-w-0 text-left' : ''} ${
                      editorial && (header === 'Rank' || header === 'Citations')
                        ? 'hidden md:table-cell'
                        : ''
                    } ${
                      header === 'Rank' || header === 'Citations' || header === 'Sentiment'
                        ? editorial
                          ? 'text-right'
                          : 'text-center'
                        : header === 'Response'
                          ? ''
                          : 'text-left'
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const extended = row as ResponseRow & { raw?: unknown }
                const preview = responsePreviewText(extended)
                const brands = responseBrands(extended)
                const citations = citationCount(row)
                const sentiment = responseSentiment(extended)
                const provider = row.provider || row.model || '—'

                return (
                  <tr
                    key={row.id}
                    className={
                      editorial
                        ? 'cursor-pointer border-b border-line transition-colors hover:bg-paper-soft/70'
                        : 'cursor-pointer border-b border-line transition hover:bg-paper-soft'
                    }
                    onClick={() => setSelectedRow(extended)}
                  >
                    <td className={`min-w-0 max-w-xl ${editorial ? 'py-3.5 pr-3' : 'px-4 py-3'}`}>
                      {preview ? (
                        <p
                          className={`line-clamp-2 leading-relaxed ${
                            editorial ? 'text-[13px] text-ink' : 'text-sm text-accent'
                          }`}
                          title={preview}
                        >
                          {preview.length > 160 ? `${preview.slice(0, 159)}…` : preview}
                        </p>
                      ) : (
                        <span className={editorial ? 'text-[13px] text-muted' : 'text-sm text-muted-dark'}>
                          Click to view response
                        </span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap ${editorial ? 'px-3 py-3.5' : 'px-4 py-3'}`}>
                      {editorial ? (
                        <span className="[&_span]:text-[13px] [&_span]:text-muted">
                          <ProviderIcon provider={provider} size="sm" showLabel />
                        </span>
                      ) : (
                        <ProviderIcon provider={provider} showLabel />
                      )}
                    </td>
                    <td
                      className={`tabular-nums ${
                        editorial
                          ? 'hidden px-3 py-3.5 text-right text-[13px] text-muted md:table-cell'
                          : 'px-4 py-3 text-center text-sm font-medium text-ink'
                      }`}
                    >
                      {row.myRank != null ? formatNumber(row.myRank, 0) : '—'}
                    </td>
                    {!editorial && <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {accountLogo && (
                          <BrandAvatar name={accountTitle} logo={accountLogo} fallback="Me" />
                        )}
                        {brands.slice(0, 3).map((brand, i) => {
                          const logo =
                            brand.logo ??
                            (brand.name ? competitorLogos.get(brand.name.toLowerCase()) ?? null : null)
                          return (
                            <BrandAvatar
                              key={`${brand.name ?? brand.domain ?? i}`}
                              name={brand.name}
                              logo={logo}
                            />
                          )
                        })}
                        {brands.length === 0 && !accountLogo && (
                          <span className="text-muted-dark">—</span>
                        )}
                      </div>
                    </td>}
                    <td className={editorial ? 'hidden px-3 py-3.5 text-right md:table-cell' : 'px-4 py-3 text-center'}>
                      <span
                        className={`inline-flex items-center justify-center gap-1 ${
                          editorial ? 'text-[13px] text-muted' : 'text-sm text-muted'
                        }`}
                      >
                        {!editorial && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                          />
                        </svg>}
                        {citations > 0 ? citations : '—'}
                      </span>
                    </td>
                    <td className={editorial ? 'py-3.5 pl-3 text-right' : 'px-4 py-3 text-center'}>
                      <SentimentBadge score={sentiment} editorial={editorial} />
                    </td>
                    {!editorial && <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                      {responseDateLabel(row)}
                    </td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <TablePagination {...pagination} />
        ) : total != null ? (
          <div className={editorial ? 'pt-3' : 'border-t border-line px-4 py-2.5'}>
            <span className={editorial ? 'text-xs text-muted' : 'text-xs text-muted-dark'}>
              {rows.length.toLocaleString()}
              {total > rows.length ? ` of ${total.toLocaleString()}` : ''} responses
            </span>
          </div>
        ) : null}
      </div>
      </section>

      {selectedRow && (
        <ResponseDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </>
  )
}
