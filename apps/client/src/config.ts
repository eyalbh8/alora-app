/**
 * Frontend config for the Menchly analytics app.
 * Dev: Vite proxies `/api` → Nest.
 * Prod: prefer VITE_API_BASE (Lambda Function URL) so Amplify does not strip Authorization.
 * Falls back to `/api/snapshots` (same-origin rewrite) when unset.
 */
const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
export const API_BASE_PATH = (configured || '/api/snapshots').replace(/\/$/, '')
