import { apiGet } from './client'
import type { Account } from '../store/useAccountStore'

export interface AccountsResponse {
  accounts: Account[]
}

export async function getAccounts(): Promise<Account[]> {
  const response = await apiGet<AccountsResponse>('/accounts')
  return response.accounts
}
