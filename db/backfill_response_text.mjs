/**
 * Backfill wl_prompt_responses.response_text / response_preview from the iGEO
 * source Postgres (prompt_responses.response). Uses a single bulk UPDATE per batch.
 *
 * Usage:
 *   node db/backfill_response_text.mjs
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'functions', 'snapshots-api', 'index.mjs'))
const pg = require('pg')

function loadEnvFile() {
  try {
    for (const line of readFileSync(path.join(here, '..', '.env'), 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {
    /* no .env */
  }
}

loadEnvFile()

const SRC_URL =
  process.env.SRC_DATABASE_URL ||
  'postgresql://postgres:GreatJobAll123!@127.0.0.1:5434/app'
const DST_URL = process.env.DATABASE_URL || process.env.DST_DATABASE_URL
const ACCOUNT_ID = process.env.ACCOUNT_ID || '44ff27db-fd23-45fe-a37f-2fb13e548314'
const DAYS = Number(process.env.DAYS || 90)

if (!DST_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

function stripSsl(u) {
  return u.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '')
}

const src = new pg.Pool({ connectionString: stripSsl(SRC_URL), max: 2 })
const dst = new pg.Pool({
  connectionString: stripSsl(DST_URL),
  ssl: { rejectUnauthorized: false },
  max: 2,
})

async function main() {
  await dst.query(`
    ALTER TABLE wl_prompt_responses
      ADD COLUMN IF NOT EXISTS response_preview text,
      ADD COLUMN IF NOT EXISTS response_text text
  `)

  const { rows: tenants } = await dst.query(
    `SELECT id FROM whitelabel_tenants WHERE source_account_id = $1 AND enabled = true`,
    [ACCOUNT_ID],
  )
  if (!tenants.length) throw new Error(`No tenant for account ${ACCOUNT_ID}`)
  const tenantId = tenants[0].id

  const startDate = new Date(Date.now() - DAYS * 86400000)
  console.log(`Backfilling response text for tenant ${tenantId}, since ${startDate.toISOString().slice(0, 10)}`)

  let offset = 0
  let totalUpdated = 0
  const PAGE = 100

  for (;;) {
    const { rows } = await src.query(
      `SELECT id, response
       FROM prompt_responses
       WHERE account_id = $1
         AND "timestamp" >= $2
         AND response IS NOT NULL
         AND length(trim(response)) > 0
       ORDER BY "timestamp" DESC, id
       OFFSET $3 LIMIT $4`,
      [ACCOUNT_ID, startDate, offset, PAGE],
    )
    if (!rows.length) break

    const payload = rows.map((r) => ({ id: r.id, response: String(r.response) }))
    const res = await dst.query(
      `UPDATE wl_prompt_responses AS dst
       SET response_text = src.response,
           response_preview = left(src.response, 400),
           synced_at = now()
       FROM jsonb_to_recordset($2::jsonb) AS src(id uuid, response text)
       WHERE dst.tenant_id = $1
         AND dst.id = src.id
         AND (dst.response_text IS NULL OR dst.response_text = '')`,
      [tenantId, JSON.stringify(payload)],
    )
    totalUpdated += res.rowCount ?? 0
    console.log(`batch offset ${offset}: ${rows.length} source rows, ${res.rowCount} updated`)
    offset += rows.length
    if (rows.length < PAGE) break
  }

  const { rows: stats } = await dst.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE response_text IS NOT NULL AND response_text <> '')::int AS with_text
     FROM wl_prompt_responses
     WHERE tenant_id = $1`,
    [tenantId],
  )
  console.log('Done.', { totalUpdated, ...stats[0] })
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await src.end()
    await dst.end()
  })
