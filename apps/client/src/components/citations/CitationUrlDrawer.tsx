import { useMemo, type ReactNode } from 'react'
import {
  getGeoCitationUrlDetail,
  type CitationUrl,
  type CitationUrlDetail,
} from '../../api/geo'
import { queryKeys } from '../../api/queryKeys'
import { useAnalyticsFilters } from '../../context/AnalyticsFiltersContext'
import { useAccountStore } from '../../store/useAccountStore'
import { useApi } from '../../hooks/useApi'
import { shortDateLabel } from '../../lib/dates'
import { formatNumber, providerLabel } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'
import { Pill } from '../Pill'
import { DeltaLabel } from '../prompts/DeltaLabel'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_AXIS, CHART_GRID } from '../dashboard/constants'

interface CitationUrlDrawerProps {
  row: CitationUrl
  onClose: () => void
}

function MetricChip({ label, value, extra }: { label: string; value: string; extra?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper-soft/80 px-3 py-2">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
      {extra}
    </div>
  )
}

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
}

export function CitationUrlDrawer({ row, onClose }: CitationUrlDrawerProps) {
  const { filters } = useAnalyticsFilters()
  const { selectedAccount } = useAccountStore()
  const detailState = useApi(
    queryKeys.geo.citationUrlDetail(selectedAccount?.id, row.url, filters),
    () => getGeoCitationUrlDetail(row.url, filters),
  )

  const detail: CitationUrlDetail = detailState.data?.data ?? {
    title: row.title,
    url: row.url,
    path: '',
    isBranded: null,
    appearances: row.mentions ?? 0,
    promptCount: 0,
    growthPercent: null,
    providers: [],
    citationTimeSeries: [],
    sparkline: [],
    prompts: [],
    lastUpdated: row.lastUpdated,
  }

  const providerMax = Math.max(1, ...detail.providers.map((item) => item.count))
  const series = useMemo(() => {
    if (detail.citationTimeSeries.length) {
      return detail.citationTimeSeries.map((point) => ({
        date: shortDateLabel(point.date),
        count: point.count,
      }))
    }
    return detail.sparkline.map((count, index) => ({
      date: String(index + 1),
      count,
    }))
  }, [detail.citationTimeSeries, detail.sparkline])

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-bg/80">
      <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-xl border-l border-line bg-surface shadow-hover">
        <div className="shrink-0 border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {detail.isBranded != null ? (
                <Pill tone={detail.isBranded ? 'green' : 'grey'}>
                  {detail.isBranded ? 'Branded' : 'Non-branded'}
                </Pill>
              ) : null}
              <h2 className="mt-2 text-lg font-semibold text-ink">{detail.title}</h2>
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                {displayUrl(detail.url)}
                <span aria-hidden>↗</span>
              </a>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-paper-soft"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {detailState.loading && !detailState.data ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-dark">
              Loading page details…
            </div>
          ) : (
            <div className="flex flex-col gap-5 px-5 py-4">
              {detailState.error ? (
                <p className="text-xs text-muted">{detailState.error}</p>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <MetricChip label="Appearances" value={formatNumber(detail.appearances, 0)} />
                <MetricChip label="Prompts" value={formatNumber(detail.promptCount, 0)} />
                <MetricChip
                  label="Growth"
                  value={detail.growthPercent == null ? '—' : ''}
                  extra={
                    detail.growthPercent != null ? (
                      <div className="mt-0.5">
                        <DeltaLabel value={detail.growthPercent} />
                        <p className="text-[10px] text-muted-dark">vs prev. period</p>
                      </div>
                    ) : null
                  }
                />
              </div>

              <section>
                <h3 className="mb-2 text-[12px] font-medium text-muted">
                  Citations over time
                </h3>
                {series.length > 0 ? (
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tick={{ fill: CHART_AXIS, fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: CHART_GRID }}
                          interval="preserveStartEnd"
                        />
                        <YAxis hide width={0} allowDecimals={false} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            return (
                              <div className="border border-line bg-surface px-3 py-2 text-xs">
                                <p className="text-muted">{label}</p>
                                <p className="font-medium text-ink">
                                  {formatNumber(typeof payload[0]?.value === 'number' ? payload[0].value : null, 0)}
                                </p>
                              </div>
                            )
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#14201a"
                          strokeWidth={1.8}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted">No time series for this page.</p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-[12px] font-medium text-muted">
                  Provider breakdown
                </h3>
                {detail.providers.length === 0 ? (
                  <p className="text-sm text-muted">No provider breakdown for this page.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {detail.providers.map((item) => (
                      <li key={item.provider} className="flex items-center gap-2.5">
                        <ProviderIcon provider={item.provider} size="sm" />
                        <span className="w-24 shrink-0 text-[13px] text-ink">
                          {providerLabel(item.provider)}
                        </span>
                        <div className="h-1.5 min-w-0 flex-1 bg-paper-soft">
                          <div
                            className="h-full bg-ink"
                            style={{ width: `${(item.count / providerMax) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[13px] tabular-nums text-ink">
                          {formatNumber(item.count, 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-[12px] font-medium text-muted">
                  Prompts that surfaced this page
                </h3>
                {detail.prompts.length === 0 ? (
                  <p className="text-sm text-muted">No prompts recorded for this page.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {detail.prompts.map((prompt) => (
                      <li key={`${prompt.promptId ?? prompt.text}`} className="px-3 py-2.5 text-sm leading-relaxed text-ink">
                        {prompt.text}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line px-5 py-4">
          <a
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 bg-ink px-4 py-2.5 text-sm font-semibold text-surface hover:opacity-90"
          >
            Open page
            <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </div>
  )
}
