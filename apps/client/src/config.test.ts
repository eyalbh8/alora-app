import { describe, expect, it } from 'vitest'
import { resolveTrackerEndpoint } from './config'

const DASHBOARD_ORIGIN = 'https://app.menchly.com'

describe('resolveTrackerEndpoint', () => {
  it('uses an explicit override, trimming a trailing slash', () => {
    const url = resolveTrackerEndpoint({
      override: 'https://api.menchly.com/api/snapshots/track/',
      apiBase: '/api/snapshots',
      isDev: false,
      origin: DASHBOARD_ORIGIN,
    })
    expect(url).toBe('https://api.menchly.com/api/snapshots/track')
  })

  it('uses VITE_API_BASE when it is absolute, as in production', () => {
    const url = resolveTrackerEndpoint({
      apiBase: 'https://abc.lambda-url.us-east-1.on.aws/api/snapshots',
      isDev: false,
      origin: DASHBOARD_ORIGIN,
    })
    expect(url).toBe('https://abc.lambda-url.us-east-1.on.aws/api/snapshots/track')
  })

  /**
   * The snippet runs on a customer's site, so it must reach the API directly.
   * Vite's /api proxy only rewrites requests from the dashboard origin, which
   * would make a dashboard-origin URL silently unreachable for customers.
   */
  it('points at the API origin in dev, not the dashboard origin', () => {
    const url = resolveTrackerEndpoint({
      apiBase: '/api/snapshots',
      isDev: true,
      origin: 'http://localhost:5175',
    })
    expect(url).toBe('http://localhost:3003/api/snapshots/track')
    expect(url).not.toContain('5175')
  })

  it('falls back to this origin in production, where Amplify rewrites to Lambda', () => {
    const url = resolveTrackerEndpoint({
      apiBase: '/api/snapshots',
      isDev: false,
      origin: DASHBOARD_ORIGIN,
    })
    expect(url).toBe('https://app.menchly.com/api/snapshots/track')
  })

  it('ignores a blank override', () => {
    const url = resolveTrackerEndpoint({
      override: '   ',
      apiBase: '/api/snapshots',
      isDev: false,
      origin: DASHBOARD_ORIGIN,
    })
    expect(url).toBe('https://app.menchly.com/api/snapshots/track')
  })

  it('always produces an absolute URL', () => {
    const cases = [
      { apiBase: '/api/snapshots', isDev: true, origin: DASHBOARD_ORIGIN },
      { apiBase: '/api/snapshots', isDev: false, origin: DASHBOARD_ORIGIN },
      { apiBase: 'https://api.example.com/api/snapshots', isDev: false, origin: DASHBOARD_ORIGIN },
      { override: 'https://x.example/track', apiBase: '/api/snapshots', isDev: true, origin: DASHBOARD_ORIGIN },
    ]
    for (const input of cases) {
      expect(resolveTrackerEndpoint(input)).toMatch(/^https?:\/\//)
    }
  })
})
