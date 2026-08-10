import { ChartSkeleton, Skeleton } from './LoadingSpinner'

function ChartCardSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-1 h-3 w-56" />
      <div className={`mt-4 ${height}`}>
        <ChartSkeleton />
      </div>
    </div>
  )
}

function TableSkeleton({
  rows = 6,
  cols = 4,
  title,
}: {
  rows?: number
  cols?: number
  title?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      {title && <Skeleton className="h-4 w-44" />}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex gap-6 border-b border-slate-100 px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex gap-6 border-b border-slate-50 px-4 py-3 last:border-0"
          >
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-3"
                style={{ width: j === 0 ? '35%' : j === cols - 1 ? '12%' : '18%' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-8 h-9 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div
          className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
          style={{ height: 420 }}
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1 h-3 w-48" />
          </div>
          <TableSkeleton rows={5} cols={5} />
        </div>
        <ChartCardSkeleton height="h-[320px]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div
          className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
          style={{ height: 420 }}
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-1 h-3 w-56" />
          </div>
          <TableSkeleton rows={5} cols={2} />
        </div>
        <div
          className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm"
          style={{ height: 420 }}
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-3 w-52" />
          </div>
          <TableSkeleton rows={5} cols={3} />
        </div>
      </div>
    </div>
  )
}

export function MentionsScreenSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCardSkeleton height="h-[420px]" />
        <ChartCardSkeleton height="h-[420px]" />
      </div>
      <TableSkeleton rows={8} cols={8} />
    </div>
  )
}

export function SentimentScreenSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCardSkeleton height="h-[420px]" />
        <ChartCardSkeleton height="h-[420px]" />
      </div>
      <TableSkeleton rows={8} cols={8} />
    </div>
  )
}

export function PromptsScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <Skeleton className="mb-3 h-4 w-20" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28 rounded-full" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <Skeleton className="mb-1 h-4 w-48" />
          <Skeleton className="mb-4 h-3 w-64" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="mt-3 flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-24" />
            ))}
          </div>
        </div>
      </div>
      <TableSkeleton rows={10} cols={8} title />
    </div>
  )
}

export function CompetitorsScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCardSkeleton height="h-[420px]" />
        <ChartCardSkeleton height="h-[420px]" />
      </div>
      <TableSkeleton rows={10} cols={8} title />
    </div>
  )
}

export function AiTrafficScreenSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 xl:flex-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-8 h-9 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <ChartCardSkeleton height="h-[420px]" />
    </div>
  )
}

export function AiCrawlersScreenSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 xl:flex-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-8 h-9 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <ChartCardSkeleton height="h-[420px]" />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCardSkeleton height="h-[420px]" />
        <ChartCardSkeleton height="h-[420px]" />
      </div>
    </div>
  )
}
