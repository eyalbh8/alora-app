/**
 * Direct DB-to-DB copy: iGEO Postgres -> Alora white-label relational mirror.
 *
 * Reads straight from the iGEO database (no API / MCP) and upserts into the
 * wl_* tables. Dimensions are fully re-upserted; facts are copied for the
 * last DAYS days (idempotent, keyed by iGEO UUID).
 *
 * Usage:
 *   node db/copy_direct.mjs
 * Optional env:
 *   SRC_DATABASE_URL (default: local tunnel to iGEO on 127.0.0.1:5434)
 *   DST_DATABASE_URL (default: alora-whitelabel RDS)
 *   ACCOUNT_ID (default: 44ff27db-fd23-45fe-a37f-2fb13e548314)
 *   DAYS (default: 3)
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'functions', 'snapshots-api', 'index.mjs'))
const pg = require('pg')

const SRC_URL =
  process.env.SRC_DATABASE_URL ||
  'postgresql://postgres:GreatJobAll123!@127.0.0.1:5434/app'
const DST_URL =
  process.env.DST_DATABASE_URL ||
  'postgresql://alora:Alora123!@alora-whitelabel.cjms4cm0yw8p.eu-central-1.rds.amazonaws.com:5432/alora_white_label'
const ACCOUNT_ID = process.env.ACCOUNT_ID || '44ff27db-fd23-45fe-a37f-2fb13e548314'
const DAYS = Number(process.env.DAYS || 3)

const src = new pg.Pool({ connectionString: stripSsl(SRC_URL), max: 2 })
const dst = new pg.Pool({
  connectionString: stripSsl(DST_URL),
  ssl: { rejectUnauthorized: false },
  max: 2,
})

function stripSsl(u) {
  return u.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '')
}

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n))

/**
 * Upsert JSON rows into a target table via jsonb_to_recordset.
 * colDefs: SQL record definition, e.g. `id uuid, name text`
 * cols: column list matching colDefs names (quoted where needed)
 */
async function upsertJson(table, cols, colDefs, conflictKey, rows, tenantId) {
  if (!rows.length) return 0
  const colList = cols.map((c) => `"${c}"`).join(', ')
  const updates = cols
    .filter((c) => c !== conflictKey)
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(', ')
  let written = 0
  for (const batch of chunk(rows, 500)) {
    await dst.query(
      `INSERT INTO ${table} (tenant_id, ${colList})
       SELECT $2::uuid, ${colList}
       FROM jsonb_to_recordset($1::jsonb) AS r(${colDefs})
       ON CONFLICT ("${conflictKey}") DO UPDATE SET tenant_id = $2::uuid, ${updates}, synced_at = now()`,
      [JSON.stringify(batch), tenantId],
    )
    written += batch.length
  }
  return written
}

