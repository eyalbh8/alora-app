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

## Brand Kit write limitation

Public REST Brand Kit endpoints are **read-only**. Submit queues a diff to your Playbook webhook for MCP apply + human publish. If a direct-write REST endpoint appears later, only `submitBrandKitChanges` in `src/api/airops.ts` needs to change.
# alora-app
