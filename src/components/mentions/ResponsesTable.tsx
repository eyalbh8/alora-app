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
  if (score == null) return <span className="text-slate-400">—</span>
  if (editorial) {
    return (
      <span className="text-[13px] tabular-nums text-[#5c554c]">
        {formatNumber(score, 0)}
      </span>
    )
  }
  const tone =
    score >= 70 ? 'bg-emerald-500 text-white' : score >= 40 ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white'
  return (
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
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
        className="h-6 w-6 rounded-full border border-slate-200 bg-white object-contain p-0.5"
      />
    )
  }
  const initial = (name ?? fallback ?? '?').slice(0, 1).toUpperCase()
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600">
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
            className="mb-4 text-[19px] font-semibold text-[#101414]"
          >
            Recent Responses
          </h2>
          <div className="border-y border-[#eae6de] py-10 text-center">
            <p className="text-sm font-medium text-[#5c554c]">No responses</p>
            <p className="mt-1 text-xs text-[#9a938a]">
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
            className="mb-4 text-[19px] font-semibold text-[#101414]"
          >
            Recent Responses
          </h2>
        )}
        <div
          className={`${
            editorial
              ? 'overflow-hidden'
              : 'overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm'
          }${loading ? ' opacity-70' : ''}`}
        >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={
                  editorial
                    ? 'border-b-2 border-[#101414]'
                    : 'border-b border-slate-100 bg-slate-50/60'
                }
              >
                {headers.map((header) => (
                  <th
                    key={header}
                    className={`whitespace-nowrap font-semibold uppercase ${
                      editorial
                        ? 'px-3 pb-2.5 text-[10px] tracking-[0.08em] text-[#9a938a]'
                        : 'px-4 py-3 text-xs tracking-wide text-slate-500'
                    } ${header === 'Response' ? 'min-w-0 pl-0 text-left' : ''} ${
                      editorial && header === 'Sentiment' ? 'pr-0' : ''
                    } ${
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
                        ? 'cursor-pointer border-b border-[#eae6de] transition-colors hover:bg-[#f5f2ed]/70'
                        : 'cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/50'
                    }
                    onClick={() => setSelectedRow(extended)}
                  >
                    <td className={`min-w-0 max-w-xl ${editorial ? 'py-3.5 pr-3' : 'px-4 py-3'}`}>
                      {preview ? (
                        <p
                          className={`line-clamp-2 leading-relaxed ${
                            editorial ? 'text-[13px] text-[#3a352e]' : 'text-sm text-brand-700'
                          }`}
                          title={preview}
                        >
                          {preview.length > 160 ? `${preview.slice(0, 159)}…` : preview}
                        </p>
                      ) : (
                        <span className={editorial ? 'text-[13px] text-[#9a938a]' : 'text-sm text-slate-400'}>
                          Click to view response
                        </span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap ${editorial ? 'px-3 py-3.5' : 'px-4 py-3'}`}>
                      {editorial ? (
                        <span className="[&_span]:text-[13px] [&_span]:text-[#5c554c]">
                          <ProviderIcon provider={provider} size="sm" showLabel />
                        </span>
                      ) : (
                        <ProviderIcon provider={provider} showLabel />
                      )}
                    </td>
                    <td
                      className={`tabular-nums ${
                        editorial
                          ? 'hidden px-3 py-3.5 text-right text-[13px] text-[#5c554c] md:table-cell'
                          : 'px-4 py-3 text-center text-sm font-medium text-[#101414]'
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
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>}
                    <td className={editorial ? 'hidden px-3 py-3.5 text-right md:table-cell' : 'px-4 py-3 text-center'}>
                      <span
                        className={`inline-flex items-center justify-center gap-1 ${
                          editorial ? 'text-[13px] text-[#5c554c]' : 'text-sm text-slate-600'
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
                    {!editorial && <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
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
          <div className={editorial ? 'pt-3' : 'border-t border-slate-100 px-4 py-2.5'}>
            <span className={editorial ? 'text-xs text-[#9a938a]' : 'text-xs text-slate-400'}>
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