async function main() {
  const t0 = Date.now()

  // Tenant lookup in the white-label DB
  const tenantRes = await dst.query(
    'SELECT id FROM whitelabel_tenants WHERE source_account_id = $1 AND enabled',
    [ACCOUNT_ID],
  )
  if (!tenantRes.rows.length) throw new Error(`No enabled tenant for account ${ACCOUNT_ID}`)
  const tenantId = tenantRes.rows[0].id
  console.log(`tenant ${tenantId} <- account ${ACCOUNT_ID}, last ${DAYS} day(s)`)

  const startDate = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
  const counts = {}

  // --- Dimensions -----------------------------------------------------------

  const account = (
    await src.query(
      `SELECT id, title, names, domains, logo, to_jsonb(a) - 'post_guidelines' AS raw
       FROM accounts a WHERE id = $1`,
      [ACCOUNT_ID],
    )
  ).rows[0]
  if (!account) throw new Error(`Account ${ACCOUNT_ID} not found in source DB`)
  await dst.query(
    `INSERT INTO wl_accounts (id, tenant_id, title, names, domains, logo, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET tenant_id = $2, title = $3, names = $4,
       domains = $5, logo = $6, raw = $7, synced_at = now()`,
    [
      account.id,
      tenantId,
      account.title,
      account.names ?? [],
      account.domains ?? [],
      account.logo,
      account.raw,
    ],
  )
  counts.accounts = 1
  console.log(`account: ${account.title}`)

  const settings = (
    await src.query(
      `SELECT to_jsonb(s) - 'social_media_provider_tokens' - 'crm_lead' - 'stripe_customer_id' AS filters
       FROM account_settings s WHERE account_id = $1`,
      [ACCOUNT_ID],
    )
  ).rows[0]
  if (settings) {
    await dst.query(
      `INSERT INTO wl_account_preferences (account_id, tenant_id, filters)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO UPDATE SET tenant_id = $2, filters = $3, synced_at = now()`,
      [ACCOUNT_ID, tenantId, settings.filters],
    )
    counts.account_preferences = 1
  }

  const topics = (
    await src.query(
      `SELECT jsonb_agg(jsonb_build_object(
         'id', t.id, 'account_id', t.account_id, 'name', t.name,
         'volume', t.volume, 'priority', t.priority, 'state', t.state,
         'raw', to_jsonb(t))) AS rows
       FROM topics t WHERE t.account_id = $1 AND t.deleted_at IS NULL`,
      [ACCOUNT_ID],
    )
  ).rows[0].rows ?? []
  counts.topics = await upsertJson(
    'wl_topics',
    ['id', 'account_id', 'name', 'volume', 'priority', 'state', 'raw'],
    'id uuid, account_id uuid, name text, volume integer, priority integer, state text, raw jsonb',
    'id',
    topics,
    tenantId,
  )
  console.log(`topics: ${counts.topics}`)

  const prompts = (
    await src.query(
      `SELECT jsonb_agg(jsonb_build_object(
         'id', p.id, 'account_id', p.account_id, 'topic_id', p.topic_id,
         'prompt', p.prompt, 'type', p.type, 'tags', p.tags, 'regions', p.regions,
         'language', p.language, 'is_active', p.is_active, 'volume', p.volume,
         'avg_visibility', p.avg_visibility, 'avg_sentiment_score', p.avg_sentiment_score,
         'sentiment_breakdown', p.sentiment_breakdown, 'stage', p.stage,
         'level', p.level, 'state', p.state, 'raw', to_jsonb(p))) AS rows
       FROM prompts p WHERE p.account_id = $1 AND p.deleted_at IS NULL`,
      [ACCOUNT_ID],
    )
  ).rows[0].rows ?? []
  counts.prompts = await upsertJson(
    'wl_prompts',
    ['id', 'account_id', 'topic_id', 'prompt', 'type', 'tags', 'regions', 'language',
     'is_active', 'volume', 'avg_visibility', 'avg_sentiment_score', 'sentiment_breakdown',
     'stage', 'level', 'state', 'raw'],
    `id uuid, account_id uuid, topic_id uuid, prompt text, type text, tags jsonb,
     regions text[], language text, is_active boolean, volume integer,
     avg_visibility integer, avg_sentiment_score integer, sentiment_breakdown jsonb,
     stage text, level text, state text, raw jsonb`,
    'id',
    prompts,
    tenantId,
  )
  console.log(`prompts: ${counts.prompts}`)

  const competitors = (
    await src.query(
      `SELECT jsonb_agg(jsonb_build_object(
         'id', c.id, 'account_id', c.account_id, 'name', c.name, 'logo', c.logo,
         'site', c.site, 'domain', c.domain, 'status', c.status, 'raw', to_jsonb(c))) AS rows
       FROM competitors c WHERE c.account_id = $1`,
      [ACCOUNT_ID],
    )
  ).rows[0].rows ?? []
  counts.competitors = await upsertJson(
    'wl_competitors',
    ['id', 'account_id', 'name', 'logo', 'site', 'domain', 'status', 'raw'],
    'id uuid, account_id uuid, name text, logo text, site text, domain text, status text, raw jsonb',
    'id',
    competitors,
    tenantId,
  )
  console.log(`competitors: ${counts.competitors}`)

  // --- Facts: results -------------------------------------------------------

  const RESULT_COLS = [
    'id', 'account_id', 'topic_id', 'topic', 'prompt_id', 'prompt',
    'is_company_in_prompt', 'prompt_type', 'prompt_ranking', 'rank', 'entity',
    'original_entity', 'reason', 'linkable', 'company_sources', 'company_site_url',
    'company_domain', 'feel', 'url_sources', 'provider', 'model', 'timestamp',
    'scan_id', 'region', 'country', 'state', 'city',
  ]
  const RESULT_DEFS = `id uuid, account_id uuid, topic_id uuid, topic text, prompt_id uuid,
    prompt text, is_company_in_prompt boolean, prompt_type text, prompt_ranking integer,
    rank integer, entity text, original_entity text, reason text, linkable boolean,
    company_sources jsonb, company_site_url text, company_domain text, feel text,
    url_sources jsonb, provider text, model text, "timestamp" timestamptz, scan_id uuid,
    region text, country text, state text, city text`

  counts.results = 0
  const PAGE = 5000
  for (let offset = 0; ; offset += PAGE) {
    const page = (
      await src.query(
        `SELECT jsonb_agg(j) AS rows FROM (
           SELECT jsonb_build_object(
             'id', r.id, 'account_id', r.account_id, 'topic_id', r.topic_id,
             'topic', r.topic, 'prompt_id', r.prompt_id, 'prompt', r.prompt,
             'is_company_in_prompt', r.is_company_in_prompt, 'prompt_type', r.prompt_type,
             'prompt_ranking', r.prompt_ranking, 'rank', r.rank, 'entity', r.entity,
             'original_entity', r.original_entity, 'reason', r.reason,
             'linkable', r.linkable, 'company_sources', to_jsonb(r.company_sources),
             'company_site_url', r.company_site_url, 'company_domain', r.company_domain,
             'feel', r.feel, 'url_sources', to_jsonb(r.url_sources),
             'provider', r.provider, 'model', r.model, 'timestamp', r.timestamp,
             'scan_id', r.scan_id, 'region', r.region, 'country', r.country,
             'state', r.state, 'city', r.city) AS j
           FROM results r
           WHERE r.account_id = $1 AND r.timestamp >= $2
           ORDER BY r.timestamp, r.id
           OFFSET $3 LIMIT $4
         ) q`,
        [ACCOUNT_ID, startDate, offset, PAGE],
      )
    ).rows[0].rows ?? []
    if (!page.length) break
    counts.results += await upsertJson('wl_results', RESULT_COLS, RESULT_DEFS, 'id', page, tenantId)
    console.log(`results: ${counts.results}...`)
    if (page.length < PAGE) break
  }
  console.log(`results total: ${counts.results}`)

  // --- Facts: prompt responses ----------------------------------------------

  const RESP_COLS = [
    'id', 'account_id', 'prompt_id', 'topic_id', 'scan_id', 'purpose', 'provider',
    'model', 'timestamp', 'region', 'country', 'state', 'city', 'visibility',
    'response_rank', 'sources', 'status', 'response_preview', 'response_text', 'raw',
  ]
  const RESP_DEFS = `id uuid, account_id uuid, prompt_id uuid, topic_id uuid, scan_id uuid,
    purpose text, provider text, model text, "timestamp" timestamptz, region text,
    country text, state text, city text, visibility integer, response_rank double precision,
    sources jsonb, status text, response_preview text, response_text text, raw jsonb`

  counts.prompt_responses = 0
  // Full response bodies can be large; keep each jsonb_agg well below PostgreSQL's
  // 256 MB limit instead of sharing the much larger results page size.
  const RESP_PAGE = 100
  for (let offset = 0; ; offset += RESP_PAGE) {
    const page = (
      await src.query(
        `SELECT pr.id,
                pr.account_id,
                pr.prompt_id,
                pr.topic_id,
                pr.scan_id,
                pr.purpose,
                pr.provider,
                pr.model,
                pr.timestamp,
                pr.region,
                pr.country,
                pr.state,
                pr.city,
                pr.visibility,
                pr.response_rank,
                to_jsonb(pr.sources) AS sources,
                pr.status,
                left(pr.response, 400) AS response_preview,
                pr.response AS response_text,
                jsonb_strip_nulls(jsonb_build_object(
                  'companies', pr.json_response->'companies',
                  'mentionedCompanies', pr.json_response->'mentionedCompanies',
                  'brands', pr.json_response->'brands',
                  'entities', pr.json_response->'entities',
                  'sentimentScore', pr.json_response->'sentimentScore',
                  'sentinemtScore', pr.json_response->'sentinemtScore',
                  'avgSentimentScore', pr.json_response->'avgSentimentScore'
                )) AS raw
         FROM prompt_responses pr
         WHERE pr.account_id = $1 AND pr.timestamp >= $2
         ORDER BY pr.timestamp, pr.id
         OFFSET $3 LIMIT $4`,
        [ACCOUNT_ID, startDate, offset, RESP_PAGE],
      )
    ).rows
    if (!page.length) break
    counts.prompt_responses += await upsertJson(
      'wl_prompt_responses', RESP_COLS, RESP_DEFS, 'id', page, tenantId,
    )
    console.log(`prompt_responses: ${counts.prompt_responses}...`)
    if (page.length < RESP_PAGE) break
  }
  console.log(`prompt_responses total: ${counts.prompt_responses}`)

  // --- Run bookkeeping --------------------------------------------------------

  await dst.query(
    `INSERT INTO whitelabel_export_runs (tenant_id, day, status, finished_at, entity_counts)
     VALUES ($1, CURRENT_DATE, 'success', now(), $2)
     ON CONFLICT (tenant_id, day) DO UPDATE SET status = 'success', finished_at = now(),
       entity_counts = $2, error_summary = NULL`,
    [tenantId, JSON.stringify({ ...counts, source: 'direct-db-copy', days: DAYS })],
  )

  console.log(`DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`, counts)
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
