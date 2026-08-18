import { ChartSkeleton, Skeleton } from './LoadingSpinner'

export function DashboardScreenSkeleton() {
  return (
    <div className="flex flex-col gap-14 pb-4">
      <div className="overflow-hidden border border-line border-t-2 border-t-ink bg-bg">
        <div className="px-5 py-5 sm:px-6">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-2 h-3 w-80 max-w-full" />
        </div>
        <div className="overflow-hidden border-t border-line">
          <div className="flex min-w-max md:min-w-full">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-[10.5rem] flex-1 flex-col border-r border-line px-5 py-5 last:border-r-0"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-9 w-14" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-line bg-paper-soft px-5 py-3">
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="overflow-hidden border-t border-line">
          <div className="flex min-w-max md:min-w-full">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex min-w-[10.5rem] flex-1 flex-col border-r border-line px-5 py-5 last:border-r-0"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-9 w-14" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-stretch gap-10 lg:grid-cols-2">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-3 w-48" />
          <div className="mt-5 border-t-2 border-ink">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-6 border-b border-line py-3.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-1 h-3 w-52" />
          <div className="mt-5 border-t-2 border-ink">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-6 border-b border-line py-3.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-1 h-3 w-56" />
        <div className="mt-5 border-t-2 border-ink">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-6 border-b border-line py-3">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MentionsScreenSkeleton() {
  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:gap-14">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-5 h-[52px] w-20" />
          <Skeleton className="mt-2 h-3 w-40" />
          <div className="mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 border-b border-line/70 py-2 last:border-b-0"
              >
                <Skeleton className="h-2 w-2 rounded-none" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-3 w-20" />
          <div className="mt-4 h-[260px]">
            <ChartSkeleton />
          </div>
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="border-t-2 border-ink">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex gap-6 border-b border-line py-3.5">
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SentimentScreenSkeleton() {
  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:gap-14">
      <div className="grid min-w-0 items-center gap-10 lg:grid-cols-2">
        <div className="flex flex-col items-center">
          <Skeleton className="mb-6 h-5 w-48" />
          <Skeleton className="h-[220px] w-[220px] rounded-full" />
        </div>
        <div>
          <Skeleton className="h-5 w-36" />
          <div className="mt-2 flex items-end gap-6">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="mt-5 h-[180px] w-full rounded-none" />
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-5 w-44" />
        <div className="flex gap-6 border-b-2 border-line pb-2.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line py-4">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="ml-auto h-5 w-28" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PromptsScreenSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border-y border-line py-5">
          <Skeleton className="mb-1 h-2.5 w-14" />
          <Skeleton className="mb-4 h-6 w-20" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28" />
            ))}
          </div>
        </div>
        <div className="border-y border-line py-5">
          <Skeleton className="mb-1 h-2.5 w-20" />
          <Skeleton className="mb-1 h-6 w-44" />
          <Skeleton className="mb-5 h-3 w-60" />
          <Skeleton className="h-2 w-full" />
          <div className="mt-4 flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-24" />
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="flex flex-col gap-3 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Skeleton className="mb-1 h-2.5 w-20" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-9 w-64" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line py-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-28 md:block" />
            <Skeleton className="hidden h-6 w-6 sm:block" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="hidden h-6 w-12 sm:block" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompetitorsScreenSkeleton() {
  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:gap-14">
      <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 flex items-end gap-3">
            <Skeleton className="h-11 w-24" />
            <Skeleton className="mb-1 h-3 w-28" />
          </div>
          <Skeleton className="mt-[18px] h-2.5 w-full rounded-none" />
          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16 rounded-none" />
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="mt-1 h-3 w-64" />
          <div className="mt-4 h-[180px] border-b border-line">
            <ChartSkeleton />
          </div>
        </div>
      </div>
      <div>
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="flex gap-6 border-b-2 border-line pb-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 rounded-none" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-line py-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton
                key={j}
                className="h-4 rounded-none"
                style={{ width: j === 0 ? '24%' : j === 1 ? '32%' : '12%' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AiTrafficScreenSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid grid-cols-1 border-t border-t-ink sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col border-b border-r border-line px-5 py-5"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-5 h-8 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="min-h-[420px]">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-3 w-64" />
        <div className="mt-4 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
        <div className="mt-4 border-y border-line py-6">
          <Skeleton className="h-[260px] w-full" />
        </div>
      </div>
      <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, sectionIndex) => (
          <div key={sectionIndex}>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-3 w-56" />
            <div className="mt-[18px] space-y-3">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AiCrawlersScreenSkeleton() {
  return (
    <div className="flex flex-col gap-8 md:gap-10 lg:gap-14">
      <div className="overflow-x-auto border-y border-b-line border-t-ink">
        <div className="flex min-w-max">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-[13.5rem] shrink-0 border-r border-line px-4 py-5 last:border-r-0"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-4 h-8 w-16" />
              <div className="mt-3 flex justify-between gap-3">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-3 w-64" />
        <div className="mt-5 flex h-[260px] items-end gap-3 border-b border-line px-3">
          {[32, 48, 42, 64, 55, 78, 68].map((height, i) => (
            <Skeleton key={i} className="flex-1 rounded-none" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>

      <div className="grid gap-10 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <div key={sectionIndex}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <div className="mt-[18px] space-y-4">
              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div key={rowIndex}>
                  <div className="mb-2 flex justify-between">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-0.5 w-full rounded-none" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
