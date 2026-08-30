import type { ComponentType, ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { title?: string }

function Svg({
  title,
  children,
  viewBox = '0 0 24 24',
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox={viewBox} aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function LinkedInBrandIcon(props: IconProps) {
  return (
    <Svg title="LinkedIn" {...props}>
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </Svg>
  )
}

export function FacebookBrandIcon(props: IconProps) {
  return (
    <Svg title="Facebook" {...props}>
      <path
        fill="currentColor"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </Svg>
  )
}

export function InstagramBrandIcon(props: IconProps) {
  return (
    <Svg title="Instagram" {...props}>
      <path
        fill="currentColor"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      />
    </Svg>
  )
}

export function XBrandIcon(props: IconProps) {
  return (
    <Svg title="X" {...props}>
      <path
        fill="currentColor"
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      />
    </Svg>
  )
}

export function WordPressBrandIcon(props: IconProps) {
  return (
    <Svg title="WordPress" {...props}>
      <path
        fill="currentColor"
        d="M12.158 12.786 9.03 20.849c.806.237 1.657.366 2.534.366 1.048 0 2.052-.185 2.986-.525-.098-.161-.181-.328-.249-.5l-2.143-7.404zm-1.42-.404L7.02 5.728c-.803.54-1.5 1.233-2.05 2.041l5.07 14.08 2.7-9.467zM12.002.15C5.42.15.152 5.42.152 12S5.42 23.85 12 23.85 23.85 18.58 23.85 12 18.58.15 12.002.15zM3.974 8.1c-.343 1.037-.53 2.14-.53 3.283 0 2.837 1.09 5.425 2.875 7.371L3.974 8.1zm14.168 9.985c1.785-1.946 2.875-4.534 2.875-7.371 0-1.143-.187-2.246-.53-3.283l-2.345 10.654zm.85-14.24c-.806-.237-1.657-.366-2.534-.366-2.918 0-5.49 1.35-7.22 3.447l4.197 12.25 5.557-15.331z"
      />
    </Svg>
  )
}

export function ShopifyBrandIcon(props: IconProps) {
  return (
    <Svg title="Shopify" {...props}>
      <path
        fill="currentColor"
        d="M15.337 23.979 18.763.986a.455.455 0 0 0-.453-.498c-.243.005-5.24.42-5.24.42s-3.503-3.405-3.877-3.78c-.374-.374-.998-.329-1.26-.247-.016.005-.03.015-.046.02-.03.015-5.728 1.767-5.728 1.767s-.916.284-.827 1.25c.01.104 1.46 14.067 1.46 14.067L15.337 23.98ZM11.75.907l-1.31 3.897s-1.46-.475-3.21-.908C8.93 1.65 10.38.962 11.09.862c.02-.005.04-.01.06-.01.27-.05.51.055.6.055Zm-.76 17.63-3.39-.927 1.07-4.29.89 3.04 1.43 2.177Zm5.12-14.15s-.99.31-2.41.72l-.39-1.45-1.29.41-.34 1.02c-.63.2-1.24.4-1.81.59L9.46.77s2.13-.56 3.98-.76c.07-.01.14-.01.21-.01.68-.02 1.16.12 1.45.29l1.02 3.998Z"
      />
    </Svg>
  )
}

/** Lovable logo mark silhouette (official L-block shape). */
export function LovableBrandIcon(props: IconProps) {
  return (
    <Svg title="Lovable" viewBox="0 0 121 122" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M36.069 0C55.989 0 72.137 16.155 72.137 36.084v13.714h12.004c19.92 0 36.069 16.155 36.069 36.083C120.21 105.809 104.061 121.964 84.141 121.964H0V36.084C0 16.155 16.149 0 36.069 0Z"
      />
    </Svg>
  )
}

export type IntegrationBrandKey =
  | 'LINKEDIN'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'X'
  | 'wordpress'
  | 'lovable'
  | 'shopify'

const BRAND_ICONS: Record<IntegrationBrandKey, ComponentType<IconProps>> = {
  LINKEDIN: LinkedInBrandIcon,
  FACEBOOK: FacebookBrandIcon,
  INSTAGRAM: InstagramBrandIcon,
  X: XBrandIcon,
  wordpress: WordPressBrandIcon,
  lovable: LovableBrandIcon,
  shopify: ShopifyBrandIcon,
}

export function IntegrationBrandIcon({
  brand,
  className = 'size-5',
}: {
  brand: string
  className?: string
}) {
  const Icon = BRAND_ICONS[brand as IntegrationBrandKey]
  if (!Icon) return null
  return <Icon className={className} />
}
