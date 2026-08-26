-- Fold wl_accounts display fields into whitelabel_tenants, then drop unused tables.

ALTER TABLE "whitelabel_tenants"
  ADD COLUMN IF NOT EXISTS "logo" text,
  ADD COLUMN IF NOT EXISTS "domains" text[] NOT NULL DEFAULT '{}';

-- Backfill from the most recently synced account per tenant (if table still exists).
DO $$
BEGIN
  IF to_regclass('public.wl_accounts') IS NOT NULL THEN
    UPDATE "whitelabel_tenants" t
    SET
      logo = COALESCE(t.logo, a.logo),
      domains = CASE
        WHEN COALESCE(cardinality(t.domains), 0) > 0 THEN t.domains
        WHEN a.domains IS NOT NULL THEN a.domains
        ELSE '{}'::text[]
      END,
      name = COALESCE(t.name, a.title),
      domain = COALESCE(t.domain, NULLIF(a.domains[1], ''))
    FROM (
      SELECT DISTINCT ON (tenant_id)
        tenant_id,
        title,
        domains,
        logo
      FROM wl_accounts
      ORDER BY tenant_id, synced_at DESC NULLS LAST
    ) a
    WHERE a.tenant_id = t.id;
  END IF;
END $$;

DROP TABLE IF EXISTS "whitelabel_screen_snapshots";
DROP TABLE IF EXISTS "whitelabel_export_runs";
DROP TABLE IF EXISTS "wl_accounts";
