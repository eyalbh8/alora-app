-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tracker_version" TEXT NOT NULL DEFAULT 'v1',
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "user_agent" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "bot_name" TEXT,
    "provider" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "screen" TEXT,
    "platform" TEXT,
    "language" TEXT,
    "country" TEXT,
    "city" TEXT,
    "region" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_tenant_id_timestamp_idx" ON "analytics_events"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "analytics_events_tenant_id_provider_timestamp_idx" ON "analytics_events"("tenant_id", "provider", "timestamp");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
