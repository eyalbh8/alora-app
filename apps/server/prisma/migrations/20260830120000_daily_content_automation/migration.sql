-- Daily content automation: opt-in fields on tenants + run history table.

ALTER TABLE "whitelabel_tenants"
  ADD COLUMN IF NOT EXISTS "daily_content_automation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "daily_content_timezone" TEXT NOT NULL DEFAULT 'Asia/Nicosia',
  ADD COLUMN IF NOT EXISTS "daily_content_hour" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS "daily_content_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "local_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'GENERATING',
  "skip_reason" TEXT,
  "prompt_id" UUID,
  "prompt_text" TEXT,
  "topic_id" UUID,
  "selection_rationale" TEXT,
  "visibility_at_selection" INTEGER,
  "last_content_at" TIMESTAMPTZ(3),
  "platforms" JSONB NOT NULL DEFAULT '{}',
  "error" TEXT,
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),

  CONSTRAINT "daily_content_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_content_runs_tenant_id_local_date_key"
  ON "daily_content_runs"("tenant_id", "local_date");

CREATE INDEX IF NOT EXISTS "daily_content_runs_status_idx"
  ON "daily_content_runs"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_content_runs_tenant_id_fkey'
  ) THEN
    ALTER TABLE "daily_content_runs"
      ADD CONSTRAINT "daily_content_runs_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
