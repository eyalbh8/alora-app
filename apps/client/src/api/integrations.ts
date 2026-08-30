import { apiGet, apiSend } from './client'

export type IntegrationSocialAccount = {
  id: string
  username: string | null
  displayName: string | null
  status: string
  connectedAt: string
}

export type IntegrationSocialRow = {
  platform: string
  zernioPlatform: string
  connected: boolean
  account: IntegrationSocialAccount | null
}

export type IntegrationBlogSite = {
  id: string
  name: string
  url?: string | null
}

export type IntegrationBlogProvider = {
  provider: 'wordpress' | 'lovable' | 'shopify' | string
  managedBy: 'igeo' | 'zernio' | string
  connected: boolean
  sites: IntegrationBlogSite[]
  account: {
    id: string
    username?: string | null
    displayName?: string | null
  } | null
}

export type IntegrationsPayload = {
  social: IntegrationSocialRow[]
  blog: IntegrationBlogProvider[]
  connectablePlatforms: string[]
}

export type IgeoBlogConnectResult = {
  managedBy: 'igeo'
  provider: string
  connected: boolean
  sites: IntegrationBlogSite[]
  authUrl?: string
  message?: string
}

export async function getIntegrations(): Promise<IntegrationsPayload> {
  return apiGet<IntegrationsPayload>('/integrations')
}

export async function connectPlatform(
  platform: string,
): Promise<{ authUrl: string }> {
  return apiSend<{ authUrl: string }>(
    `/integrations/connect/${encodeURIComponent(platform)}`,
    'POST',
  )
}

export async function connectShopify(
  shop: string,
): Promise<{ authUrl: string }> {
  return apiSend<{ authUrl: string }>('/integrations/connect/shopify', 'POST', {
    shop,
  })
}

export async function connectBlogProvider(
  provider: 'wordpress' | 'lovable',
): Promise<IgeoBlogConnectResult> {
  return apiSend<IgeoBlogConnectResult>(
    `/integrations/connect/blog/${encodeURIComponent(provider)}`,
    'POST',
  )
}

export async function disconnectAccount(
  accountId: string,
): Promise<{ ok: boolean }> {
  return apiSend<{ ok: boolean }>(
    `/integrations/accounts/${encodeURIComponent(accountId)}`,
    'DELETE',
  )
}
