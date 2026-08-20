/**
 * GEO aggregation endpoints backed by the live upstream Public API.
 * Response shapes match the previous SQL /geo/* contract so the React
 * screens do not need to change their types.
 */
import { isAccountRow } from './accountCompetitor.mjs'
import {
  getSourceApiBase,
  SourceApiError,
  sourceGet as sourceGetRaw,
  sourceGetCached as sourceGetCachedRaw,
  previousPeriod,
  resolveSourceCredentials,
  toSourceQuery,
  toIsoDay,
  toEndIso,
  toStartIso,
} from './sourceClient.mjs'

const RANGE_PRESETS = new Set([1, 7, 14, 30, 90])

function parseRangeDays(value) {
  const n = Number(value)
  return RANGE_PRESETS.has(n) ? n : null
}

function addUtcDays(day, delta) {
  const d = new Date(`${day}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Last-N-days presets must use upstream `range=N` — UTC start/end misses the first day. */
function resolveCrawlerRangeDays(filters) {
  const explicit = parseRangeDays(filters?.rangeDays)
  if (explicit != null) return explicit
  if (!filters?.startDate || !filters?.endDate) return null
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = addUtcDays(today, -1)
  for (const end of [today, yesterday]) {
    for (const days of RANGE_PRESETS) {
      const start = addUtcDays(end, -(days - 1))
      if (filters.startDate === start && filters.endDate === end) return days
    }
  }
  return null
}

/** Prefer native range=N over UTC start/end (matches the upstream web app). */
function toSourceQueryWithRange(filters, extra = {}, options = {}) {
  const q = toSourceQuery(filters, extra, options)
  const rangeDays = parseRangeDays(filters?.rangeDays)
  if (rangeDays == null) return q
  const params = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q)
  params.delete('startDate')
  params.delete('endDate')
  params.set('range', String(rangeDays))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Peel upstream `{ data, computedAt, isLive }` envelopes (sometimes nested). */
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

async function sourceGet(accountId, apiKey, pathAndQuery) {
  return unwrapPayload(await sourceGetRaw(accountId, apiKey, pathAndQuery))
}

async function sourceGetCached(accountId, apiKey, pathAndQuery) {
  return unwrapPayload(await sourceGetCachedRaw(accountId, apiKey, pathAndQuery))
}

async function sourceWrite(accountId, apiKey, pathAndQuery, options = {}) {
  const method = (options.method || 'POST').toUpperCase()
  const url = `${getSourceApiBase()}${pathAndQuery}`
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'X-Workspace-Id': accountId,
    Accept: 'application/json',
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (err) {
    throw new SourceApiError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      502,
    )
  }
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.title || body?.description || body?.message || body?.error || ''
    } catch {
      detail = await response.text().catch(() => '')
    }
    const err = new SourceApiError(
      `Request failed (${response.status}) for ${pathAndQuery}${detail ? `: ${String(detail).slice(0, 240)}` : ''}`,
      response.status,
    )
    throw err
  }
  if (response.status === 204) return null
  return unwrapPayload(await response.json())
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
    rangeDays: parseRangeDays(q.range),
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

function asArray(value, preferredKey) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    if (preferredKey && Array.isArray(value[preferredKey])) return value[preferredKey]
    // Prefer prompts over topics — upstream /prompts often includes both keys, and
    // an empty `topics` array would otherwise wipe the prompt list.
    if (Array.isArray(value.prompts)) return value.prompts
    if (Array.isArray(value.topics)) return value.topics
    if (Array.isArray(value.tags)) return value.tags
    if (Array.isArray(value.competitors)) return value.competitors
    if (Array.isArray(value.sites)) return value.sites
    if (Array.isArray(value.catalog)) return value.catalog
    if (Array.isArray(value.matches)) return value.matches
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

export function mapTag(tag) {
  if (typeof tag === 'string') {
    const name = tag.trim()
    return name ? { name, tagId: name, colorRow: null } : null
  }
  if (!tag || typeof tag !== 'object') return null
  const name = tagName(tag)
  const tagId = tag.tagId || tag.id || null
  const colorRow = tag.colorRow || tag.color || null
  if (!name && !tagId) return null
  return {
    name: name || String(tagId),
    tagId: tagId ? String(tagId) : name,
    colorRow: colorRow ? String(colorRow) : null,
  }
}

function mapTags(value) {
  return asArray(value, 'tags').map(mapTag).filter(Boolean)
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
    tags: mapTags(p.tags),
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
  return resolveSourceCredentials(db, tenantId)
}

function accountPath(accountId, suffix, query = '') {
  return `/accounts/${accountId}${suffix}${query}`
}

async function optionalSource(accountId, apiKey, pathAndQuery) {
  try {
    return await sourceGet(accountId, apiKey, pathAndQuery)
  } catch (err) {
    console.warn(
      `[geo] optional ${pathAndQuery} failed: ${err instanceof Error ? err.message : err}`,
    )
    return null
  }
}

function isPublicAllowlistDenied(err) {
  const message = err instanceof Error ? err.message : String(err)
  return (
    err?.statusCode === 403 &&
    /not exposed for public API access/i.test(message)
  )
}

/** REST first; MCP `api_get` for MCP-allowlisted paths the public API blocks. */
async function sourceGetAllowlisted(accountId, apiKey, pathAndQuery) {
  try {
    return await sourceGet(accountId, apiKey, pathAndQuery)
  } catch (err) {
    if (!isPublicAllowlistDenied(err)) throw err
    try {
      const raw = await mcpApiGet(accountId, apiKey, pathAndQuery)
      console.info(`[geo] MCP api_get OK ${pathAndQuery}`)
      return unwrapPayload(raw)
    } catch (mcpErr) {
      console.warn(
        `[geo] MCP api_get failed for ${pathAndQuery}: ${
          mcpErr instanceof Error ? mcpErr.message : mcpErr
        }`,
      )
      throw err
    }
  }
}

async function optionalAllowlisted(accountId, apiKey, pathAndQuery) {
  try {
    return await sourceGetAllowlisted(accountId, apiKey, pathAndQuery)
  } catch (err) {
    console.warn(
      `[geo] optional allowlisted ${pathAndQuery} failed: ${
        err instanceof Error ? err.message : err
      }`,
    )
    return null
  }
}

function isPromptActive(p) {
  return (p?.isActive ?? p?.active) !== false
}

function countActivePrompts(promptsRaw) {
  if (promptsRaw == null) return null
  return asArray(promptsRaw, 'prompts').filter(isPromptActive).length
}

function mapSentimentHistorical(historicalRaw) {
  return (Array.isArray(historicalRaw) ? historicalRaw : asArray(historicalRaw)).map((row) => ({
    date: toIsoDay(row.date) || String(row.date),
    provider: row.provider || 'ALL',
    sentimentScore: Number(row.sentimentScore) || 0,
  }))
}

/** Match the Sentiment screen: current = mean of every point; previous = first half. */
function sentimentPeriodScores(historical) {
  const periodScores = historical
    .map((row) => row.sentimentScore)
    .filter((value) => Number.isFinite(value))
  const mean = (values) =>
    values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
  return {
    overallScore: mean(periodScores),
    previousOverallScore: mean(periodScores.slice(0, Math.floor(periodScores.length / 2))),
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

  // GET /regions is control-plane on upstream and returns 403 for API keys.
  // Use account settings + prompt regions instead.
  const [account, topicsRaw, promptsRaw, tagsRaw, lastScan, competitorsRaw] = await Promise.all([
    sourceGetCached(accountId, apiKey, `/accounts/${accountId}`),
    sourceGetCached(accountId, apiKey, accountPath(accountId, '/topics')),
    sourceGet(accountId, apiKey, accountPath(accountId, '/prompts', '?take=200&skip=0')),
    sourceGet(accountId, apiKey, accountPath(accountId, '/tags')),
    sourceGet(accountId, apiKey, accountPath(accountId, '/scans/last')),
    optionalSource(accountId, apiKey, accountPath(accountId, '/market-players', '?take=100&skip=0')),
  ])

  const topics = asArray(topicsRaw, 'topics').map((t) => ({ id: t.id, name: t.name }))
  const prompts = asArray(promptsRaw, 'prompts').map((p) => ({
    id: p.id,
    text: p.prompt ?? p.text ?? '',
  }))
  const promptRows = asArray(promptsRaw, 'prompts')

  const tagByKey = new Map()
  const promptTypeSet = new Set()
  for (const p of promptRows) {
    if (p.type) promptTypeSet.add(p.type)
    for (const t of mapTags(p.tags)) {
      tagByKey.set(t.tagId || t.name, t)
    }
  }
  for (const t of mapTags(tagsRaw)) {
    tagByKey.set(t.tagId || t.name, t)
  }
  const tagCatalog = [...tagByKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  console.info('[geo/meta] tags', {
    rawType: tagsRaw == null ? 'null' : Array.isArray(tagsRaw) ? `array:${tagsRaw.length}` : typeof tagsRaw,
    rawKeys: tagsRaw && typeof tagsRaw === 'object' && !Array.isArray(tagsRaw) ? Object.keys(tagsRaw) : [],
    fromPrompts: promptRows.filter((p) => (p.tags ?? []).length > 0).length,
    collected: tagCatalog.map((t) => t.name),
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
      tags: tagCatalog.map((t) => t.name),
      tagCatalog,
      promptTypes: [...promptTypeSet].sort(),
    },
    competitors,
  }
}

export async function geoTenantScanDays(db, tenantId) {
  const { accountId, apiKey } = await creds(db, tenantId)
  const lastScan = await sourceGet(accountId, apiKey, accountPath(accountId, '/scans/last'))
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
function mapCompetitorRow(row, accountId, account) {
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
    topics: row.topics ?? [],
    historicalData: row.historicalData ?? [],
    isAccount: isAccountRow(row, accountId, account),
  }
}

export async function geoDashboard(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const q = toSourceQueryWithRange(f, {}, { engines: 'aiEngines' })

  console.info('[geo/dashboard] start', {
    tenantId,
    accountId,
    filters: f,
    sourceQuery: q,
  })

  const promptsQ = toSourceQueryWithRange(f, { skip: 0, take: 200 }, { engines: 'aiEngines' })
  const histQ = toSourceQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' })
  let [dash, topSources, promptsRaw, historicalRaw, account] = await Promise.all([
    sourceGet(accountId, apiKey, accountPath(accountId, '/ui-pages/dashboard', q)),
    sourceGet(accountId, apiKey, accountPath(accountId, '/ui-pages/dashboard/top-source-domains', q)),
    optionalSource(accountId, apiKey, accountPath(accountId, '/prompts', promptsQ)),
    optionalSource(
      accountId,
      apiKey,
      accountPath(accountId, '/prompts/responses/sentiment/historical', histQ),
    ),
    sourceGetCached(accountId, apiKey, `/accounts/${accountId}`),
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

  // dashboard uses range=7 when a date window contains no completed scans.
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
      sourceGet(accountId, apiKey, accountPath(accountId, '/ui-pages/dashboard', fallback)),
      sourceGet(
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
    mapCompetitorRow(row, accountId, account),
  )
  const catalogCount =
    typeof dash?.promptsCount === 'number'
      ? dash.promptsCount
      : (dash?.promptsCount?.total ?? dash?.promptsCount?.count ?? 0)
  const promptsCount = countActivePrompts(promptsRaw) ?? catalogCount
  const { overallScore, previousOverallScore } = sentimentPeriodScores(
    mapSentimentHistorical(historicalRaw),
  )

  const mapped = {
    hasPages: dash?.hasPages ?? sources.length > 0,
    promptsCount,
    overallScore,
    previousOverallScore,
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
    catalogCount,
    overallScore,
    previousOverallScore,
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
  const q = toSourceQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' })
  const chart = await sourceGet(
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
  const histQ = toSourceQueryWithRange(f, { granularity: 'daily' }, { engines: 'providers' })
  const historicalRaw = await sourceGet(
    accountId,
    apiKey,
    accountPath(accountId, '/prompts/responses/sentiment/historical', histQ),
  )

  const historical = mapSentimentHistorical(historicalRaw)
  const { overallScore, previousOverallScore } = sentimentPeriodScores(historical)

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
  const q = toSourceQueryWithRange(f, { skip, take }, { engines: 'aiEngines' })
  const result = await sourceGet(accountId, apiKey, accountPath(accountId, '/prompts', q))
  const prompts = asArray(result, 'prompts').map(mapPromptRow)
  return {
    total: typeof result?.total === 'number' ? result.total : prompts.length,
    prompts,
  }
}

export async function geoTags(db, tenantId) {
  const { accountId, apiKey } = await creds(db, tenantId)
  const [tagsRaw, promptsRaw] = await Promise.all([
    sourceGet(accountId, apiKey, accountPath(accountId, '/tags')),
    sourceGet(accountId, apiKey, accountPath(accountId, '/prompts', '?take=200&skip=0')),
  ])
  const byKey = new Map()
  for (const t of mapTags(tagsRaw)) byKey.set(t.tagId || t.name, t)
  for (const p of asArray(promptsRaw, 'prompts')) {
    for (const t of mapTags(p.tags)) byKey.set(t.tagId || t.name, t)
  }
  return {
    tags: [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

async function trySourceWrites(accountId, apiKey, attempts) {
  let lastError = null
  for (const attempt of attempts) {
    try {
      return await sourceWrite(accountId, apiKey, attempt.path, {
        method: attempt.method,
        body: attempt.body,
      })
    } catch (err) {
      lastError = err
      const status = err?.statusCode
      if (status && status !== 400 && status !== 404 && status !== 405) throw err
      console.warn(
        `[geo/tags] ${attempt.method} ${attempt.path} failed (${status || 'error'}), trying next shape`,
      )
    }
  }
  throw lastError || new Error('Could not save this tag. Try again.')
}

export async function geoCreateTag(db, tenantId, input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!name) {
    const err = new Error('Tag name is required')
    err.statusCode = 400
    throw err
  }
  const colorRow = typeof input?.colorRow === 'string' && input.colorRow.trim() ? input.colorRow.trim() : 'E'
  const { accountId, apiKey } = await creds(db, tenantId)
  const created = await trySourceWrites(accountId, apiKey, [
    { method: 'POST', path: accountPath(accountId, '/tags'), body: { name, colorRow } },
    { method: 'POST', path: accountPath(accountId, '/tags'), body: { name, color: colorRow } },
    { method: 'POST', path: '/tags', body: { name, colorRow } },
  ])
  return { tag: mapTag(created) || { name, tagId: created?.id || created?.tagId || name, colorRow } }
}

export async function geoSetPromptTags(db, tenantId, promptId, input) {
  if (!promptId) {
    const err = new Error('Prompt id is required')
    err.statusCode = 400
    throw err
  }
  const tags = mapTags(input?.tags)
  const tagIds = tags.map((t) => t.tagId).filter(Boolean)
  const { accountId, apiKey } = await creds(db, tenantId)
  const result = await trySourceWrites(accountId, apiKey, [
    { method: 'PATCH', path: accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}`), body: { tags: tagIds } },
    { method: 'PATCH', path: accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}`), body: { tags } },
    { method: 'PATCH', path: accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}`), body: { tagIds } },
    {
      method: 'PUT',
      path: accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}/tags`),
      body: { tags: tagIds },
    },
    { method: 'PUT', path: accountPath(accountId, `/prompts/${encodeURIComponent(promptId)}/tags`), body: { tagIds } },
  ])
  const mapped = mapPromptRow(result?.id ? result : { id: promptId, prompt: result?.prompt, tags: result?.tags ?? tags })
  const nextTags = result?.tags != null ? mapTags(result.tags) : tags
  return { prompt: { ...mapped, tags: nextTags } }
}

export async function geoDeleteTag(db, tenantId, tagId) {
  if (!tagId) {
    const err = new Error('Tag id is required')
    err.statusCode = 400
    throw err
  }
  const { accountId, apiKey } = await creds(db, tenantId)
  await trySourceWrites(accountId, apiKey, [
    { method: 'DELETE', path: accountPath(accountId, `/tags/${encodeURIComponent(tagId)}`) },
    { method: 'DELETE', path: `/tags/${encodeURIComponent(tagId)}` },
  ])
  return { ok: true }
}

// ---------------------------------------------------------------------------
// /geo/provider-mentions/:provider/prompts
// ---------------------------------------------------------------------------
export async function geoProviderMentionPrompts(db, tenantId, rawQuery, provider) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  if (!provider) return { prompts: [] }
  const q = toSourceQueryWithRange(f, {}, { engines: 'aiEngines' })
  const rows = await sourceGet(
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
  const q = toSourceQueryWithRange(f, {}, { engines: 'aiEngines' })
  const [page, account] = await Promise.all([
    sourceGet(accountId, apiKey, accountPath(accountId, '/market-players/page-data', q)),
    sourceGetCached(accountId, apiKey, `/accounts/${accountId}`),
  ])
  const ranking = asArray(page?.ranking ?? page?.competitors ?? page).map((row) =>
    mapCompetitorRow(row, accountId, account),
  )
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
  const q = toSourceQueryWithRange(f, { skip, take, listOnly: 'true' }, { engines: 'providers' })
  const path =
    rawQuery.sentiment === '1' || rawQuery.sentiment === 'true'
      ? '/prompts/responses/sentiment'
      : '/prompts/responses'
  const result = await sourceGet(accountId, apiKey, accountPath(accountId, path, q))
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
  const row = await sourceGet(
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
  const payload = await sourceGet(
    accountId,
    apiKey,
    `/traffic/${accountId}/ai-dashboard-data?${params.toString()}`,
  )
  const rec = payload && typeof payload === 'object' ? payload : {}
  console.info('[geo/traffic]', {
    startDate: f.startDate,
    endDate: f.endDate,
    sourceQuery: params.toString(),
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
    sourceQuery: params.toString(),
  })
  return sourceGet(
    accountId,
    apiKey,
    `/traffic/${accountId}/cloudflare/crawler-analytics?${params.toString()}`,
  )
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeHost(value) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase() || null
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.toLowerCase() || null
  }
}

function stringList(value) {
  return asArray(value)
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (item && typeof item === 'object') {
        const name = item.name || item.label || item.title || item.category
        return typeof name === 'string' ? name.trim() : ''
      }
      return ''
    })
    .filter(Boolean)
}

function mapMarketplaceSite(row) {
  if (!row || typeof row !== 'object') return null
  const site = row.site && typeof row.site === 'object' ? row.site : row
  const domain = normalizeHost(site.domain || site.site || site.url || site.website)
  const name = site.name || site.title || site.publisher || domain
  if (!name && !domain) return null
  const status = typeof site.status === 'string' ? site.status.toUpperCase() : 'ACTIVE'
  const mentionsValue = site.mentions
  const mentions =
    mentionsValue && typeof mentionsValue === 'object'
      ? numberOrNull(mentionsValue.appearances ?? mentionsValue.count ?? mentionsValue.avgCitations)
      : numberOrNull(mentionsValue)
  return {
    id: String(site.id || site.siteId || site.thirdPartySiteId || domain || name),
    name: String(name || domain),
    domain,
    logo: site.logoUrl || site.logo || site.faviconUrl || null,
    faviconUrl: site.faviconUrl || null,
    categories: stringList(site.categories || site.category),
    customerPriceCents: numberOrNull(site.priceCents ?? site.customerPriceCents ?? site.price),
    currency: site.currency || 'USD',
    credits: numberOrNull(site.credits),
    publisher: site.publisher || null,
    origin: site.origin || null,
    status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    thirdPartySiteId: site.thirdPartySiteId ? String(site.thirdPartySiteId) : null,
    traffic: numberOrNull(site.traffic),
    rank: numberOrNull(site.rank),
    mentions,
    occurrences: mentions,
    cited: mentions != null && mentions > 0,
  }
}

function catalogQuery(rawQuery) {
  const params = new URLSearchParams()
  for (const key of ['category', 'domain', 'origin', 'includeInactive']) {
    if (rawQuery[key] != null && rawQuery[key] !== '') params.set(key, String(rawQuery[key]))
  }
  for (const key of ['categories', 'origins']) {
    for (const value of csv(rawQuery[key])) params.append(key, value)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ---------------------------------------------------------------------------
// /geo/marketplace
// ---------------------------------------------------------------------------
export async function geoMarketplace(db, tenantId, rawQuery) {
  parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const raw = await sourceGet(
    accountId,
    apiKey,
    accountPath(accountId, '/articles-marketplace/catalog', catalogQuery(rawQuery)),
  )
  const sites = asArray(raw, 'catalog').map(mapMarketplaceSite).filter(Boolean)
  const matches = sites
    .filter((site) => site.cited)
    .sort((a, b) => {
      const mentionDiff = (b.mentions ?? 0) - (a.mentions ?? 0)
      if (mentionDiff !== 0) return mentionDiff
      return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY)
    })

  console.info('[geo/marketplace] catalog', { sites: sites.length, matches: matches.length })

  return {
    data: {
      matches,
      sites,
      catalogAvailable: true,
    },
    isLive: true,
    computedAt: nowIso(),
  }
}

// ---------------------------------------------------------------------------
// /geo/citations — Sources domains, domain URLs, and URL detail
// ---------------------------------------------------------------------------

function mapTypeCount(row) {
  if (!row || typeof row !== 'object') return null
  const type = String(row.type || row.name || row.domainType || row.urlType || '').trim()
  const count = numberOrNull(row.count ?? row.total ?? row.appearances)
  if (!type || count == null) return null
  return { type, count }
}

function mapCitationTrend(raw) {
  const trend = raw && typeof raw === 'object' ? raw : {}
  return {
    chartCategories: asArray(trend.chartCategories).map((value) => String(value)),
    chartSeries: asArray(trend.chartSeries)
      .map((series) => ({
        name: String(series?.name || series?.type || 'Other'),
        data: asArray(series?.data).map((value) => numberOrNull(value) ?? 0),
      }))
      .filter((series) => series.name),
    currentTotal: numberOrNull(trend.currentTotal) ?? 0,
    previousTotal: numberOrNull(trend.previousTotal) ?? 0,
  }
}

function mapCitationSummary(raw) {
  const summary = raw?.summary && typeof raw.summary === 'object' ? raw.summary : raw || {}
  return {
    totalCitations: numberOrNull(summary.totalCitations) ?? 0,
    distributionByDomainType: asArray(summary.distributionByDomainType).map(mapTypeCount).filter(Boolean),
    distributionByUrlType: asArray(summary.distributionByUrlType).map(mapTypeCount).filter(Boolean),
    trend: mapCitationTrend(summary.trend),
  }
}

function asUsedPercent(value) {
  const n = numberOrNull(value)
  if (n == null) return null
  return n
}

function normalizeUsedPercents(rows) {
  const values = rows.map((row) => row.usedPercent).filter((value) => value != null)
  if (values.length > 0 && values.every((value) => value >= 0 && value <= 1)) {
    return rows.map((row) => ({
      ...row,
      usedPercent: row.usedPercent == null ? null : row.usedPercent * 100,
    }))
  }
  return rows
}

function mapCitationDomain(row) {
  if (!row || typeof row !== 'object') return null
  const domain = normalizeHost(row.domain || row.host || row.hostname || row.source)
  if (!domain) return null
  return {
    domain,
    appearances: numberOrNull(row.appearances ?? row.occurrences ?? row.count),
    domainType: String(row.domainType || row.type || 'Other'),
    usedPercent: asUsedPercent(row.usedPercent ?? row.used),
    avgCitations: numberOrNull(row.avgCitations ?? row.averageCitations),
  }
}

function mapCitationUrl(row, fallbackDomain) {
  if (!row || typeof row !== 'object') return null
  const url = String(row.url || row.href || row.path || '').trim()
  if (!url) return null
  const domain = normalizeHost(row.domain || fallbackDomain) || normalizeHost(url)
  return {
    title: String(row.title || row.name || '').trim() || url,
    url,
    domain: domain || fallbackDomain || '',
    urlType: String(row.urlType || row.domainType || row.type || 'Other'),
    mentions: numberOrNull(row.occurrences ?? row.usedTotal ?? row.mentions ?? row.appearances),
    avgCitations: numberOrNull(row.avgCitations ?? row.averageCitations),
    lastUpdated: row.lastUpdated || row.updatedAt || row.updated || null,
  }
}

function flattenSourceUrls(raw, fallbackDomain) {
  const groups = asArray(raw?.sourceGroups ?? raw?.groups ?? raw?.items, 'sourceGroups')
  const urls = []
  if (groups.length) {
    for (const group of groups) {
      const groupDomain = group?.domain || fallbackDomain
      const groupUrls = asArray(group?.urls)
      if (groupUrls.length) {
        for (const item of groupUrls) urls.push(mapCitationUrl(item, groupDomain))
      } else {
        urls.push(mapCitationUrl(group, groupDomain))
      }
    }
  } else {
    for (const item of asArray(raw?.urls ?? raw?.items, 'urls')) {
      urls.push(mapCitationUrl(item, fallbackDomain))
    }
  }
  return urls.filter(Boolean)
}

function growthPercent(current, previous) {
  if (current == null || previous == null) return null
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function mapCitationUrlDetail(raw, fallbackUrl) {
  const row = raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : raw || {}
  const url = String(row.url || fallbackUrl || '').trim()
  const citations = numberOrNull(row.citations ?? row.appearances ?? row.occurrences)
  const previous = numberOrNull(row.previousCitations ?? row.previousAppearances)
  const delta = numberOrNull(row.citationsDelta ?? row.growthPercent ?? row.growth)
  const computedGrowth =
    numberOrNull(row.growthPercent ?? row.growth) ??
    (previous != null ? growthPercent(citations, previous) : delta)
  const providers = asArray(row.providers).map((item) => ({
    provider: String(item.provider || item.name || item.engine || ''),
    count: numberOrNull(item.count ?? item.appearances) ?? 0,
    share: numberOrNull(item.share) ?? 0,
  })).filter((item) => item.provider)
  const prompts = asArray(row.promptList ?? row.prompts).map((item) => {
    if (typeof item === 'string') return { text: item, promptId: null }
    const text = String(item?.text || item?.prompt || item?.title || '').trim()
    if (!text) return null
    return { text, promptId: item.promptId ? String(item.promptId) : null }
  }).filter(Boolean)
  const series = asArray(row.citationTimeSeries ?? row.timeSeries).map((item) => ({
    date: toIsoDay(item.date) || String(item.date || ''),
    count: numberOrNull(item.count ?? item.value) ?? 0,
  })).filter((item) => item.date)

  return {
    title: String(row.title || row.name || '').trim() || url,
    url,
    path: String(row.path || '').trim(),
    isBranded: typeof row.isBranded === 'boolean' ? row.isBranded : null,
    appearances: citations ?? 0,
    promptCount: numberOrNull(row.promptCount) ?? prompts.length,
    growthPercent: computedGrowth,
    providers,
    citationTimeSeries: series,
    sparkline: asArray(row.sparkline).map((value) => numberOrNull(value) ?? 0),
    prompts,
    lastUpdated: row.lastUpdated || null,
  }
}

export async function geoCitations(db, tenantId, rawQuery) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const pageSize = 200
  const firstQuery = toSourceQueryWithRange(f, { page: 1, pageSize }, { engines: 'aiEngines' })
  const first = await sourceGet(accountId, apiKey, accountPath(accountId, '/sources/domains-page', firstQuery))
  const summary = mapCitationSummary(first)
  let items = asArray(first?.domains?.items ?? first?.domains ?? first?.items, 'items').map(mapCitationDomain).filter(Boolean)
  const total = numberOrNull(first?.domains?.total ?? first?.total) ?? items.length
  items = normalizeUsedPercents(items)

  console.info('[geo/citations] domains', { total, loaded: items.length })

  return {
    data: {
      summary,
      domains: items,
      total,
    },
    isLive: true,
    computedAt: nowIso(),
  }
}

export async function geoCitationDomain(db, tenantId, rawQuery, domain) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const host = normalizeHost(domain)
  if (!host) {
    const err = new Error('domain is required')
    err.statusCode = 400
    throw err
  }

  const pageSize = 100
  const encoded = encodeURIComponent(host)
  let raw
  try {
    raw = await sourceGet(
      accountId,
      apiKey,
      accountPath(
        accountId,
        `/sources/domain-drill-down/${encoded}`,
        toSourceQueryWithRange(f, { page: 1, pageSize }, { engines: 'aiEngines' }),
      ),
    )
  } catch (err) {
    console.warn(
      `[geo/citations] drill-down failed for ${host}, falling back: ${err instanceof Error ? err.message : err}`,
    )
    const [summaryRaw, urlsRaw] = await Promise.all([
      sourceGet(
        accountId,
        apiKey,
        accountPath(accountId, '/sources/url-type-summary', toSourceQueryWithRange(f, {}, { engines: 'aiEngines' })),
      ),
      sourceGet(
        accountId,
        apiKey,
        accountPath(
          accountId,
          `/sources/domains/${encoded}/urls`,
          toSourceQueryWithRange(f, { page: 1, pageSize }, { engines: 'aiEngines' }),
        ),
      ),
    ])
    raw = {
      summary: summaryRaw?.summary ?? summaryRaw,
      sourceGroups: urlsRaw?.sourceGroups ?? urlsRaw,
      total: urlsRaw?.total,
    }
  }

  const urls = flattenSourceUrls(raw, host)
  const seen = new Set(urls.map((row) => row.url))
  const total = numberOrNull(raw?.total) ?? urls.length
  const pages = Math.min(Math.ceil(total / pageSize), 8)
  for (let page = 2; page <= pages; page += 1) {
    try {
      const next = await sourceGet(
        accountId,
        apiKey,
        accountPath(
          accountId,
          `/sources/domains/${encoded}/urls`,
          toSourceQueryWithRange(f, { page, pageSize }, { engines: 'aiEngines' }),
        ),
      )
      for (const row of flattenSourceUrls(next, host)) {
        if (seen.has(row.url)) continue
        seen.add(row.url)
        urls.push(row)
      }
    } catch (err) {
      console.warn(
        `[geo/citations] extra URL page failed for ${host}: ${err instanceof Error ? err.message : err}`,
      )
      break
    }
  }

  console.info('[geo/citations] domain', { domain: host, urls: urls.length, total })

  return {
    data: {
      domain: host,
      summary: mapCitationSummary(raw),
      urls,
      total,
    },
    isLive: true,
    computedAt: nowIso(),
  }
}

export async function geoCitationUrlDetail(db, tenantId, rawQuery, url) {
  const f = parseGeoFilters(rawQuery)
  const { accountId, apiKey } = await creds(db, tenantId)
  const target = String(url || rawQuery.url || '').trim()
  if (!target) {
    const err = new Error('url is required')
    err.statusCode = 400
    throw err
  }

  const attempts = [
    ['/sources/detail', { url: target }],
    ['/sources/detail', { pageUrl: target }],
    ['/pages/detail', { url: target }],
  ]
  let lastError
  let raw = null
  for (const [path, extra] of attempts) {
    try {
      raw = await sourceGet(
        accountId,
        apiKey,
        accountPath(accountId, path, toSourceQueryWithRange(f, extra, { engines: 'aiEngines' })),
      )
      if (raw) break
    } catch (err) {
      lastError = err
    }
  }
  if (!raw) {
    throw lastError || new Error('Source URL detail was not available')
  }

  return {
    data: mapCitationUrlDetail(raw, target),
    isLive: true,
    computedAt: nowIso(),
  }
}
