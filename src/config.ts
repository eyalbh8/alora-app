/**
 * Frontend config for the fixed-tenant Alora snapshot app.
 * All snapshot reads go through `/api/snapshots/*` (Vite middleware in
 * development, Lambda in production). DATABASE_URL and WHITELABEL_TENANT_ID
 * are server-only and never bundled.
 */
export const API_BASE_PATH = '/api/snapshots'
