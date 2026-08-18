import { useMemo } from 'react'
import type { ResponseRow } from '../../api/types'
import { getGeoResponseDetail, type GeoResponseDetail } from '../../api/geo'
import { queryKeys } from '../../api/queryKeys'
import { useGeoMeta } from '../../context/GeoMetaContext'
import { useAccountStore } from '../../store/useAccountStore'
import { useApi } from '../../hooks/useApi'
import { formatNumber, providerLabel, regionLabel, truncateMiddle } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'
import {
  citationCount,
  responseBrands,
  responseDateTimeLabel,
  responseFullText,
  responsePreviewText,
  responseSentiment,
} from './responseHelpers'
import { ResponseFormattedText } from './ResponseFormattedText'

interface ResponseDrawerProps {
  row: ResponseRow & { raw?: unknown }
  onClose: () => void
}

function SentimentBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-dark">—</span>
  const tone = score >= 70 ? 'text-accent' : score >= 40 ? 'text-muted' : 'text-error'
  return (
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center font-mono text-[11px] font-medium tracking-[0.1em] ${tone}`}>
      {formatNumber(score, 0)}
    </span>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper-soft/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-dark">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function BrandAvatar({ name, logo }: { name?: string | null; logo?: string | null }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name ?? 'Brand'}
        className="h-7 w-7 rounded-full border border-line bg-surface object-contain p-0.5"
      />
    )
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-paper-soft text-[10px] font-bold text-muted">
      {(name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export function ResponseDrawer({ row, onClose }: ResponseDrawerProps) {
  const { geoMode, meta } = useGeoMeta()
  const { selectedAccount } = useAccountStore()

  const { data: detailPayload, loading } = useApi<GeoResponseDetail>(
    queryKeys.geo.responseDetail(selectedAccount?.id, row.id),
    () => getGeoResponseDetail(row.id),
    { enabled: geoMode },
  )

  const detail = (detailPayload?.data ?? row) as ResponseRow & { raw?: unknown }
  const provider = detail.provider || detail.model || '—'
  const preview = responsePreviewText(detail)
  const fullText = responseFullText(detail) || preview
  const sentiment = responseSentiment(detail)
  const brands = responseBrands(detail)
  const citations = detail.sources ?? []

  const competitorLogos = useMemo(
    () => new Map((meta?.competitors ?? []).map((c) => [c.name.toLowerCase(), c.logo])),
    [meta?.competitors],
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-bg/80">
      <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-line bg-surface ">
        {/* Header */}
        <div className="shrink-0 border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={provider} size="md" />
                <div>
                  <h2 className="text-base font-semibold text-ink">{providerLabel(provider)}</h2>
                  <p className="text-xs text-muted">{responseDateTimeLabel(detail)}</p>
                </div>
              </div>
              {detail.region && (
                <p className="mt-2 text-xs text-muted-dark">{regionLabel(detail.region)}</p>
              )}
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

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-dark">Loading response…</div>
          ) : (
            <div className="flex flex-col gap-5 px-5 py-4">
              {detail.promptText && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-dark">
                    Prompt
                  </h3>
                  <p className="rounded-xl border border-line bg-paper-soft/80 px-4 py-3 text-sm leading-relaxed text-ink">
                    {detail.promptText}
                  </p>
                </section>
              )}

              {detail.topic && (
                <p className="text-xs text-muted">
                  Topic: <span className="font-medium text-ink">{detail.topic}</span>
                </p>
              )}

              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-dark">
                  Response
                </h3>
                {fullText ? (
                  <div className="rounded-xl border border-line bg-surface px-4 py-4">
                    <ResponseFormattedText text={fullText} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-line bg-paper-soft px-4 py-6 text-center text-sm text-muted">
                    Response text is not available for this row yet. Re-sync prompt responses to populate it.
                  </div>
                )}
              </section>

              <div className="grid grid-cols-3 gap-2">
                <MetricChip
                  label="Rank"
                  value={detail.myRank != null ? formatNumber(detail.myRank, 0) : '—'}
                />
                <div className="rounded-lg border border-line bg-paper-soft/80 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-dark">Sentiment</p>
                  <div className="mt-1">
                    <SentimentBadge score={sentiment} />
                  </div>
                </div>
                <MetricChip
                  label="Visibility"
                  value={
                    detail.visibilityAverage != null
                      ? `${formatNumber(detail.visibilityAverage, 0)}%`
                      : '—'
                  }
                />
              </div>

              {(brands.length > 0 || meta?.account?.logo) && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-dark">
                    Brands
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {meta?.account?.logo && (
                      <BrandAvatar name={meta.account.title} logo={meta.account.logo} />
                    )}
                    {brands.map((brand, i) => (
                      <BrandAvatar
                        key={`${brand.name ?? brand.domain ?? i}`}
                        name={brand.name}
                        logo={
                          brand.logo ??
                          (brand.name ? competitorLogos.get(brand.name.toLowerCase()) ?? null : null)
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {citations.length > 0 && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-dark">
                    Citations ({citationCount(detail)})
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-line">
                    {citations.map((source, i) => (
                      <li key={`${source.url}-${i}`} className="px-3 py-2.5">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          {source.title || truncateMiddle(source.url, 72)}
                        </a>
                        <p className="mt-0.5 truncate text-xs text-muted-dark">{source.url}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
