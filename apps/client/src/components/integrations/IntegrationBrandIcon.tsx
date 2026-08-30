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
        d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"
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
