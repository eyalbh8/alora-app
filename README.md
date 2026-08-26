# Alora App

Whitelabel analytics dashboard (GEO / traffic / crawlers).

## Monorepo layout

```
Alora-app/
├── apps/
│   ├── client/          # Vite + React 19 SPA
│   └── server/          # NestJS + Prisma + Serverless
├── packages/
│   └── shared/          # @alora/shared (types + utils)
├── docs/
├── amplify.yml
└── amplify-redirects.json
```

## Develop

```bash
# Install all workspaces
npm ci

# Terminal A — API on :3003
npm run dev:server

# Terminal B — SPA on :5173 (proxies /api → :3003)
npm run dev:client
```

Copy root `.env.example` → `apps/server/.env` (and `apps/client/.env` for `VITE_*` keys).

## Deploy server (`npm run deploy:prod`)

```bash
cd apps/server
npm run deploy:prod
# = fetch-secrets:prod → prisma:deploy:prod → ecr:login → serverless deploy --stage prod
```

Prerequisites:

1. Create Secrets Manager secret `alora-prod` in us-east-1 with:
   `DATABASE_URL`, `DESCOPE_PROJECT_ID`, `SOURCE_API_BASE`, `SOURCE_API_KEY`,
   `MCP_URL`, `MCP_API_KEY`, `ALLOWED_ORIGIN`
2. Hand-maintain `apps/server/.env.prod.local` for `prisma migrate deploy` (may use a tunneled DB host)
3. Docker running locally; AWS credentials via `AWS_PROFILE` (default: `default`)
4. After first deploy, paste the Function URL into [`amplify-redirects.json`](amplify-redirects.json)

## Deploy client (Amplify)

[`amplify.yml`](amplify.yml) builds `@alora/client` and publishes `apps/client/dist`.

## Auth model

- `Authorization: Bearer <Descope JWT>`
- `X-Alora-Tenant-Id: <tenant-uuid>` on tenant-scoped routes

## API surface

- `GET /api/snapshots/*` — accounts, tenant, snapshots, traffic, crawlers, geo/*
