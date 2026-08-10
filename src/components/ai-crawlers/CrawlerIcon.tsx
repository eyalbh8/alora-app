import {
  getCrawlerBotDisplayName,
  getCrawlerBotIcon,
  CRAWLER_BOT_ICONS,
} from '../../lib/crawlerBots'

interface CrawlerIconProps {
  bot: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const SIZE_PX = { sm: 20, md: 24, lg: 28 } as const

export function CrawlerIcon({
  bot,
  size = 'sm',
  showLabel = false,
  className = '',
}: CrawlerIconProps) {
  const px = SIZE_PX[size]
  const label = getCrawlerBotDisplayName(bot)
  const iconSrc = getCrawlerBotIcon(bot)

  const img = (
    <img
      src={iconSrc}
      alt={label}
      width={px}
      height={px}
      className={`shrink-0 object-contain ${className}`}
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = CRAWLER_BOT_ICONS.DEFAULT
      }}
    />
  )

  if (showLabel) {
    return (
      <span className="inline-flex items-center gap-2">
        {img}
        <span className="text-sm text-slate-700">{label}</span>
      </span>
    )
  }

  return img
}
