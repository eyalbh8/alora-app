import { API_BASE_PATH } from '../config'

/** Typed error for snapshot API failures. */
export class SnapshotApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'SnapshotApiError'
    this.status = status
  }
}

async function request<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_PATH}${path}`)
  } catch (err) {
    throw new SnapshotApiError(
      `Network error calling snapshot API: ${err instanceof Error ? err.message : String(err)}. Is the dev server running?`,
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
