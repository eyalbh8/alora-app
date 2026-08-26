import { describe, expect, it } from 'vitest'
import { buildAiTrafficViewModel } from './aiTraffic'

const range = { startDate: '2026-08-12', endDate: '2026-08-18' }

const sourcePayload = {
  hasEvents: true,
  llmProviders: [
    { provider: 'TOTAL', visits: 4, changePercent: 100 },
    { provider: 'OPENAI', visits: 4, changePercent: 100 },
    { provider: 'ANTHROPIC', visits: 0, changePercent: 0 },
    { provider: 'PERPLEXITY', visits: 0, changePercent: 0 },
    { provider: 'GEMINI', visits: 0, changePercent: 0 },
    { provider: 'BD_COPILOT', visits: 0, changePercent: 0 },
  ],
  historicalData: [
    {
      provider: 'OPENAI',
      historicalData: [
        { date: '2026-08-16', value: 0 },
        { date: '2026-08-17', value: 2 },
        { date: '2026-08-18', value: 2 },
      ],
    },
  ],
  topSources: [{ source: 'chatgpt.com', visitors: 4 }],
  topPages: [{ page: '/', visitors: 4 }],
  topLocations: [
    { country: 'Cyprus', countryCode: 'CY', visitors: 3 },
    { country: 'Israel', countryCode: 'IL', visitors: 1 },
  ],
  topDevices: [
    { device: 'desktop', visitors: 2 },
    { device: 'mobile', visitors: 2 },
  ],
  topBrowsers: [
    { browser: 'Chrome', visitors: 3 },
    { browser: 'Safari', visitors: 1 },
  ],
}

describe('buildAiTrafficViewModel', () => {
  it('fills every day in the selected range and keeps all providers on the chart', () => {
    const view = buildAiTrafficViewModel(sourcePayload, range, [])

    expect(view.chartProviderKeys).toEqual([
      'OPENAI',
      'ANTHROPIC',
      'PERPLEXITY',
      'GEMINI',
      'BD_COPILOT',
    ])
    expect(view.chartRows.map((row) => row.rawDate)).toEqual([
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
      '2026-08-17',
      '2026-08-18',
    ])
    expect(view.chartRows.find((row) => row.rawDate === '2026-08-17')).toMatchObject({
      OPENAI: 2,
      ANTHROPIC: 0,
    })
    expect(view.totalEntries).toBe(4)
    expect(view.providers.find((p) => p.provider === 'OPENAI')).toMatchObject({
      count: 4,
      change: 100,
    })
  })

  it('parses upstream top source, page, location, device, and browser cards', () => {
    const view = buildAiTrafficViewModel(sourcePayload, range, [])

    expect(view.topSources).toEqual([{ label: 'chatgpt.com', value: 4, domain: 'chatgpt.com' }])
    expect(view.topPages).toEqual([{ label: '/', value: 4 }])
    expect(view.topLocations).toEqual([
      { label: 'Cyprus', value: 3, countryCode: 'CY' },
      { label: 'Israel', value: 1, countryCode: 'IL' },
    ])
    expect(view.topDevices).toEqual([
      { label: 'desktop', value: 2 },
      { label: 'mobile', value: 2 },
    ])
    expect(view.topBrowsers).toEqual([
      { label: 'Chrome', value: 3 },
      { label: 'Safari', value: 1 },
    ])
  })

  it('falls back to provider visits when historical points are all zero', () => {
    const view = buildAiTrafficViewModel(
      {
        llmProviders: [
          { provider: 'OPENAI', visits: 4, changePercent: 100 },
          { provider: 'TOTAL', visits: 4, changePercent: 100 },
        ],
        historicalData: [
          {
            provider: 'OPENAI',
            historicalData: [
              { date: '2026-08-12', value: 0 },
              { date: '2026-08-18', value: 0 },
            ],
          },
        ],
      },
      range,
      [],
    )

    expect(view.totalEntries).toBe(4)
    expect(view.providers.find((p) => p.provider === 'OPENAI')?.count).toBe(4)
  })

  it('accepts alternate upstream field names for breakdown cards', () => {
    const view = buildAiTrafficViewModel(
      {
        sources: [{ domain: 'https://www.chatgpt.com/referrer', count: 4 }],
        pages: [{ path: '/pricing', entries: 2 }],
        countries: [{ country: 'IL', visitors: 1 }],
        devices: [{ type: 'desktop', value: 2 }],
        browsers: [{ name: 'Chrome', sessions: 3 }],
      },
      range,
      [],
    )

    expect(view.topSources[0]).toMatchObject({ label: 'chatgpt.com', value: 4, domain: 'chatgpt.com' })
    expect(view.topPages[0]).toMatchObject({ label: '/pricing', value: 2 })
    expect(view.topLocations[0]).toMatchObject({ label: 'IL', value: 1, countryCode: 'IL' })
    expect(view.topDevices[0]).toMatchObject({ label: 'desktop', value: 2 })
    expect(view.topBrowsers[0]).toMatchObject({ label: 'Chrome', value: 3 })
  })
})
