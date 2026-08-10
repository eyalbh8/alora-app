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
}: BrandLogoProps) {
  const { meta } = useGeoMeta()
  const lookup = useMemo(
    () => buildBrandLogoLookup(meta?.account, meta?.competitors),
    [meta],
  )
  const candidates = useMemo(
    () => brandLogoCandidates({ id, name, logo, domain, site }, metaLogoFor({ id, name }, lookup)),
    [id, name, logo, domain, site, lookup],
  )
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [id, name, logo, domain, site, lookup])

  const sizeClass = SIZE_CLASS[size]
  const textClass = TEXT_CLASS[size]
  const badgeClass = badge
    ? 'rounded-full border border-slate-200/60 bg-white p-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-2 ring-white'
    : 'rounded object-contain'

  if (candidates.length === 0 || index >= candidates.length) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-500 ${sizeClass} ${textClass} ${className}`}
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
      className={`shrink-0 ${badgeClass} ${sizeClass} ${className}`}
      onError={() => setIndex((i) => i + 1)}
    />
  )
}
