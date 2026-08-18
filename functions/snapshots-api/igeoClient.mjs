/**
 * Server-only iGEO Public REST client.
 * Browser never sees the API key — the BFF injects Bearer + X-Workspace-Id.
 */
import { getTenantMcpKey, loadTenant } from './db.mjs'

export const IGEO_NOT_CONNECTED_MESSAGE =
  'This account is not connected to iGEO. Connect an API key (Carousel → Connect) or set IGEO_API_KEY.'

const META_CACHE_TTL_MS = 5 * 60 * 1000

/** @type {Map<string, { expiresAt: number, value: unknown }>} */
const metaCache = new Map()

export class IgeoApiError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string | null} [retryAfter]
   */
  constructor(message, statusCode, retryAfter = null) {
    super(message)
    this.name = 'IgeoApiError'
    this.statusCode = statusCode
    this.retryAfter = retryAfter
  }
}

function optionalEnv(name) {
  const value = process.env[name]?.trim()
  if (!value || value === 'undefined' || value === 'null') return null
  return value
}

export function getIgeoApiBase() {
  return (optionalEnv('IGEO_API_BASE') || 'https://api.igeo.ai').replace(/\/$/, '')
}

function httpError(status, path, retryAfter) {
  if (status === 401) {
    return new IgeoApiError('iGEO API key is missing, invalid, expired, or revoked.', 401, retryAfter)
  }
  if (status === 403) {
    return new IgeoApiError('iGEO denied this workspace, role, scope, or path.', 403, retryAfter)
  }
  if (status === 429) {
    const wait = retryAfter ? ` Retry after ${retryAfter}s.` : ''
    return new IgeoApiError(`iGEO rate limit reached.${wait}`, 429, retryAfter)
  }
  return new IgeoApiError(`iGEO request failed (${status}) for ${path}`, status, retryAfter)
}

/**
 * Resolve workspace id + API key for a tenant.
 * @param {import('pg').Pool | import('pg').Client} db
 * @param {string} tenantId
 * @returns {Promise<{ tenant: object, accountId: string, apiKey: string }>}
 */
export async function resolveIgeoCredentials(db, tenantId) {
  const tenant = await loadTenant(db, tenantId)
  if (!tenant) {
    const err = new IgeoApiError('Configured tenant was not found', 404)
    throw err
  }
  if (!tenant.enabled) {
    const err = new IgeoApiError('Configured tenant is disabled', 403)
    throw err
  }
  const apiKey = await getTenantMcpKey(db, tenantId)
  const accountId = tenant.source_account_id
  if (!apiKey || !accountId) {
    const err = new IgeoApiError(IGEO_NOT_CONNECTED_MESSAGE, 400)
    throw err
  }
  return { tenant, accountId, apiKey }
}

/**
 * @param {string} day YYYY-MM-DD
 */
export function toStartIso(day) {
  return `${day}T00:00:00.000Z`
}

/**
 * @param {string} day YYYY-MM-DD
 */
export function toEndIso(day) {
  return `${day}T23:59:59.999Z`
}

/**
 * Previous equal-length period ending the day before startDate.
 * @param {{ startDate: string, endDate: string }} range
 */
export function previousPeriod(range) {
  const start = new Date(`${range.startDate}T00:00:00.000Z`)
  const end = new Date(`${range.endDate}T00:00:00.000Z`)
  const spanDays = Math.floor((end - start) / 86400000) + 1
  const prevEnd = new Date(start)
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setUTCDate(prevStart.getUTCDate() - (spanDays - 1))
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  }
}

function appendList(params, key, values) {
  if (!Array.isArray(values)) return
  for (const value of values) {
    if (value == null || value === '') continue
    params.append(key, String(value))
  }
}

/**
 * Map Alora comma-list filters to iGEO repeat-array query params.
 * @param {object} filters parseGeoFilters result
 * @param {Record<string, string | number | undefined>} [extra]
 * @param {{ engines?: 'aiEngines' | 'providers' | 'both', includeRegions?: boolean }} [options]
 */
