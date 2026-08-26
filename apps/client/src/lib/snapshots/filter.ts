import type {
  BrandedFilter,
  CompetitorPerformance,
  GeoFilters,
  PromptRow,
  PromptTag,
  ProviderMention,
  ResponseRow,
  TopicRow,
} from '../../api/types'
import { providerOf, sentimentOf } from './normalize'

function norm(value: string | number | null | undefined): string {
  if (value == null) return ''
  return String(value).trim().toLowerCase()
}

/** Normalize a tag string or `{ name, tagId }` object to a display/filter id. */
export function tagLabel(tag: PromptTag | null | undefined): string | null {
  if (tag == null) return null
  if (typeof tag === 'string') {
    const s = tag.trim()
    return s || null
  }
  if (typeof tag === 'object') {
    const name = typeof tag.name === 'string' ? tag.name.trim() : ''
    const id = typeof tag.tagId === 'string' ? tag.tagId.trim() : ''
    return name || id || null
  }
  return null
}

export function tagLabels(tags: PromptTag[] | null | undefined): string[] {
  if (!tags?.length) return []
  return tags.map(tagLabel).filter((t): t is string => !!t)
}

/** Active prompts only — inactive rows are hidden from the Prompts screen. */
export function isPromptActive(row: Pick<PromptRow, 'isActive'>): boolean {
  return row.isActive !== false
}

export function activePrompts(rows: PromptRow[]): PromptRow[] {
  return rows.filter(isPromptActive)
}

function includesAny(haystacks: Array<string | null | undefined>, selected: string[]): boolean {
  if (!selected.length) return true
  const set = new Set(selected.map(norm))
  return haystacks.some((h) => set.has(norm(h)))
}

function arrayIncludesAny(values: Array<string | null | undefined> | null | undefined, selected: string[]): boolean {
  if (!selected.length) return true
  if (!values?.length) return false
  const set = new Set(selected.map(norm))
  return values.some((v) => set.has(norm(v)))
}

function tagsMatch(tags: PromptTag[] | null | undefined, selected: string[]): boolean {
  if (!selected.length) return true
  return arrayIncludesAny(tagLabels(tags), selected)
}

export function brandedMatches(
  meInPrompt: boolean | null | undefined,
  branded: BrandedFilter,
): boolean {
  if (!branded) return true
  if (meInPrompt == null) return false
  if (branded === 'AccountIncluded') return meInPrompt === true
  return meInPrompt === false
}

/** Detect which filter dimensions exist in a set of response-like rows. */
export function detectResponseFilterAvailability(rows: ResponseRow[]) {
  const has = {
    providers: false,
    topics: false,
    prompts: false,
    regions: false,
    tags: false,
    branded: false,
    promptTypes: false,
  }
  for (const row of rows) {
    if (providerOf(row)) has.providers = true
    if (row.topicId || row.topic) has.topics = true
    if (row.promptId || row.promptText) has.prompts = true
    if (row.region || row.countries?.length) has.regions = true
    if (row.tags?.length) has.tags = true
    if (row.meInPrompt != null || row.isCompanyInPrompt != null) has.branded = true
    if (row.promptType || row.type) has.promptTypes = true
  }
  return has
}

export function detectPromptFilterAvailability(rows: PromptRow[]) {
  return {
    providers: false,
    topics: rows.some((r) => r.topicId || r.topic),
    prompts: rows.length > 0,
    regions: rows.some((r) => (r.regions?.length ?? 0) > 0),
    tags: rows.some((r) => (r.tags?.length ?? 0) > 0),
    branded: rows.some((r) => r.meInPrompt != null),
    promptTypes: rows.some((r) => !!r.type),
  }
}

export function detectCompetitorFilterAvailability(rows: CompetitorPerformance[]) {
  return {
    providers: false,
    topics: rows.some((r) => (r.topics?.length ?? 0) > 0),
    prompts: false,
    regions: false,
    tags: false,
    branded: false,
    promptTypes: false,
  }
}

export function filterProviderMentions(
  rows: ProviderMention[] | undefined,
  providers: string[],
): ProviderMention[] {
  if (!rows) return []
  if (!providers.length) return rows
  const set = new Set(providers.map(norm))
  return rows.filter((r) => set.has(norm(r.provider)))
}

