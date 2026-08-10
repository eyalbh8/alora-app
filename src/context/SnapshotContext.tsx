import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
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
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [availableDays, setAvailableDays] = useState<AvailableDay[]>([])
  const [range, setRange] = useState<DateRange | null>(null)
  const [snapshots, setSnapshots] = useState<ScreenSnapshot[]>([])
  const [bootError, setBootError] = useState<string | null>(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const latestDay = availableDays[0]?.day ?? null

  // Bootstrap tenant + available days
  useEffect(() => {
    let cancelled = false
    setBootLoading(true)
    getTenant()
      .then((res) => {
        if (cancelled) return
        setTenant(res.tenant)
        setAvailableDays(res.availableDays)
        const end = res.availableDays[0]?.day
        if (end) {
          setRange(lastNDaysEnding(1, end))
        } else {
          setBootError('No snapshot days available for this tenant yet.')
        }
        setBootLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setBootError(err instanceof Error ? err.message : String(err))
        setBootLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Load snapshots whenever range changes
  useEffect(() => {
    if (!range) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getSnapshots({ startDate: range.startDate, endDate: range.endDate })
      .then((res) => {
        if (cancelled) return
        setSnapshots(res.snapshots)
        setAvailableDays(res.availableDays)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const forScreen = useCallback(
    (screen: ScreenKey | string) => snapshots.filter((s) => s.screen === screen),
    [snapshots],
  )

  const freshness = useMemo(() => {
    if (!snapshots.length) return { day: latestDay, pulledAt: availableDays[0]?.pulledAt ?? null }
    const latest = snapshots.reduce((a, b) => (a.day >= b.day ? a : b))
    return { day: latest.day, pulledAt: latest.pulledAt }
  }, [snapshots, latestDay, availableDays])

  if (bootLoading) {
    return (
      <div className="flex flex-col gap-3 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-3xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (bootError || !tenant || !range) {
    return <ErrorState message={bootError ?? 'Unable to load tenant'} onRetry={retry} />
  }

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
