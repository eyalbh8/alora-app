-- =============================================================================
-- Alora Authentication & Membership Schema
--
-- Add user authentication and tenant membership on top of the white-label
-- relational mirror. Users authenticate via Descope; membership determines
-- which tenants they can access.
--
-- Apply with:
--   psql "$DATABASE_URL" -f schema_auth.sql
-- =============================================================================

-- Users table: stores Descope-authenticated users
CREATE TABLE IF NOT EXISTS wl_users (
  id         text PRIMARY KEY,              -- Descope user ID
  email      text NOT NULL UNIQUE,
  name       text,
  is_admin   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wl_users_email_idx ON wl_users (email);

-- User-tenant membership: grants access to specific tenants
CREATE TABLE IF NOT EXISTS wl_user_tenants (
  user_id    text NOT NULL REFERENCES wl_users(id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS wl_user_tenants_tenant_idx ON wl_user_tenants (tenant_id);

-- =============================================================================
-- Seeding first admin users
-- =============================================================================
--
-- To grant admin access to the first user(s), after they've logged in once
-- (which creates their wl_users row), run:
--
--   UPDATE wl_users SET is_admin = true WHERE email = 'admin@example.com';
--
-- Alternatively, manually insert before first login:
--
--   INSERT INTO wl_users (id, email, name, is_admin)
--   VALUES ('descope-user-id-here', 'admin@example.com', 'Admin Name', true)
--   ON CONFLICT (id) DO UPDATE SET is_admin = true;
--
-- Non-admin users need explicit membership via wl_user_tenants.
-- You can pre-provision by email before first login (pending:* id).
-- On first Descope login, upsertUser replaces the pending id and keeps memberships.
--
--   INSERT INTO wl_users (id, email, name, is_admin)
--   VALUES ('pending:user@example.com', 'user@example.com', NULL, false)
--   ON CONFLICT (email) DO NOTHING;
--
--   INSERT INTO wl_user_tenants (user_id, tenant_id, role)
--   SELECT u.id, 'tenant-uuid-here', 'member'
--   FROM wl_users u
--   WHERE u.email = 'user@example.com'
--   ON CONFLICT (user_id, tenant_id) DO NOTHING;
--
-- =============================================================================
