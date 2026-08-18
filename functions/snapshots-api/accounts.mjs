/**
 * Account listing and first-account upstream connect for authenticated users.
 */
import { fetchBrandHub, parseMcpConnectionInput } from './mcpClient.mjs'

/**
 * List tenants the user can access, with linked account metadata.
 * @param {import('pg').Pool} db
 * @param {string} userId
 * @param {boolean} isAdmin
 * @returns {Promise<Array<{id: string, name: string|null, domain: string|null, sourceAccountId: string, account: {id: string, title: string, domains: string[], logo: string|null}|null}>>}
 */
export async function listAccessibleTenants(db, userId, isAdmin) {
  let query
  let params

  if (isAdmin) {
    // Admins see all enabled tenants
    query = `
      SELECT
        t.id,
        t.name,
        t.domain,
        t.source_account_id,
        a.id as account_id,
        a.title as account_title,
        a.domains as account_domains,
        a.logo as account_logo
      FROM whitelabel_tenants t
      LEFT JOIN wl_accounts a ON a.tenant_id = t.id
      WHERE t.enabled = true
      ORDER BY t.name, t.id
    `
    params = []
  } else {
    // Non-admins see only their memberships
    query = `
      SELECT
        t.id,
        t.name,
        t.domain,
        t.source_account_id,
        a.id as account_id,
        a.title as account_title,
        a.domains as account_domains,
        a.logo as account_logo
      FROM wl_user_tenants ut
      JOIN whitelabel_tenants t ON t.id = ut.tenant_id
      LEFT JOIN wl_accounts a ON a.tenant_id = t.id
      WHERE ut.user_id = $1 AND t.enabled = true
      ORDER BY t.name, t.id
    `
    params = [userId]
  }

  const result = await db.query(query, params)

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    sourceAccountId: row.source_account_id,
    account: row.account_id
      ? {
          id: row.account_id,
          title: row.account_title,
          domains: row.account_domains || [],
          logo: row.account_logo,
        }
      : null,
  }))
}

function mapTenantRow(row) {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    sourceAccountId: row.source_account_id,
    account: row.account_id
      ? {
          id: row.account_id,
          title: row.account_title,
          domains: row.account_domains || [],
          logo: row.account_logo,
        }
      : null,
  }
}

/**
 * Create or attach an Alora tenant from a pasted upstream MCP URL.
 * Used on first login when the user has no account yet.
 *
 * @param {import('pg').Pool} db
 * @param {{ id: string, isAdmin: boolean }} user
 * @param {string} connectionUrl
 */
export async function connectFirstAccount(db, user, connectionUrl) {
  const { apiKey, workspaceId } = parseMcpConnectionInput(connectionUrl)
  const brand = await fetchBrandHub(workspaceId, apiKey)
  const title = brand?.title || 'Account'
  const domain = Array.isArray(brand?.domains) ? brand.domains[0] || null : null

  const existing = await db.query(
    `SELECT id FROM whitelabel_tenants WHERE source_account_id = $1`,
    [workspaceId],
  )

  let tenantId = existing.rows[0]?.id || null
  if (tenantId) {
    await db.query(
      `UPDATE whitelabel_tenants
       SET mcp_api_key = $2,
           enabled = true,
           name = COALESCE(NULLIF(name, ''), $3),
           domain = COALESCE(NULLIF(domain, ''), $4)
       WHERE id = $1`,
      [tenantId, apiKey, title, domain],
    )
  } else {
    const inserted = await db.query(
      `INSERT INTO whitelabel_tenants (id, name, domain, source_account_id, enabled, mcp_api_key)
       VALUES (gen_random_uuid(), $1, $2, $3, true, $4)
       RETURNING id`,
      [title, domain, workspaceId, apiKey],
    )
    tenantId = inserted.rows[0].id
  }

  await db.query(
    `INSERT INTO wl_user_tenants (user_id, tenant_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (user_id, tenant_id) DO NOTHING`,
    [user.id, tenantId],
  )

  if (brand?.id) {
    await db.query(
      `INSERT INTO wl_accounts (id, tenant_id, title, names, domains, logo, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         title = EXCLUDED.title,
         names = EXCLUDED.names,
         domains = EXCLUDED.domains,
         logo = EXCLUDED.logo,
         raw = EXCLUDED.raw,
         synced_at = now()`,
      [
        brand.id,
        tenantId,
        title,
        brand.names ?? [],
        brand.domains ?? [],
        brand.logo ?? null,
        JSON.stringify(brand),
      ],
    )
  }

  const accounts = await listAccessibleTenants(db, user.id, user.isAdmin)
  const created = accounts.find((account) => account.id === tenantId)
  return created ?? mapTenantRow({
    id: tenantId,
    name: title,
    domain,
    source_account_id: workspaceId,
    account_id: brand?.id ?? null,
    account_title: title,
    account_domains: brand?.domains ?? [],
    account_logo: brand?.logo ?? null,
  })
}
