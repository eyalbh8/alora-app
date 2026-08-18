import { describe, expect, it } from 'vitest'
import { buildAiCrawlersViewModel } from './aiCrawlers'

const range = { startDate: '2026-08-12', endDate: '2026-08-18' }

describe('buildAiCrawlersViewModel', () => {
  it('keeps distinct iGEO crawlers and sorts cards by volume descending', () => {
    const view = buildAiCrawlersViewModel(
      {
        totalRequests: 25305,
        byBot: [
          { botName: 'Applebot', requests: 3, changePercent: -96.1 },
          { botName: 'ClaudeBot', requests: 1290, changePercent: 0 },
          { botName: 'Amazonbot', requests: 5314, changePercent: 9562 },
          { botName: 'Meta-ExternalAgent', requests: 10249, changePercent: 3015.2 },
          { botName: 'FacebookBot', requests: 250, changePercent: 6150 },
          { botName: 'OAI-SearchBot', requests: 1159 },
          { botName: 'ChatGPT-User', requests: 3538 },
          { botName: 'Bytespider', requests: 103, changePercent: 930 },
        ],
      },
      range,
      [],
    )

    expect(view.totalEntries).toBe(25305)
    expect(view.bots.map((b) => [b.bot, b.count])).toEqual([
      ['META_EXTERNALAGENT', 10249],
      ['AMAZONBOT', 5314],
      ['CHATGPT_USER', 3538],
      ['CLAUDEBOT', 1290],
      ['OAI_SEARCHBOT', 1159],
      ['FACEBOOKBOT', 250],
      ['BYTESPIDER', 103],
      ['APPLEBOT', 3],
    ])
  })

  it('does not merge FacebookBot into Meta-ExternalAgent', () => {
    const view = buildAiCrawlersViewModel(
      {
        byBot: [
          { bot: 'Meta-ExternalAgent', requests: 10249 },
          { bot: 'FacebookBot', requests: 250 },
        ],
      },
      range,
      [],
    )

    expect(view.bots).toEqual([
      { bot: 'META_EXTERNALAGENT', count: 10249, change: null },
      { bot: 'FACEBOOKBOT', count: 250, change: null },
    ])
  })

  it('sums hourly totalRequests into daily chart points', () => {
    const view = buildAiCrawlersViewModel(
      {
        totalRequests: 25305,
        totalRequestsChangePercent: 0,
        timeSeriesData: [
          { date: '2026-08-11T00:00:00.000Z', hour: 22, totalRequests: 200 },
          { date: '2026-08-11T00:00:00.000Z', hour: 23, totalRequests: 136 },
          { date: '2026-08-12T00:00:00.000Z', hour: 0, totalRequests: 50 },
        ],
      },
      range,
      [],
    )

    expect(view.totalEntries).toBe(25305)
    expect(view.totalChange).toBe(0)
    expect(view.chartRows).toEqual([
      { date: '2026-08-11', rawDate: '2026-08-11', value: 336 },
      { date: '2026-08-12', rawDate: '2026-08-12', value: 50 },
    ])
  })

  it('keeps only selected crawlers and still sorts by volume', () => {
    const view = buildAiCrawlersViewModel(
      {
        byBot: [
          { bot: 'Amazonbot', entries: 100 },
          { bot: 'ClaudeBot', entries: 50 },
          { bot: 'Bytespider', entries: 200 },
        ],
      },
      range,
      ['ClaudeBot', 'Bytespider'],
    )

    expect(view.bots.map((b) => b.bot)).toEqual(['BYTESPIDER', 'CLAUDEBOT'])
  })
})
