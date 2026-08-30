import { PulsingLogo } from './PulsingLogo'

export function PageLoader({ size = 64 }: { size?: number }) {
  return (
    <div className="page-loader" role="status" aria-label="Loading">
      <PulsingLogo size={size} />
    </div>
  )
}
