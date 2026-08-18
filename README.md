# Alora (white-label analytics)

React + Vite + TypeScript app that renders **Alora analytics screens from the live iGEO Public API** (`https://api.igeo.ai`) with **Descope authentication** and **multi-tenant account switching**.

The browser never calls iGEO directly. Descope JWT + `X-Alora-Tenant-Id` go to Alora’s BFF, which injects the workspace API key.

## Screens

| Route | Live iGEO sources |
| --- | --- |
| `/` Dashboard | `/ui-pages/dashboard`, `/ui-pages/dashboard/top-source-domains` |
| `/prompts` | `/prompts`, `/prompts/responses` |
| `/mentions` | `/prompts/responses/chart-data`, `/prompts/responses` |
| `/sentiment` | `/findings/ai-feel`, `/findings/provider-feel`, sentiment historical + responses |
| `/competitors` | `/market-players/page-data` |
| `/ai-traffic` | `/traffic/{id}/ai-dashboard-data` |
| `/ai-crawlers` | `/traffic/{id}/cloudflare/crawler-analytics` |

Filters are applied **server-side** on iGEO (date range, providers, topics, prompts, regions, tags, branded, prompt types).

## Setup

```bash
npm install
cp .env.example .env   # fill DATABASE_URL, DESCOPE_*, and an iGEO API key
npm run dev
```

Open http://localhost:5173. You'll be redirected to the Descope login flow.

Each tenant needs an iGEO key (`igeo_live_…`) bound to `whitelabel_tenants.source_account_id`. Paste the MCP URL in **Carousel → Connect**, or set `IGEO_API_KEY` as a single-workspace fallback.

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Server-only.** Postgres for users, membership, and tenant→workspace mapping. |
| `DESCOPE_PROJECT_ID` | **Server-only.** Your Descope project ID for JWT verification. |
| `VITE_DESCOPE_PROJECT_ID` | **Client.** Same Descope project ID, exposed to the browser for auth. |
| `VITE_DESCOPE_FLOW_ID` | **Client.** Optional Descope flow ID (defaults to `sign-up-or-in`). |
| `IGEO_API_BASE` | **Server-only.** Public API origin (default `https://api.igeo.ai`). |
| `IGEO_API_KEY` / `IGEO_MCP_API_KEY` | **Server-only.** Fallback `igeo_live_` key when a tenant has no stored key. |
| `IGEO_MCP_URL` | **Server-only.** MCP endpoint for carousel (default `https://api.igeo.ai/mcp`). |
| `WHITELABEL_TENANT_ID` | **Server-only.** Used by sync/backfill scripts only (not browser requests). |
| `ALLOWED_ORIGIN` | Lambda only — CORS allowlist (optional). |

Never prefix `DATABASE_URL`, `DESCOPE_PROJECT_ID`, or iGEO keys with `VITE_`.

### Database Schema

Apply the schemas in order:

1. **Core snapshot schema** (if not already applied):
   ```bash
   psql "$DATABASE_URL" -f db/schema_relational_mirror.sql
   ```

2. **Auth & membership schema**:
   ```bash
   psql "$DATABASE_URL" -f db/schema_auth.sql
   ```

3. **Per-tenant MCP/API key column**:
   ```bash
   psql "$DATABASE_URL" -f db/schema_tenant_mcp.sql
   ```

### Seeding Users & Memberships

After a user logs in for the first time via Descope, their record is automatically created in `wl_users`. To grant access:

**Grant admin access** (can see all enabled tenants):
```sql
UPDATE wl_users SET is_admin = true WHERE email = 'admin@example.com';
```

**Grant specific tenant membership** (non-admins):
```sql
INSERT INTO wl_user_tenants (user_id, tenant_id, role)
VALUES ('descope-user-id', 'tenant-uuid-here', 'member');
```

To find the Descope user ID after first login:
```sql
SELECT id, email, name, is_admin FROM wl_users WHERE email = 'user@example.com';
```

## Architecture

```
Browser → Descope JWT + X-Alora-Tenant-Id → [Vite middleware (dev) | Lambda (prod)]
        → Postgres (membership + tenant key)
        → https://api.igeo.ai (Bearer igeo_live_… + X-Workspace-Id)
```

All data endpoints require:
- **Authentication**: `Authorization: Bearer <Descope JWT>` header
- **Tenant selection**: `X-Alora-Tenant-Id: <tenant-uuid>` header

The API verifies JWT, checks user membership, then proxies live iGEO reads for that tenant’s `source_account_id`.

Endpoints:

- `GET /api/snapshots/health` — no auth required
- `GET /api/snapshots/accounts` — list accessible tenants
- `GET /api/snapshots/tenant` — tenant metadata + last scan day
- `GET /api/snapshots/geo/*` — GEO screens (dashboard, mentions, sentiment, prompts, competitors, responses)
- `GET /api/snapshots/traffic` — AI traffic dashboard
- `GET /api/snapshots/crawlers` — Cloudflare crawler analytics

### Account Switching

Users with access to multiple tenants can switch via the sidebar account switcher (under the Alora logo). On switch:
- `selectedAccount` is updated in localStorage (`alora-selected-account`)
- All React Query caches are invalidated
- Data re-fetches for the new tenant

Admins see all enabled tenants; non-admins see only their explicit memberships.

## Deploy to Amplify

### 1. Lambda snapshots API

```bash
cd functions/snapshots-api
npm install --omit=dev
zip -r snapshots-api.zip index.mjs db.mjs geo.mjs igeoClient.mjs mcpClient.mjs auth.mjs accounts.mjs package.json node_modules
```

Create a Lambda (Node.js 20.x), upload the zip, set handler `index.handler`, and env:

- `DATABASE_URL`
- `IGEO_API_BASE=https://api.igeo.ai`
- `IGEO_API_KEY` (or store per-tenant keys)
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
| `npm test` | Vitest unit tests |

## Data model

- `whitelabel_tenants` — tenant registry (`source_account_id` = iGEO workspace, optional `igeo_mcp_api_key`)
- `wl_users` / `wl_user_tenants` — Descope users and memberships
