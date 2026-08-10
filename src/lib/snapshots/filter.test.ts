import { describe, expect, it } from 'vitest'
import {
  brandedMatches,
  collectFilterOptions,
  filterCompetitors,
  filterPrompts,
  filterProviderMentions,
  filterResponses,
  tagLabel,
  tagLabels,
} from './filter'
import { mergeMentions, mergeSentiment } from './merge'
import {
  mapDashboard,
  mapPrompts,
  mapResponses,
  mapTopSources,
  normalizeSnapshot,
  sentimentOf,
} from './normalize'
import type { ScreenSnapshot } from '../../api/types'

function snap(screen: string, day: string, payload: unknown, error: string | null = null): ScreenSnapshot {
  return {
    day,
    screen,
    payload,
    source: 'test',
    schemaVersion: 1,
    pulledAt: `${day}T12:00:00.000Z`,
    error,
  }
}

describe('normalizeSnapshot', () => {
  it('marks null payload as empty', () => {
    const n = normalizeSnapshot(snap('dashboard', '2026-08-09', null), mapDashboard)
    expect(n.empty).toBe(true)
    expect(n.payload).toBeNull()
  })

  it('surfaces row-level error', () => {
    const n = normalizeSnapshot(
      snap('ai_traffic', '2026-08-09', { foo: 1 }, '403: denied'),
      (p) => p as object,
    )
    expect(n.error).toBe('403: denied')
    expect(n.payload).toBeNull()
  })

  it('surfaces error-shaped payloads', () => {
    const n = normalizeSnapshot(
      snap('ai_crawlers', '2026-08-09', { error: true, message: 'Path not allowed' }),
      (p) => p as object,
    )
    expect(n.error).toContain('Path not allowed')
  })

  it('unwraps dashboard data envelope', () => {
    const n = normalizeSnapshot(
      snap('dashboard', '2026-08-09', {
        data: { promptsCount: 10, providerMentions: [{ provider: 'GEMINI', count: 3 }] },
      }),
      mapDashboard,
    )
    expect(n.payload?.promptsCount).toBe(10)
    expect(n.payload?.providerMentions?.[0].provider).toBe('GEMINI')
  })

  it('maps top sources array payload', () => {
    expect(mapTopSources([{ domain: 'a.com', occurrences: 1 }])).toEqual([
      { domain: 'a.com', occurrences: 1 },
    ])
  })

  it('reads sentimentScore typo alias', () => {
    expect(sentimentOf({ id: '1', sentinemtScore: 77 })).toBe(77)
    expect(sentimentOf({ id: '1', sentimentScore: 80 })).toBe(80)
  })
})

