-- Per-tenant iGEO MCP API key (igeo_live_...).
-- Never select this column in public tenant/account list APIs.

ALTER TABLE whitelabel_tenants
  ADD COLUMN IF NOT EXISTS igeo_mcp_api_key text;
