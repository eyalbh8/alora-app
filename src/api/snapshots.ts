import { apiGet } from './client'
import type { ScreenKey, SnapshotsResponse, TenantResponse } from './types'

export function getTenant(): Promise<TenantResponse> {
  return apiGet<TenantResponse>('/tenant')
}

export function getSnapshots(params: {
  startDate: string
  endDate: string
  screens?: ScreenKey[]
}): Promise<SnapshotsResponse> {
  const q = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  })
  if (params.screens?.length) q.set('screens', params.screens.join(','))
  return apiGet<SnapshotsResponse>(`/snapshots?${q.toString()}`)
}
