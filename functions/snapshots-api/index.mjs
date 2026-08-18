/**
 * Read-only whitelabel snapshot API for AWS Amplify / Lambda Function URL.
 *
 * Browser → Amplify rewrite `/api/snapshots/*` → this function → upstream Public API
 * Requires Descope JWT auth; tenant selected via X-Alora-Tenant-Id header.
 */
import { getPool, loadSnapshots, loadTenant, SCREEN_KEYS } from './db.mjs'
import {
  geoCompetitors,
  geoCrawlers,
  geoDashboard,
  geoMentions,
  geoMeta,
  geoPrompts,
  geoTags,
  geoCreateTag,
  geoSetPromptTags,
  geoDeleteTag,
  geoProviderMentionPrompts,
  geoResponseDetail,
  geoResponses,
  geoSentiment,
  geoTenantScanDays,
  geoTraffic,
} from './geo.mjs'
import { verifyToken, upsertUser, canAccessTenant } from './auth.mjs'
import { connectFirstAccount, listAccessibleTenants } from './accounts.mjs'

function corsHeaders(requestHeaders = {}) {
  const allowed = process.env.ALLOWED_ORIGIN || '*'
  const origin = requestHeaders.origin || requestHeaders.Origin || allowed
  const allowOrigin = allowed === '*' ? origin || '*' : allowed
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':
      requestHeaders['access-control-request-headers'] || 'Content-Type, Authorization, X-Alora-Tenant-Id',
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

function parseJsonBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  if (typeof raw !== 'string' || !raw.trim()) return {}
  return JSON.parse(raw)
}

export const handler = async (event) => {
  const requestHeaders = event.headers || {}
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(requestHeaders), body: '' }
  }
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    return json(405, { error: 'Method not allowed' }, requestHeaders)
  }

  try {
    const db = getPool()
    const path = parsePath(event)
    const q = queryParams(event)

    if (path === '/' || path === '/health') {
      return json(200, { ok: true, screens: SCREEN_KEYS }, requestHeaders)
    }

    // All other routes require authentication
    const authHeader = getHeader(requestHeaders, 'authorization')
    let authUser
    try {
      authUser = await verifyToken(authHeader)
    } catch (err) {
      return json(401, { error: 'Unauthorized: ' + err.message }, requestHeaders)
    }

    // Upsert user record
    const user = await upsertUser(db, authUser)

    if (path === '/accounts' && method === 'GET') {
      const accounts = await listAccessibleTenants(db, user.id, user.isAdmin)
      return json(200, { accounts }, requestHeaders)
    }

    if (path === '/accounts' && method === 'POST') {
      const body = parseJsonBody(event)
      const connectionUrl = typeof body.connectionUrl === 'string' ? body.connectionUrl : ''
      const account = await connectFirstAccount(db, user, connectionUrl)
      return json(201, { account }, requestHeaders)
    }

    const promptTagsMatch = path.match(/^\/geo\/prompts\/([^/]+)\/tags$/)
    const deleteTagMatch = path.match(/^\/geo\/tags\/([^/]+)$/)
    const isTagWrite =
      (method === 'POST' && path === '/geo/tags') ||
      (method === 'PATCH' && Boolean(promptTagsMatch)) ||
      (method === 'DELETE' && Boolean(deleteTagMatch))

    if (method !== 'GET' && !isTagWrite) {
      return json(405, { error: 'Method not allowed' }, requestHeaders)
    }

    // All data routes require X-Alora-Tenant-Id header
    const tenantId = getHeader(requestHeaders, 'x-alora-tenant-id')
    if (!tenantId) {
      return json(400, { error: 'Missing X-Alora-Tenant-Id header' }, requestHeaders)
    }

    // Check membership/access
    const hasAccess = await canAccessTenant(db, user.id, tenantId, user.isAdmin)
    if (!hasAccess) {
      return json(403, { error: 'Forbidden: no access to this tenant' }, requestHeaders)
    }

    if (path === '/tenant') {
      const tenant = await loadTenant(db, tenantId)
      if (!tenant) return json(404, { error: 'Configured tenant was not found' }, requestHeaders)
      if (!tenant.enabled) return json(403, { error: 'Configured tenant is disabled' }, requestHeaders)
      let availableDays = []
      try {
        availableDays = await geoTenantScanDays(db, tenantId)
      } catch (err) {
        if (err?.statusCode !== 400) throw err
      }
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

    if (path === '/traffic') {
      return json(200, await geoTraffic(db, tenantId, q), requestHeaders)
    }

    if (path === '/crawlers') {
      return json(200, await geoCrawlers(db, tenantId, q), requestHeaders)
    }

    // GEO aggregation endpoints proxied to the live upstream Public API.
    if (path.startsWith('/geo/')) {
      const providerPromptsMatch = path.match(/^\/geo\/provider-mentions\/([^/]+)\/prompts$/)
      const responseDetailMatch = path.match(/^\/geo\/responses\/([^/]+)$/)
      if (method === 'GET' && path === '/geo/tags') {
        return json(200, await geoTags(db, tenantId), requestHeaders)
      }
      if (method === 'POST' && path === '/geo/tags') {
        return json(201, await geoCreateTag(db, tenantId, parseJsonBody(event)), requestHeaders)
      }
      if (method === 'PATCH' && promptTagsMatch) {
        return json(
          200,
          await geoSetPromptTags(db, tenantId, decodeURIComponent(promptTagsMatch[1]), parseJsonBody(event)),
          requestHeaders,
        )
      }
      if (method === 'DELETE' && deleteTagMatch) {
        return json(200, await geoDeleteTag(db, tenantId, decodeURIComponent(deleteTagMatch[1])), requestHeaders)
      }
      const geoHandlers = {
        '/geo/meta': () => geoMeta(db, tenantId),
        '/geo/dashboard': () => geoDashboard(db, tenantId, q),
        '/geo/mentions': () => geoMentions(db, tenantId, q),
        '/geo/sentiment': () => geoSentiment(db, tenantId, q),
        '/geo/prompts': () => geoPrompts(db, tenantId, q),
        '/geo/tags': () => geoTags(db, tenantId),
        '/geo/competitors': () => geoCompetitors(db, tenantId, q),
        '/geo/responses': () => geoResponses(db, tenantId, q),
      }
      const geoHandler =
        providerPromptsMatch
          ? () => geoProviderMentionPrompts(db, tenantId, q, decodeURIComponent(providerPromptsMatch[1]))
          : responseDetailMatch
            ? () => geoResponseDetail(db, tenantId, decodeURIComponent(responseDetailMatch[1]))
            : geoHandlers[path]
      if (!geoHandler) return json(404, { error: `Unknown path ${path}` }, requestHeaders)
      return json(200, await geoHandler(), requestHeaders)
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
