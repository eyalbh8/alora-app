import { PulsingLogo } from './PulsingLogo'

export function FullScreenLoader({ size = 64 }: { size?: number }) {
  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-bg"
      role="status"
      aria-label="Loading"
    >
      <PulsingLogo size={size} />
    </div>
  )
}
