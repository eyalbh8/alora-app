/**
 * One-time backfill: mirror upstream account data into the Alora white-label DB.
 *
 * Pulls dimensions (account, preferences, topics, prompts, competitors) and
 * up to DAYS days of facts (results via /findings/export, prompt responses),
 * plus ai_traffic / ai_crawlers JSON snapshots. Idempotent upserts throughout.
 *
 * Usage:
 *   SOURCE_API_KEY=... DATABASE_URL=postgresql://... node db/backfill.mjs
 * Optional env: ACCOUNT_ID, DAYS (default 90), SOURCE_API_BASE / API_BASE
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { aiDashboardPath, crawlerAnalyticsPath } from './trafficApi.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'functions', 'snapshots-api', 'index.mjs'))
const pg = require('pg')

const API_BASE = (process.env.SOURCE_API_BASE || process.env.API_BASE || '').replace(/\/$/, '')
const API_KEY = process.env.SOURCE_API_KEY
const ACCOUNT_ID = process.env.ACCOUNT_ID || '44ff27db-fd23-45fe-a37f-2fb13e548314'
const DAYS = Number(process.env.DAYS || 90)
const DATABASE_URL = process.env.DATABASE_URL

if (!API_BASE) exit('SOURCE_API_BASE is required')
if (!API_KEY) exit('SOURCE_API_KEY is required')
if (!DATABASE_URL) exit('DATABASE_URL is required')

function exit(msg) {
  console.error(`FATAL: ${msg}`)
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, ''),
  ssl: { rejectUnauthorized: false },
  max: 4,
})

async function apiGet(pathAndQuery, { tolerate = [] } = {}) {
  const url = `${API_BASE}${pathAndQuery}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
  if (!res.ok) {
    if (tolerate.includes(res.status)) {
      console.warn(`WARN ${res.status} ${pathAndQuery} (tolerated)`)
      return { __error: res.status }
    }
    const body = await res.text().catch(() => '')
    throw new Error(`GET ${pathAndQuery} -> ${res.status} ${body.slice(0, 300)}`)
  }
  return res.json()
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n))

/** Multi-row upsert. cols: [[name, extractor]] */
async function upsertRows(table, cols, conflictKey, rows, extra = {}) {
  if (!rows.length) return 0
  const names = [...cols.map(([n]) => n), ...Object.keys(extra)]
  let written = 0
  for (const batch of chunk(rows, 200)) {
    const values = []
    const placeholders = batch.map((row, r) => {
      const ph = names.map((_, c) => `$${r * names.length + c + 1}`)
      for (const [, get] of cols) values.push(get(row))
      for (const v of Object.values(extra)) values.push(v)
      return `(${ph.join(',')})`
    })
    const updates = names
      .filter((n) => n !== conflictKey)
      .map((n) => `"${n}" = EXCLUDED."${n}"`)
    await pool.query(
      `INSERT INTO ${table} (${names.map((n) => `"${n}"`).join(',')})
       VALUES ${placeholders.join(',')}
       ON CONFLICT ("${conflictKey}") DO UPDATE SET ${updates.join(', ')}, synced_at = now()`,
      values,
    )
    written += batch.length
  }
  return written
}

const js = (v) => (v == null ? null : JSON.stringify(v))

