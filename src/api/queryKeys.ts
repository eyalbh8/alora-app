import type { GeoFilters } from './types'

export const queryKeys = {
  tenant: ['tenant'] as const,
  snapshots: (start: string, end: string) => ['snapshots', start, end] as const,
  geo: {
    meta: ['geo', 'meta'] as const,
    dashboard: (filters: GeoFilters) => ['geo', 'dashboard', filters] as const,
    prompts: (filters: GeoFilters) => ['geo', 'prompts', filters] as const,
    mentionsAndResponses: (filters: GeoFilters) => ['geo', 'mentionsAndResponses', filters] as const,
    sentimentAndResponses: (filters: GeoFilters) => ['geo', 'sentimentAndResponses', filters] as const,
    competitors: (filters: GeoFilters) => ['geo', 'competitors', filters] as const,
    responses: (filters: GeoFilters, pagination?: { skip?: number; take?: number }) =>
      ['geo', 'responses', filters, pagination] as const,
    responseDetail: (id: string) => ['geo', 'response', id] as const,
    providerPrompts: (provider: string, filters: GeoFilters) =>
      ['geo', 'providerPrompts', provider, filters] as const,
  },
}
