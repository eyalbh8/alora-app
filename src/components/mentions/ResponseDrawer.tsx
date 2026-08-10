import { useMemo, useState } from 'react'
import type { ResponseRow } from '../../api/types'
import { getGeoResponseDetail, type GeoResponseDetail } from '../../api/geo'
import { queryKeys } from '../../api/queryKeys'
import { useGeoMeta } from '../../context/GeoMetaContext'
import { useApi } from '../../hooks/useApi'
import { formatNumber, providerLabel, regionLabel, truncateMiddle } from '../../lib/format'
import { ProviderIcon } from '../ProviderIcon'
import {
  citationCount,
  responseBrands,
  responseDateTimeLabel,
  responseFullText,
  responsePreviewText,
  responseRaw,
  responseSentiment,
} from './responseHelpers'
import { ResponseFormattedText } from './ResponseFormattedText'

type DrawerTab = 'response' | 'raw'

interface ResponseDrawerProps {
  row: ResponseRow & { raw?: unknown }
  initialTab?: DrawerTab
  onClose: () => void
}

function SentimentBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-400">—</span>
  const tone =
    score >= 70 ? 'bg-emerald-500 text-white' : score >= 40 ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white'
  return (
    <span className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {formatNumber(score, 0)}
    </span>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#101414]">{value}</p>
    </div>
  )
}

function BrandAvatar({ name, logo }: { name?: string | null; logo?: string | null }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name ?? 'Brand'}
        className="h-7 w-7 rounded-full border border-slate-200 bg-white object-contain p-0.5"
      />
    )
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600">
      {(name ?? '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export function ResponseDrawer({ row, initialTab = 'response', onClose }: ResponseDrawerProps) {
  const { geoMode, meta } = useGeoMeta()
  const [tab, setTab] = useState<DrawerTab>(initialTab)

  const { data: detailPayload, loading } = useApi<GeoResponseDetail>(
    queryKeys.geo.responseDetail(row.id),
    () =>
      geoMode
        ? getGeoResponseDetail(row.id)
        : Promise.resolve({ data: row as GeoResponseDetail['data'], computedAt: '' }),
    { enabled: geoMode },
  )

  const detail = (detailPayload?.data ?? row) as ResponseRow & { raw?: unknown }
  const provider = detail.provider || detail.model || '—'
  const preview = responsePreviewText(detail)
  const fullText = responseFullText(detail) || preview
  const sentiment = responseSentiment(detail)
  const brands = responseBrands(detail)
  const citations = detail.sources ?? []
  const raw = responseRaw(detail)

  const competitorLogos = useMemo(
    () => new Map((meta?.competitors ?? []).map((c) => [c.name.toLowerCase(), c.logo])),
    [meta?.competitors],
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
      <button type="button" className="flex-1 cursor-default" aria-label="Close drawer" onClick={onClose} />
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ProviderIcon provider={provider} size="md" />
                <div>
                  <h2 className="text-base font-semibold text-[#101414]">{providerLabel(provider)}</h2>
                  <p className="text-xs text-slate-500">{responseDateTimeLabel(detail)}</p>
                </div>
              </div>
              {detail.region && (
                <p className="mt-2 text-xs text-slate-400">{regionLabel(detail.region)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(['response', 'raw'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  tab === key ? 'bg-white text-[#101414] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {key === 'raw' ? 'Raw' : 'Response'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && tab === 'response' ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading response…</div>
          ) : tab === 'raw' ? (
            <div className="px-5 py-4">
              <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                {raw ? JSON.stringify(raw, null, 2) : 'No raw payload available.'}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col gap-5 px-5 py-4">
              {detail.promptText && (
                <section>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Prompt
                  </h3>
                  <p className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm leading-relaxed text-slate-700">
                    {detail.promptText}
                  </p>
                </section>
              )}

              {detail.topic && (
                <p className="text-xs text-slate-500">
                  Topic: <span className="font-medium text-slate-700">{detail.topic}</span>
                </p>
              )}

              <section>
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Response
                </h3>
                {fullText ? (
                  <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-4">
                    <ResponseFormattedText text={fullText} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Response text is not available for this row yet. Re-sync prompt responses to populate it, or
                    check the Raw tab.
                  </div>
                )}
              </section>

              <div className="grid grid-cols-3 gap-2">
                <MetricChip
                  label="Rank"
                  value={detail.myRank != null ? formatNumber(detail.myRank, 0) : '—'}
                />
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sentiment</p>
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
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Citations ({citationCount(detail)})
                  </h3>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80">
                    {citations.map((source, i) => (
                      <li key={`${source.url}-${i}`} className="px-3 py-2.5">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-brand-700 hover:underline"
                        >
                          {source.title || truncateMiddle(source.url, 72)}
                        </a>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{source.url}</p>
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
