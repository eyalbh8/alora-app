/**
 * iGEO MCP Client - HTTP JSON-RPC Caller
 * Connects to iGEO's public MCP endpoint to fetch Instagram posts and BrandHub data.
 * API keys are passed per request (tenant column, with optional env fallback).
 */

const MCP_NOT_CONNECTED_MESSAGE =
  'This account is not connected to iGEO MCP. Paste the full MCP URL to continue.'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function optionalEnv(name) {
  const value = process.env[name]?.trim()
  if (!value || value === 'undefined' || value === 'null') return null
  return value
}

function getMcpUrl() {
  return optionalEnv('IGEO_MCP_URL') || 'https://api.igeo.ai/mcp'
}

/**
 * Tenant key first, then optional env fallback for local/dev.
 * @param {string | null | undefined} tenantKey
 * @returns {string | null}
 */
export function resolveMcpApiKey(tenantKey) {
  const fallback = optionalEnv('IGEO_MCP_API_KEY') || optionalEnv('IGEO_API_KEY')
  return tenantKey || fallback || null
}

/**
 * Mask a live key for API responses. Never returns the secret.
 * @param {string | null | undefined} key
 * @returns {string | null}
 */
export function maskMcpKey(key) {
  if (!key || typeof key !== 'string' || !key.startsWith('igeo_live_')) {
    return null
  }
  const afterPrefix = key.slice('igeo_live_'.length)
  const visible = afterPrefix.slice(0, 4)
  return `igeo_live_${visible}…`
}

/**
 * Parse a pasted iGEO MCP connection string.
 * Expected: https://api.igeo.ai/mcp?mcp_token=igeo_live_…&workspace_id=…
 * Bare keys are rejected so users paste the full URL.
 *
 * @param {string | null | undefined} input
 * @returns {{ apiKey: string, workspaceId: string, mcpUrl: string }}
 */
export function parseMcpConnectionInput(input) {
  const trimmed = typeof input === 'string' ? input.trim() : ''
  if (!trimmed) {
    throw new Error(
      'Paste the full iGEO MCP URL, including mcp_token and workspace_id.',
    )
  }

  if (trimmed.startsWith('igeo_live_')) {
    throw new Error(
      'Paste the full MCP URL (not just the key), e.g. https://api.igeo.ai/mcp?mcp_token=…&workspace_id=…',
    )
  }

  let url
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(
      'Paste a valid MCP URL, e.g. https://api.igeo.ai/mcp?mcp_token=…&workspace_id=…',
    )
  }

  const apiKey =
    url.searchParams.get('mcp_token') ||
    url.searchParams.get('token') ||
    url.searchParams.get('api_key') ||
    ''
  const workspaceId =
    url.searchParams.get('workspace_id') ||
    url.searchParams.get('workspaceId') ||
    url.searchParams.get('account_id') ||
    ''

  if (!apiKey.startsWith('igeo_live_')) {
    throw new Error('The MCP URL must include mcp_token=igeo_live_…')
  }
  if (!UUID_RE.test(workspaceId)) {
    throw new Error('The MCP URL must include a valid workspace_id.')
  }

  const pathname = url.pathname.replace(/\/+$/, '') || '/mcp'
  return {
    apiKey,
    workspaceId: workspaceId.toLowerCase(),
    mcpUrl: `${url.origin}${pathname}`,
  }
}

/**
 * @param {string | null | undefined} apiKey
 */
export function validateMcpApiKey(apiKey) {
  if (!apiKey) {
    const err = new Error(MCP_NOT_CONNECTED_MESSAGE)
    err.code = 'MCP_NOT_CONNECTED'
    throw err
  }
  if (!apiKey.startsWith('igeo_live_')) {
    throw new Error('MCP API key must start with igeo_live_')
  }
}

/**
 * Call an iGEO MCP tool via JSON-RPC 2.0
 * @param {string} accountId - iGEO workspace account UUID
 * @param {string} apiKey - Workspace-scoped igeo_live_ key
 * @param {string} toolName - MCP tool name (e.g., 'posts', 'api_get')
 * @param {Object} args - Tool arguments
 * @returns {Promise<any>} Parsed result from MCP
 */
async function callMcpTool(accountId, apiKey, toolName, args = {}) {
  validateMcpApiKey(apiKey)

  const requestId = Math.random().toString(36).substring(7)
  const jsonRpcRequest = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  }

  console.log(`[MCP] Calling tool: ${toolName} for account ${accountId}`)

  try {
    const response = await fetch(getMcpUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-Workspace-Id': accountId,
      },
      body: JSON.stringify(jsonRpcRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`MCP HTTP ${response.status}: ${errorText}`)
    }

    const jsonRpcResponse = await response.json()

    if (jsonRpcResponse.error) {
      const { code, message } = jsonRpcResponse.error
      throw new Error(`MCP error ${code}: ${message}`)
    }

    const content = jsonRpcResponse.result?.content
    if (!content || !Array.isArray(content) || content.length === 0) {
      throw new Error('MCP returned empty or invalid content')
    }

    const textContent = content.find((item) => item.type === 'text')
    if (!textContent || !textContent.text) {
      throw new Error('MCP result missing text content')
    }

    return JSON.parse(textContent.text)
  } catch (error) {
    console.error(`[MCP] Error calling ${toolName}:`, error.message)
    throw error
  }
}

/**
 * Fetch Instagram posts from iGEO MCP
 * Uses the 'posts' named tool which maps to GET /accounts/{workspaceId}/agents/posts
 *
 * @param {string} accountId - iGEO Account UUID
 * @param {string} apiKey - Tenant MCP key
 * @param {string} [provider='INSTAGRAM']
 * @returns {Promise<{posts: Array, totalCount: number}>}
 */
