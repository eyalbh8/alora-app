import { apiGet } from './client'
import type { AiCrawlersPayload, AiTrafficPayload, GeoFilters } from './types'

function filtersToQuery(filters: GeoFilters): string {
  const q = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate })
  if (filters.providers.length) q.set('providers', filters.providers.join(','))
  if (filters.regions.length) q.set('regions', filters.regions.join(','))
  return q.toString()
}

export function getTraffic(filters: GeoFilters): Promise<AiTrafficPayload> {
  return apiGet<AiTrafficPayload>(`/traffic?${filtersToQuery(filters)}`)
}

export function getCrawlers(filters: GeoFilters): Promise<AiCrawlersPayload> {
  return apiGet<AiCrawlersPayload>(`/crawlers?${filtersToQuery(filters)}`)
}
