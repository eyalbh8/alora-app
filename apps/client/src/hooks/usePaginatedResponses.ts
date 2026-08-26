import { useEffect, useState } from 'react'
import { getGeoResponses } from '../api/geo'
import { queryKeys } from '../api/queryKeys'
import type { ResponseRow } from '../api/types'
import { type PageSize } from '../components/TablePagination'
import { useAnalyticsFilters } from '../context/AnalyticsFiltersContext'
import { useGeoMeta } from '../context/GeoMetaContext'
import { useAccountStore } from '../store/useAccountStore'
import { useApi } from './useApi'

export function usePaginatedResponses(options?: { sentiment?: boolean }) {
  const { selectedAccount } = useAccountStore()
  const { geoMode } = useGeoMeta()
  const { filters } = useAnalyticsFilters()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)

  useEffect(() => {
    setPage(1)
  }, [filters, pageSize])

  const skip = (page - 1) * pageSize
  const pagination = { skip, take: pageSize, sentiment: options?.sentiment }

  const state = useApi(
    queryKeys.geo.responses(selectedAccount?.id, filters, pagination),
    () => getGeoResponses(filters, pagination),
    { enabled: geoMode, keepPreviousData: true },
  )

  const rows = (state.data?.data.responses ?? []) as unknown as ResponseRow[]
  const total = state.data?.data.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize
  const pageEnd = pageStart + rows.length

  return {
    rows,
    total,
    page: currentPage,
    pageSize,
    setPage,
    setPageSize,
    pageStart,
    pageEnd,
    totalPages,
    loading: state.loading,
    fetching: state.fetching,
    error: state.error,
    retry: state.retry,
    pending: state.loading && state.data == null,
  }
}
