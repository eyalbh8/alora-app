import { useQuery } from '@tanstack/react-query'

export interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  retry: () => void
}

export interface UseApiOptions {
  enabled?: boolean
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
  const { enabled = true } = options

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    retry: () => {
      void refetch()
    },
  }
}
