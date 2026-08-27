import { describe, expect, it } from 'vitest'
import type { CompetitorPerformance, ProviderMention } from '../../api/types'
import { buildAccountBrief } from './briefInsights'

const providers: ProviderMention[] = [
  { provider: 'OPENAI', count: 24, countChange: 20 },
  { provider: 'GEMINI', count: 16, countChange: -25 },
]

describe('buildAccountBrief', () => {
  it('derives snapshot metrics and positive signals', () => {
    const competitors: CompetitorPerformance[] = [
      {
        id: 'account',
        name: 'Menchly client',
        isAccount: true,
        position: 1,
        occurrences: 40,
        avgRank: 1.8,
        sentimentScore: 88,
        sentimentScoreDelta: 5,
      },
      { id: 'rival', name: 'Rival', position: 2, occurrences: 20 },
    ]

    const brief = buildAccountBrief(
      { promptsCount: 32, overallScore: 75, previousOverallScore: 74 },
      providers,
      competitors,
    )

    expect(brief.snapshot.totalMentions).toBe(40)
    expect(brief.snapshot.shareOfVoice).toBeCloseTo(66.67, 1)
    expect(brief.snapshot.promptsCount).toBe(32)
    expect(brief.snapshot.sentiment).toBe(75)
    expect(brief.snapshot.sentimentDelta).toBe(1)
    expect(brief.wins.map((item) => item.title)).toContain('You lead the category')
    expect(brief.wins.map((item) => item.title)).toContain('ChatGPT is gaining')
  })

  it('prioritizes declines and relevant actions', () => {
    const competitors: CompetitorPerformance[] = [
      {
        id: 'account',
        name: 'Menchly client',
        isAccount: true,
        position: 4,
        occurrences: 20,
        avgRankDelta: 1.2,
        sentimentScoreDelta: -8,
      },
      {
        id: 'leader',
        name: 'Rising Rival',
        position: 1,
        occurrences: 50,
        occurrencesDelta: 18,
      },
    ]

    const brief = buildAccountBrief({}, providers, competitors)

    expect(brief.risks.map((item) => item.title)).toContain('Gemini visibility declined')
    expect(brief.risks.map((item) => item.title)).toContain('Average rank slipped')
    expect(brief.actions.map((item) => item.href)).toEqual([
      '/mentions',
      '/competitors',
      '/sentiment',
    ])
    expect(brief.actions[0].provider).toBe('GEMINI')
  })

  it('handles incomplete data with a useful fallback action', () => {
    const brief = buildAccountBrief({}, [], [])

    expect(brief.snapshot).toEqual({
      totalMentions: 0,
      shareOfVoice: null,
      averageRank: null,
      rankDelta: null,
      sentiment: null,
      sentimentDelta: null,
      promptsCount: null,
    })
    expect(brief.wins).toEqual([])
    expect(brief.risks).toEqual([])
    expect(brief.actions).toEqual([
      {
        title: 'Expand prompt coverage',
        detail: 'Add or refine tracked questions to uncover the next growth opportunity.',
        href: '/prompts',
      },
    ])
  })
})
