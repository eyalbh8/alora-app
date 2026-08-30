import { MenchlyLogo } from '../MenchlyLogo'

export const APP_LOGO_SRC = '/logo.svg'

interface PulsingLogoProps {
  size?: number
  className?: string
}

export function PulsingLogo({ size = 40, className = '' }: PulsingLogoProps) {
  return (
    <div
      className={`pulsing-logo${className ? ` ${className}` : ''}`}
      style={{ height: size }}
    >
      <MenchlyLogo className="pulsing-logo__mark" title="Loading" />
    </div>
  )
}
