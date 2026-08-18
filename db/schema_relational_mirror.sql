-- =============================================================================
-- Alora White-Label DB: relational mirror of upstream core entities.
--
-- Dimensions (wl_accounts, wl_account_preferences, wl_topics, wl_prompts,
-- wl_competitors) are fully re-upserted on every daily sync.
-- Facts (wl_results, wl_prompt_responses) are appended day by day, idempotent
-- upserts keyed by the upstream UUID.
--
-- whitelabel_tenants / whitelabel_export_runs / whitelabel_screen_snapshots
-- are kept from the original design. Snapshots now only carry ai_traffic and
-- ai_crawlers payloads.
--
-- Apply with:
--   psql "$DATABASE_URL" -f schema_relational_mirror.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wl_accounts (
  id          uuid PRIMARY KEY,               -- upstream account id
  tenant_id   uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  names       text[] NOT NULL DEFAULT '{}',
  domains     text[] NOT NULL DEFAULT '{}',
  logo        text,
  raw         jsonb,                          -- full account payload from upstream
  synced_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wl_accounts_tenant_idx ON wl_accounts (tenant_id);

CREATE TABLE IF NOT EXISTS wl_account_preferences (
  account_id  uuid PRIMARY KEY REFERENCES wl_accounts(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  filters     jsonb,                          -- FiltersDto payload from GET /accounts/:id/preferences
  synced_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wl_topics (
  id          uuid PRIMARY KEY,               -- upstream topic id
  tenant_id   uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL,
  name        text NOT NULL,
  volume      integer,
  priority    integer,
  state       text,
  raw         jsonb,
  synced_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wl_topics_account_idx ON wl_topics (account_id);

CREATE TABLE IF NOT EXISTS wl_prompts (
  id                   uuid PRIMARY KEY,      -- upstream prompt id
  tenant_id            uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id           uuid NOT NULL,
  topic_id             uuid,
  prompt               text NOT NULL,
  type                 text,
  tags                 jsonb,
  regions              text[] NOT NULL DEFAULT '{}',
  language             text,
  is_active            boolean NOT NULL DEFAULT true,
  volume               integer,
  avg_visibility       integer,
  avg_sentiment_score  integer,
  sentiment_breakdown  jsonb,
  stage                text,
  level                text,
  state                text,
  raw                  jsonb,
  synced_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wl_prompts_account_idx ON wl_prompts (account_id);
CREATE INDEX IF NOT EXISTS wl_prompts_topic_idx ON wl_prompts (topic_id);

CREATE TABLE IF NOT EXISTS wl_competitors (
  id          uuid PRIMARY KEY,               -- upstream competitor id
  tenant_id   uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL,
  name        text NOT NULL,
  logo        text,
  site        text,
  domain      text,
  status      text,
  raw         jsonb,
  synced_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wl_competitors_account_idx ON wl_competitors (account_id);

-- ---------------------------------------------------------------------------
-- Facts
-- ---------------------------------------------------------------------------

-- Mirrors upstream `results` (see apps/server/prisma/schema.prisma model Results).
-- One row per (scan, prompt, provider, ranked entity). This is the workhorse
-- for provider mentions %, industry ranking, sentiment, and source domains.
CREATE TABLE IF NOT EXISTS wl_results (
  id                   uuid PRIMARY KEY,      -- upstream results id
  tenant_id            uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id           uuid NOT NULL,
  topic_id             uuid NOT NULL,
  topic                text NOT NULL,
  prompt_id            uuid NOT NULL,
  prompt               text NOT NULL,
  is_company_in_prompt boolean NOT NULL,
  prompt_type          text NOT NULL,
  prompt_ranking       integer NOT NULL,
  rank                 integer NOT NULL,
  entity               text NOT NULL,
  original_entity      text NOT NULL,
  reason               text,
  linkable             boolean NOT NULL DEFAULT false,
  company_sources      jsonb,
  company_site_url     text,
  company_domain       text,
  feel                 text,
  url_sources          jsonb,
  provider             text NOT NULL,
  model                text NOT NULL,
  "timestamp"          timestamptz NOT NULL,
  scan_id              uuid NOT NULL,
  region               text,
  country              text,
  state                text,
  city                 text,
  synced_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wl_results_account_ts_idx      ON wl_results (account_id, "timestamp");
CREATE INDEX IF NOT EXISTS wl_results_account_entity_idx  ON wl_results (account_id, entity);
CREATE INDEX IF NOT EXISTS wl_results_account_scan_idx    ON wl_results (account_id, scan_id);
CREATE INDEX IF NOT EXISTS wl_results_provider_idx        ON wl_results (provider);
CREATE INDEX IF NOT EXISTS wl_results_topic_idx           ON wl_results (topic_id);
CREATE INDEX IF NOT EXISTS wl_results_company_domain_idx  ON wl_results (company_domain);
CREATE INDEX IF NOT EXISTS wl_results_day_idx             ON wl_results (account_id, (("timestamp" AT TIME ZONE 'UTC')::date));

-- Mirrors upstream `prompt_responses` minus the heavy raw response text.
-- One row per (scan, prompt, provider) LLM response; drives the visibility
-- chart and per-response listings on the Prompts screen.
CREATE TABLE IF NOT EXISTS wl_prompt_responses (
  id             uuid PRIMARY KEY,            -- upstream prompt_responses id
  tenant_id      uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id     uuid NOT NULL,
  prompt_id      uuid,
  topic_id       uuid,
  scan_id        uuid,
  purpose        text,
  provider       text NOT NULL,
  model          text,
  "timestamp"    timestamptz NOT NULL,
  region         text,
  country        text,
  state          text,
  city           text,
  visibility     integer NOT NULL DEFAULT 0,  -- 100 if account appeared, else 0
  response_rank  double precision,
  sources        jsonb,
  status         text,
  response_preview text,                    -- truncated text for table rows
  response_text    text,                      -- full LLM response body
  raw            jsonb,                       -- response payload minus raw text (json_response/companies etc.)
  synced_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wl_prompt_responses_account_ts_idx ON wl_prompt_responses (account_id, "timestamp");
CREATE INDEX IF NOT EXISTS wl_prompt_responses_prompt_idx     ON wl_prompt_responses (prompt_id);
CREATE INDEX IF NOT EXISTS wl_prompt_responses_scan_idx       ON wl_prompt_responses (scan_id);
CREATE INDEX IF NOT EXISTS wl_prompt_responses_provider_idx   ON wl_prompt_responses (provider);
CREATE INDEX IF NOT EXISTS wl_prompt_responses_day_idx        ON wl_prompt_responses (account_id, (("timestamp" AT TIME ZONE 'UTC')::date));

ALTER TABLE wl_prompt_responses
  ADD COLUMN IF NOT EXISTS response_preview text,
  ADD COLUMN IF NOT EXISTS response_text text;

-- ---------------------------------------------------------------------------
-- Export run bookkeeping: add per-entity counts to existing table
-- ---------------------------------------------------------------------------

ALTER TABLE whitelabel_export_runs
  ADD COLUMN IF NOT EXISTS entity_counts jsonb;
