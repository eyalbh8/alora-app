/**
 * GEO aggregation endpoints backed by the live iGEO Public API.
 * Response shapes match the previous SQL /geo/* contract so the React
 * screens do not need to change their types.
 */
import {
  igeoGet as igeoGetRaw,
  igeoGetCached as igeoGetCachedRaw,
  previousPeriod,
  resolveIgeoCredentials,
  toIgeoQuery,
  toIsoDay,
  toEndIso,
  toStartIso,
} from './igeoClient.mjs'

const IGEO_RANGE_PRESETS = new Set([1, 7, 14, 30, 90])

function parseIgeoRangeDays(value) {
  const n = Number(value)
  return IGEO_RANGE_PRESETS.has(n) ? n : null
}

function addUtcDays(day, delta) {
  const d = new Date(`${day}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Last-N-days presets must use iGEO `range=N` — UTC start/end misses the first day. */
function resolveCrawlerRangeDays(filters) {
  const explicit = parseIgeoRangeDays(filters?.rangeDays)
  if (explicit != null) return explicit
  if (!filters?.startDate || !filters?.endDate) return null
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = addUtcDays(today, -1)
  for (const end of [today, yesterday]) {
    for (const days of IGEO_RANGE_PRESETS) {
      const start = addUtcDays(end, -(days - 1))
      if (filters.startDate === start && filters.endDate === end) return days
    }
  }
  return null
}

/** Prefer iGEO's native range=N over UTC start/end (matches the iGEO web app). */
function toIgeoQueryWithRange(filters, extra = {}, options = {}) {
  const q = toIgeoQuery(filters, extra, options)
  const rangeDays = parseIgeoRangeDays(filters?.rangeDays)
  if (rangeDays == null) return q
  const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q)
  params.delete('startDate')
  params.delete('endDate')
  params.set('range', String(rangeDays))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Peel iGEO `{ data, computedAt, isLive }` envelopes (sometimes nested). */
function unwrapPayload(value) {
  let current = value
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) break
    if (
      current.data != null &&
      typeof current.data === 'object' &&
      (current.computedAt != null ||
        current.isLive != null ||
        current.dataVersion != null ||
        Array.isArray(current.data.llmProviders) ||
        current.data.historicalData != null)
    ) {
      current = current.data
      continue
    }
    break
  }
  return current
}

async function igeoGet(accountId, apiKey, pathAndQuery) {
  return unwrapPayload(await igeoGetRaw(accountId, apiKey, pathAndQuery))
}

async function igeoGetCached(accountId, apiKey, pathAndQuery) {
  return unwrapPayload(await igeoGetCachedRaw(accountId, apiKey, pathAndQuery))
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
    rangeDays: parseIgeoRangeDays(q.range),
    providers: csv(q.providers),
    topics: csv(q.topics),
    prompts: csv(q.prompts),
    regions: csv(q.regions),
    tags: csv(q.tags),
    branded: q.branded === 'AccountIncluded' || q.branded === 'AccountNotIncluded' ? q.branded : null,
    promptTypes: csv(q.promptTypes),
  }
}

function nowIso() {
  return new Date().toISOString()
}

function asArray(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    if (Array.isArray(value.topics)) return value.topics
    if (Array.isArray(value.prompts)) return value.prompts
    if (Array.isArray(value.tags)) return value.tags
    if (Array.isArray(value.competitors)) return value.competitors
    if (Array.isArray(value.items)) return value.items
    if (Array.isArray(value.data)) return value.data
  }
  return []
}

function tagName(tag) {
  if (typeof tag === 'string') return tag.trim() || null
  if (tag && typeof tag === 'object') {
    const name = tag.name || tag.label || tag.tag
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return null
}

function mapResponseRow(row, { list = false } = {}) {
  const countries = Array.isArray(row.countries)
    ? row.countries
    : row.region
      ? [row.region]
      : row.country
        ? [row.country]
        : []
  const preview = row.responsePreview ?? row.response_preview ?? null
  const full = row.response ?? null
  return {
    id: row.id,
    provider: row.provider ?? null,
    model: row.model ?? null,
    timestamp: row.timestamp ?? row.createdAt ?? null,
    region: row.region ?? null,
    countries,
    myRank: row.myRank ?? row.responseRank ?? null,
    visibilityAverage: row.visibilityAverage ?? row.visibility ?? null,
    sources: row.sources ?? [],
    status: row.status ?? null,
    promptId: row.promptId ?? null,
    topicId: row.topicId ?? null,
    promptText: row.promptText ?? row.prompt ?? null,
    topic: typeof row.topic === 'string' ? row.topic : row.topic?.name ?? null,
    responsePreview: preview || (full ? String(full).slice(0, 400) : null),
    response: list ? null : full,
    sentimentScore: row.sentimentScore ?? row.sentinemtScore ?? null,
    raw: row.rawResponseDetails ?? row.jsonResponse ?? row.raw ?? null,
  }
}

function mapPromptRow(p) {
  const topic = p.topic
    ? {
        id: p.topic.id ?? p.topicId ?? null,
        name: p.topic.name ?? '',
        state: p.topic.state ?? null,
      }
    : p.topicId
      ? { id: p.topicId, name: '', state: null }
      : null
  return {
    id: p.id,
    prompt: p.prompt,
    topicId: p.topicId ?? p.topic?.id ?? null,
    topic,
    tags: p.tags ?? [],
    type: p.type ?? null,
    regions: p.regions ?? [],
    meInPrompt: p.meInPrompt ?? null,
    volume: p.volume ?? null,
    isActive: p.isActive ?? p.active ?? true,
    state: p.state ?? null,
    avgVisibility: p.avgVisibility ?? null,
    visibilityChange: p.visibilityChange ?? null,
    avgRank: p.avgRank ?? null,
    rankChange: p.rankChange ?? null,
    avgSentimentScore: p.avgSentimentScore ?? null,
    sentimentBreakdown: p.sentimentBreakdown ?? null,
    responsesCount: p.responsesCount ?? 0,
  }
}

async function creds(db, tenantId) {
  return resolveIgeoCredentials(db, tenantId)
}

function accountPath(accountId, suffix, query = '') {
  return `/accounts/${accountId}${suffix}${query}`
}

async function optionalIgeo(accountId, apiKey, pathAndQuery) {
  try {
    return await igeoGet(accountId, apiKey, pathAndQuery)
  } catch (err) {
    console.warn(
      `[geo] optional ${pathAndQuery} failed: ${err instanceof Error ? err.message : err}`,
    )
    return null
  }
}

function collectRegions(account, promptRows) {
  const set = new Set()
  for (const value of account?.accountSettings?.regions ?? []) {
    if (value) set.add(String(value))
  }
  for (const prompt of promptRows) {
    for (const region of prompt.regions ?? []) {
      if (typeof region === 'string' && region) set.add(region)
      else if (region?.country) set.add(String(region.country))
      else if (region?.name) set.add(String(region.name))
      else if (region?.locale) set.add(String(region.locale))
    }
  }
  return [...set].sort()
}

// ---------------------------------------------------------------------------
// /geo/meta
// ---------------------------------------------------------------------------
export async function geoMeta(db, tenantId) {
  const { accountId, apiKey } = await creds(db, tenantId)

  // GET /regions is control-plane on iGEO and returns 403 for API keys.
  // Use account settings + prompt regions instead.
  const [account, topicsRaw, promptsRaw, tagsRaw, lastScan, competitorsRaw] = await Promise.all([
    igeoGetCached(accountId, apiKey, `/accounts/${accountId}`),
    igeoGetCached(accountId, apiKey, accountPath(accountId, '/topics')),
    igeoGet(accountId, apiKey, accountPath(accountId, '/prompts', '?take=200&skip=0')),
    igeoGet(accountId, apiKey, accountPath(accountId, '/tags')),
    igeoGet(accountId, apiKey, accountPath(accountId, '/scans/last')),
    optionalIgeo(accountId, apiKey, accountPath(accountId, '/market-players', '?take=100&skip=0')),
  ])

  const topics = asArray(topicsRaw).map((t) => ({ id: t.id, name: t.name }))
  const prompts = asArray(promptsRaw).map((p) => ({
    id: p.id,
    text: p.prompt ?? p.text ?? '',
  }))
  const promptRows = asArray(promptsRaw)

  const tagSet = new Set()
  const promptTypeSet = new Set()
  for (const p of promptRows) {
    if (p.type) promptTypeSet.add(p.type)
    for (const t of p.tags ?? []) {
      const name = tagName(t)
      if (name) tagSet.add(name)
    }
  }
  for (const t of asArray(tagsRaw)) {
    const name = tagName(t)
    if (name) tagSet.add(name)
  }
  console.info('[geo/meta] tags', {
    rawType: tagsRaw == null ? 'null' : Array.isArray(tagsRaw) ? `array:${tagsRaw.length}` : typeof tagsRaw,
    rawKeys: tagsRaw && typeof tagsRaw === 'object' && !Array.isArray(tagsRaw) ? Object.keys(tagsRaw) : [],
    fromPrompts: promptRows.filter((p) => (p.tags ?? []).length > 0).length,
    collected: [...tagSet],
  })

  const providers = (account?.accountSettings?.aiEngines ?? [])
    .map((e) => e?.name)
    .filter(Boolean)

  const regions = collectRegions(account, promptRows)

  const competitors = asArray(competitorsRaw).map((c) => ({
    id: c.id,
    name: c.name ?? c.title ?? '',
    logo: c.logo ?? null,
    site: c.site ?? null,
    domain: c.domain ?? null,
    status: c.status ?? null,
  }))

  const maxDay = toIsoDay(lastScan) || toIsoDay(lastScan?.date) || toIsoDay(lastScan?.lastRunDate)

  return {
    hasFacts: Boolean(maxDay),
    factDays: { min: null, max: maxDay },
    account: account
      ? {
          id: account.id,
          title: account.title,
          names: account.names ?? [],
          domains: account.domains ?? [],
          logo: account.logo ?? null,
        }
      : null,
    options: {
      providers,
      topics,
      prompts,
      regions,
      tags: [...tagSet].sort(),
      promptTypes: [...promptTypeSet].sort(),
    },
    competitors,
  }
}

export async function geoTenantScanDays(db, tenantId) {
  const { accountId, apiKey } = await creds(db, tenantId)
  const lastScan = await igeoGet(accountId, apiKey, accountPath(accountId, '/scans/last'))
  const day = toIsoDay(lastScan) || toIsoDay(lastScan?.date) || toIsoDay(lastScan?.lastRunDate)
  if (!day) return []
  const pulledAt = typeof lastScan === 'string' ? lastScan : lastScan?.finishedAt ?? lastScan?.date ?? null
  return [
    {
      day,
      status: 'ok',
      finishedAt: pulledAt,
      errorSummary: null,
      pulledAt,
    },
  ]
}

// ---------------------------------------------------------------------------
// /geo/dashboard
// ---------------------------------------------------------------------------
function mapCompetitorRow(row, accountId) {
  const id = row.id ?? row.name ?? ''
  return {
    id,
    name: row.name ?? row.title ?? '',
    logo: row.logo ?? null,
    site: row.site ?? null,
    domain: row.domain ?? null,
    position: row.position ?? null,
    occurrences: row.occurrences ?? 0,
    occurrencesDelta: row.occurrencesDelta ?? null,
    avgRank: row.avgRank ?? null,
    avgRankDelta: row.avgRankDelta ?? null,
    sentimentScore: row.sentimentScore ?? null,
    sentimentScoreDelta: row.sentimentScoreDelta ?? null,
    historicalData: row.historicalData ?? [],
    isAccount: Boolean(row.isAccount || (accountId && id === accountId)),
  }
}

export async function geoDashboard(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const q = toIgeoQueryWithRange(f, {}, { engines: 'aiEngines' })

  console.info('[geo/dashboard] start', {
    tenantId,
    accountId,
    filters: f,
    igeoQuery: q,
  })

  let [dash, topSources] = await Promise.all([
    igeoGet(accountId, apiKey, accountPath(accountId, '/ui-pages/dashboard', q)),
    igeoGet(accountId, apiKey, accountPath(accountId, '/ui-pages/dashboard/top-source-domains', q)),
  ])

  const noExtraFilters =
    f.providers.length === 0 &&
    f.topics.length === 0 &&
    f.prompts.length === 0 &&
    f.regions.length === 0 &&
    f.tags.length === 0 &&
    !f.branded &&
    f.promptTypes.length === 0

  const firstMentions = asArray(dash?.providerMentions).length
  const firstCompetitors = asArray(dash?.competitorsPerformance).length
  console.info('[geo/dashboard] first response', {
    dashType: dash == null ? 'null' : Array.isArray(dash) ? 'array' : typeof dash,
    dashKeys: dash && typeof dash === 'object' && !Array.isArray(dash) ? Object.keys(dash) : [],
    firstMentions,
    firstCompetitors,
    promptsCountRaw: dash?.promptsCount,
    topSourcesType: Array.isArray(topSources) ? `array:${topSources.length}` : typeof topSources,
  })

  // iGEO's dashboard uses range=7 when a date window contains no completed scans.
  let usedFallback = false
  if (
    noExtraFilters &&
    firstMentions === 0 &&
    firstCompetitors === 0
  ) {
    usedFallback = true
    const fallback = '?range=7'
    console.info('[geo/dashboard] empty dated payload, retrying with', fallback)
    ;[dash, topSources] = await Promise.all([
      igeoGet(accountId, apiKey, accountPath(accountId, '/ui-pages/dashboard', fallback)),
      igeoGet(
        accountId,
        apiKey,
        accountPath(accountId, '/ui-pages/dashboard/top-source-domains', fallback),
      ),
    ])
  }

  const sources = Array.isArray(topSources) ? topSources : asArray(topSources)
  const mentions = asArray(dash?.providerMentions).map((m) => ({
    provider: m.provider,
    count: m.count ?? 0,
    countChange: m.countChange ?? null,
    historicalData: m.historicalData ?? [],
  }))
  const competitors = asArray(dash?.competitorsPerformance).map((row) =>
    mapCompetitorRow(row, accountId),
  )
  const promptsCount =
    typeof dash?.promptsCount === 'number'
      ? dash.promptsCount
      : (dash?.promptsCount?.total ?? dash?.promptsCount?.count ?? 0)

  const mapped = {
    hasPages: dash?.hasPages ?? sources.length > 0,
    promptsCount,
    providerMentions: mentions,
    competitorsPerformance: competitors,
    agentPosts: dash?.agentPosts ?? null,
    weeklyInsights: dash?.weeklyInsights ?? null,
    topSourceDomains: sources.map((s) => ({
      domain: s.domain,
      pageCount: s.pageCount ?? s.page_count ?? 0,
      occurrences: s.occurrences ?? 0,
    })),
  }

  console.info('[geo/dashboard] mapped', {
    usedFallback,
    promptsCount,
    mentionCount: mentions.length,
    mentionTotals: mentions.map((m) => ({ provider: m.provider, count: m.count })),
    competitorCount: competitors.length,
    competitorSample: competitors.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      occurrences: c.occurrences,
      isAccount: c.isAccount,
    })),
    sourceCount: mapped.topSourceDomains.length,
  })

  return {
    data: mapped,
    isLive: true,
    computedAt: nowIso(),
    dataVersion: 2,
  }
}

// ---------------------------------------------------------------------------
// /geo/mentions — chart-data includes historicalData
// ---------------------------------------------------------------------------
export async function geoMentions(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const q = toIgeoQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' })
  const chart = await igeoGet(
    accountId,
    apiKey,
    accountPath(accountId, '/prompts/responses/chart-data', q),
  )
  return {
    data: {
      providers: chart?.providers ?? [],
      trackedRecommendations: asArray(chart?.trackedRecommendations),
      posts: asArray(chart?.posts),
    },
    isLive: true,
    computedAt: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// /geo/sentiment
// ---------------------------------------------------------------------------
export async function geoSentiment(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const histQ = toIgeoQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' })
  const historicalRaw = await igeoGet(
    accountId,
    apiKey,
    accountPath(accountId, '/prompts/responses/sentiment/historical', histQ),
  )

  const historical = (Array.isArray(historicalRaw) ? historicalRaw : asArray(historicalRaw)).map(
    (row) => ({
      date: toIsoDay(row.date) || String(row.date),
      provider: row.provider || 'ALL',
      sentimentScore: Number(row.sentimentScore) || 0,
    }),
  )
  // iGEO Sentiment page: current = mean of every historical point; previous = first half.
  const periodScores = historical
    .map((row) => row.sentimentScore)
    .filter((value) => Number.isFinite(value))
  const mean = (values) =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  const overallScore = mean(periodScores)
  const previousOverallScore = mean(periodScores.slice(0, Math.floor(periodScores.length / 2)))

  return {
    data: {
      summary: [],
      overallScore,
      previousOverallScore,
      historical,
    },
    isLive: true,
    computedAt: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// /geo/prompts
// ---------------------------------------------------------------------------
export async function geoPrompts(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const skip = Math.max(0, Number(rawQuery.skip) || 0)
  const take = Math.min(200, Math.max(1, Number(rawQuery.take) || 200))
  const q = toIgeoQueryWithRange(f, { skip, take }, { engines: 'aiEngines' })
  const result = await igeoGet(accountId, apiKey, accountPath(accountId, '/prompts', q))
  const prompts = asArray(result).map(mapPromptRow)
  return {
    total: typeof result?.total === 'number' ? result.total : prompts.length,
    prompts,
  }
}

// ---------------------------------------------------------------------------
// /geo/provider-mentions/:provider/prompts
// ---------------------------------------------------------------------------
export async function geoProviderMentionPrompts(db, tenantId, rawQuery, provider) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  if (!provider) return { prompts: [] }
  const q = toIgeoQueryWithRange(f, {}, { engines: 'aiEngines' })
  const rows = await igeoGet(
    accountId,
    apiKey,
    accountPath(accountId, `/provider-mentions/${encodeURIComponent(provider)}/prompts`, q),
  )
  return {
    prompts: asArray(rows).map((r) => ({
      promptId: r.promptId ?? r.id ?? null,
      prompt: r.prompt ?? r.text ?? '',
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
  const { accountId, apiKey } = await creds(db, tenantId)
  const q = toIgeoQueryWithRange(f, {}, { engines: 'aiEngines' })
  const page = await igeoGet(accountId, apiKey, accountPath(accountId, '/market-players/page-data', q))
  const ranking = page?.ranking ?? page?.competitors ?? (Array.isArray(page) ? page : [])
  return {
    data: { ranking },
    isLive: true,
    computedAt: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// /geo/responses
// ---------------------------------------------------------------------------
export async function geoResponses(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const skip = Math.max(0, Number(rawQuery.skip) || 0)
  const take = Math.min(100, Math.max(1, Number(rawQuery.take) || 50))
  const q = toIgeoQueryWithRange(f, { skip, take, listOnly: 'true' }, { engines: 'providers' })
  const path =
    rawQuery.sentiment === '1' || rawQuery.sentiment === 'true'
      ? '/prompts/responses/sentiment'
      : '/prompts/responses'
  const result = await igeoGet(accountId, apiKey, accountPath(accountId, path, q))
  const responses = (result?.responses ?? asArray(result)).map((row) =>
    mapResponseRow(row, { list: true }),
  )
  return {
    data: {
      total: result?.total ?? responses.length,
      responses,
    },
    isLive: true,
    computedAt: nowIso(),
  }
}

export async function geoResponseDetail(db, tenantId, responseId) {
  const { accountId, apiKey } = await creds(db, tenantId)
  const row = await igeoGet(
    accountId,
    apiKey,
    accountPath(accountId, `/prompts/responses/${encodeURIComponent(responseId)}`),
  )
  if (!row) {
    const err = new Error('Response not found')
    err.statusCode = 404
    throw err
  }
  return {
    data: mapResponseRow(row, { list: false }),
    isLive: true,
    computedAt: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// /traffic and /crawlers
// ---------------------------------------------------------------------------
export async function geoTraffic(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const prev = previousPeriod(f)
  // ai-dashboard-data expects an explicit UTC window. `range=N` (used by crawlers)
  // returns an empty series on this endpoint.
  const params = new URLSearchParams({
    startDate: toStartIso(f.startDate),
    endDate: toEndIso(f.endDate),
    prevStartDate: toStartIso(prev.startDate),
    prevEndDate: toEndIso(prev.endDate),
    granularity: 'daily',
  })
  if (f.providers.length) params.set('providers', f.providers.join(','))
  if (f.regions.length) params.set('countries', f.regions.join(','))
  const payload = await igeoGet(
    accountId,
    apiKey,
    `/traffic/${accountId}/ai-dashboard-data?${params.toString()}`,
  )
  const rec = payload && typeof payload === 'object' ? payload : {}
  console.info('[geo/traffic]', {
    startDate: f.startDate,
    endDate: f.endDate,
    igeoQuery: params.toString(),
    keys: Object.keys(rec),
    llmProviders: Array.isArray(rec.llmProviders) ? rec.llmProviders.length : typeof rec.llmProviders,
    historicalData: Array.isArray(rec.historicalData)
      ? rec.historicalData.length
      : typeof rec.historicalData,
    hasEvents: rec.hasEvents ?? null,
  })
  return payload
}

export async function geoCrawlers(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const params = new URLSearchParams()
  const rangeDays = resolveCrawlerRangeDays(f)
  if (rangeDays != null) {
    params.set('range', String(rangeDays))
  } else {
    params.set('startDate', toStartIso(f.startDate))
    params.set('endDate', toEndIso(f.endDate))
  }
  console.info('[geo/crawlers]', {
    startDate: f.startDate,
    endDate: f.endDate,
    rangeDays: f.rangeDays,
    igeoQuery: params.toString(),
  })
  return igeoGet(
    accountId,
    apiKey,
    `/traffic/${accountId}/cloudflare/crawler-analytics?${params.toString()}`,
  )
}