export function toIgeoQuery(filters, extra = {}, options = {}) {
  const params = new URLSearchParams()
  if (filters?.startDate) params.set('startDate', toStartIso(filters.startDate))
  if (filters?.endDate) params.set('endDate', toEndIso(filters.endDate))

  const engines = options.engines ?? 'both'
  if (engines === 'aiEngines' || engines === 'both') {
    appendList(params, 'aiEngines', filters?.providers)
  }
  if (engines === 'providers' || engines === 'both') {
    appendList(params, 'providers', filters?.providers)
  }
  appendList(params, 'topics', filters?.topics)
  appendList(params, 'promptIds', filters?.prompts)
  appendList(params, 'countries', filters?.regions)
  if (options.includeRegions) {
    appendList(params, 'regions', filters?.regions)
  }
  appendList(params, 'tags', filters?.tags)
  appendList(params, 'promptTypes', filters?.promptTypes)
  if (filters?.branded === 'AccountIncluded' || filters?.branded === 'AccountNotIncluded') {
    params.set('isCompanyInPrompt', filters.branded)
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === '') continue
    params.set(key, String(value))
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

function summarizeIgeoValue(value, depth = 0) {
  if (value == null) return value
  if (Array.isArray(value)) {
    const first = value[0]
    return {
      type: 'array',
      length: value.length,
      first:
        first && typeof first === 'object'
          ? { keys: Object.keys(first).slice(0, 12), sample: first }
          : first,
    }
  }
  if (typeof value !== 'object') return value
  if (depth >= 1) return { keys: Object.keys(value).slice(0, 20) }
  const keys = Object.keys(value)
  const nested = {}
  for (const key of keys.slice(0, 16)) {
    nested[key] = summarizeIgeoValue(value[key], depth + 1)
  }
  return { keys, nested }
}

/**
 * @param {string} accountId
 * @param {string} apiKey
 * @param {string} pathAndQuery path starting with /
 */
export async function igeoGet(accountId, apiKey, pathAndQuery) {
  const url = `${getIgeoApiBase()}${pathAndQuery}`
  const keyPrefix =
    typeof apiKey === 'string' && apiKey.startsWith('igeo_live_')
      ? `${apiKey.slice(0, 14)}…`
      : apiKey
        ? 'present-but-unexpected-prefix'
        : 'missing'
  console.info('[iGEO] GET', {
    path: pathAndQuery,
    workspaceId: accountId,
    keyPrefix,
    url,
  })
  let response
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Workspace-Id': accountId,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    throw new IgeoApiError(
      `Network error calling iGEO: ${err instanceof Error ? err.message : String(err)}`,
      502,
    )
  }

  const retryAfter = response.headers.get('retry-after')
  if (!response.ok) {
    if (response.status === 429 && retryAfter) {
      console.warn(`[iGEO] 429 ${pathAndQuery} Retry-After=${retryAfter}`)
    }
    let detail = ''
    try {
      const body = await response.json()
      detail =
        body?.title ||
        body?.description ||
        body?.message ||
        body?.error_description ||
        body?.error ||
        ''
    } catch {
      detail = await response.text().catch(() => '')
    }
    const suffix = detail ? `: ${String(detail).slice(0, 240)}` : ''
    console.warn(`[iGEO] ${response.status} ${pathAndQuery}${suffix}`)
    const err = httpError(response.status, pathAndQuery, retryAfter)
    err.message = `${err.message}${suffix}`
    throw err
  }

  if (response.status === 204) return null
  const body = await response.json()
  const unwrapped = unwrapIgeoBody(body)
  const didUnwrap = unwrapped !== body
  console.info('[iGEO] OK', {
    path: pathAndQuery,
    status: response.status,
    didUnwrap,
    raw: summarizeIgeoValue(body),
    unwrapped: didUnwrap ? summarizeIgeoValue(unwrapped) : undefined,
  })
  return unwrapped
}

/**
 * iGEO cache interceptor wraps payloads as
 * `{ data, computedAt, dataVersion, isLive }`. The iGEO web app reads
 * `response.data.data`; Alora adapters need the inner payload.
 *
 * @param {unknown} body
 */
export function unwrapIgeoBody(body) {
  let current = body
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return current
    if (
      current.data != null &&
      (current.computedAt != null || current.isLive != null || current.dataVersion != null)
    ) {
      current = current.data
      continue
    }
    break
  }
  return current
}

/**
 * Short in-process cache for stable meta endpoints (account, topics, tags).
 * @param {string} accountId
 * @param {string} apiKey
 * @param {string} pathAndQuery
 */
export async function igeoGetCached(accountId, apiKey, pathAndQuery) {
  const key = `${accountId}:${pathAndQuery}`
  const hit = metaCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value
  const value = await igeoGet(accountId, apiKey, pathAndQuery)
  metaCache.set(key, { value, expiresAt: Date.now() + META_CACHE_TTL_MS })
  return value
}

/**
 * @param {unknown} value
 * @returns {string | null} YYYY-MM-DD
 */
export function toIsoDay(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const text = String(value)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}
