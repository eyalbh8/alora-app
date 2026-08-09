import { API_BASE_PATH } from '../config'

/** Typed error thrown for any non-2xx AirOps API response or network failure. */
export class AirOpsApiError extends Error {
  readonly status: number | null
  readonly validationErrors: unknown

  constructor(message: string, status: number | null = null, validationErrors: unknown = null) {
    super(message)
    this.name = 'AirOpsApiError'
    this.status = status
    this.validationErrors = validationErrors
  }
}

const STATUS_HINTS: Record<number, string> = {
  400: 'Invalid filter, operator, or sort field.',
  401: 'Missing or invalid API key — check your .env file.',
  404: "Endpoint or Brand Kit not found, or you don't have access.",
  412: 'AEO is not configured for this Brand Kit.',
  422: 'Invalid analytics query (end_date must be before today, max 3 dimensions, grain range limits).',
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, init)
  } catch (err) {
    throw new AirOpsApiError(
      `Network error calling AirOps API: ${err instanceof Error ? err.message : String(err)}. Is the dev server proxy running?`,
    )
  }

  if (!response.ok) {
    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // non-JSON error body — ignore
    }
    const bodyObj = body as { message?: string; error?: string; validation_errors?: unknown } | null
    const detail = bodyObj?.message ?? bodyObj?.error ?? STATUS_HINTS[response.status] ?? response.statusText
    throw new AirOpsApiError(
      `AirOps API error ${response.status}: ${detail}`,
      response.status,
      bodyObj?.validation_errors ?? null,
    )
  }

  return (await response.json()) as T
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}
