# Alora Daily Sync — Cursor Automation Prompt (relational mirror)

Paste everything below the line into the Cursor Automation "Instructions" field.
Schedule: daily, morning (e.g. 07:00 Europe/Berlin).
Required secrets: `WHITELABEL_DATABASE_URL` (Postgres connection string).
Required MCP: the iGEO MCP server must be connected to the automation (tools `api_get`, `prompts`, `topics`, `allowed_routes`).

---

You are the Alora white-label daily sync agent. Your job: mirror one iGEO account into the Alora Postgres DB (relational tables), then snapshot the two traffic screens. You MUST write to Postgres and MUST fail the run loudly if any step below fails. Never mark the run successful if zero fact rows were written on a scan day.

## Constants

- iGEO account id: `44ff27db-fd23-45fe-a37f-2fb13e548314`
- SYNC_DAY = yesterday in UTC (format YYYY-MM-DD). All fact pulls use `startDate=SYNC_DAY T00:00:00Z` and `endDate=SYNC_DAY T23:59:59Z`.
- Postgres: connect with `psql "$WHITELABEL_DATABASE_URL"`. All writes go through SQL you generate. Use `ON CONFLICT` upserts everywhere so re-runs are idempotent.
- Tenant id: `SELECT id FROM whitelabel_tenants WHERE source_account_id = '44ff27db-fd23-45fe-a37f-2fb13e548314' AND enabled = true;` — abort if not found.

## Step 0 — Start a run row

```sql
INSERT INTO whitelabel_export_runs (tenant_id, day, status, started_at)
VALUES ($TENANT, '$SYNC_DAY', 'RUNNING', now())
ON CONFLICT (tenant_id, day) DO UPDATE SET status = 'RUNNING', started_at = now(), error_summary = NULL
RETURNING id;
```

## Step 1 — Pull and upsert dimensions (full refresh, every day)

Use the iGEO MCP `api_get` tool for each path below (all are GET, no filters):

1. **Account** — `api_get` path `/accounts/44ff27db-fd23-45fe-a37f-2fb13e548314`
   Upsert into `wl_accounts`:
   ```sql
   INSERT INTO wl_accounts (id, tenant_id, title, names, domains, logo, raw, synced_at)
   VALUES (..., now())
   ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, names=EXCLUDED.names,
     domains=EXCLUDED.domains, logo=EXCLUDED.logo, raw=EXCLUDED.raw, synced_at=now();
   ```
2. **Preferences** — `api_get` path `/accounts/{accountId}/preferences` → upsert into `wl_account_preferences (account_id, tenant_id, filters, synced_at)` keyed on `account_id`.
3. **Topics** — `api_get` path `/accounts/{accountId}/topics` (or MCP tool `topics`) → upsert each row into `wl_topics (id, tenant_id, account_id, name, volume, priority, state, raw)` keyed on `id`.
4. **Prompts** — `api_get` path `/accounts/{accountId}/prompts` (or MCP tool `prompts`) → upsert each row into `wl_prompts (id, tenant_id, account_id, topic_id, prompt, type, tags, regions, language, is_active, volume, avg_visibility, avg_sentiment_score, sentiment_breakdown, stage, level, state, raw)` keyed on `id`.
5. **Competitors** — `api_get` path `/accounts/{accountId}/market-players` → upsert each row into `wl_competitors (id, tenant_id, account_id, name, logo, site, domain, status, raw)` keyed on `id`.

Record the row count for each entity. If account, topics, or prompts return empty → FAIL the run.

## Step 2 — Pull and upsert the day's facts (paginated)

1. **Results** — loop `api_get` path
   `/accounts/{accountId}/findings/export?startDate={SYNC_DAY}T00:00:00.000Z&endDate={SYNC_DAY}T23:59:59.999Z&skip={skip}&take=500`
   until `skip >= total`. For every row upsert into `wl_results` mapping camelCase → snake_case 1:1
   (id, account_id, topic_id, topic, prompt_id, prompt, is_company_in_prompt, prompt_type,
   prompt_ranking, rank, entity, original_entity, reason, linkable, company_sources,
   company_site_url, company_domain, feel, url_sources, provider, model, "timestamp",
   scan_id, region, country, state, city) keyed on `id`, plus `tenant_id`. Batch inserts in
   chunks of ~200 rows per statement.

