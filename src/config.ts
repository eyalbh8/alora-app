/**
 * Frontend config for the Alora analytics app.
 * All reads go through `/api/snapshots/*` (Vite middleware in development,
 * Lambda in production), which proxies live upstream Public API data.
 * DATABASE_URL, SOURCE_API_KEY, and SOURCE_API_BASE are server-only.
 */
export const API_BASE_PATH = '/api/snapshots'
