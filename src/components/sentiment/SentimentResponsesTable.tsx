import { useState } from 'react'
import type { ResponseRow } from '../../api/types'
import { formatNumber, providerLabel } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'
import { TablePagination, type TablePaginationProps } from '../TablePagination'
import { ResponseDrawer } from '../mentions/ResponseDrawer'
import { responsePreviewText, responseSentiment } from '../mentions/responseHelpers'

interface SentimentResponsesTableProps {
  rows: ResponseRow[]
  total?: number
  emptyMessage?: string
  loading?: boolean
  pagination?: TablePaginationProps
}

export function SentimentResponsesTable({
  rows,
  total,
  emptyMessage,
  loading = false,
  pagination,
}: SentimentResponsesTableProps) {
  const [selectedRow, setSelectedRow] = useState<(ResponseRow & { raw?: unknown }) | null>(null)

  return (
    <>
      <section aria-labelledby="recent-responses-title">
        <h2 id="recent-responses-title" className="mb-4 text-[19px] font-semibold text-[#101414]">
          Recent Responses
        </h2>

        {rows.length === 0 ? (
          <div className="border-y border-[#eae6de] py-12 text-center">
            <p className="text-sm font-medium text-[#3a352e]">No responses</p>
            <p className="mt-1 text-sm text-[#9a938a]">
              {emptyMessage ?? 'No sentiment responses match the filters.'}
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto${loading ? ' opacity-70' : ''}`}>
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[#101414]">
                  <th className="min-w-0 pb-2.5 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a938a]">
                    Response
                  </th>
                  <th className="hidden min-w-0 px-3 pb-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a938a] sm:table-cell">
                    Model
                  </th>
                  <th className="pb-2.5 pl-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a938a]">
                    Sentiment
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const extended = row as ResponseRow & { raw?: unknown }
                  const preview = responsePreviewText(extended)
                  const sentiment = responseSentiment(extended)
                  const provider = row.provider || row.model || '—'

                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      className="cursor-pointer border-b border-[#eae6de] transition-colors hover:bg-white/70 focus:bg-white/70 focus:outline-none"
                      onClick={() => setSelectedRow(extended)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedRow(extended)
                        }
                      }}
                      aria-label={`Open response from ${provider}`}
                    >
                      <td className="min-w-0 py-4 pr-3 text-[13px] leading-relaxed text-[#3a352e]">
                        {preview ? (
                          <p className="line-clamp-2" title={preview}>
                            {preview.length > 180 ? `${preview.slice(0, 179)}…` : preview}
                          </p>
                        ) : (
                          <span className="text-[#9a938a]">Click to view response</span>
                        )}
                        <p className="mt-1.5 text-[10px] text-[#8b857c] sm:hidden">
                          {providerLabel(provider)}
                        </p>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-4 text-[13px] text-[#5c554c] sm:table-cell">
                        <ProviderIcon provider={provider} showLabel />
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 text-right text-[13px] font-medium text-[#5c554c]">
                        {sentiment != null ? formatNumber(sentiment, 0) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination ? (
          <TablePagination {...pagination} />
        ) : rows.length > 0 && total != null ? (
          <p className="mt-2.5 text-xs text-[#9a938a]">
            {rows.length.toLocaleString()}
            {total > rows.length ? ` of ${total.toLocaleString()}` : ''} responses
          </p>
        ) : null}
      </section>

      {selectedRow && (
        <ResponseDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </>
  )
}
