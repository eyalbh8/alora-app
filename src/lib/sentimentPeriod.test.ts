import { describe, expect, it } from 'vitest'
import { averageScore, sentimentPctChange, sentimentPeriodScores } from './sentimentPeriod'

describe('sentimentPeriodScores', () => {
  it('matches upstream: full-series current, first-half previous', () => {
    const historical = [
      { sentimentScore: 73 },
      { sentimentScore: 75 },
      { sentimentScore: 76 },
      { sentimentScore: 76 },
    ]
    expect(sentimentPeriodScores(historical)).toEqual({ current: 75, previous: 74 })
    expect(sentimentPctChange(75, 74)).toBe(1.35)
  })

  it('returns nulls when there is no history', () => {
    expect(sentimentPeriodScores([])).toEqual({ current: null, previous: null })
    expect(averageScore([])).toBeNull()
    expect(sentimentPctChange(75, null)).toBeNull()
  })
})
