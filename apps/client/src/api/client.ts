import { API_BASE_PATH } from '../config'
import { getSessionToken } from '@descope/react-sdk'
import { useAccountStore } from '../store/useAccountStore'

/** Typed error for snapshot API failures. */
export class SnapshotApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'SnapshotApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const token = getSessionToken()
    const selectedAccount = useAccountStore.getState().selectedAccount
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (token) {
      headers.Authorization = `Bearer ${token}`
      // Amplify Hosting strips Authorization on external rewrites; custom header is forwarded.
      headers['X-Alora-Authorization'] = `Bearer ${token}`
    }
    
    if (selectedAccount?.id) {
      headers['X-Alora-Tenant-Id'] = selectedAccount.id
    }
    
    response = await fetch(`${API_BASE_PATH}${path}`, { ...init, headers })
  } catch (err) {
    throw new SnapshotApiError(
      `Network error calling Alora API: ${err instanceof Error ? err.message : String(err)}. Is the dev server running?`,
    )
  }

  if (!response.ok) {
    let detail = response.statusText
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      // ignore
    }
    throw new SnapshotApiError(`Snapshot API error ${response.status}: ${detail}`, response.status)
  }

  return (await response.json()) as T
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
