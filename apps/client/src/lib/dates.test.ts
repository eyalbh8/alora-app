import { describe, expect, it } from 'vitest'
import { lastNDaysEnding, matchActivePresetDays, presetRange } from './dates'

describe('matchActivePresetDays', () => {
  it('recognizes last 7 days ending on the preset end day', () => {
    const range = lastNDaysEnding(7, '2026-08-18')
    expect(range).toEqual({ startDate: '2026-08-12', endDate: '2026-08-18' })
    expect(matchActivePresetDays(range, '2026-08-18')).toBe(7)
  })

  it('returns null for a custom span of the same length', () => {
    expect(
      matchActivePresetDays({ startDate: '2026-08-01', endDate: '2026-08-07' }, '2026-08-18'),
    ).toBeNull()
  })

  it('recognizes last 30 days', () => {
    const range = presetRange(30, '2026-08-18')
    expect(matchActivePresetDays(range, '2026-08-18')).toBe(30)
  })
})