export function filterResponses(
  rows: ResponseRow[],
  filters: Pick<
    GeoFilters,
    'providers' | 'topics' | 'prompts' | 'regions' | 'tags' | 'branded' | 'promptTypes'
  >,
  promptLookup?: Map<string, PromptRow>,
): ResponseRow[] {
  return rows.filter((row) => {
    const provider = providerOf(row)
    if (filters.providers.length && !includesAny([provider], filters.providers)) return false

    if (filters.topics.length) {
      const topicName = row.topic || (row.topicId ? promptLookup?.get(row.topicId)?.topic?.name : null)
      const topicId = row.topicId
      if (!includesAny([topicId, topicName], filters.topics)) return false
    }

    if (filters.prompts.length) {
      if (!includesAny([row.promptId, row.promptText], filters.prompts)) return false
    }

    if (filters.regions.length) {
      const ok =
        includesAny([row.region], filters.regions) ||
        arrayIncludesAny(row.countries, filters.regions)
      if (!ok) return false
    }

    if (filters.tags.length) {
      const promptTags = row.promptId ? promptLookup?.get(row.promptId)?.tags : null
      const tags = row.tags?.length ? row.tags : promptTags
      if (!tagsMatch(tags, filters.tags)) return false
    }

    const me =
      row.meInPrompt ??
      row.isCompanyInPrompt ??
      (row.promptId ? promptLookup?.get(row.promptId)?.meInPrompt : null)
    if (!brandedMatches(me, filters.branded)) return false

    if (filters.promptTypes.length) {
      const type =
        row.promptType ||
        row.type ||
        (row.promptId ? promptLookup?.get(row.promptId)?.type : null)
      if (!includesAny([type], filters.promptTypes)) return false
    }

    return true
  })
}

export function filterPrompts(
  rows: PromptRow[],
  filters: Pick<
    GeoFilters,
    'topics' | 'prompts' | 'regions' | 'tags' | 'branded' | 'promptTypes'
  >,
): PromptRow[] {
  return rows.filter((row) => {
    if (filters.topics.length) {
      if (!includesAny([row.topicId, row.topic?.name, row.topic?.id], filters.topics)) return false
    }
    if (filters.prompts.length) {
      if (!includesAny([row.id, row.prompt], filters.prompts)) return false
    }
    if (filters.regions.length && !arrayIncludesAny(row.regions, filters.regions)) return false
    if (filters.tags.length && !tagsMatch(row.tags, filters.tags)) return false
    if (!brandedMatches(row.meInPrompt, filters.branded)) return false
    if (filters.promptTypes.length && !includesAny([row.type], filters.promptTypes)) return false
    return true
  })
}

export function filterCompetitors(
  rows: CompetitorPerformance[],
  filters: Pick<GeoFilters, 'topics'>,
): CompetitorPerformance[] {
  if (!filters.topics.length) return rows
  return rows.filter((row) => arrayIncludesAny(row.topics, filters.topics))
}

export function filterHistoricalSentiment(
  points: Array<{ date: string; provider: string; sentimentScore: number }>,
  providers: string[],
) {
  if (!providers.length) return points
  const set = new Set(providers.map(norm))
  return points.filter((p) => set.has(norm(p.provider)))
}

export function averageSentiment(rows: ResponseRow[]): number | null {
  const scores = rows.map(sentimentOf).filter((v): v is number => v != null)
  if (!scores.length) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

export function collectFilterOptions(args: {
  topics?: TopicRow[]
  prompts?: PromptRow[]
  responses?: ResponseRow[]
  providers?: string[]
  competitors?: CompetitorPerformance[]
}) {
  const providers = new Set<string>()
  const topics = new Map<string, string>()
  const promptOpts = new Map<string, string>()
  const regions = new Set<string>()
  const tags = new Set<string>()
  const promptTypes = new Set<string>()
  const crawlers = new Set<string>()

  for (const p of args.providers ?? []) providers.add(p)
  for (const t of args.topics ?? []) topics.set(t.id, t.name)
  for (const p of args.prompts ?? []) {
    promptOpts.set(p.id, p.prompt)
    if (p.topicId && p.topic?.name) topics.set(p.topicId, p.topic.name)
    for (const r of p.regions ?? []) {
      if (typeof r === 'string' && r) regions.add(r)
    }
    for (const label of tagLabels(p.tags)) tags.add(label)
    if (p.type) promptTypes.add(p.type)
  }
  for (const r of args.responses ?? []) {
    const provider = providerOf(r)
    if (provider) providers.add(provider)
    if (r.topicId) topics.set(r.topicId, r.topic || r.topicId)
    if (r.promptId) promptOpts.set(r.promptId, r.promptText || r.promptId)
    if (r.region) regions.add(r.region)
    for (const c of r.countries ?? []) {
      if (typeof c === 'string' && c) regions.add(c)
    }
    for (const label of tagLabels(r.tags)) tags.add(label)
    if (r.promptType) promptTypes.add(r.promptType)
    if (r.type) promptTypes.add(r.type)
  }
  for (const c of args.competitors ?? []) {
    for (const t of c.topics ?? []) topics.set(t, t)
  }

  return {
    providers: [...providers].sort(),
    topics: [...topics.entries()].map(([id, name]) => ({ id, name })),
    prompts: [...promptOpts.entries()].map(([id, text]) => ({ id, text })),
    regions: [...regions].sort(),
    tags: [...tags].sort(),
    promptTypes: [...promptTypes].sort(),
    crawlers: [...crawlers].sort(),
  }
}

export function filterByBot<T extends Record<string, unknown>>(
  rows: T[] | undefined,
  crawlers: string[],
  key = 'bot',
): T[] {
  if (!rows) return []
  if (!crawlers.length) return rows
  const set = new Set(crawlers.map(norm))
  return rows.filter((r) => set.has(norm(String(r[key] ?? r.name ?? r.botName ?? ''))))
}
