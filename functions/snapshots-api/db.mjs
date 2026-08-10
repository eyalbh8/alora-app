import pg from 'pg'

const SCREEN_KEYS = [
  'dashboard',
  'dashboard_top_sources',
  'prompts',
  'topics',
  'mentions_chart',
  'mentions_sentiment',
  'sentiment',
  'sentiment_historical',
  'competitors',
  'ai_traffic',
  'ai_crawlers',
]

/** @type {pg.Pool | null} */
let pool = null

export function getPool() {
  if (pool) return pool
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL is not configured')
  const connectionString = raw.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '')
  pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
  })
  return pool
}

export function getTenantId() {
  const id = process.env.WHITELABEL_TENANT_ID
  if (!id) throw new Error('WHITELABEL_TENANT_ID is not configured')
  return id
}

export function isoDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

export function daysInclusive(start, end) {
  const a = new Date(`${start}T00:00:00Z`)
  const b = new Date(`${end}T00:00:00Z`)
  return Math.floor((b - a) / 86400000) + 1
}

export async function loadTenant(db, tenantId) {
  const { rows } = await db.query(
    `SELECT id, source_account_id, name, domain, enabled
     FROM whitelabel_tenants
     WHERE id = $1`,
    [tenantId],
  )
  return rows[0] ?? null
}

export async function listAvailableDays(db, tenantId) {
  const { rows } = await db.query(
    `SELECT er.day::text AS day,
            er.status,
            er.finished_at,
            er.error_summary,
            MAX(ss.pulled_at) AS pulled_at
     FROM whitelabel_export_runs er
     LEFT JOIN whitelabel_screen_snapshots ss
       ON ss.tenant_id = er.tenant_id AND ss.day = er.day
     WHERE er.tenant_id = $1
     GROUP BY er.day, er.status, er.finished_at, er.error_summary
     ORDER BY er.day DESC`,
    [tenantId],
  )
  return rows.map((r) => ({
    day: r.day,
    status: r.status,
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    errorSummary: r.error_summary ?? null,
    pulledAt: r.pulled_at ? new Date(r.pulled_at).toISOString() : null,
  }))
}

/**
 * @param {import('pg').Pool | import('pg').Client} db
 * @param {string} tenantId
 * @param {{ startDate: string, endDate: string, screens?: string[] }} opts
 */
export async function loadSnapshots(db, tenantId, opts) {
  const startDate = isoDay(opts.startDate)
  const endDate = isoDay(opts.endDate)
  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate must be ISO dates (YYYY-MM-DD)')
    err.statusCode = 400
    throw err
  }
  if (startDate > endDate) {
    const err = new Error('startDate must be <= endDate')
    err.statusCode = 400
    throw err
  }
  const span = daysInclusive(startDate, endDate)
  if (span > 90) {
    const err = new Error('Date range cannot exceed 90 days')
    err.statusCode = 400
    throw err
  }

  let screens = opts.screens?.length ? opts.screens : SCREEN_KEYS
  screens = screens.filter((s) => SCREEN_KEYS.includes(s))
  if (!screens.length) {
    const err = new Error(`screens must be one of: ${SCREEN_KEYS.join(', ')}`)
    err.statusCode = 400
    throw err
  }

  const tenant = await loadTenant(db, tenantId)
  if (!tenant) {
    const err = new Error('Configured tenant was not found')
    err.statusCode = 404
    throw err
  }
  if (!tenant.enabled) {
    const err = new Error('Configured tenant is disabled')
    err.statusCode = 403
    throw err
  }

  const { rows } = await db.query(
    `SELECT day::text AS day,
            screen,
            payload,
            source,
            schema_version AS "schemaVersion",
            pulled_at AS "pulledAt",
            error
     FROM whitelabel_screen_snapshots
     WHERE tenant_id = $1
       AND day >= $2::date
       AND day <= $3::date
       AND screen = ANY($4::text[])
     ORDER BY day ASC, screen ASC`,
    [tenantId, startDate, endDate, screens],
  )

  const availableDays = await listAvailableDays(db, tenantId)

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      sourceAccountId: tenant.source_account_id,
    },
    range: { startDate, endDate },
    availableDays,
    snapshots: rows.map((r) => ({
      day: r.day,
      screen: r.screen,
      payload: r.payload ?? null,
      source: r.source ?? null,
      schemaVersion: r.schemaVersion ?? 1,
      pulledAt: r.pulledAt ? new Date(r.pulledAt).toISOString() : null,
      error: r.error ?? null,
    })),
  }
}

export { SCREEN_KEYS }
