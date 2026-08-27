export function LoadingSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-accent">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
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
