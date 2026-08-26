import { apiGet } from './client'
import type { TenantResponse } from './types'

export function getTenant(): Promise<TenantResponse> {
  return apiGet<TenantResponse>('/tenant')
}
