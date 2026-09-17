/**
 * Frontend config for the Menchly analytics app.
 * Dev: Vite proxies `/api` → Nest.
 * Prod: prefer VITE_API_BASE (Lambda Function URL) so Amplify does not strip Authorization.
 * Falls back to `/api/snapshots` (same-origin rewrite) when unset.
 */
const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
export const API_BASE_PATH = (configured || '/api/snapshots').replace(/\/$/, '')

/**
 * Source URL for the embeddable AI traffic tracker, used to build the install
 * snippet on the Tracker setup screen.
 *
 * Defaults to this app's own origin, since Vite publishes the built script as a
 * static asset at /v1/tracker.min.js. Set VITE_TRACKER_SRC to an absolute URL if
 * the script is ever served from a dedicated CDN domain instead.
 */
const trackerSrc = (import.meta.env.VITE_TRACKER_SRC as string | undefined)?.trim()

export function trackerScriptUrl(): string {
  return trackerSrc || `${window.location.origin}/v1/tracker.min.js`
}

/** Dev API origin. Matches the `/api` proxy target in vite.config.ts. */
const DEV_API_ORIGIN = 'http://localhost:3003'

const trackerEndpoint = (import.meta.env.VITE_TRACKER_ENDPOINT as string | undefined)?.trim()

/**
 * Ingest URL for the install snippet.
 *
 * This must be an absolute URL pointing at the API, because the snippet runs on
 * the customer's own site. It cannot be derived from the dashboard's origin:
 * that is a different origin from the API in dev, and only coincidentally
 * routes to it in production.
 *
 * Resolution order:
 *   1. VITE_TRACKER_ENDPOINT, for a dedicated API domain.
 *   2. VITE_API_BASE when absolute, i.e. the Lambda Function URL in production.
 *   3. The dev API origin, since Vite's proxy only serves the dashboard origin.
 *   4. This origin, where Amplify rewrites /api/snapshots/* to the Lambda.
 *
 * Takes its inputs explicitly so every branch is unit-testable.
 */
export function resolveTrackerEndpoint(input: {
  override?: string
  apiBase: string
  isDev: boolean
  origin: string
}): string {
  const override = input.override?.trim()
  if (override) return override.replace(/\/$/, '')
  if (input.apiBase.startsWith('http')) return `${input.apiBase}/track`
  if (input.isDev) return `${DEV_API_ORIGIN}${input.apiBase}/track`
  return `${input.origin}${input.apiBase}/track`
}

export function trackerEndpointUrl(): string {
  return resolveTrackerEndpoint({
    override: trackerEndpoint,
    apiBase: API_BASE_PATH,
    isDev: import.meta.env.DEV,
    origin: window.location.origin,
  })
}
