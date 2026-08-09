const FLAG_EMOJI: Record<string, string> = {
  'flag-gb': '🇬🇧',
  'flag-uk': '🇬🇧',
  'flag-us': '🇺🇸',
  'flag-ru': '🇷🇺',
  'flag-ca': '🇨🇦',
  'flag-au': '🇦🇺',
  'flag-de': '🇩🇪',
  'flag-fr': '🇫🇷',
  'flag-es': '🇪🇸',
  'flag-it': '🇮🇹',
  'flag-il': '🇮🇱',
}

interface FlagIconProps {
  iconName: string
  className?: string
}

/** Maps AirOps icon_name (e.g. flag-gb) to a flag emoji. */
export function FlagIcon({ iconName, className = 'text-2xl' }: FlagIconProps) {
  const emoji = FLAG_EMOJI[iconName.toLowerCase()] ?? '🏳️'
  return (
    <span className={className} role="img" aria-label={iconName}>
      {emoji}
    </span>
  )
}
