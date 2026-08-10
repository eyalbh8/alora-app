# Alora iGEO (white-label snapshots)

React + Vite + TypeScript app that renders **iGEO analytics screens from a Postgres snapshot DB** — not live iGEO APIs.

## Screens

| Route | Snapshot keys |
| --- | --- |
| `/` Dashboard | `dashboard`, `dashboard_top_sources` |
| `/prompts` | `prompts`, `topics` (+ response detail from `mentions_sentiment`) |
| `/mentions` | `mentions_chart`, `mentions_sentiment` |
| `/sentiment` | `sentiment`, `sentiment_historical` |
| `/competitors` | `competitors` |
| `/ai-traffic` | `ai_traffic` |
| `/ai-crawlers` | `ai_crawlers` |

Filters are applied **client-side** on payload JSON. Unavailable dimensions are disabled with “Not available in snapshot.”

## Setup

```bash
npm install
cp .env.example .env   # fill DATABASE_URL + WHITELABEL_TENANT_ID
npm run dev
```

Open http://localhost:5173.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Server-only.** Postgres connection to `whitelabel_*` tables. |
| `WHITELABEL_TENANT_ID` | **Server-only.** Fixed tenant UUID (`whitelabel_tenants.id`). |
| `ALLOWED_ORIGIN` | Lambda only — CORS allowlist (optional). |

Never prefix `DATABASE_URL` or `WHITELABEL_TENANT_ID` with `VITE_`.

## Architecture

```
Browser → /api/snapshots/* → [Vite middleware (dev) | Lambda (prod)] → Postgres
```

The browser never receives credentials and cannot choose a tenant. Endpoints:

- `GET /api/snapshots/health`
- `GET /api/snapshots/tenant`
- `GET /api/snapshots/snapshots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&screens=a,b`

Date ranges are capped at **90 days**.

## Deploy to Amplify

### 1. Lambda snapshots API

```bash
cd functions/snapshots-api
npm install --omit=dev
zip -r snapshots-api.zip index.mjs db.mjs package.json node_modules
```

Create a Lambda (Node.js 20.x), upload the zip, set handler `index.handler`, and env:

- `DATABASE_URL`
- `WHITELABEL_TENANT_ID`
- optional `ALLOWED_ORIGIN`

Create a **Function URL** (Auth type: NONE).

### 2. Amplify rewrites

Paste [`amplify-redirects.json`](amplify-redirects.json), replacing `YOUR_LAMBDA_FUNCTION_URL` with the Function URL host. Keep the API rule above the SPA catch-all.

### 3. Amplify build

[`amplify.yml`](amplify.yml) runs `npm ci` + `npm run build` and publishes `dist/`. No `VITE_` secrets are required for the snapshot UI.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite + local `/api/snapshots` middleware |
| `npm run build` | Typecheck + production bundle |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit tests for snapshot helpers |

## Data model

- `whitelabel_tenants` — tenant registry (`enabled` must be true)
- `whitelabel_export_runs` — per-day export status
- `whitelabel_screen_snapshots` — `(tenant_id, day, screen)` → `payload` JSONB + `error` + `pulled_at`
