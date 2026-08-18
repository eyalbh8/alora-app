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

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isAdmin: row.is_admin,
  }
}

/**
 * Run fn in a transaction. Uses a dedicated pool client so BEGIN/COMMIT stay on one connection.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {(client: import('pg').Pool | import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withTransaction(db, fn) {
  const client = typeof db.connect === 'function' ? await db.connect() : db
  const shouldRelease = client !== db
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failure
    }
    throw err
  } finally {
    if (shouldRelease) client.release()
  }
}

/**
 * Upsert user record in wl_users on first authenticated request.
 * Pre-provisioned users (inserted by email before first login) are claimed:
 * their pending id is replaced with the Descope id and memberships are kept.
 * @param {import('pg').Pool} db
 * @param {{userId: string, email: string, name?: string}} user
 * @returns {Promise<{id: string, email: string, name: string|null, isAdmin: boolean}>}
 */
export async function upsertUser(db, user) {
  const email = user.email ? String(user.email).trim().toLowerCase() : null
  if (!email) {
    throw new Error('User email is required')
  }

  const existing = await db.query(`SELECT COUNT(*)::int AS count FROM wl_users`)
  const isFirstUser = existing.rows[0]?.count === 0

  return withTransaction(db, async (client) => {
    const byId = await client.query(
      `SELECT id, email, name, is_admin FROM wl_users WHERE id = $1`,
      [user.userId],
    )
    if (byId.rows[0]) {
      const result = await client.query(
        `UPDATE wl_users
         SET email = $2,
             name = COALESCE($3, name),
             updated_at = now()
         WHERE id = $1
         RETURNING id, email, name, is_admin`,
        [user.userId, email, user.name || null],
      )
      return mapUserRow(result.rows[0])
    }

    const byEmail = await client.query(
      `SELECT id, is_admin FROM wl_users WHERE lower(email) = $1`,
      [email],
    )
    if (byEmail.rows[0]) {
      const oldId = byEmail.rows[0].id
      const isAdmin = byEmail.rows[0].is_admin
      // Insert first (temp email) so membership FKs can move, then drop the pending row.
      await client.query(
        `INSERT INTO wl_users (id, email, name, is_admin)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, `${user.userId}@descope.pending`, user.name || null, isAdmin],
      )
      await client.query(`UPDATE wl_user_tenants SET user_id = $1 WHERE user_id = $2`, [
        user.userId,
        oldId,
      ])
      await client.query(`DELETE FROM wl_users WHERE id = $1`, [oldId])
      const result = await client.query(
        `UPDATE wl_users
         SET email = $2,
             name = COALESCE($3, name),
             updated_at = now()
         WHERE id = $1
         RETURNING id, email, name, is_admin`,
        [user.userId, email, user.name || null],
      )
      return mapUserRow(result.rows[0])
    }

    const result = await client.query(
      `INSERT INTO wl_users (id, email, name, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, is_admin`,
      [user.userId, email, user.name || null, isFirstUser],
    )
    return mapUserRow(result.rows[0])
  })
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