async function main() {
  const counts = {}

  const { rows: tenants } = await pool.query(
    `SELECT id FROM whitelabel_tenants WHERE source_account_id = $1 AND enabled = true`,
    [ACCOUNT_ID],
  )
  if (!tenants.length) exit(`No enabled tenant for source_account_id=${ACCOUNT_ID}`)
  const TENANT = tenants[0].id
  console.log(`Tenant ${TENANT}, account ${ACCOUNT_ID}, ${DAYS} days`)

  // ------------------------------------------------------------- dimensions
  const account = await apiGet(`/accounts/${ACCOUNT_ID}`)
  await pool.query(
    `INSERT INTO wl_accounts (id, tenant_id, title, names, domains, logo, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (id) DO UPDATE SET title=$3, names=$4, domains=$5, logo=$6, raw=$7::jsonb, synced_at=now()`,
    [account.id, TENANT, account.title, account.names ?? [], account.domains ?? [], account.logo ?? null, js(account)],
  )
  counts.account = 1

  const prefs = await apiGet(`/accounts/${ACCOUNT_ID}/preferences`, { tolerate: [403, 404] })
  if (!prefs?.__error) {
    await pool.query(
      `INSERT INTO wl_account_preferences (account_id, tenant_id, filters)
       VALUES ($1,$2,$3::jsonb)
       ON CONFLICT (account_id) DO UPDATE SET filters=$3::jsonb, synced_at=now()`,
      [ACCOUNT_ID, TENANT, js(prefs)],
    )
    counts.preferences = 1
  }

  const topics = await apiGet(`/accounts/${ACCOUNT_ID}/topics`)
  counts.topics = await upsertRows(
    'wl_topics',
    [
      ['id', (t) => t.id],
      ['account_id', () => ACCOUNT_ID],
      ['name', (t) => t.name],
      ['volume', (t) => t.volume ?? null],
      ['priority', (t) => t.priority ?? null],
      ['state', (t) => t.state ?? null],
      ['raw', (t) => js(t)],
    ],
    'id',
    Array.isArray(topics) ? topics : topics.topics ?? [],
    { tenant_id: TENANT },
  )

  const promptsRes = await apiGet(`/accounts/${ACCOUNT_ID}/prompts`)
  const prompts = Array.isArray(promptsRes) ? promptsRes : promptsRes.prompts ?? []
  counts.prompts = await upsertRows(
    'wl_prompts',
    [
      ['id', (p) => p.id],
      ['account_id', () => ACCOUNT_ID],
      ['topic_id', (p) => p.topicId ?? p.topic?.id ?? null],
      ['prompt', (p) => p.prompt],
      ['type', (p) => p.type ?? null],
      ['tags', (p) => js(p.tags)],
      ['regions', (p) => p.regions ?? []],
      ['language', (p) => p.language ?? null],
      ['is_active', (p) => p.isActive ?? true],
      ['volume', (p) => p.volume ?? null],
      ['avg_visibility', (p) => p.avgVisibility ?? null],
      ['avg_sentiment_score', (p) => p.avgSentimentScore ?? null],
      ['sentiment_breakdown', (p) => js(p.sentimentBreakdown)],
      ['stage', (p) => p.stage ?? null],
      ['level', (p) => p.level ?? null],
      ['state', (p) => p.state ?? null],
      ['raw', (p) => js(p)],
    ],
    'id',
    prompts,
    { tenant_id: TENANT },
  )

  const competitorsRes = await apiGet(`/accounts/${ACCOUNT_ID}/market-players`, { tolerate: [403, 404] })
  if (!competitorsRes?.__error) {
    const competitors = Array.isArray(competitorsRes) ? competitorsRes : competitorsRes.competitors ?? []
    counts.competitors = await upsertRows(
      'wl_competitors',
      [
        ['id', (c) => c.id],
        ['account_id', () => ACCOUNT_ID],
        ['name', (c) => c.name],
        ['logo', (c) => c.logo ?? null],
        ['site', (c) => c.site ?? null],
        ['domain', (c) => c.domain ?? null],
        ['status', (c) => c.status ?? null],
        ['raw', (c) => js(c)],
      ],
      'id',
      competitors,
      { tenant_id: TENANT },
    )
  }

  // ------------------------------------------------------------------ facts
  const end = new Date()
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - DAYS)
  start.setUTCHours(0, 0, 0, 0)
  const startIso = start.toISOString()
  const endIso = end.toISOString()

  // Results via /findings/export (requires deployed endpoint)
  counts.results = 0
  let resultsBlocked = false
  for (let skip = 0; ; ) {
    const page = await apiGet(
      `/accounts/${ACCOUNT_ID}/findings/export?startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(endIso)}&skip=${skip}&take=1000`,
      { tolerate: [403, 404] },
    )
    if (page?.__error) {
      resultsBlocked = true
      console.warn('results export endpoint unavailable — deploy source-app first, then re-run')
      break
    }
    const rows = page.results ?? []
    counts.results += await upsertRows(
      'wl_results',
      [
        ['id', (r) => r.id],
        ['account_id', (r) => r.accountId],
        ['topic_id', (r) => r.topicId],
        ['topic', (r) => r.topic],
        ['prompt_id', (r) => r.promptId],
        ['prompt', (r) => r.prompt],
        ['is_company_in_prompt', (r) => r.isCompanyInPrompt],
        ['prompt_type', (r) => r.promptType],
        ['prompt_ranking', (r) => r.promptRanking],
        ['rank', (r) => r.rank],
        ['entity', (r) => r.entity],
        ['original_entity', (r) => r.originalEntity],
        ['reason', (r) => r.reason ?? null],
        ['linkable', (r) => r.linkable ?? false],
        ['company_sources', (r) => js(r.companySources)],
        ['company_site_url', (r) => r.companySiteUrl ?? null],
        ['company_domain', (r) => r.companyDomain ?? null],
        ['feel', (r) => r.feel ?? null],
        ['url_sources', (r) => js(r.urlSources)],
        ['provider', (r) => r.provider],
        ['model', (r) => r.model],
        ['timestamp', (r) => r.timestamp],
        ['scan_id', (r) => r.scanId],
        ['region', (r) => r.region ?? null],
        ['country', (r) => r.country ?? null],
        ['state', (r) => r.state ?? null],
        ['city', (r) => r.city ?? null],
      ],
      'id',
      rows,
      { tenant_id: TENANT },
    )
    skip += rows.length
    console.log(`results: ${skip}/${page.total}`)
    if (skip >= page.total || rows.length === 0) break
  }

  // Prompt responses (existing endpoint)
  counts.responses = 0
  for (let skip = 0; ; ) {
    const page = await apiGet(
      `/accounts/${ACCOUNT_ID}/prompts/responses?startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(endIso)}&skip=${skip}&take=200`,
    )
    const rows = page.responses ?? []
    counts.responses += await upsertRows(
      'wl_prompt_responses',
      [
        ['id', (r) => r.id],
        ['account_id', (r) => r.accountId ?? ACCOUNT_ID],
        ['prompt_id', (r) => r.promptId ?? r.prompt?.id ?? null],
        ['topic_id', (r) => r.topicId ?? r.topic?.id ?? null],
        ['scan_id', (r) => r.scanId ?? null],
        ['purpose', (r) => r.purpose ?? null],
        ['provider', (r) => r.provider],
        ['model', (r) => r.model ?? null],
        ['timestamp', (r) => r.timestamp],
        ['region', (r) => r.region ?? null],
        ['country', (r) => r.country ?? null],
        ['state', (r) => r.state ?? null],
        ['city', (r) => r.city ?? null],
        // API returns computed visibilityAverage / myRank; raw DB sync would return visibility / responseRank
        ['visibility', (r) => r.visibility ?? r.visibilityAverage ?? 0],
        ['response_rank', (r) => r.responseRank ?? r.myRank ?? null],
        ['sources', (r) => js(r.sources)],
        ['status', (r) => r.status ?? null],
        ['response_preview', (r) => r.responsePreview ?? (typeof r.response === 'string' ? r.response.slice(0, 400) : null)],
        ['response_text', (r) => (typeof r.response === 'string' ? r.response : null)],
        ['raw', (r) => { const { response, ...rest } = r; return js(rest) }],
      ],
      'id',
      rows,
      { tenant_id: TENANT },
    )
    skip += rows.length
    console.log(`responses: ${skip}/${page.total}`)
    if (skip >= page.total || rows.length === 0) break
  }

  // ------------------------------------------------- traffic JSON snapshots (one row per day)
  counts.ai_traffic = 0
  counts.ai_crawlers = 0
  for (let offset = 0; offset < DAYS; offset++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - offset)
    const day = d.toISOString().slice(0, 10)
    for (const [screen, buildPath] of [
      ['ai_traffic', () => aiDashboardPath(ACCOUNT_ID, day)],
      ['ai_crawlers', () => crawlerAnalyticsPath(ACCOUNT_ID, day)],
    ]) {
      const payload = await apiGet(buildPath(), { tolerate: [403, 404, 500] })
      const failed = payload?.__error
      await pool.query(
        `INSERT INTO whitelabel_screen_snapshots (tenant_id, day, screen, payload, source, schema_version, pulled_at, error)
         VALUES ($1,$2,$3,$4::jsonb,'backfill',2,now(),$5)
         ON CONFLICT (tenant_id, day, screen) DO UPDATE SET payload=$4::jsonb, pulled_at=now(), error=$5`,
        [TENANT, day, screen, failed ? null : js(payload), failed ? `HTTP ${failed}` : null],
      )
      if (!failed) counts[screen] = (counts[screen] ?? 0) + 1
    }
  }

  // ------------------------------------------- export_runs rows per fact day
  await pool.query(
    `INSERT INTO whitelabel_export_runs (tenant_id, day, status, started_at, finished_at, entity_counts)
     SELECT $1, d.day, 'SUCCEEDED', now(), now(),
            jsonb_build_object('results', d.results, 'responses', d.responses, 'source', 'backfill')
     FROM (
       SELECT COALESCE(r.day, p.day) AS day, COALESCE(r.n, 0) AS results, COALESCE(p.n, 0) AS responses
       FROM (SELECT ("timestamp" AT TIME ZONE 'UTC')::date AS day, count(*) AS n
             FROM wl_results WHERE tenant_id = $1 GROUP BY 1) r
       FULL OUTER JOIN (SELECT ("timestamp" AT TIME ZONE 'UTC')::date AS day, count(*) AS n
             FROM wl_prompt_responses WHERE tenant_id = $1 GROUP BY 1) p USING (day)
     ) d
     ON CONFLICT (tenant_id, day) DO UPDATE
       SET status='SUCCEEDED', finished_at=now(), entity_counts=EXCLUDED.entity_counts`,
    [TENANT],
  )

  console.log('\nBackfill complete:', JSON.stringify(counts, null, 2))
  if (resultsBlocked) {
    console.warn('\nNOTE: wl_results is EMPTY — deploy the source-app /findings/export endpoint and re-run this script.')
  }
  await pool.end()
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
