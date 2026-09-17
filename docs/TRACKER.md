# AI Traffic Tracker

First-party tracking for visits that arrive from AI assistants. A small script on
the customer's site reports qualifying visits to our API, which stores them in
`analytics_events` and aggregates them for the AI Traffic dashboard.

This replaces the upstream Source API as the data source for `/ai-traffic`.
Crawler analytics on `/ai-crawlers` still come from upstream, because AI crawlers
do not execute JavaScript.

## Pipeline

```
Customer site
  └─ <script src="https://<app-host>/v1/tracker.min.js" ...>
       └─ POST /api/snapshots/track          (only when an AI signal is present)
            └─ TrackingService: validate tenant + origin, classify crawler UA,
               resolve provider, GeoIP enrich
                 └─ analytics_events
                      └─ AnalyticsService.getAiDashboardAggregates
                           └─ GET /api/snapshots/traffic  →  AI Traffic screen
```

## Installing on a customer site

The workspace's snippet is available in the app under **Tracker setup**
(`/ai-traffic/setup`), pre-filled with the workspace id.

```html
<script
  src="https://<app-host>/v1/tracker.min.js"
  data-account-id="<workspace-uuid>"
  data-endpoint="https://<api-host>/api/snapshots/track"
  async
></script>
```

Optional no-JS fallback, which catches some agents that read HTML without
running scripts:

```html
<noscript>
  <img src="https://<api-host>/api/snapshots/track/pixel.gif?a=<workspace-uuid>" alt="" width="1" height="1" />
</noscript>
```

`data-account-id` is the Menchly workspace (tenant) UUID, not the Source API
account id.

The two URLs are different hosts and both must be absolute, because the snippet
executes on the customer's site:

- `src` is the **app / CDN** host that serves the static script.
- `data-endpoint` is the **API** host that receives events.

Neither can be derived from the dashboard's own origin. In local development the
dashboard runs on Vite (`:5173`) while the API runs on Nest (`:3003`), and Vite's
`/api` proxy only rewrites requests made from the dashboard origin. Override
either host with `VITE_TRACKER_SRC` and `VITE_TRACKER_ENDPOINT`; see
[`config.ts`](../apps/client/src/config.ts) for the resolution order.

## Detection rules

The tracker exits without sending anything unless at least one signal matches.
Ordinary visitors are never reported.

| Signal | Rule |
| --- | --- |
| Referrer | Exact hostname match, or a subdomain of a known AI chat host |
| `utm_source` | Substring match against a token list |
| User agent | Crawler names, checked **server-side** against the real request header |

Referrer matching is exact rather than substring, so domains that merely contain
a provider name (`grokkingalgorithms.com`, `claude-monet-gallery.com`) do not
register. Bare `bing.com` and `google.com` are excluded because they carry
ordinary search traffic; only `copilot.microsoft.com` and
`edgeservices.bing.com` count as Copilot.

Providers resolve to the canonical codes the dashboard renders: `OPENAI`,
`ANTHROPIC`, `PERPLEXITY`, `GEMINI`, `BD_COPILOT`, plus `GROK`, `DEEPSEEK` and
`META`. Resolution order is referrer, then `utm_source`, then crawler user agent.

All tables live in [`ai-signals.util.ts`](../apps/server/src/utils/ai-signals.util.ts),
with the tracker carrying a trimmed copy of the referrer and UTM lists for its
own gate. Keep the two in sync when adding a provider.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/snapshots/track` | Public | Ingest one event |
| `GET` | `/api/snapshots/track/pixel.gif` | Public | No-JS fallback, returns a 1x1 GIF |
| `GET` | `/api/snapshots/tracker/status` | Tenant | Install verification |
| `GET` | `/api/snapshots/traffic` | Tenant | Dashboard aggregates |

Ingest routes must stay under `/api/snapshots/` — that is the only prefix
[`amplify-redirects.json`](../amplify-redirects.json) rewrites to the Lambda.

### POST /api/snapshots/track

```json
{
  "trackerVersion": "v1",
  "accountId": "<workspace-uuid>",
  "ts": "2026-09-15T06:30:00.000Z",
  "url": "https://example.com/pricing",
  "path": "/pricing",
  "referrer": "https://chatgpt.com/c/abc",
  "utmSource": null,
  "utmMedium": null,
  "utmCampaign": null,
  "browser": "Chrome",
  "os": "macOS",
  "device": "desktop",
  "screen": "1920x1080",
  "platform": "MacIntel",
  "language": "en-US"
}
```

`accountId` and `url` are required. `userAgent`, IP and country are taken from
the request, never the body. Responses:

- `{ "success": true, "eventId": "...", "provider": "OPENAI" }` — stored
- `{ "success": true, "stored": false }` — valid request with no AI signal
- `400` invalid `accountId` or missing `url`
- `403` `Origin` outside the workspace's configured domains
- `404` unknown or disabled workspace

Verify manually:

```bash
curl -i -X POST http://localhost:3003/api/snapshots/track \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: Mozilla/5.0 Chrome/120.0' \
  -d '{"accountId":"<workspace-uuid>","ts":"2026-09-15T06:30:00.000Z",
       "url":"https://example.com/blog","path":"/blog",
       "referrer":"https://chatgpt.com/c/abc"}'
