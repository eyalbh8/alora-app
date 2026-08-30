import type { GeoFilters } from './types'

export const queryKeys = {
  accounts: ['accounts'] as const,
  me: ['me'] as const,
  tenant: (accountId?: string) => ['tenant', accountId] as const,
  snapshots: (accountId: string | undefined, start: string, end: string) =>
    ['snapshots', accountId, start, end] as const,
  dailyContent: {
    runs: (accountId?: string, take?: number) =>
      ['dailyContent', 'runs', accountId, take] as const,
    days: (accountId?: string, take?: number) =>
      ['dailyContent', 'days', accountId, take] as const,
    dayPosts: (accountId: string | undefined, date: string) =>
      ['dailyContent', 'dayPosts', accountId, date] as const,
    runPosts: (accountId: string | undefined, runId: string) =>
      ['dailyContent', 'runPosts', accountId, runId] as const,
    settings: (accountId?: string) => ['dailyContent', 'settings', accountId] as const,
    publishTargets: (accountId?: string) =>
      ['dailyContent', 'publishTargets', accountId] as const,
    blogSiteCategories: (accountId: string | undefined, siteId: string) =>
      ['dailyContent', 'blogSiteCategories', accountId, siteId] as const,
  },
  integrations: {
    list: (accountId?: string) => ['integrations', accountId] as const,
  },
  geo: {
    meta: (accountId?: string) => ['geo', 'meta', accountId] as const,
    dashboard: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'dashboard', accountId, filters] as const,
    prompts: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'prompts', accountId, filters] as const,
    tags: (accountId?: string) => ['geo', 'tags', accountId] as const,
    mentions: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'mentions', accountId, filters] as const,
    sentiment: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'sentiment', accountId, filters] as const,
    competitors: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'competitors', accountId, filters] as const,
    marketplace: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'marketplace', accountId, filters] as const,
    citations: (accountId: string | undefined, filters: GeoFilters) =>
      ['geo', 'citations', accountId, filters] as const,
    citationDomain: (accountId: string | undefined, domain: string, filters: GeoFilters) =>
      ['geo', 'citations', 'domain', accountId, domain, filters] as const,
    citationUrlDetail: (accountId: string | undefined, url: string, filters: GeoFilters) =>
      ['geo', 'citations', 'url', accountId, url, filters] as const,
    responses: (
      accountId: string | undefined,
      filters: GeoFilters,
      pagination?: { skip?: number; take?: number; sentiment?: boolean }
    ) => ['geo', 'responses', accountId, filters, pagination] as const,
    responseDetail: (accountId: string | undefined, id: string) =>
      ['geo', 'response', accountId, id] as const,
    providerPrompts: (accountId: string | undefined, provider: string, filters: GeoFilters) =>
      ['geo', 'providerPrompts', accountId, provider, filters] as const,
  },
  traffic: (accountId: string | undefined, filters: GeoFilters) =>
    ['traffic', accountId, filters] as const,
  crawlers: (accountId: string | undefined, filters: GeoFilters) =>
    ['crawlers', 'source-range', accountId, filters] as const,
}
