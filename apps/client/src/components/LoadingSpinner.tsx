import { PulsingLogo } from './loading'

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12">
      <PulsingLogo size={20} />
      <span className="text-[13px] font-medium text-muted">{label}</span>
    </div>
  )
}

/** Shimmer block used in skeleton layouts — tinted for contrast on the Menchly paper background. */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`skeleton ${className}`} style={style} />
}

export function ChartSkeleton() {
  return (
    <div className="flex h-64 items-end gap-3 px-4 pb-4">
      {[40, 65, 50, 80, 60, 90, 70, 55].map((height, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${height}%` }} />
      ))}
    </div>
  )
}
