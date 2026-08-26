import { getLlmProviderDisplayName, getLlmProviderIcon, LLM_PROVIDER_ICONS } from '../lib/llmProviders'

interface ProviderIconProps {
  provider: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  rounded?: boolean
  className?: string
}

const SIZE_PX = { sm: 20, md: 24, lg: 28 } as const

export function ProviderIcon({
  provider,
  size = 'sm',
  showLabel = false,
  rounded = false,
  className = '',
}: ProviderIconProps) {
  const px = SIZE_PX[size]
  const label = getLlmProviderDisplayName(provider)
  const iconSrc = getLlmProviderIcon(provider)

  const img = (
    <img
      src={iconSrc}
      alt={label}
      width={px}
      height={px}
      className={`shrink-0 object-cover ${rounded ? 'rounded-full' : ''} ${className}`}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = LLM_PROVIDER_ICONS.DEFAULT
      }}
    />
  )

  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-2">
        {img}
        <span className="text-sm text-ink">{label}</span>
      </span>
    )
  }

  return img
}
