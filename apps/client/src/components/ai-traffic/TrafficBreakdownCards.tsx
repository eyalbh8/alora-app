import { BrandLogo } from '../competitors/BrandLogo'
import { formatNumber } from '../../lib/format'
import { countryDisplayName, regionFlag } from '../../lib/regions'
import type { TrafficBreakdownRow } from '../../lib/snapshots/aiTraffic'

interface BreakdownCardProps {
  title: string
  subtitle: string
  columnLabel: string
  rows: TrafficBreakdownRow[]
  kind: 'source' | 'page' | 'location' | 'device' | 'browser'
}

function rowLabel(row: TrafficBreakdownRow, kind: BreakdownCardProps['kind']): string {
  if (kind === 'location') return countryDisplayName(row.countryCode || row.label)
  if (kind === 'device') {
    const label = row.label.trim()
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : label
  }
  return row.label
}

function BreakdownCard({ title, subtitle, columnLabel, rows, kind }: BreakdownCardProps) {
  const visibleRows = rows.slice(0, 8)
  const isEmpty = visibleRows.length === 0
  const showLeading = kind === 'source' || kind === 'location'

  return (
    <section className="min-w-0">
      <div className="mb-[18px] min-h-[4.5rem]">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs leading-4 text-muted">{subtitle}</p>
      </div>
      {isEmpty ? (
        <div className="flex min-h-36 items-center justify-center border-y border-dashed border-line px-6 text-sm text-muted">
          No data for the selected period.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] items-end border-b border-line pb-2.5 text-[12px] font-medium text-muted">
            <span className="min-w-0 truncate text-left">{columnLabel}</span>
            <span className="text-right">Visitors</span>
          </div>
          {visibleRows.map((row, index) => {
            const label = rowLabel(row, kind)
            return (
              <div
                key={`${kind}-${row.label}`}
                className="grid grid-cols-[minmax(0,1fr)_5.25rem] items-center border-b border-line py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="card-number shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {showLeading && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {kind === 'source' && row.domain ? (
                        <BrandLogo name={row.domain} domain={row.domain} size="sm" shape="rounded" />
                      ) : null}
                      {kind === 'location' ? (
                        <span aria-hidden="true" className="text-base leading-none">
                          {regionFlag(row.countryCode || row.label)}
                        </span>
                      ) : null}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-sm text-ink" title={label}>
                    {label}
                  </span>
                </div>
                <span className="text-right text-sm font-medium tabular-nums text-muted">
                  {formatNumber(row.value, 0)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface TrafficBreakdownCardsProps {
  topSources: TrafficBreakdownRow[]
  topPages: TrafficBreakdownRow[]
  topLocations: TrafficBreakdownRow[]
  topDevices: TrafficBreakdownRow[]
  topBrowsers: TrafficBreakdownRow[]
}

export function TrafficBreakdownCards({
  topSources,
  topPages,
  topLocations,
  topDevices,
  topBrowsers,
}: TrafficBreakdownCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
      <BreakdownCard
        title="Top Sources"
        subtitle="Shows the referral sources that send the most AI traffic to your website"
        columnLabel="Source"
        rows={topSources}
        kind="source"
      />
      <BreakdownCard
        title="Top Pages"
        subtitle="Shows the most visited pages on your website by AI traffic"
        columnLabel="Page"
        rows={topPages}
        kind="page"
      />
      <BreakdownCard
        title="Top Locations"
        subtitle="Shows the geographic locations of visitors accessing your website through AI"
        columnLabel="Country"
        rows={topLocations}
        kind="location"
      />
      <BreakdownCard
        title="Top Devices"
        subtitle="Shows the types of devices used to access your website through AI"
        columnLabel="Device"
        rows={topDevices}
        kind="device"
      />
      <BreakdownCard
        title="Top Browsers"
        subtitle="Shows the most common browsers used to access your website through AI"
        columnLabel="Browser"
        rows={topBrowsers}
        kind="browser"
      />
    </div>
  )
}
