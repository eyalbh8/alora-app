-- Per-workspace AI Traffic source: iGEO (default) vs first-party analytics_events.
ALTER TABLE "whitelabel_tenants"
ADD COLUMN "first_party_traffic" BOOLEAN NOT NULL DEFAULT false;
