/**
 * Refresh ai_traffic (and optionally ai_crawlers) JSON snapshots from iGEO.
 *
 * Usage:
 *   IGEO_API_KEY=... DATABASE_URL=postgresql://... node db/sync_traffic_snapshots.mjs
 *
 * Optional: ACCOUNT_ID, DAYS (default 90), SYNC_DAY (default today UTC)
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { aiDashboardPath } from './trafficApi.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'functions', 'snapshots-api', 'index.mjs'))
const pg = require('pg')

const API_BASE = (process.env.API_BASE || 'https://api.igeo.ai').replace(/\/$/, '')
const API_KEY = process.env.IGEO_API_KEY
const ACCOUNT_ID = process.env.ACCOUNT_ID || '44ff27db-fd23-45fe-a37f-2fb13e548314'
const DAYS = Number(process.env.DAYS || 90)
const DATABASE_URL = process.env.DATABASE_URL
const SYNC_DAY = process.env.SYNC_DAY || new Date().toISOString().slice(0, 10)

if (!API_KEY) {
  console.error('FATAL: IGEO_API_KEY is required')
  process.exit(1)
}
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, ''),
  ssl: { rejectUnauthorized: false },
  max: 2,
})

async function apiGet(pathAndQuery, { tolerate = [] } = {}) {
  const url = `${API_BASE}${pathAndQuery}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
  if (!res.ok) {
    if (tolerate.includes(res.status)) {
      console.warn(`WARN ${res.status} ${pathAndQuery}`)
      return { __error: res.status }
    }
    const body = await res.text().catch(() => '')
    throw new Error(`GET ${pathAndQuery} -> ${res.status} ${body.slice(0, 300)}`)
  }
  return res.json()
}

const js = (v) => (v == null ? null : JSON.stringify(v))

async function main() {
  const { rows: tenants } = await pool.query(
    `SELECT id FROM whitelabel_tenants WHERE source_account_id = $1 AND enabled = true`,
    [ACCOUNT_ID],
  )
  if (!tenants.length) {
    console.error(`No enabled tenant for account ${ACCOUNT_ID}`)
    process.exit(1)
  }
  const TENANT = tenants[0].id

  const end = new Date(`${SYNC_DAY}T23:59:59.999Z`)
  const aiPath = aiDashboardPath(ACCOUNT_ID, DAYS, end)
  console.log(`Fetching ${aiPath}`)
  const payload = await apiGet(aiPath, { tolerate: [403, 404, 500] })
  const failed = payload?.__error

  await pool.query(
    `INSERT INTO whitelabel_screen_snapshots (tenant_id, day, screen, payload, source, schema_version, pulled_at, error)
     VALUES ($1,$2,'ai_traffic',$3::jsonb,'sync_traffic',2,now(),$4)
     ON CONFLICT (tenant_id, day, screen) DO UPDATE
       SET payload=$3::jsonb, pulled_at=now(), error=$4, source='sync_traffic'`,
    [TENANT, SYNC_DAY, failed ? null : js(payload), failed ? `HTTP ${failed}` : null],
  )

  if (failed) {
    console.error(`ai_traffic sync failed: HTTP ${failed}`)
    process.exit(1)
  }

  const llmCount = Array.isArray(payload.llmProviders) ? payload.llmProviders.length : 0
  const histCount = Array.isArray(payload.historicalData) ? payload.historicalData.length : 0
  const total = payload.llmProviders?.find((r) => r.provider === 'TOTAL')
  console.log(
    JSON.stringify(
      {
        day: SYNC_DAY,
        hasEvents: payload.hasEvents,
        llmProviders: llmCount,
        historicalSeries: histCount,
        totalVisits: total?.visits ?? null,
        totalChange: total?.changePercent ?? null,
      },
      null,
      2,
    ),
  )

  if (llmCount === 0 && histCount === 0) {
    console.warn('WARNING: snapshot saved but llmProviders/historicalData are empty — check analytics events in iGEO')
  }

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