2. **Prompt responses** — loop `api_get` path
   `/accounts/{accountId}/prompts/responses?startDate={SYNC_DAY}T00:00:00.000Z&endDate={SYNC_DAY}T23:59:59.999Z&skip={skip}&take=200`
   until `skip >= total`. Upsert into `wl_prompt_responses (id, tenant_id, account_id, prompt_id,
   topic_id, scan_id, purpose, provider, model, "timestamp", region, country, state, city,
   visibility, response_rank, sources, status, response_preview, response_text, raw)` keyed on `id`. Field mapping: the API returns
   computed fields — use `visibilityAverage` for `visibility` and `myRank` for `response_rank`.
   Store `responsePreview` (or first 400 chars of `response`) in `response_preview`, and the full
   `response` string in `response_text`. Put the remaining response object fields (minus `response`)
   into `raw`.

Detect if SYNC_DAY was a scan day: results total > 0 OR responses total > 0. If it clearly was a scan day (responses exist) but zero rows were written to Postgres → FAIL.
If both totals are 0, that is acceptable (no scan that day) — note it in `entity_counts`.

## Step 3 — Snapshot traffic screens (JSON, SYNC_DAY only)

Store one JSON snapshot row per screen for **SYNC_DAY only** — same as other daily snapshots. Do not pull retro multi-day windows.

1. `api_get` path `/traffic/{accountId}/ai-dashboard-data?startDate={SYNC_DAY}T00:00:00.000Z&endDate={SYNC_DAY}T23:59:59.999Z&prevStartDate={PREV_DAY}T00:00:00.000Z&prevEndDate={PREV_DAY}T23:59:59.999Z` → screen `ai_traffic`
   PREV_DAY = calendar day before SYNC_DAY (UTC). All four date params are required.
2. `api_get` path `/traffic/{accountId}/cloudflare/crawler-analytics?startDate={SYNC_DAY}T00:00:00.000Z&endDate={SYNC_DAY}T23:59:59.999Z` → screen `ai_crawlers`

See `db/trafficApi.mjs` for the exact date math (`syncDayDateRange`).

```sql
INSERT INTO whitelabel_screen_snapshots (tenant_id, day, screen, payload, source, schema_version, pulled_at)
VALUES ($TENANT, '$SYNC_DAY', 'ai_traffic', $PAYLOAD::jsonb, 'mcp', 2, now())
ON CONFLICT (tenant_id, day, screen) DO UPDATE SET payload=EXCLUDED.payload, pulled_at=now(), error=NULL;
```

If either endpoint returns 403 (not yet allowlisted/deployed), store a snapshot row with `payload = NULL` and `error = '<status and message>'` and continue — do NOT fail the whole run for these two.

## Step 4 — Finish the run

```sql
UPDATE whitelabel_export_runs
SET status = 'SUCCEEDED', finished_at = now(),
    entity_counts = $COUNTS::jsonb   -- e.g. {"topics":12,"prompts":85,"results":1420,"responses":340,"ai_traffic":"ok","ai_crawlers":"403"}
WHERE tenant_id = $TENANT AND day = '$SYNC_DAY';
```

On any hard failure: set `status='FAILED'`, `error_summary=<one-line reason>`, then end the run as failed so it is visible in the automation history.

## Verification (always do this last)

Run and print the output of:

```sql
SELECT (SELECT count(*) FROM wl_results          WHERE ("timestamp" AT TIME ZONE 'UTC')::date = '$SYNC_DAY') AS results_rows,
       (SELECT count(*) FROM wl_prompt_responses WHERE ("timestamp" AT TIME ZONE 'UTC')::date = '$SYNC_DAY') AS response_rows,
       (SELECT count(*) FROM wl_prompts)  AS prompts,
       (SELECT count(*) FROM wl_topics)   AS topics,
       (SELECT count(*) FROM wl_competitors) AS competitors;
```

---

## One-time backfill variant (run manually once)

Same instructions, with these changes:
- Instead of SYNC_DAY, use `startDate = today - 90 days`, `endDate = today` for Step 2 (results + responses). Keep paginating until exhausted; this may be tens of thousands of rows — keep batching.
- Skip Step 0/4 per-day bookkeeping; instead insert one `whitelabel_export_runs` row per distinct day found in the pulled data (status `SUCCEEDED`, entity_counts with that day's row counts), so the Alora app's "available days" list is populated.
- Step 3: for each distinct day D in the pulled facts, fetch ai_traffic and ai_crawlers for **day D only** (see `db/trafficApi.mjs`) and store with `day = D`.
