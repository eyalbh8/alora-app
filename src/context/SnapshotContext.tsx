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
import { getTenant } from '../api/snapshots'
import type { AvailableDay, ScreenKey, ScreenSnapshot, TenantInfo } from '../api/types'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/LoadingSpinner'
import { lastNDaysEnding, yesterdayISO, type DateRange } from '../lib/dates'
import { useAccountStore } from '../store/useAccountStore'

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
  const { selectedAccount } = useAccountStore()

  const tenantQuery = useQuery({
    queryKey: queryKeys.tenant(selectedAccount?.id),
    queryFn: getTenant,
    enabled: Boolean(selectedAccount),
  })

  useEffect(() => {
    if (!tenantQuery.data || range) return
    const end = tenantQuery.data.availableDays[0]?.day ?? yesterdayISO()
    setRange(lastNDaysEnding(7, end))
  }, [tenantQuery.data, range])

  const retry = useCallback(() => {
    void tenantQuery.refetch()
  }, [tenantQuery])

  const forScreen = useCallback((_screen: ScreenKey | string) => [] as ScreenSnapshot[], [])

  const tenant = tenantQuery.data?.tenant ?? null
  const availableDays = tenantQuery.data?.availableDays ?? []
  const latestDay = availableDays[0]?.day ?? yesterdayISO()
  const snapshots: ScreenSnapshot[] = []

  const freshness = useMemo(
    () => ({ day: latestDay, pulledAt: availableDays[0]?.pulledAt ?? null }),
    [latestDay, availableDays],
  )

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

  const activeRange = range ?? lastNDaysEnding(7, latestDay)

  const value: SnapshotContextValue = {
    tenant,
    availableDays,
    latestDay,
    range: activeRange,
    setRange,
    snapshots,
    loading: false,
    error: null,
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
