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
        <h2 id="recent-responses-title" className="mb-4 text-[17px] font-semibold text-ink">
          Recent Responses
        </h2>

        {rows.length === 0 ? (
          <div className="border-y border-line py-12 text-center">
            <p className="text-sm font-medium text-ink">No responses</p>
            <p className="mt-1 text-sm text-muted">
              {emptyMessage ?? 'No sentiment responses match the filters.'}
            </p>
          </div>
        ) : (
          <div className={`table-bleed${loading ? ' opacity-70' : ''}`}>
          <div className="table-bleed__scroll">
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-soft">
                  <th className="min-w-0 pb-2.5 pr-3 text-left text-[12px] font-medium text-muted">
                    Response
                  </th>
                  <th className="hidden min-w-0 px-3 pb-2.5 text-left text-[12px] font-medium text-muted sm:table-cell">
                    Model
                  </th>
                  <th className="pb-2.5 pl-3 text-right text-[12px] font-medium text-muted">
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
                      className="cursor-pointer border-b border-line transition-colors hover:bg-surface/70 focus:bg-surface/70 focus:outline-none"
                      onClick={() => setSelectedRow(extended)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedRow(extended)
                        }
                      }}
                      aria-label={`Open response from ${provider}`}
                    >
                      <td className="min-w-0 py-4 pr-3 text-[13px] leading-relaxed text-ink">
                        {preview ? (
                          <p className="line-clamp-2" title={preview}>
                            {preview.length > 180 ? `${preview.slice(0, 179)}…` : preview}
                          </p>
                        ) : (
                          <span className="text-muted">Click to view response</span>
                        )}
                        <p className="mt-1.5 text-[10px] text-muted-dark sm:hidden">
                          {providerLabel(provider)}
                        </p>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-4 text-[13px] text-muted sm:table-cell">
                        <ProviderIcon provider={provider} showLabel />
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 text-right text-[13px] font-medium text-muted">
                        {sentiment != null ? formatNumber(sentiment, 0) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <div className="px-4">
              <TablePagination {...pagination} />
            </div>
          ) : rows.length > 0 && total != null ? (
            <p className="px-4 py-2.5 text-xs text-muted">
              {rows.length.toLocaleString()}
              {total > rows.length ? ` of ${total.toLocaleString()}` : ''} responses
            </p>
          ) : null}
          </div>
        )}
      </section>

      {selectedRow && (
        <ResponseDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </>
  )
}
