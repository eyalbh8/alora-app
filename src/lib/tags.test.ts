import { describe, expect, it } from 'vitest'
import { normalizeTag, normalizeTags, tagColor } from './tags'

describe('tags', () => {
  it('normalizes string and object tags', () => {
    expect(normalizeTag('Shoes')).toEqual({ name: 'Shoes', tagId: 'Shoes', colorRow: null })
    expect(normalizeTag({ name: 'Running', tagId: '0f41', colorRow: 'E' })).toEqual({
      name: 'Running',
      tagId: '0f41',
      colorRow: 'E',
    })
  })

  it('dedupes tags by id', () => {
    expect(
      normalizeTags([
        { name: 'Shoes', tagId: 'abc', colorRow: 'F' },
        { name: 'Shoes', tagId: 'abc', colorRow: 'F' },
        'Other',
      ]).map((t) => t.tagId),
    ).toEqual(['abc', 'Other'])
  })

  it('maps colorRow letters and hex', () => {
    expect(tagColor('E')).toBe('#42ca80')
    expect(tagColor('#ff00aa')).toBe('#ff00aa')
    expect(tagColor(null)).toBe('#42ca80')
  })
})
