import { useEffect, useMemo, useState } from 'react'
import { useGeoMeta } from '../../context/GeoMetaContext'
import {
  brandLogoCandidates,
  buildBrandLogoLookup,
  metaLogoFor,
  type BrandLogoSource,
} from '../../lib/brandLogo'

const SIZE_CLASS = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
  xl: 'h-10 w-10',
} as const

const TEXT_CLASS = {
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-xs',
  xl: 'text-sm',
} as const

interface BrandLogoProps extends BrandLogoSource {
  size?: keyof typeof SIZE_CLASS
  className?: string
  /** White circular badge with shadow (Share of Voice callouts). */
  badge?: boolean
  /** Circle for brands; rounded tile for site favicons. */
  shape?: 'circle' | 'rounded'
}

export function BrandLogo({
  name,
  logo,
  domain,
  site,
  id,
  size = 'md',
  className = '',
  badge = false,
  shape = 'circle',
}: BrandLogoProps) {
  const { meta } = useGeoMeta()
  const lookup = useMemo(
    () => buildBrandLogoLookup(meta?.account, meta?.competitors),
    [meta],
  )
  const candidates = useMemo(
    () =>
      brandLogoCandidates(
        { id, name, logo, domain, site },
        metaLogoFor({ id, name, domain, site }, lookup),
      ),
    [id, name, logo, domain, site, lookup],
  )
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [id, name, logo, domain, site, lookup])

  const sizeClass = SIZE_CLASS[size]
  const textClass = TEXT_CLASS[size]
  const imageClass = badge
    ? 'rounded-full border border-line bg-surface p-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-2 ring-white'
    : shape === 'rounded'
      ? 'rounded-md bg-surface object-contain p-0.5 ring-1 ring-line'
      : 'rounded-full bg-surface object-cover'
  const fallbackClass =
    shape === 'rounded'
      ? 'rounded-md bg-paper-soft text-muted ring-1 ring-line'
      : 'rounded-full bg-paper-soft text-muted'

  if (candidates.length === 0 || index >= candidates.length) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center font-semibold ${fallbackClass} ${sizeClass} ${textClass} ${className}`}
        title={name}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={candidates[index]}
      alt={name}
      title={name}
      className={`shrink-0 ${imageClass} ${sizeClass} ${className}`}
      onError={() => setIndex((i) => i + 1)}
    />
  )
}
