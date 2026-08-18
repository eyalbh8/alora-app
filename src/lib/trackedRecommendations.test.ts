import { describe, expect, it } from 'vitest'
import {
  collectTrackedRecommendations,
  groupRecommendationsByDay,
  normalizeTrackedRecommendation,
  recommendationTypeLabel,
} from './trackedRecommendations'

describe('trackedRecommendations', () => {
  it('normalizes alternate upstream field names', () => {
    const rec = normalizeTrackedRecommendation({
      id: 'r1',
      title: 'Myth Busted: Limassol Specs',
      url: 'https://berkos.co/blog/myth-busted',
      cited: 3,
      publishedAt: '2026-08-18T10:00:00.000Z',
      contentType: 'blog',
      thumbnail: 'https://img.example/cover.jpg',
    })

    expect(rec).toMatchObject({
      id: 'r1',
      recommendationTitle: 'Myth Busted: Limassol Specs',
      urls: ['https://berkos.co/blog/myth-busted'],
      totalAppearances: 3,
      createdAt: '2026-08-18T10:00:00.000Z',
      type: 'blog',
      imageUrl: 'https://img.example/cover.jpg',
    })
  })

  it('groups recommendations by calendar day', () => {
    const grouped = groupRecommendationsByDay([
      { id: 'a', recommendationTitle: 'One', createdAt: '2026-08-18T09:00:00.000Z' },
      { id: 'b', recommendationTitle: 'Two', createdAt: '2026-08-18T21:00:00.000Z' },
      { id: 'c', recommendationTitle: 'Three', createdAt: '2026-08-13' },
    ])

    expect(grouped.get('2026-08-18')?.map((item) => item.id)).toEqual(['a', 'b'])
    expect(grouped.get('2026-08-13')?.map((item) => item.id)).toEqual(['c'])
  })

  it('falls back to posts when tracked recommendations are empty', () => {
    const items = collectTrackedRecommendations([], [
      { id: 'p1', title: 'Published page', createdAt: '2026-08-14', url: 'https://berkos.co/page' },
    ])

    expect(items).toHaveLength(1)
    expect(items[0]?.recommendationTitle).toBe('Published page')
    expect(recommendationTypeLabel(items[0]!)).toBe('Page')
  })

  it('infers Blog from a wordpress or /blog/ url', () => {
    const rec = normalizeTrackedRecommendation({
      id: 'b1',
      recommendationTitle: 'Specs',
      createdAt: '2026-08-18',
      urls: ['https://berkos.co/blog/specs'],
    })

    expect(recommendationTypeLabel(rec!)).toBe('Blog')
  })
})
