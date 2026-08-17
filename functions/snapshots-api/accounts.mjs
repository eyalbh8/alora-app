/**
 * Account listing for authenticated users.
 * Returns accessible tenants with linked brand account metadata.
 */

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
