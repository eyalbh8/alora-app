import { getSessionToken } from '@descope/react-sdk'
import { API_BASE_PATH } from '../config'
import { apiGet } from './client'
import type { Account } from '../store/useAccountStore'

export interface AccountsResponse {
  accounts: Account[]
}

export type CurrentUser = {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
}

export async function getMe(): Promise<CurrentUser> {
  const response = await apiGet<{ user: CurrentUser }>('/me')
  return response.user
}

export async function getAccounts(): Promise<Account[]> {
  const response = await apiGet<AccountsResponse>('/accounts')
  return response.accounts
}

export async function createFirstAccount(connectionUrl: string): Promise<Account> {
  const token = getSessionToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
    headers['X-Alora-Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_PATH}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ connectionUrl }),
  })
  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  const body = (await response.json()) as { account: Account }
  return body.account
}
