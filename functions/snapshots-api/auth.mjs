/**
 * Descope JWT authentication for snapshots-api.
 * Verifies session tokens and upserts wl_users on first authenticated request.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'

const DESCOPE_API = 'https://api.descope.com'

function getProjectId() {
  const id = process.env.DESCOPE_PROJECT_ID
  if (!id) throw new Error('DESCOPE_PROJECT_ID is not configured')
  return id
}

let jwksCache = null
let jwksProjectId = null

function getJWKS(projectId) {
  if (!jwksCache || jwksProjectId !== projectId) {
    jwksProjectId = projectId
    jwksCache = createRemoteJWKSet(new URL(`${DESCOPE_API}/v2/keys/${projectId}`))
  }
  return jwksCache
}

function extractBearer(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.substring(7).trim()
  if (!token) throw new Error('Missing JWT token')
  return token
}

function claimsFromPayload(payload) {
  const email =
    payload.email ||
    payload.emailAddress ||
    (Array.isArray(payload.emails) ? payload.emails[0] : null) ||
    payload['descope']?.email ||
    null
  const name =
    payload.name ||
    payload.given_name ||
    [payload.givenName, payload.familyName].filter(Boolean).join(' ') ||
    null
  return {
    userId: payload.sub,
    email: email ? String(email) : null,
    name: name ? String(name) : null,
  }
}

/**
 * Fetch email/name from Descope /v1/auth/me (session JWT often omits email).
 */
async function fetchDescopeUser(projectId, token) {
  try {
    const response = await fetch(`${DESCOPE_API}/v1/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${projectId}:${token}`,
      },
    })
    if (!response.ok) return null
    const body = await response.json()
    const user = body.user || body
    return {
      userId: user.userId || user.user_id || null,
      email: user.email || user.loginIds?.[0] || user.loginId || null,
      name: user.name || user.givenName || null,
    }
  } catch (err) {
    console.warn('[auth] Descope /me failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Verify Descope JWT from Authorization header.
 * @param {string} authHeader - "Bearer <token>"
 * @returns {Promise<{userId: string, email: string, name?: string}>}
 */
export async function verifyToken(authHeader) {
  const token = extractBearer(authHeader)
  const projectId = getProjectId()

  let payload
  try {
    const { payload: verified } = await jwtVerify(token, getJWKS(projectId), {
      // Descope session JWTs use the project ID as iss (not the API URL).
      issuer: [projectId, `${DESCOPE_API}/${projectId}`, `${DESCOPE_API}/v1/apps/${projectId}`],
    })
    payload = verified
  } catch (err) {
    throw new Error(`JWT verification failed: ${err.message}`)
  }

  if (!payload.sub) {
    throw new Error('JWT missing sub (user id)')
  }

  const fromJwt = claimsFromPayload(payload)
  let email = fromJwt.email
  let name = fromJwt.name
  let userId = fromJwt.userId

  if (!email) {
    const fromMe = await fetchDescopeUser(projectId, token)
    if (fromMe) {
      userId = fromMe.userId || userId
      email = fromMe.email || email
      name = fromMe.name || name
    }
  }

  if (!email) {
    email = `${userId}@descope.local`
  }

  return { userId, email, name: name || null }
}

/**
 * Upsert user record in wl_users on first authenticated request.
 * @param {import('pg').Pool} db
 * @param {{userId: string, email: string, name?: string}} user
 * @returns {Promise<{id: string, email: string, name: string|null, isAdmin: boolean}>}
 */
export async function upsertUser(db, user) {
  const existing = await db.query(`SELECT COUNT(*)::int AS count FROM wl_users`)
  const isFirstUser = existing.rows[0]?.count === 0

  const result = await db.query(
    `INSERT INTO wl_users (id, email, name, is_admin)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET email = EXCLUDED.email,
           name = COALESCE(EXCLUDED.name, wl_users.name),
           updated_at = now()
     RETURNING id, email, name, is_admin`,
    [user.userId, user.email, user.name || null, isFirstUser],
  )
  const row = result.rows[0]
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: row.is_admin,
  }
}

/**
 * Check if user can access the given tenant.
 * @param {import('pg').Pool} db
 * @param {string} userId
 * @param {string} tenantId
 * @param {boolean} isAdmin
 * @returns {Promise<boolean>}
 */
export async function canAccessTenant(db, userId, tenantId, isAdmin) {
  if (isAdmin) {
    const result = await db.query(
      `SELECT 1 FROM whitelabel_tenants WHERE id = $1 AND enabled = true`,
      [tenantId],
    )
    return result.rows.length > 0
  }

  const result = await db.query(
    `SELECT 1 FROM wl_user_tenants
     WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId],
  )
  return result.rows.length > 0
}
