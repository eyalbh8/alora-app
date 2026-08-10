/**
 * Read-only whitelabel snapshot API for AWS Amplify / Lambda Function URL.
 *
 * Browser → Amplify rewrite `/api/snapshots/*` → this function → Postgres
 * Tenant is fixed via WHITELABEL_TENANT_ID (never accepted from the client).
 */
import { getPool, getTenantId, loadSnapshots, loadTenant, listAvailableDays, SCREEN_KEYS } from './db.mjs'

function corsHeaders(requestHeaders = {}) {
  const allowed = process.env.ALLOWED_ORIGIN || '*'
  const origin = requestHeaders.origin || requestHeaders.Origin || allowed
  const allowOrigin = allowed === '*' ? origin || '*' : allowed
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers':
      requestHeaders['access-control-request-headers'] || 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function getHeader(headers, name) {
  if (!headers) return undefined
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

function json(statusCode, body, requestHeaders) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(requestHeaders),
    },
    body: JSON.stringify(body),
  }
}

function parsePath(event) {
  const rawPath = event.rawPath || event.path || '/'
  const stripped = rawPath.replace(/^\/api\/snapshots/, '') || '/'
  return stripped.split('?')[0]
}

function queryParams(event) {
  if (event.queryStringParameters) return event.queryStringParameters
  if (event.rawQueryString) return Object.fromEntries(new URLSearchParams(event.rawQueryString))
  return {}
}

export const handler = async (event) => {
  const requestHeaders = event.headers || {}
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(requestHeaders), body: '' }
  }
  if (method !== 'GET') {
    return json(405, { error: 'Method not allowed' }, requestHeaders)
  }

  try {
    const db = getPool()
    const tenantId = getTenantId()
    const path = parsePath(event)
    const q = queryParams(event)

    if (path === '/' || path === '/health') {
      return json(200, { ok: true, screens: SCREEN_KEYS }, requestHeaders)
    }

    if (path === '/tenant') {
      const tenant = await loadTenant(db, tenantId)
      if (!tenant) return json(404, { error: 'Configured tenant was not found' }, requestHeaders)
      if (!tenant.enabled) return json(403, { error: 'Configured tenant is disabled' }, requestHeaders)
      const availableDays = await listAvailableDays(db, tenantId)
      return json(
        200,
        {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            sourceAccountId: tenant.source_account_id,
          },
          availableDays,
        },
        requestHeaders,
      )
    }

    if (path === '/snapshots') {
      const screens = q.screens
        ? String(q.screens)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined
      const data = await loadSnapshots(db, tenantId, {
        startDate: q.startDate || q.day,
        endDate: q.endDate || q.day || q.startDate,
        screens,
      })
      return json(200, data, requestHeaders)
    }

    return json(404, { error: `Unknown path ${path}` }, requestHeaders)
  } catch (err) {
    const status = err?.statusCode || 500
    const message = err instanceof Error ? err.message : String(err)
    console.error('snapshots-api error', message)
    return json(status, { error: message }, requestHeaders)
  }
}

// unused but keeps bundlers from tree-shaking getHeader if reused later
void getHeader
