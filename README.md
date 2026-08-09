# riddleday-airops

React + Vite + TypeScript app for RiddleDay’s AirOps workspace: **Insights** (Analytics, Onsite, Prompts, Offsite) plus a **Brand Kit editor**.

## What’s included

### Insights (existing)
- **Analytics** — `/` Overview, `/visibility`, `/citations`, `/sentiment`
- **Onsite** — `/pages`
- **Prompts** — `/prompts`
- **Offsite** — `/offsite` (citations & domains inventory)

### Brand Kit editor (added)
- Routes under `/brand-kit/*` (Overview, Foundations, Product Lines, Content Types, Audiences, Regions, Visual Guidelines, Custom Variables, Review)
- Live READ via `GET /brand_kits/{id}` + `POST /brand_kits/list`
- Local edits + diff review; submit posts to `VITE_SUBMIT_WEBHOOK_URL` (Playbook webhook) — **not** a direct AirOps write (no public write API exists)

## Setup

```bash
npm install
cp .env.example .env   # fill AIROPS_API_KEY, optional webhook URL
npm run dev
```

Open http://localhost:5173.

| Variable | Purpose |
| --- | --- |
| `AIROPS_API_KEY` | **Recommended.** Proxy-only; never bundled. |
| `AIROPS_API_BASE` | Defaults to `https://api.airops.com`. |
| `VITE_AIROPS_BRAND_KIT_ID` | Brand Kit id (client-readable). |
| `VITE_SUBMIT_WEBHOOK_URL` | Playbook webhook for Brand Kit submit queue. |
| `VITE_SEED_MISSING_ENTITIES` | Seed REST-missing Brand Kit entities (default `true`). |

## Security

Frontend reads call `/api/airops/*`. The Vite proxy injects `Authorization` from `AIROPS_API_KEY` on the Node side. This only works for `npm run dev` / `preview` — production needs a small backend/serverless proxy. Never ship the key with a `VITE_` prefix.

## Deploy to Amplify (fix the production 404)

Amplify hosts a static SPA only. It does **not** run the Vite proxy, so `/api/airops/...` was returning `index.html` and the app showed `AirOps API error 404`.

### 1. Deploy the Lambda proxy

Files live in [`functions/airops-proxy/index.mjs`](functions/airops-proxy/index.mjs).

1. AWS Console → **Lambda** → Create function  
   - Runtime: **Node.js 20.x**  
   - Handler: leave default; paste the contents of `index.mjs` (ESM: set package type or rename as needed — for a single-file Function URL, set **Runtime settings → Handler** to `index.handler` and ensure the file exports `handler`)
2. Configuration → **Environment variables**  
   - `AIROPS_API_KEY` = your AirOps key (same as local `.env`)  
   - optional: `AIROPS_API_BASE` = `https://api.airops.com`
3. Configuration → **Function URL** → Create  
   - Auth type: **NONE**  
   - Copy the Function URL (e.g. `https://xxxx.lambda-url.us-east-1.on.aws/`)

Quick zip deploy from the repo:

```bash
cd functions/airops-proxy
zip -j airops-proxy.zip index.mjs
# Upload airops-proxy.zip in Lambda → Code → Upload from → .zip file
```

If Lambda expects CommonJS and rejects ESM, add a tiny `package.json` next to the file with `{ "type": "module" }` inside the zip.

### 2. Amplify rewrites

Amplify Console → your app → **Hosting** → **Rewrites and redirects** → Open text editor.

Paste [`amplify-redirects.json`](amplify-redirects.json), replacing `YOUR_LAMBDA_FUNCTION_URL` with the Function URL **host** (no trailing path).

Order matters: API proxy rule first, SPA `404 → /index.html` second.

### 3. Amplify build env vars

Amplify → **Environment variables** (for the frontend build only):

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_AIROPS_BRAND_KIT_ID` | Yes | Same as local |
| `VITE_SUBMIT_WEBHOOK_URL` | If using Brand Kit submit | Playbook webhook |
| `VITE_SEED_MISSING_ENTITIES` | Optional | Default true |

Do **not** add `VITE_AIROPS_API_KEY`. Keep `AIROPS_API_KEY` only on the Lambda.

[`amplify.yml`](amplify.yml) builds with `npm ci` + `npm run build` and publishes `dist/`.

### 4. Verify

After redeploy, open DevTools → Network. A request like:

`https://main....amplifyapp.com/api/airops/public_api/brand_kits/list`

should return **JSON**, not HTML. Offsite / Analytics should load.

## Brand Kit write limitation

Public REST Brand Kit endpoints are **read-only**. Submit queues a diff to your Playbook webhook for MCP apply + human publish. If a direct-write REST endpoint appears later, only `submitBrandKitChanges` in `src/api/airops.ts` needs to change.
