import { keepPreviousData, useQuery } from '@tanstack/react-query'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  fetching: boolean
  error: string | null
  retry: () => void
}

export interface UseApiOptions {
  enabled?: boolean
  keepPreviousData?: boolean
}

/**
 * Cached async-data hook backed by TanStack Query. Returns cached data
 * instantly on remount when the query key matches a prior fetch.
 */
export function useApi<T>(
  queryKey: readonly unknown[],
  fetcher: () => Promise<T>,
  options: UseApiOptions = {},
): ApiState<T> {
  const { enabled = true, keepPreviousData: keepPrev = false } = options

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled,
    placeholderData: keepPrev ? keepPreviousData : undefined,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    fetching: isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    retry: () => {
      void refetch()
    },
  }
}
