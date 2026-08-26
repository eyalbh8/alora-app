-- Per-tenant workspace MCP API key.
-- Never select this column in public tenant/account list APIs.

ALTER TABLE whitelabel_tenants
  ADD COLUMN IF NOT EXISTS mcp_api_key text;
