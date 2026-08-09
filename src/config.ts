/**
 * All frontend AirOps READ requests go through the local Vite dev-server
 * proxy (`/api/airops/*` → `https://api.airops.com/*`). The proxy injects
 * the Authorization header server-side so the API key never reaches the
 * browser. See vite.config.ts and README.md for the deployment caveat.
 *
 * Brand Kit "submit" writes do NOT go to api.airops.com — they POST to
 * VITE_SUBMIT_WEBHOOK_URL (an AirOps Playbook webhook).
 */
export const API_BASE_PATH = '/api/airops'

const rawBrandKitId = import.meta.env.VITE_AIROPS_BRAND_KIT_ID as string | undefined

if (!rawBrandKitId) {
  throw new Error(
    'VITE_AIROPS_BRAND_KIT_ID is not set. Copy .env.example to .env and fill it in.',
  )
}

/** String id used by Insights path builders. */
export const BRAND_KIT_ID: string = rawBrandKitId

export const SUBMIT_WEBHOOK_URL: string =
  (import.meta.env.VITE_SUBMIT_WEBHOOK_URL as string | undefined) ?? ''

/** Merge seed entities the public REST API does not expose. Default: true. */
export const SEED_MISSING_ENTITIES: boolean =
  (import.meta.env.VITE_SEED_MISSING_ENTITIES as string | undefined) !== 'false'
