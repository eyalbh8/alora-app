# Alora (white-label analytics)

React + Vite + TypeScript app that renders **Alora analytics screens from a Postgres snapshot DB** with **Descope authentication** and **multi-tenant account switching**.

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
cp .env.example .env   # fill DATABASE_URL, DESCOPE_PROJECT_ID, VITE_DESCOPE_PROJECT_ID
npm run dev
```

Open http://localhost:5173. You'll be redirected to the Descope login flow.

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | **Server-only.** Postgres connection to `whitelabel_*` tables. |
| `DESCOPE_PROJECT_ID` | **Server-only.** Your Descope project ID for JWT verification. |
| `VITE_DESCOPE_PROJECT_ID` | **Client.** Same Descope project ID, exposed to the browser for auth. |
| `VITE_DESCOPE_FLOW_ID` | **Client.** Optional Descope flow ID (defaults to `sign-up-or-in`). |
| `WHITELABEL_TENANT_ID` | **Server-only.** Used by sync/backfill scripts only (not browser requests). |
| `ALLOWED_ORIGIN` | Lambda only — CORS allowlist (optional). |

Never prefix `DATABASE_URL` or `DESCOPE_PROJECT_ID` with `VITE_`.

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
Browser → Descope JWT + X-Alora-Tenant-Id → [Vite middleware (dev) | Lambda (prod)] → Postgres
```

All data endpoints require:
- **Authentication**: `Authorization: Bearer <Descope JWT>` header
- **Tenant selection**: `X-Alora-Tenant-Id: <tenant-uuid>` header

The API verifies JWT, checks user membership for the requested tenant, then returns tenant-scoped data.

Endpoints:

- `GET /api/snapshots/health` — no auth required
- `GET /api/snapshots/accounts` — list accessible tenants
- `GET /api/snapshots/tenant` — tenant metadata (requires auth + tenant header)
- `GET /api/snapshots/snapshots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&screens=a,b` — snapshots (requires auth + tenant header)
- `GET /api/snapshots/geo/*` — GEO endpoints (requires auth + tenant header)

Date ranges are capped at **90 days**.

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
