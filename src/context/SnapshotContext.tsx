import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getSnapshots, getTenant } from '../api/snapshots'
import type {
  AvailableDay,
  ScreenKey,
  ScreenSnapshot,
  TenantInfo,
} from '../api/types'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/LoadingSpinner'
import { lastNDaysEnding, type DateRange } from '../lib/dates'

interface SnapshotContextValue {
  tenant: TenantInfo
  availableDays: AvailableDay[]
  latestDay: string | null
  range: DateRange
  setRange: (range: DateRange) => void
  snapshots: ScreenSnapshot[]
  loading: boolean
  error: string | null
  retry: () => void
  /** Convenience: snapshots for a single screen key across the range */
  forScreen: (screen: ScreenKey | string) => ScreenSnapshot[]
  freshness: { day: string | null; pulledAt: string | null }
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null)

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange | null>(null)

  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant,
    queryFn: getTenant,
  })

  useEffect(() => {
    if (!tenantQuery.data || range) return
    const end = tenantQuery.data.availableDays[0]?.day
    if (end) {
      setRange(lastNDaysEnding(1, end))
    }
  }, [tenantQuery.data, range])

  const snapshotsQuery = useQuery({
    queryKey: range
      ? queryKeys.snapshots(range.startDate, range.endDate)
      : ['snapshots', 'pending'],
    queryFn: () => getSnapshots({ startDate: range!.startDate, endDate: range!.endDate }),
    enabled: Boolean(range),
  })

  const retry = useCallback(() => {
    void tenantQuery.refetch()
    void snapshotsQuery.refetch()
  }, [tenantQuery, snapshotsQuery])

  const forScreen = useCallback(
    (screen: ScreenKey | string) =>
      (snapshotsQuery.data?.snapshots ?? []).filter((s) => s.screen === screen),
    [snapshotsQuery.data?.snapshots],
  )

  const tenant = tenantQuery.data?.tenant ?? null
  const availableDays = snapshotsQuery.data?.availableDays ?? tenantQuery.data?.availableDays ?? []
  const latestDay = availableDays[0]?.day ?? null
  const snapshots = snapshotsQuery.data?.snapshots ?? []

  const freshness = useMemo(() => {
    if (!snapshots.length) return { day: latestDay, pulledAt: availableDays[0]?.pulledAt ?? null }
    const latest = snapshots.reduce((a, b) => (a.day >= b.day ? a : b))
    return { day: latest.day, pulledAt: latest.pulledAt }
  }, [snapshots, latestDay, availableDays])

  const bootLoading = tenantQuery.isLoading
  const bootError =
    tenantQuery.error instanceof Error
      ? tenantQuery.error.message
      : tenantQuery.error
        ? String(tenantQuery.error)
        : null

  if (bootLoading) {
    return (
      <div className="flex flex-col gap-3 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-3xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (bootError || !tenant) {
    return <ErrorState message={bootError ?? 'Unable to load tenant'} onRetry={retry} />
  }

  if (!range) {
    return (
      <ErrorState
        message="No snapshot days available for this tenant yet."
        onRetry={retry}
      />
    )
  }

  const loading = snapshotsQuery.isLoading
  const error =
    snapshotsQuery.error instanceof Error
      ? snapshotsQuery.error.message
      : snapshotsQuery.error
        ? String(snapshotsQuery.error)
        : null

  const value: SnapshotContextValue = {
    tenant,
    availableDays,
    latestDay,
    range,
    setRange,
    snapshots,
    loading,
    error,
    retry,
    forScreen,
    freshness,
  }

  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>
}

export function useSnapshots(): SnapshotContextValue {
  const ctx = useContext(SnapshotContext)
  if (!ctx) throw new Error('useSnapshots must be used within SnapshotProvider')
  return ctx
}
