import type { MarketplaceSite } from '../../api/geo'
import { BrandLogo } from '../competitors/BrandLogo'

export function SiteCell({ site }: { site: MarketplaceSite }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandLogo
        id={site.id}
        name={site.name}
        logo={site.logo || site.faviconUrl}
        domain={site.domain}
        site={site.domain}
        size="md"
        shape="rounded"
      />
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{site.name}</p>
        {site.domain ? (
          <p className="truncate text-[11px] text-muted-dark">{site.domain}</p>
        ) : null}
      </div>
    </div>
  )
}