```

```sql
SELECT provider, source, bot_name, path, utm_source, country, timestamp
FROM analytics_events ORDER BY timestamp DESC LIMIT 10;
```

## Storage

`analytics_events`, one row per event, keyed to `whitelabel_tenants` by
`tenant_id` with `ON DELETE CASCADE`. Indexed on `(tenant_id, timestamp)` and
`(tenant_id, provider, timestamp)`.

`provider` is resolved and stored **at write time**, so aggregate queries filter
an indexed column instead of re-deriving attribution on every read. The tradeoff
is that changing the detection tables only affects new rows; existing rows need a
backfill `UPDATE` to be re-attributed.

`source` is `USER` for a human arriving from an AI assistant and `AI_CRAWLER`
only when the request's own user agent is a known crawler. A human following a
`?utm_source=chatgpt` link stays a `USER`.

## Aggregation

`getAiDashboardAggregates` emits the `AiTrafficPayload` shape the client already
parses in
[`aiTraffic.ts`](../apps/client/src/lib/snapshots/aiTraffic.ts): `llmProviders`
(with a leading synthetic `TOTAL` row), nested per-provider `historicalData`,
and `topSources` / `topPages` / `topLocations` / `topDevices` / `topBrowsers` /
`availableCountries`.

Aggregates cover the five providers the dashboard renders as entry cards.
Visits attributed to Grok, DeepSeek and Meta AI are still stored, but are
excluded here: the client derives "Total entries" by summing the providers it
renders, so including them would make the breakdowns exceed the total.

Daily buckets are computed in UTC (`timestamp AT TIME ZONE 'UTC'`) so they do
not shift with the database session timezone.

## Building and shipping the script

```bash
npm run build --workspace=@alora/tracker
```

Minifies [`packages/tracker/src/tracker.js`](../packages/tracker/src/tracker.js)
into `apps/client/public/v1/tracker.min.js`, which Vite publishes as a static
asset and Amplify serves from its CDN. The build fails if the output exceeds
2.5KB or contains a `console` call. It runs automatically as the client's
`prebuild`, so `npm run build --workspace=@alora/client` keeps it current, and
the built file is committed so Amplify needs no extra step.

`customHeaders` in [`amplify.yml`](../amplify.yml) sets a one-year immutable
`Cache-Control` plus `Access-Control-Allow-Origin: *`. The URL is versioned:
publish breaking changes under `/v2/` rather than mutating `/v1/`.

For manual browser testing:

```bash
npx http-server packages/tracker -p 8080
# then open http://localhost:8080/test/test.html?utm_source=chatgpt
```

## Limitations

- **Browser JavaScript cannot see AI crawlers.** GPTBot, ClaudeBot,
  PerplexityBot and CCBot fetch raw HTML and never run the script. The pixel
  fallback catches some; `/ai-crawlers` remains the authoritative crawler source.
- **Referrers are often stripped.** Several AI chat interfaces emit
  `rel="noreferrer"`, so `utm_source` tagging is frequently the only signal, and
  only when links carry it. Expect undercounting.
- **Rate limiting is best-effort.** The throttler's in-memory store is per Lambda
  container, so the 1000 requests per 15 minutes limit is approximate.
- **Origin checks need configured domains.** Enforced only when the workspace has
  `domains` or `domain` set; workspaces without them accept any origin.
- **Raw IPs are stored.** `analytics_events.ip` holds the full client IP. If a
  privacy review requires it, switch to a salted hash or truncation and keep only
  the derived country, city and region.
