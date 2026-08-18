import { describe, expect, it } from 'vitest'
import { parseIgeoRangeDays, toIgeoQuery } from './igeoClient.mjs'

describe('toIgeoQuery', () => {
  it('sends range=N and omits UTC dates for Last N days presets', () => {
    const q = toIgeoQuery({
      startDate: '2026-08-12',
      endDate: '2026-08-18',
      rangeDays: 7,
      providers: [],
      topics: [],
      prompts: [],
      regions: [],
      tags: [],
      branded: null,
      promptTypes: [],
    })
    expect(q).toBe('?range=7')
    expect(q).not.toContain('startDate')
    expect(q).not.toContain('endDate')
  })

  it('keeps explicit UTC dates for a custom calendar span', () => {
    const q = toIgeoQuery({
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      rangeDays: null,
      providers: [],
      topics: [],
      prompts: [],
      regions: [],
      tags: [],
      branded: null,
      promptTypes: [],
    })
    expect(q).toContain('startDate=2026-08-01T00%3A00%3A00.000Z')
    expect(q).toContain('endDate=2026-08-07T23%3A59%3A59.999Z')
    expect(q).not.toContain('range=')
  })

  it('ignores a non-preset rangeDays value', () => {
    expect(parseIgeoRangeDays(3)).toBeNull()
    expect(parseIgeoRangeDays('7')).toBe(7)
  })
})