describe('filters', () => {
  it('ORs within provider type and ANDs across types', () => {
    const rows = [
      { id: '1', provider: 'GEMINI', topicId: 't1', region: 'us', promptId: 'p1' },
      { id: '2', provider: 'PERPLEXITY', topicId: 't1', region: 'us', promptId: 'p2' },
      { id: '3', provider: 'GEMINI', topicId: 't2', region: 'gb', promptId: 'p1' },
    ]
    const filtered = filterResponses(rows, {
      providers: ['GEMINI', 'PERPLEXITY'],
      topics: ['t1'],
      prompts: [],
      regions: ['us'],
      tags: [],
      branded: null,
      promptTypes: [],
    })
    expect(filtered.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('applies branded filter via meInPrompt', () => {
    expect(brandedMatches(true, 'AccountIncluded')).toBe(true)
    expect(brandedMatches(false, 'AccountIncluded')).toBe(false)
    expect(brandedMatches(false, 'AccountNotIncluded')).toBe(true)
    expect(brandedMatches(null, 'AccountIncluded')).toBe(false)
    expect(brandedMatches(true, null)).toBe(true)
  })

  it('filters prompts by topic/tags/type', () => {
    const rows = [
      {
        id: 'p1',
        prompt: 'A',
        topicId: 't1',
        tags: ['eco'],
        type: 'INFORMATIONAL',
        meInPrompt: true,
        regions: ['us'],
      },
      {
        id: 'p2',
        prompt: 'B',
        topicId: 't2',
        tags: null,
        type: 'COMMERCIAL',
        meInPrompt: false,
        regions: ['gb'],
      },
    ]
    const out = filterPrompts(rows, {
      topics: ['t1'],
      prompts: [],
      regions: [],
      tags: ['eco'],
      branded: 'AccountIncluded',
      promptTypes: ['INFORMATIONAL'],
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('p1')
  })

  it('normalizes object tags to string labels', () => {
    expect(tagLabel({ name: 'Shoes', tagId: 'abc', colorRow: 'F' })).toBe('Shoes')
    expect(tagLabel({ tagId: 'abc' })).toBe('abc')
    expect(tagLabels([{ name: 'Running', tagId: '1' }, 'eco'])).toEqual(['Running', 'eco'])
  })

  it('collects object tags as string options for the filter bar', () => {
    const opts = collectFilterOptions({
      prompts: [
        {
          id: 'p1',
          prompt: 'A',
          tags: [
            { name: 'Shoes', tagId: '2fbd', colorRow: 'F' },
            { name: 'Running', tagId: '0f41', colorRow: 'E' },
          ],
        },
      ],
    })
    expect(opts.tags).toEqual(['Running', 'Shoes'])
    expect(opts.tags.every((t) => typeof t === 'string')).toBe(true)

    const out = filterPrompts(
      [
        {
          id: 'p1',
          prompt: 'A',
          tags: [{ name: 'Shoes', tagId: '2fbd', colorRow: 'F' }],
        },
      ],
      {
        topics: [],
        prompts: [],
        regions: [],
        tags: ['Shoes'],
        branded: null,
        promptTypes: [],
      },
    )
    expect(out).toHaveLength(1)
  })

  it('filters provider mentions case-insensitively', () => {
    const out = filterProviderMentions(
      [
        { provider: 'GEMINI', count: 1 },
        { provider: 'CHATGPT', count: 2 },
      ],
      ['gemini'],
    )
    expect(out).toHaveLength(1)
  })

  it('filters competitors by topic when present', () => {
    const out = filterCompetitors(
      [
        { id: '1', name: 'A', topics: ['Running Shoes'] },
        { id: '2', name: 'B', topics: ['Sustainability'] },
      ],
      { topics: ['Running Shoes'] },
    )
    expect(out.map((r) => r.id)).toEqual(['1'])
  })
})

describe('merge', () => {
  it('dedupes responses across days', () => {
    const merged = mergeMentions([
      snap('mentions_sentiment', '2026-08-08', {
        data: { total: 1, responses: [{ id: 'r1', provider: 'GEMINI' }] },
      }),
      snap('mentions_sentiment', '2026-08-09', {
        data: {
          total: 2,
          responses: [
            { id: 'r1', provider: 'GEMINI' },
            { id: 'r2', provider: 'PERPLEXITY' },
          ],
        },
      }),
      snap('mentions_chart', '2026-08-09', {
        data: { providers: [{ provider: 'GEMINI', count: 3 }] },
      }),
    ])
    expect(merged.responses.payload?.responses.map((r) => r.id)).toEqual(['r1', 'r2'])
    expect(merged.chart.payload?.providers?.[0].count).toBe(3)
  })

  it('concatenates sentiment historical points', () => {
    const merged = mergeSentiment([
      snap('sentiment_historical', '2026-08-08', {
        data: [{ date: '2026-08-08', provider: 'ALL', sentimentScore: 80 }],
      }),
      snap('sentiment_historical', '2026-08-09', {
        data: [{ date: '2026-08-09', provider: 'ALL', sentimentScore: 90 }],
      }),
      snap('sentiment', '2026-08-09', {
        data: { total: 1, responses: [{ id: '1', sentimentScore: 88 }] },
      }),
    ])
    expect(merged.historical.payload).toHaveLength(2)
    expect(mapResponses({ data: { total: 1, responses: [] } }).total).toBe(1)
    expect(mapPrompts({ total: 2, prompts: [{ id: '1', prompt: 'x' }] }).prompts).toHaveLength(1)
  })
})
