npm warn Unknown env config "devdir". This will stop working in the next major version of npm.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "wl_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_user_tenants" (
    "user_id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_user_tenants_pkey" PRIMARY KEY ("user_id","tenant_id")
);

-- CreateTable
CREATE TABLE "whitelabel_tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_account_id" UUID NOT NULL,
    "name" TEXT,
    "domain" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mcp_api_key" TEXT,

    CONSTRAINT "whitelabel_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_account_profiles" (
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "profile_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carousel_account_profiles_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "carousel_content_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "option_name" TEXT NOT NULL,
    "slide_count" INTEGER NOT NULL,
    "narrative_structure" TEXT NOT NULL,
    "use_cases" TEXT[],
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carousel_content_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_figma_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "generation_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "import_token_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'queued',
    "figma_file_key" VARCHAR(255),
    "figma_page_id" VARCHAR(255),
    "figma_page_name" VARCHAR(255),
    "figma_file_url" TEXT,
    "exported_slide_urls" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6) NOT NULL DEFAULT (now() + '24:00:00'::interval),
    "error" TEXT,
    "plugin_version" VARCHAR(50),
    "plugin_user_info" JSONB,

    CONSTRAINT "carousel_figma_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_generation_outputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "generation_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "input_json" JSONB NOT NULL,
    "output_json" JSONB,
    "duration_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "carousel_generation_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_generations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "selected_post_id" UUID NOT NULL,
    "post_prompt" TEXT NOT NULL,
    "post_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "steps_completed" INTEGER NOT NULL DEFAULT 0,
    "current_step" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "final_caption" TEXT,
    "figma_file_url" TEXT,
    "image_urls" TEXT[],
    "profile_config" JSONB,

    CONSTRAINT "carousel_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_name" TEXT NOT NULL,
    "description" TEXT,
    "figma_file_key" TEXT NOT NULL,
    "figma_node_id" TEXT NOT NULL,
    "template_json" JSONB,
    "zones" JSONB,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carousel_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whitelabel_export_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "error_summary" TEXT,
    "entity_counts" JSONB,

    CONSTRAINT "whitelabel_export_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whitelabel_screen_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "screen" TEXT NOT NULL,
    "payload" JSONB,
    "source" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "pulled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,

    CONSTRAINT "whitelabel_screen_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_account_preferences" (
    "account_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "filters" JSONB,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_account_preferences_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "wl_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logo" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_competitors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "site" TEXT,
    "domain" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_prompt_responses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "prompt_id" UUID,
    "topic_id" UUID,
    "scan_id" UUID,
    "purpose" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "region" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "visibility" INTEGER NOT NULL DEFAULT 0,
    "response_rank" DOUBLE PRECISION,
    "sources" JSONB,
    "status" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_preview" TEXT,
    "response_text" TEXT,

    CONSTRAINT "wl_prompt_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_prompts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "topic_id" UUID,
    "prompt" TEXT NOT NULL,
    "type" TEXT,
    "tags" JSONB,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "volume" INTEGER,
    "avg_visibility" INTEGER,
    "avg_sentiment_score" INTEGER,
    "sentiment_breakdown" JSONB,
    "stage" TEXT,
    "level" TEXT,
    "state" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "prompt_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "is_company_in_prompt" BOOLEAN NOT NULL,
    "prompt_type" TEXT NOT NULL,
    "prompt_ranking" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "original_entity" TEXT NOT NULL,
    "reason" TEXT,
    "linkable" BOOLEAN NOT NULL DEFAULT false,
    "company_sources" JSONB,
    "company_site_url" TEXT,
    "company_domain" TEXT,
    "feel" TEXT,
    "url_sources" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "scan_id" UUID NOT NULL,
    "region" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wl_topics" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "volume" INTEGER,
    "priority" INTEGER,
    "state" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wl_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wl_users_email_key" ON "wl_users"("email");

-- CreateIndex
CREATE INDEX "wl_users_email_idx" ON "wl_users"("email");

-- CreateIndex
CREATE INDEX "wl_user_tenants_tenant_idx" ON "wl_user_tenants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "whitelabel_tenants_source_account_id_key" ON "whitelabel_tenants"("source_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "carousel_account_profiles_account_id_key" ON "carousel_account_profiles"("account_id");

-- CreateIndex
CREATE INDEX "carousel_account_profiles_account_id_idx" ON "carousel_account_profiles"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "carousel_content_options_option_name_key" ON "carousel_content_options"("option_name");

-- CreateIndex
CREATE INDEX "carousel_content_options_option_name_idx" ON "carousel_content_options"("option_name");

-- CreateIndex
CREATE UNIQUE INDEX "carousel_figma_jobs_import_token_hash_key" ON "carousel_figma_jobs"("import_token_hash");

-- CreateIndex
CREATE INDEX "idx_figma_jobs_expires" ON "carousel_figma_jobs"("expires_at");

-- CreateIndex
CREATE INDEX "idx_figma_jobs_generation" ON "carousel_figma_jobs"("generation_id");

-- CreateIndex
CREATE INDEX "idx_figma_jobs_status" ON "carousel_figma_jobs"("status");

-- CreateIndex
CREATE INDEX "idx_figma_jobs_tenant" ON "carousel_figma_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_figma_jobs_token" ON "carousel_figma_jobs"("import_token_hash");

-- CreateIndex
CREATE INDEX "carousel_generation_outputs_generation_id_idx" ON "carousel_generation_outputs"("generation_id", "step_number");

-- CreateIndex
CREATE INDEX "carousel_generations_created_at_idx" ON "carousel_generations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "carousel_generations_status_idx" ON "carousel_generations"("status");

-- CreateIndex
CREATE INDEX "carousel_generations_tenant_id_idx" ON "carousel_generations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "carousel_templates_template_name_key" ON "carousel_templates"("template_name");

-- CreateIndex
CREATE INDEX "carousel_templates_template_name_idx" ON "carousel_templates"("template_name");

-- CreateIndex
CREATE INDEX "whitelabel_export_runs_day_idx" ON "whitelabel_export_runs"("day");

-- CreateIndex
CREATE UNIQUE INDEX "whitelabel_export_runs_tenant_id_day_key" ON "whitelabel_export_runs"("tenant_id", "day");

-- CreateIndex
CREATE INDEX "whitelabel_screen_snapshots_tenant_day_idx" ON "whitelabel_screen_snapshots"("tenant_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "whitelabel_screen_snapshots_tenant_id_day_screen_key" ON "whitelabel_screen_snapshots"("tenant_id", "day", "screen");

-- CreateIndex
CREATE INDEX "wl_accounts_tenant_idx" ON "wl_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "wl_competitors_account_idx" ON "wl_competitors"("account_id");

-- CreateIndex
CREATE INDEX "wl_prompt_responses_account_ts_idx" ON "wl_prompt_responses"("account_id", "timestamp");

-- CreateIndex
CREATE INDEX "wl_prompt_responses_prompt_idx" ON "wl_prompt_responses"("prompt_id");

-- CreateIndex
CREATE INDEX "wl_prompt_responses_provider_idx" ON "wl_prompt_responses"("provider");

-- CreateIndex
CREATE INDEX "wl_prompt_responses_scan_idx" ON "wl_prompt_responses"("scan_id");

-- CreateIndex
CREATE INDEX "wl_prompts_account_idx" ON "wl_prompts"("account_id");

-- CreateIndex
CREATE INDEX "wl_prompts_topic_idx" ON "wl_prompts"("topic_id");

-- CreateIndex
CREATE INDEX "wl_results_account_entity_idx" ON "wl_results"("account_id", "entity");

-- CreateIndex
CREATE INDEX "wl_results_account_scan_idx" ON "wl_results"("account_id", "scan_id");

-- CreateIndex
CREATE INDEX "wl_results_account_ts_idx" ON "wl_results"("account_id", "timestamp");

-- CreateIndex
CREATE INDEX "wl_results_company_domain_idx" ON "wl_results"("company_domain");

-- CreateIndex
CREATE INDEX "wl_results_provider_idx" ON "wl_results"("provider");

-- CreateIndex
CREATE INDEX "wl_results_topic_idx" ON "wl_results"("topic_id");

-- CreateIndex
CREATE INDEX "wl_topics_account_idx" ON "wl_topics"("account_id");

-- AddForeignKey
ALTER TABLE "wl_user_tenants" ADD CONSTRAINT "wl_user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_user_tenants" ADD CONSTRAINT "wl_user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "wl_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carousel_account_profiles" ADD CONSTRAINT "carousel_account_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wl_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carousel_account_profiles" ADD CONSTRAINT "carousel_account_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carousel_figma_jobs" ADD CONSTRAINT "carousel_figma_jobs_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "carousel_generations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carousel_generation_outputs" ADD CONSTRAINT "carousel_generation_outputs_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "carousel_generations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "carousel_generations" ADD CONSTRAINT "carousel_generations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whitelabel_export_runs" ADD CONSTRAINT "whitelabel_export_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "whitelabel_screen_snapshots" ADD CONSTRAINT "whitelabel_screen_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_account_preferences" ADD CONSTRAINT "wl_account_preferences_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wl_accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_account_preferences" ADD CONSTRAINT "wl_account_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_accounts" ADD CONSTRAINT "wl_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_competitors" ADD CONSTRAINT "wl_competitors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_prompt_responses" ADD CONSTRAINT "wl_prompt_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_prompts" ADD CONSTRAINT "wl_prompts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_results" ADD CONSTRAINT "wl_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "wl_topics" ADD CONSTRAINT "wl_topics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

