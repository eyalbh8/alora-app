/**
 * GEO aggregation endpoints computed from the relational mirror tables
 * (wl_accounts, wl_topics, wl_prompts, wl_competitors, wl_results,
 * wl_prompt_responses).
 *
 * The SQL semantics deliberately replicate iGEO's server-side logic:
 *  - Appearances (mentions):  count(distinct (prompt, provider)) of results
 *    rows whose company_domain is one of the account domains (per scan / day).
 *    Source: prisma/sql/getAppearancesCountByCompanyNames.sql
 *  - Sentiment feel dedup per (scan, prompt, topic, provider):
 *    pos+neu=pos, neg+neu=neg, pos+neg=mixed, 3 distinct=mixed.
 *    Source: prisma/sql/getEntitySentimentGroupedByTopicAndProvider.sql
 *  - Sentiment score: round(50 + ((positive - negative) / total) * 50) with
 *    MIXED split 50/50 into positive and negative.
 *    Source: results.service.ts calculateSentimentFromItems
 *  - Visibility: avg of per-(scan, provider) visibility from wl_prompt_responses
 *    (dedupe with max(visibility) when multiple rows exist for the same scan +
 *    provider, then average). Matches iGEO prompts table semantics.
 */

let formatResponseDisplayText = (raw) => (raw?.trim() ? raw.trim() : '')
let formatResponsePreview = (raw, max = 400) => {
  const text = formatResponseDisplayText(raw)
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

async function loadResponseFormatters() {
  const mod = await import(`./responseBody.mjs?t=${Date.now()}`)
  formatResponseDisplayText = mod.formatResponseDisplayText
  formatResponsePreview = mod.formatResponsePreview
}

/** Accumulates positional SQL params. */
class Q {
  params = []
  add(v) {
    this.params.push(v)
    return `$${this.params.length}`
  }
}

function isoDay(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

function csv(v) {
  if (!v) return []
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseGeoFilters(q) {
  const startDate = isoDay(q.startDate)
  const endDate = isoDay(q.endDate)
  if (!startDate || !endDate) {
    const err = new Error('startDate and endDate must be ISO dates (YYYY-MM-DD)')
    err.statusCode = 400
    throw err
  }
  return {
    startDate,
    endDate,
    providers: csv(q.providers),
    topics: csv(q.topics),
    prompts: csv(q.prompts),
    regions: csv(q.regions),
    tags: csv(q.tags),
    branded: q.branded === 'AccountIncluded' || q.branded === 'AccountNotIncluded' ? q.branded : null,
    promptTypes: csv(q.promptTypes),
  }
}

/** WHERE fragment applying iGEO ResultsFilters semantics to wl_results rows. */
function resultWhere(q, tenantId, f, alias = 'r') {
  const w = [`${alias}.tenant_id = ${q.add(tenantId)}::uuid`]
  w.push(`${alias}."timestamp" >= ${q.add(`${f.startDate}T00:00:00.000Z`)}::timestamptz`)
  w.push(`${alias}."timestamp" <= ${q.add(`${f.endDate}T23:59:59.999Z`)}::timestamptz`)
  if (f.providers.length) w.push(`${alias}.provider = ANY(${q.add(f.providers)}::text[])`)
  if (f.topics.length) {
    const p = q.add(f.topics)
    w.push(`(${alias}.topic_id::text = ANY(${p}::text[]) OR ${alias}.topic = ANY(${p}::text[]))`)
  }
  if (f.prompts.length) w.push(`${alias}.prompt_id::text = ANY(${q.add(f.prompts)}::text[])`)
  if (f.regions.length) w.push(`${alias}.region = ANY(${q.add(f.regions)}::text[])`)
  if (f.promptTypes.length) w.push(`${alias}.prompt_type = ANY(${q.add(f.promptTypes)}::text[])`)
  if (f.branded === 'AccountIncluded') w.push(`${alias}.is_company_in_prompt = true`)
  if (f.branded === 'AccountNotIncluded') w.push(`${alias}.is_company_in_prompt = false`)
  if (f.tags.length) {
    const p = q.add(f.tags)
    w.push(
      `${alias}.prompt_id IN (
         SELECT p.id FROM wl_prompts p
         WHERE EXISTS (
           SELECT 1 FROM jsonb_array_elements(COALESCE(p.tags, '[]'::jsonb)) t
           WHERE t->>'name' = ANY(${p}::text[])
              OR (jsonb_typeof(t) = 'string' AND t #>> '{}' = ANY(${p}::text[]))
         )
       )`,
    )
  }
  return w.join(' AND ')
}

/** Same filters applied to wl_prompt_responses (no topic-name/promptType columns). */
function responseWhere(q, tenantId, f, alias = 'pr') {
  const w = [`${alias}.tenant_id = ${q.add(tenantId)}::uuid`]
  w.push(`${alias}."timestamp" >= ${q.add(`${f.startDate}T00:00:00.000Z`)}::timestamptz`)
  w.push(`${alias}."timestamp" <= ${q.add(`${f.endDate}T23:59:59.999Z`)}::timestamptz`)
  if (f.providers.length) w.push(`${alias}.provider = ANY(${q.add(f.providers)}::text[])`)
  if (f.topics.length) {
    const p = q.add(f.topics)
    w.push(
      `(${alias}.topic_id::text = ANY(${p}::text[]) OR ${alias}.topic_id IN (SELECT id FROM wl_topics WHERE name = ANY(${p}::text[])))`,
    )
  }
  if (f.prompts.length) w.push(`${alias}.prompt_id::text = ANY(${q.add(f.prompts)}::text[])`)
  if (f.regions.length) w.push(`${alias}.region = ANY(${q.add(f.regions)}::text[])`)
  if (f.tags.length) {
    const p = q.add(f.tags)
    w.push(
      `${alias}.prompt_id IN (
         SELECT p.id FROM wl_prompts p
         WHERE EXISTS (
           SELECT 1 FROM jsonb_array_elements(COALESCE(p.tags, '[]'::jsonb)) t
           WHERE t->>'name' = ANY(${p}::text[])
              OR (jsonb_typeof(t) = 'string' AND t #>> '{}' = ANY(${p}::text[]))
         )
       )`,
    )
  }
  if (f.branded === 'AccountIncluded' || f.branded === 'AccountNotIncluded') {
    const want = f.branded === 'AccountIncluded'
    w.push(`${alias}.prompt_id IN (SELECT id FROM wl_prompts WHERE (raw->>'meInPrompt')::boolean = ${want})`)
  }
  if (f.promptTypes.length) {
    w.push(`${alias}.prompt_id IN (SELECT id FROM wl_prompts WHERE type = ANY(${q.add(f.promptTypes)}::text[]))`)
  }
  return w.join(' AND ')
}

async function getAccount(db, tenantId) {
  const { rows } = await db.query(
    `SELECT id, title, names, domains, logo FROM wl_accounts WHERE tenant_id = $1 LIMIT 1`,
    [tenantId],
  )
  return rows[0] ?? null
}

/** Previous period of equal length, ending the day before startDate. */
function previousPeriod(f) {
  const start = new Date(`${f.startDate}T00:00:00Z`)
  const end = new Date(`${f.endDate}T00:00:00Z`)
  const spanDays = Math.floor((end - start) / 86400000) + 1
  const prevEnd = new Date(start.getTime() - 86400000)
  const prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * 86400000)
  return {
    ...f,
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  }
}

const pctChange = (curr, prev) => (prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null)

/** Per-prompt visibility/rank averaged over deduped (scan, provider) response units. */
async function promptResponseMetrics(db, tenantId, f) {
  const q = new Q()
  const where = responseWhere(q, tenantId, f)
  const { rows } = await db.query(
    `WITH deduped AS (
       SELECT prompt_id, scan_id, provider,
              max(visibility)::float AS visibility,
              max(response_rank)::float AS response_rank
       FROM wl_prompt_responses pr
       WHERE ${where} AND prompt_id IS NOT NULL
       GROUP BY prompt_id, scan_id, provider
     )
     SELECT prompt_id,
            avg(visibility) AS avg_visibility,
            avg(response_rank) AS avg_rank,
            count(*)::int AS response_units
     FROM deduped
     GROUP BY prompt_id`,
    q.params,
  )
  return Object.fromEntries(rows.map((r) => [r.prompt_id, r]))
}

/** SQL CASE replicating iGEO's per-(scan,prompt) feel dedup. */
const FEEL_CASE = `
  CASE
    WHEN COUNT(DISTINCT feel) = 1 THEN CASE
      WHEN MIN(feel) IN ('POSITIVE','NEGATIVE','NEUTRAL','MIXED') THEN MIN(feel) ELSE 'NEUTRAL' END
    WHEN COUNT(DISTINCT feel) = 2 AND 'POSITIVE' = ANY(ARRAY_AGG(DISTINCT feel)) AND 'NEUTRAL' = ANY(ARRAY_AGG(DISTINCT feel)) THEN 'POSITIVE'
    WHEN COUNT(DISTINCT feel) = 2 AND 'NEGATIVE' = ANY(ARRAY_AGG(DISTINCT feel)) AND 'NEUTRAL' = ANY(ARRAY_AGG(DISTINCT feel)) THEN 'NEGATIVE'
    WHEN COUNT(DISTINCT feel) = 2 AND 'POSITIVE' = ANY(ARRAY_AGG(DISTINCT feel)) AND 'NEGATIVE' = ANY(ARRAY_AGG(DISTINCT feel)) THEN 'MIXED'
    WHEN COUNT(DISTINCT feel) = 3 THEN 'MIXED'
    ELSE 'NEUTRAL'
  END`

/** iGEO sentiment score from a feel-count breakdown. */
function sentimentScore(breakdown) {
  const mixedSplit = (breakdown.mixed ?? 0) * 0.5
  const positive = (breakdown.positive ?? 0) + mixedSplit
  const negative = (breakdown.negative ?? 0) + mixedSplit
  const total =
    (breakdown.positive ?? 0) + (breakdown.negative ?? 0) + (breakdown.neutral ?? 0) + (breakdown.mixed ?? 0)
  return total > 0 ? Math.round(50 + ((positive - negative) / total) * 50) : null
}

// ---------------------------------------------------------------------------
// /geo/meta — filter options + availability
// ---------------------------------------------------------------------------
export async function geoMeta(db, tenantId) {
  const account = await getAccount(db, tenantId)

  const [providers, topics, prompts, competitors, regions, factSpan] = await Promise.all([
    db.query(`SELECT DISTINCT provider FROM wl_results WHERE tenant_id = $1 ORDER BY provider`, [tenantId]),
    db.query(
      `SELECT id, name, state, volume, priority FROM wl_topics WHERE tenant_id = $1 AND COALESCE(state,'ACTIVE') != 'DELETED' ORDER BY priority NULLS LAST, name`,
      [tenantId],
    ),
    db.query(
      `SELECT id, prompt, topic_id AS "topicId", type, tags, regions, is_active AS "isActive"
       FROM wl_prompts WHERE tenant_id = $1 ORDER BY prompt`,
      [tenantId],
    ),
    db.query(
      `SELECT id, name, logo, site, domain, status FROM wl_competitors
       WHERE tenant_id = $1 AND COALESCE(status,'ACTIVE') = 'ACTIVE' ORDER BY name`,
      [tenantId],
    ),
    db.query(
      `SELECT DISTINCT region FROM wl_results WHERE tenant_id = $1 AND region IS NOT NULL ORDER BY region`,
      [tenantId],
    ),
    db.query(
      `SELECT min(("timestamp" AT TIME ZONE 'UTC')::date)::text AS min_day,
              max(("timestamp" AT TIME ZONE 'UTC')::date)::text AS max_day,
              count(*)::int AS results_count
       FROM wl_results WHERE tenant_id = $1`,
      [tenantId],
    ),
  ])

  const tagSet = new Set()
  const promptTypeSet = new Set()
  for (const p of prompts.rows) {
    if (p.type) promptTypeSet.add(p.type)
    const tags = Array.isArray(p.tags) ? p.tags : []
    for (const t of tags) {
      if (typeof t === 'string') tagSet.add(t)
      else if (t && typeof t === 'object' && t.name) tagSet.add(t.name)
    }
  }

  const span = factSpan.rows[0]
  return {
    hasFacts: (span?.results_count ?? 0) > 0,
    factDays: { min: span?.min_day ?? null, max: span?.max_day ?? null },
    account: account
      ? { id: account.id, title: account.title, names: account.names, domains: account.domains, logo: account.logo }
      : null,
    options: {
      providers: providers.rows.map((r) => r.provider),
      topics: topics.rows.map((t) => ({ id: t.id, name: t.name })),
      prompts: prompts.rows.map((p) => ({ id: p.id, text: p.prompt })),
      regions: regions.rows.map((r) => r.region),
      tags: [...tagSet].sort(),
      promptTypes: [...promptTypeSet].sort(),
    },
    competitors: competitors.rows,
  }
}

// ---------------------------------------------------------------------------
// Shared: appearances per provider (current + previous period + per-day)
// ---------------------------------------------------------------------------
async function providerMentions(db, tenantId, account, f) {
  const domains = account?.domains ?? []
  if (!domains.length) return []

  const current = new Q()
  const currWhere = resultWhere(current, tenantId, f)
  const { rows: currRows } = await db.query(
    `SELECT provider, count(DISTINCT (prompt, provider))::int AS count
     FROM wl_results r
     WHERE ${currWhere} AND r.company_domain = ANY(${current.add(domains)}::text[])
     GROUP BY provider ORDER BY count DESC`,
    current.params,
  )

  const prevF = previousPeriod(f)
  const prev = new Q()
  const prevWhere = resultWhere(prev, tenantId, prevF)
  const { rows: prevRows } = await db.query(
    `SELECT provider, count(DISTINCT (prompt, provider))::int AS count
     FROM wl_results r
     WHERE ${prevWhere} AND r.company_domain = ANY(${prev.add(domains)}::text[])
     GROUP BY provider`,
    prev.params,
  )
  const prevByProvider = Object.fromEntries(prevRows.map((r) => [r.provider, r.count]))

  const daily = new Q()
  const dailyWhere = resultWhere(daily, tenantId, f)
  const { rows: dailyRows } = await db.query(
    `SELECT provider, (("timestamp" AT TIME ZONE 'UTC')::date)::text AS day,
            count(DISTINCT (prompt, provider))::int AS count
     FROM wl_results r
     WHERE ${dailyWhere} AND r.company_domain = ANY(${daily.add(domains)}::text[])
     GROUP BY provider, day ORDER BY day`,
    daily.params,
  )
  const historyByProvider = {}
  for (const row of dailyRows) {
    ;(historyByProvider[row.provider] ??= []).push({ date: row.day, value: row.count })
  }

  return currRows.map((r) => ({
    provider: r.provider,
    count: r.count,
    countChange: pctChange(r.count, prevByProvider[r.provider] ?? 0),
    historicalData: historyByProvider[r.provider] ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Shared: ranking table (account + competitors) with sentiment
// ---------------------------------------------------------------------------
async function entityRankingStats(db, tenantId, f, e, includeHistory = true) {
  const q = new Q()
  const where = resultWhere(q, tenantId, f)
  const domainsP = q.add(e.domains)
  const namesP = q.add(e.names)
  const match = `(r.company_domain = ANY(${domainsP}::text[]) OR r.entity = ANY(${namesP}::text[]))`
  const { rows: agg } = await db.query(
    `SELECT count(DISTINCT (prompt, provider, scan_id))::int AS occurrences,
            avg(rank)::float AS avg_rank,
            array_agg(DISTINCT topic) AS topics
     FROM wl_results r WHERE ${where} AND ${match}`,
    q.params,
  )

  const fq = new Q()
  const fwhere = resultWhere(fq, tenantId, f)
  const fdomainsP = fq.add(e.domains)
  const fnamesP = fq.add(e.names)
  const { rows: feelRows } = await db.query(
    `WITH prompt_feel AS (
       SELECT scan_id, prompt_id, provider, ${FEEL_CASE} AS final_feel
       FROM wl_results r
       WHERE ${fwhere} AND (r.company_domain = ANY(${fdomainsP}::text[]) OR r.entity = ANY(${fnamesP}::text[]))
         AND feel IS NOT NULL
       GROUP BY scan_id, prompt_id, provider
     )
     SELECT lower(final_feel) AS feel, count(*)::int AS count FROM prompt_feel GROUP BY final_feel`,
    fq.params,
  )
  const breakdown = Object.fromEntries(feelRows.map((r) => [r.feel, r.count]))

  let historicalData = []
  if (includeHistory) {
    const hq = new Q()
    const hwhere = resultWhere(hq, tenantId, f)
    const hdomainsP = hq.add(e.domains)
    const hnamesP = hq.add(e.names)
    const { rows: histRows } = await db.query(
      `SELECT (("timestamp" AT TIME ZONE 'UTC')::date)::text AS day,
              count(DISTINCT (prompt, provider, scan_id))::int AS count
       FROM wl_results r
       WHERE ${hwhere} AND (r.company_domain = ANY(${hdomainsP}::text[]) OR r.entity = ANY(${hnamesP}::text[]))
       GROUP BY day ORDER BY day`,
      hq.params,
    )
    historicalData = histRows.map((r) => ({ date: r.day, value: r.count }))
  }

  const occurrences = agg[0]?.occurrences ?? 0
  const avgRank = agg[0]?.avg_rank != null ? Math.round(agg[0].avg_rank * 10) / 10 : null
  return {
    occurrences,
    avgRank,
    sentimentScore: sentimentScore(breakdown),
    topics: (agg[0]?.topics ?? []).filter(Boolean),
    historicalData,
  }
}

async function rankingTable(db, tenantId, account, f) {
  const { rows: competitors } = await db.query(
    `SELECT id, name, logo, site, domain, status FROM wl_competitors
     WHERE tenant_id = $1 AND COALESCE(status,'ACTIVE') = 'ACTIVE'`,
    [tenantId],
  )
  const entities = [
    {
      id: account?.id ?? 'account',
      name: account?.title ?? 'You',
      logo: account?.logo ?? null,
      site: account?.site ?? null,
      domains: account?.domains ?? [],
      names: account?.names ?? [],
      isAccount: true,
    },
    ...competitors.map((c) => ({
      id: c.id,
      name: c.name,
      logo: c.logo,
      site: c.site,
      domains: c.domain ? [c.domain] : [],
      names: [c.name],
      isAccount: false,
    })),
  ]

  const prevF = previousPeriod(f)
  const rows = []
  for (const e of entities) {
    const current = await entityRankingStats(db, tenantId, f, e, true)
    const previous = await entityRankingStats(db, tenantId, prevF, e, false)

    rows.push({
      id: e.id,
      name: e.name,
      logo: e.logo ?? null,
      site: e.site ?? null,
      domain: e.domains[0] ?? null,
      occurrences: current.occurrences,
      avgRank: current.avgRank,
      sentimentScore: current.sentimentScore,
      occurrencesDelta: pctChange(current.occurrences, previous.occurrences),
      avgRankDelta:
        current.avgRank != null && previous.avgRank != null
          ? Math.round((current.avgRank - previous.avgRank) * 10) / 10
          : null,
      sentimentScoreDelta:
        current.sentimentScore != null && previous.sentimentScore != null
          ? current.sentimentScore - previous.sentimentScore
          : null,
      topics: current.topics,
      historicalData: current.historicalData,
      isAccount: e.isAccount,
    })
  }

  rows.sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0))
  rows.forEach((r, i) => {
    r.position = i + 1
  })
  return rows
}

// ---------------------------------------------------------------------------
// /geo/dashboard
// ---------------------------------------------------------------------------
export async function geoDashboard(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const account = await getAccount(db, tenantId)

  const [mentions, ranking, promptsCount, topSources] = await Promise.all([
    providerMentions(db, tenantId, account, f),
    rankingTable(db, tenantId, account, f),
    db.query(`SELECT count(*)::int AS n FROM wl_prompts WHERE tenant_id = $1 AND is_active = true`, [tenantId]),
    (async () => {
      const q = new Q()
      const where = resultWhere(q, tenantId, f)
      const { rows } = await db.query(
        `SELECT lower(regexp_replace(split_part(src->>'url', '/', 3), '^www\\.', '')) AS domain,
                count(*)::int AS occurrences,
                count(DISTINCT src->>'url')::int AS page_count
         FROM wl_results r, jsonb_array_elements(COALESCE(r.url_sources, '[]'::jsonb)) src
         WHERE ${where} AND src->>'url' IS NOT NULL
         GROUP BY 1 ORDER BY occurrences DESC LIMIT 25`,
        q.params,
      )
      return rows
    })(),
  ])

  return {
    data: {
      hasPages: topSources.length > 0,
      promptsCount: promptsCount.rows[0]?.n ?? 0,
      providerMentions: mentions,
      competitorsPerformance: ranking,
      topSourceDomains: topSources.map((r) => ({
        domain: r.domain,
        occurrences: r.occurrences,
        pageCount: r.page_count,
      })),
    },
    isLive: true,
    computedAt: new Date().toISOString(),
    dataVersion: 2,
  }
}

// ---------------------------------------------------------------------------
// /geo/mentions — provider mention series for the chart
// ---------------------------------------------------------------------------
export async function geoMentions(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const account = await getAccount(db, tenantId)
  const providers = await providerMentions(db, tenantId, account, f)
  return { data: { providers }, isLive: true, computedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// /geo/sentiment — breakdown per provider/topic + daily historical scores
// ---------------------------------------------------------------------------
async function accountSentimentBreakdown(db, tenantId, f, domains) {
  const q = new Q()
  const where = resultWhere(q, tenantId, f)
  const domainsP = q.add(domains)
  const { rows } = await db.query(
    `WITH prompt_feel AS (
       SELECT scan_id, prompt_id, topic, provider, ${FEEL_CASE} AS final_feel
       FROM wl_results r
       WHERE ${where} AND r.company_domain = ANY(${domainsP}::text[]) AND feel IS NOT NULL
       GROUP BY scan_id, prompt_id, topic, provider
     )
     SELECT topic, provider, lower(final_feel) AS feel, count(*)::int AS count
     FROM prompt_feel GROUP BY topic, provider, final_feel ORDER BY topic, provider`,
    q.params,
  )
  const byKey = new Map()
  const overall = { positive: 0, negative: 0, neutral: 0, mixed: 0 }
  for (const r of rows) {
    const key = `${r.topic}|${r.provider}`
    if (!byKey.has(key)) {
      byKey.set(key, { topic: r.topic, provider: r.provider, breakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 } })
    }
    byKey.get(key).breakdown[r.feel] += r.count
    overall[r.feel] += r.count
  }
  return { byKey, overall }
}

export async function geoSentiment(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const account = await getAccount(db, tenantId)
  const domains = account?.domains ?? []
  if (!domains.length) {
    return {
      data: { summary: [], overallScore: null, previousOverallScore: null, historical: [] },
      isLive: true,
    }
  }

  const { byKey, overall } = await accountSentimentBreakdown(db, tenantId, f, domains)
  const summary = [...byKey.values()].map((g) => ({ ...g, score: sentimentScore(g.breakdown) }))

  const prevF = previousPeriod(f)
  const { overall: prevOverall } = await accountSentimentBreakdown(db, tenantId, prevF, domains)

  const hq = new Q()
  const hwhere = resultWhere(hq, tenantId, f)
  const hdomainsP = hq.add(domains)
  const { rows: histRows } = await db.query(
    `WITH prompt_feel AS (
       SELECT (("timestamp" AT TIME ZONE 'UTC')::date)::text AS day, scan_id, prompt_id, provider,
              ${FEEL_CASE} AS final_feel
       FROM wl_results r
       WHERE ${hwhere} AND r.company_domain = ANY(${hdomainsP}::text[]) AND feel IS NOT NULL
       GROUP BY day, scan_id, prompt_id, provider
     )
     SELECT day, provider, lower(final_feel) AS feel, count(*)::int AS count
     FROM prompt_feel GROUP BY day, provider, final_feel ORDER BY day`,
    hq.params,
  )
  const histKey = new Map()
  for (const r of histRows) {
    const key = `${r.day}|${r.provider}`
    if (!histKey.has(key)) {
      histKey.set(key, { date: r.day, provider: r.provider, breakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 } })
    }
    histKey.get(key).breakdown[r.feel] += r.count
  }
  const historical = [...histKey.values()].map((g) => ({
    date: g.date,
    provider: g.provider,
    sentimentScore: sentimentScore(g.breakdown) ?? 0,
  }))

  return {
    data: {
      summary,
      overallScore: sentimentScore(overall),
      previousOverallScore: sentimentScore(prevOverall),
      historical,
    },
    isLive: true,
    computedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// /geo/prompts — prompt table with range-computed metrics
// ---------------------------------------------------------------------------
export async function geoPrompts(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const account = await getAccount(db, tenantId)
  const domains = account?.domains ?? []

  const { rows: prompts } = await db.query(
    `SELECT p.id, p.prompt, p.topic_id AS "topicId", t.name AS topic_name, t.state AS topic_state,
            p.type, p.tags, p.regions, p.is_active AS "isActive", p.volume, p.state,
            (p.raw->>'meInPrompt')::boolean AS "meInPrompt"
     FROM wl_prompts p LEFT JOIN wl_topics t ON t.id = p.topic_id
     WHERE p.tenant_id = $1 AND COALESCE(p.is_active, true) = true
     ORDER BY p.prompt`,
    [tenantId],
  )

  const prevF = previousPeriod(f)
  const [visByPrompt, prevVisByPrompt] = await Promise.all([
    promptResponseMetrics(db, tenantId, f),
    promptResponseMetrics(db, tenantId, prevF),
  ])

  let feelByPrompt = {}
  if (domains.length) {
    const fq = new Q()
    const fwhere = resultWhere(fq, tenantId, f)
    const fdomainsP = fq.add(domains)
    const { rows: feelRows } = await db.query(
      `WITH prompt_feel AS (
         SELECT prompt_id, scan_id, provider, ${FEEL_CASE} AS final_feel
         FROM wl_results r
         WHERE ${fwhere} AND r.company_domain = ANY(${fdomainsP}::text[]) AND feel IS NOT NULL
         GROUP BY prompt_id, scan_id, provider
       )
       SELECT prompt_id, lower(final_feel) AS feel, count(*)::int AS count
       FROM prompt_feel GROUP BY prompt_id, final_feel`,
      fq.params,
    )
    for (const r of feelRows) {
      ;(feelByPrompt[r.prompt_id] ??= { positive: 0, negative: 0, neutral: 0, mixed: 0 })[r.feel] += r.count
    }
  }

  const rows = prompts.map((p) => {
    const vis = visByPrompt[p.id]
    const prevVis = prevVisByPrompt[p.id]
    const breakdown = feelByPrompt[p.id]
    const avgVisibility = vis?.avg_visibility != null ? Math.round(vis.avg_visibility) : null
    const prevAvgVisibility =
      prevVis?.avg_visibility != null ? Math.round(prevVis.avg_visibility) : null
    const avgRank = vis?.avg_rank != null ? Math.round(vis.avg_rank * 10) / 10 : null
    const prevAvgRank = prevVis?.avg_rank != null ? Math.round(prevVis.avg_rank * 10) / 10 : null
    return {
      id: p.id,
      prompt: p.prompt,
      topicId: p.topicId,
      topic: p.topicId ? { id: p.topicId, name: p.topic_name, state: p.topic_state } : null,
      tags: p.tags ?? [],
      type: p.type,
      regions: p.regions ?? [],
      meInPrompt: p.meInPrompt,
      volume: p.volume,
      isActive: p.isActive,
      state: p.state,
      avgVisibility,
      visibilityChange: pctChange(avgVisibility, prevAvgVisibility),
      avgRank,
      rankChange: pctChange(avgRank, prevAvgRank),
      avgSentimentScore: breakdown ? sentimentScore(breakdown) : null,
      sentimentBreakdown: breakdown ?? null,
      responsesCount: vis?.response_units ?? 0,
    }
  })

  // Only prompts matching the prompt-level filters (topic/tags/promptIds/type)
  const filtered = rows.filter((p) => {
    if (f.prompts.length && !f.prompts.includes(p.id)) return false
    if (f.topics.length && !(f.topics.includes(p.topicId ?? '') || f.topics.includes(p.topic?.name ?? ''))) return false
    if (f.promptTypes.length && !f.promptTypes.includes(p.type ?? '')) return false
    if (f.branded === 'AccountIncluded' && p.meInPrompt !== true) return false
    if (f.branded === 'AccountNotIncluded' && p.meInPrompt !== false) return false
    if (f.tags.length) {
      const names = (p.tags ?? []).map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      if (!names.some((n) => f.tags.includes(n))) return false
    }
    return true
  })

  return { total: filtered.length, prompts: filtered }
}

// ---------------------------------------------------------------------------
// /geo/provider-mentions/:provider/prompts — lazy load for dashboard dialog
// ---------------------------------------------------------------------------
export async function geoProviderMentionPrompts(db, tenantId, rawQuery, provider) {
  const f = parseGeoFilters(rawQuery)
  const account = await getAccount(db, tenantId)
  const domains = account?.domains ?? []
  if (!domains.length || !provider) return { prompts: [] }

  const q = new Q()
  const where = resultWhere(q, tenantId, f)
  const providerP = q.add(provider)
  const domainsP = q.add(domains)
  const { rows } = await db.query(
    `SELECT r.prompt_id AS "promptId", r.prompt, r.topic,
            count(DISTINCT (r.prompt, r.provider))::int AS count
     FROM wl_results r
     WHERE ${where} AND r.provider = ${providerP} AND r.company_domain = ANY(${domainsP}::text[])
       AND r.prompt IS NOT NULL
     GROUP BY r.prompt_id, r.prompt, r.topic
     ORDER BY count DESC, r.prompt`,
    q.params,
  )
  return {
    prompts: rows.map((r) => ({
      promptId: r.promptId,
      prompt: r.prompt,
      topic: r.topic ?? null,
      count: r.count,
    })),
  }
}

// ---------------------------------------------------------------------------
// /geo/competitors
// ---------------------------------------------------------------------------
export async function geoCompetitors(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const account = await getAccount(db, tenantId)
  const ranking = await rankingTable(db, tenantId, account, f)
  return { data: { ranking }, isLive: true, computedAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// /geo/responses — paginated response list
// ---------------------------------------------------------------------------
export async function geoResponses(db, tenantId, rawQuery) {
  await loadResponseFormatters()
  const f = parseGeoFilters(rawQuery)
  const skip = Math.max(0, Number(rawQuery.skip) || 0)
  const take = Math.min(200, Math.max(1, Number(rawQuery.take) || 50))

  const q = new Q()
  const where = responseWhere(q, tenantId, f)
  const countParams = [...q.params]
  const skipP = q.add(skip)
  const takeP = q.add(take)

  const [{ rows: countRows }, { rows }] = await Promise.all([
    db.query(`SELECT count(*)::int AS total FROM wl_prompt_responses pr WHERE ${where}`, countParams),
    db.query(
      `SELECT pr.id, pr.provider, pr.model, pr."timestamp", pr.region, pr.country,
              pr.visibility, pr.response_rank AS "responseRank", pr.sources, pr.status,
              COALESCE(
                pr.response_preview,
                NULLIF(trim(pr.raw->>'responsePreview'), ''),
                NULLIF(trim(pr.raw->>'response_preview'), ''),
                NULLIF(trim(pr.raw->>'snippet'), ''),
                NULLIF(trim(pr.raw->>'preview'), ''),
                left(NULLIF(trim(pr.raw->>'response'), ''), 400)
              ) AS response_preview,
              COALESCE(
                pr.response_text,
                NULLIF(trim(pr.raw->>'response'), ''),
                NULLIF(trim(pr.raw->>'fullResponse'), ''),
                NULLIF(trim(pr.raw->>'answer'), '')
              ) AS response_text,
              pr.prompt_id AS "promptId", pr.topic_id AS "topicId", pr.raw,
              p.prompt AS prompt_text, t.name AS topic_name
       FROM wl_prompt_responses pr
       LEFT JOIN wl_prompts p ON p.id = pr.prompt_id
       LEFT JOIN wl_topics t ON t.id = pr.topic_id
       WHERE ${where}
       ORDER BY pr."timestamp" DESC
       OFFSET ${skipP} LIMIT ${takeP}`,
      q.params,
    ),
  ])

  return {
    data: {
      total: countRows[0]?.total ?? 0,
      responses: rows.map(mapGeoResponseRow),
    },
    isLive: true,
    computedAt: new Date().toISOString(),
  }
}

function extractResponsePreview(r) {
  if (typeof r.response_preview === 'string' && r.response_preview.trim()) return r.response_preview
  const raw = r.raw && typeof r.raw === 'object' ? r.raw : {}
  for (const key of ['responsePreview', 'response_preview', 'preview', 'snippet', 'shortResponse', 'excerpt']) {
    const v = raw[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  const full = extractResponseText(r)
  return full ? full.slice(0, 400) : null
}

function extractResponseText(r) {
  if (typeof r.response_text === 'string' && r.response_text.trim()) return r.response_text
  const raw = r.raw && typeof r.raw === 'object' ? r.raw : {}
  for (const key of ['response', 'fullResponse', 'full_response', 'answer', 'text', 'content']) {
    const v = raw[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  const nested = raw.json_response ?? raw.jsonResponse
  if (nested && typeof nested === 'object') {
    for (const key of ['response', 'text', 'content', 'answer']) {
      const v = nested[key]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return null
}

function extractSentimentScore(r) {
  const raw = r.raw && typeof r.raw === 'object' ? r.raw : {}
  for (const key of ['sentimentScore', 'sentinemtScore', 'avgSentimentScore']) {
    const v = raw[key]
    if (typeof v === 'number' && !Number.isNaN(v)) return v
  }
  return null
}

function mapGeoResponseRow(r) {
  const rawPreview = extractResponsePreview(r)
  const rawText = extractResponseText(r)
  const sentimentScore = extractSentimentScore(r)
  const responseText = rawText
    ? formatResponseDisplayText(rawText)
    : rawPreview
      ? formatResponseDisplayText(rawPreview)
      : null
  const responsePreview = responseText
    ? formatResponsePreview(responseText)
    : rawPreview
      ? formatResponsePreview(rawPreview)
      : null

  return {
    id: r.id,
    provider: r.provider,
    model: r.model,
    timestamp: r.timestamp,
    region: r.region,
    countries: r.country ? [r.country] : [],
    myRank: r.responseRank,
    visibilityAverage: r.visibility,
    sources: r.sources ?? [],
    status: r.status,
    promptId: r.promptId,
    topicId: r.topicId,
    promptText: r.prompt_text,
    topic: r.topic_name,
    responsePreview,
    response: responseText,
    sentimentScore,
    raw: r.raw ?? null,
  }
}

// ---------------------------------------------------------------------------
// /geo/responses/:id — single response detail for the mentions drawer
// ---------------------------------------------------------------------------
export async function geoResponseDetail(db, tenantId, responseId) {
  await loadResponseFormatters()
  const { rows } = await db.query(
    `SELECT pr.id, pr.provider, pr.model, pr."timestamp", pr.region, pr.country,
            pr.visibility, pr.response_rank AS "responseRank", pr.sources, pr.status,
            COALESCE(
              pr.response_preview,
              NULLIF(trim(pr.raw->>'responsePreview'), ''),
              NULLIF(trim(pr.raw->>'response_preview'), ''),
              NULLIF(trim(pr.raw->>'snippet'), ''),
              NULLIF(trim(pr.raw->>'preview'), ''),
              left(NULLIF(trim(pr.raw->>'response'), ''), 400)
            ) AS response_preview,
            COALESCE(
              pr.response_text,
              NULLIF(trim(pr.raw->>'response'), ''),
              NULLIF(trim(pr.raw->>'fullResponse'), ''),
              NULLIF(trim(pr.raw->>'answer'), '')
            ) AS response_text,
            pr.prompt_id AS "promptId", pr.topic_id AS "topicId", pr.raw,
            p.prompt AS prompt_text, t.name AS topic_name
     FROM wl_prompt_responses pr
     LEFT JOIN wl_prompts p ON p.id = pr.prompt_id
     LEFT JOIN wl_topics t ON t.id = pr.topic_id
     WHERE pr.tenant_id = $1 AND pr.id = $2::uuid
     LIMIT 1`,
    [tenantId, responseId],
  )
  if (!rows[0]) {
    const err = new Error('Response not found')
    err.statusCode = 404
    throw err
  }
  return { data: mapGeoResponseRow(rows[0]), isLive: true, computedAt: new Date().toISOString() }
}