export async function fetchTodayPosts(accountId, apiKey, provider = 'INSTAGRAM') {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 14)

    const query = {
      socialNetwork: provider,
      includeFullData: true,
    }

    console.log(`[MCP] Fetching ${provider} posts for last 14 days`)
    const result = await callMcpTool(accountId, apiKey, 'posts', { query })
    const posts = (result.posts || []).filter((post) => {
      if (!post.createdAt) return false
      const createdAt = new Date(post.createdAt)
      return createdAt >= startDate && createdAt <= endDate
    })

    return {
      posts,
      totalCount: posts.length,
    }
  } catch (error) {
    console.error('[MCP] Error fetching posts:', error.message)
    throw new Error(`Failed to fetch Instagram posts: ${error.message}`)
  }
}

/**
 * Fetch BrandHub data (Account brandbook) from iGEO MCP
 * Uses 'api_get' tool with path /accounts/{accountId}
 *
 * @param {string} accountId - iGEO Account UUID
 * @param {string} apiKey - Tenant MCP key
 * @returns {Promise<Object>} BrandHub object with Account fields
 */
export async function fetchBrandHub(accountId, apiKey) {
  try {
    const path = `/accounts/${accountId}`

    console.log(`[MCP] Fetching BrandHub for account ${accountId}`)
    const account = await callMcpTool(accountId, apiKey, 'api_get', { path })

    // Normalize typography from various possible fields
    const typography = account.typography || account.fonts || {}
    const normalizedTypography = {
      headlineFont: typography.headlineFont || typography.headline || 'Montserrat',
      bodyFont: typography.bodyFont || typography.body || 'Inter',
      labelFont: typography.labelFont || typography.label || 'Inter',
      headlineWeight: String(typography.headlineWeight || typography.headlineFontWeight || '700'),
      bodyWeight: String(typography.bodyWeight || typography.bodyFontWeight || '500'),
      labelWeight: String(typography.labelWeight || typography.labelFontWeight || '600'),
    }

    return {
      id: account.id,
      title: account.title,
      logo: account.logo || null,
      names: account.names || [],
      domains: account.domains || [],
      about: account.about || '',
      industryCategory: account.industryCategory || '',
      subIndustryCategory: account.subIndustryCategory || '',
      language: account.language || 'en-US',
      targetAudience: account.targetAudience || [],
      toneOfVoice: account.toneOfVoice || [],
      values: account.values || [],
      personality: account.personality || [],
      keyFeatures: account.keyFeatures || [],
      knowledgeSources: account.knowledgeSources || [],
      postGuidelines: account.postGuidelines || { dos: [], donts: [] },
      brandColors: account.brandColors || [],
      typography: normalizedTypography,
      socials: account.socials || {},
      skipPostImages: account.skipPostImages || false,
      generatePostsOnRecommendation: account.generatePostsOnRecommendation || false,
    }
  } catch (error) {
    console.error('[MCP] Error fetching BrandHub:', error.message)
    throw new Error(`Failed to fetch BrandHub data: ${error.message}`)
  }
}

/**
 * Fetch BrandHub from Postgres as fallback
 * Only use if MCP fails and wl_accounts.raw has a full payload
 *
 * @param {Object} db - Postgres pool connection
 * @param {string} accountId - iGEO Account UUID
 * @returns {Promise<Object>} BrandHub object
 */
export async function fetchBrandHubFromPostgres(db, accountId) {
  try {
    const query = `
      SELECT raw
      FROM wl_accounts
      WHERE id = $1
      LIMIT 1
    `

    const result = await db.query(query, [accountId])

    if (result.rows.length === 0 || !result.rows[0].raw) {
      throw new Error(`Account ${accountId} not found in wl_accounts or missing raw data`)
    }

    const raw = result.rows[0].raw

    // Normalize typography from various possible fields
    const typography = raw.typography || raw.fonts || {}
    const normalizedTypography = {
      headlineFont: typography.headlineFont || typography.headline || 'Montserrat',
      bodyFont: typography.bodyFont || typography.body || 'Inter',
      labelFont: typography.labelFont || typography.label || 'Inter',
      headlineWeight: String(typography.headlineWeight || typography.headlineFontWeight || '700'),
      bodyWeight: String(typography.bodyWeight || typography.bodyFontWeight || '500'),
      labelWeight: String(typography.labelWeight || typography.labelFontWeight || '600'),
    }

    return {
      id: raw.id,
      title: raw.title,
      logo: raw.logo || null,
      names: raw.names || [],
      domains: raw.domains || [],
      about: raw.about || '',
      industryCategory: raw.industryCategory || '',
      subIndustryCategory: raw.subIndustryCategory || '',
      language: raw.language || 'en-US',
      targetAudience: raw.targetAudience || [],
      toneOfVoice: raw.toneOfVoice || [],
      values: raw.values || [],
      personality: raw.personality || [],
      keyFeatures: raw.keyFeatures || [],
      knowledgeSources: raw.knowledgeSources || [],
      postGuidelines: raw.postGuidelines || { dos: [], donts: [] },
      brandColors: raw.brandColors || [],
      typography: normalizedTypography,
      socials: raw.socials || {},
      skipPostImages: raw.skipPostImages || false,
      generatePostsOnRecommendation: raw.generatePostsOnRecommendation || false,
    }
  } catch (error) {
    console.error('[Postgres] Error fetching BrandHub fallback:', error.message)
    throw new Error(`Failed to fetch BrandHub from Postgres: ${error.message}`)
  }
}

export { MCP_NOT_CONNECTED_MESSAGE }
