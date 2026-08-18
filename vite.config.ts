import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Handle carousel API routes
 */
async function handleCarouselRoutes(
  req: Connect.IncomingMessage,
  res: import('http').ServerResponse,
  send: (status: number, body: unknown) => void,
  env: Record<string, string>,
  db: unknown,
  _user: { id: string; isAdmin: boolean } | null,
  tenantId: string | null,
  sourceAccountId: string | null,
  api: SnapshotDbModule,
) {
  const url = new URL(req.url!, 'http://localhost')
  const pathName = url.pathname.replace(/^\/api\/carousel/, '') || '/'

  process.env.DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
  process.env.OPENAI_API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (env.CLAUDE_MODEL) process.env.CLAUDE_MODEL = env.CLAUDE_MODEL
  if (env.MCP_URL) process.env.MCP_URL = env.MCP_URL
  if (env.MCP_API_KEY) process.env.MCP_API_KEY = env.MCP_API_KEY
  if (env.SOURCE_API_KEY) process.env.SOURCE_API_KEY = env.SOURCE_API_KEY
  if (env.SOURCE_API_BASE) process.env.SOURCE_API_BASE = env.SOURCE_API_BASE

  const carouselModulePath = pathToFileURL(
    path.join(__dirname, 'functions/snapshots-api/carouselGeneration.mjs'),
  ).href
  const carouselModule = (await import(`${carouselModulePath}?v=${Date.now()}`)) as {
    startInstagramCarousel: (
      db: unknown,
      tenantId: string,
      postId: string,
      accountId: string,
    ) => Promise<{ generationId: string; status: string }>
    generateInstagramCarousel: (
      db: unknown,
      tenantId: string,
      postId: string,
      accountId: string,
      generationId: string,
      existingOutputs?: Record<string, unknown>,
    ) => Promise<unknown>
    resumeInstagramCarousel: (
      db: unknown,
      tenantId: string,
      generationId: string,
    ) => Promise<{
      generationId: string
      status: string
      resumedFromStep: number
      postId: string
      accountId: string
      existingOutputs: Record<string, unknown>
    }>
    listGenerations: (db: unknown, tenantId: string, limit?: number) => Promise<unknown>
    getGenerationStatus: (db: unknown, generationId: string) => Promise<unknown>
    resolveCarouselAssetPath: (generationId: string, filename: string) => string | null
    createFigmaJob: (db: unknown, generationId: string, tenantId: string, accountId: string) => Promise<{ jobId: string; importCode: string; expiresAt: string }>
    claimFigmaJob: (db: unknown, importCode: string) => Promise<{ jobId: string; generationId: string; generation: unknown }>
    updateFigmaJobStatus: (db: unknown, importCode: string, status: string, error?: string | null) => Promise<unknown>
    completeFigmaJob: (db: unknown, importCode: string, completionData: unknown) => Promise<unknown>
    getFigmaJobStatus: (db: unknown, generationId: string) => Promise<unknown>
  }

  const mcpClientPath = pathToFileURL(
    path.join(__dirname, 'functions/snapshots-api/mcpClient.mjs'),
  ).href
  const mcpClient = (await import(`${mcpClientPath}?v=${Date.now()}`)) as {
    fetchTodayPosts: (accountId: string, apiKey: string, provider?: string) => Promise<unknown>
    fetchBrandHub: (accountId: string, apiKey: string) => Promise<unknown>
    resolveMcpApiKey: (tenantKey: string | null) => string | null
    maskMcpKey: (key: string | null) => string | null
    validateMcpApiKey: (apiKey: string | null | undefined) => void
    parseMcpConnectionInput: (input: string | null | undefined) => {
      apiKey: string
      workspaceId: string
      mcpUrl: string
    }
  }

  if (pathName === '/figma/qa' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
      if (body.length > 60_000_000) req.destroy()
    })
    req.on('end', async () => {
      try {
        const { importCode, previews } = JSON.parse(body || '{}') as {
          importCode?: string
          previews?: Array<{ slideIndex: number; pngBase64: string }>
        }
        if (!importCode || !Array.isArray(previews) || previews.length > 5) {
          send(400, { error: 'Invalid QA request' })
          return
        }
        await carouselModule.updateFigmaJobStatus(db, importCode, 'importing', null)
        const orchestratorPath = pathToFileURL(
          path.join(__dirname, 'functions/snapshots-api/claudeOrchestrator.mjs'),
        ).href
        const orchestrator = (await import(`${orchestratorPath}?v=${Date.now()}`)) as {
          runRenderedSlideQA: (input: { pngBase64: string; slideIndex: number }) => Promise<unknown>
        }
        const results = []
        for (const preview of previews) {
          results.push({
            slideIndex: preview.slideIndex,
            ...(await orchestrator.runRenderedSlideQA(preview) as object),
          })
        }
        send(200, { results })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/figma/qa]', message)
        send(400, { error: message })
      }
    })
    return
  }

  // Plugin import uses a one-time code instead of JWT + tenant headers.
  if (pathName === '/figma/claim' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const { importCode } = JSON.parse(body || '{}')
        if (!importCode) {
          send(400, { error: 'Missing importCode' })
          return
        }

        const job = await carouselModule.claimFigmaJob(db, importCode)
        send(200, job)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/figma/claim]', message)
        send(400, { error: message })
      }
    })
    return
  }

  if (pathName === '/figma/status' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const { importCode, status, error } = JSON.parse(body || '{}')
        if (!importCode || !status) {
          send(400, { error: 'Missing importCode or status' })
          return
        }

        const result = await carouselModule.updateFigmaJobStatus(
          db,
          importCode,
          status,
          error || null,
        )
        send(200, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/figma/status]', message)
        send(400, { error: message })
      }
    })
    return
  }

  if (pathName === '/figma/complete' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const { importCode, ...completionData } = JSON.parse(body || '{}')
        if (!importCode) {
          send(400, { error: 'Missing importCode' })
          return
        }

        const result = await carouselModule.completeFigmaJob(db, importCode, completionData)
        send(200, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/figma/complete]', message)
        send(400, { error: message })
      }
    })
    return
  }

  if (!tenantId) {
    send(400, { error: 'Missing X-Alora-Tenant-Id header' })
    return
  }

  const notConnectedBody = {
    error: 'This account is not connected. Paste the full MCP URL to continue.',
    code: 'MCP_NOT_CONNECTED',
  }

  // GET /carousel/mcp-connection — masked status only (allowed before workspace is linked)
  if (pathName === '/mcp-connection' && req.method === 'GET') {
    try {
      const tenantKey = await api.getTenantMcpKey(db, tenantId)
      send(200, {
        connected: Boolean(tenantKey && sourceAccountId),
        keyPrefix: mcpClient.maskMcpKey(tenantKey),
        workspaceId: sourceAccountId,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/mcp-connection]', message)
      send(500, { error: message })
    }
    return
  }

  // PUT /carousel/mcp-connection — save key + workspace_id on this Alora account
  if (pathName === '/mcp-connection' && req.method === 'PUT') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {}
        const connectionUrl = parsed.connectionUrl as string | null | undefined
        const apiKeyField = parsed.apiKey as string | null | undefined
        const disconnect =
          connectionUrl === null ||
          connectionUrl === '' ||
          apiKeyField === null ||
          apiKeyField === ''

        if (disconnect) {
          await api.setTenantSourceConnection(db, tenantId, null, null)
          send(200, { connected: false, keyPrefix: null, workspaceId: sourceAccountId })
          return
        }

        const rawInput =
          typeof connectionUrl === 'string'
            ? connectionUrl
            : typeof apiKeyField === 'string'
              ? apiKeyField
              : null

        let parsedConnection
        try {
          parsedConnection = mcpClient.parseMcpConnectionInput(rawInput)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          send(400, { error: message })
          return
        }

        const { apiKey, workspaceId } = parsedConnection
        if (sourceAccountId && sourceAccountId.toLowerCase() !== workspaceId) {
          send(400, {
            error:
              'This MCP URL is for a different workspace than the selected Alora account.',
          })
          return
        }

        try {
          await mcpClient.fetchBrandHub(workspaceId, apiKey)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[carousel/mcp-connection] verify failed:', message)
          send(400, {
            error:
              'Could not verify this MCP URL. Check that the token and workspace_id are correct.',
          })
          return
        }

        await api.setTenantSourceConnection(db, tenantId, apiKey, workspaceId)
        send(200, {
          connected: true,
          keyPrefix: mcpClient.maskMcpKey(apiKey),
          workspaceId,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/mcp-connection]', message)
        send(500, { error: message })
      }
    })
    return
  }

  if (!sourceAccountId) {
    send(400, { error: 'This account has no linked workspace.' })
    return
  }

  // POST /carousel/generate - Start carousel generation
  if (pathName === '/generate' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const { postId } = JSON.parse(body)
        if (!postId) {
          send(400, { error: 'Missing postId' })
          return
        }

        const tenantKey = await api.getTenantMcpKey(db, tenantId)
        const mcpKey = mcpClient.resolveMcpApiKey(tenantKey)
        if (!mcpKey) {
          send(400, notConnectedBody)
          return
        }

        const started = await carouselModule.startInstagramCarousel(
          db,
          tenantId,
          postId,
          sourceAccountId,
        )
        send(202, started)

        void carouselModule
          .generateInstagramCarousel(db, tenantId, postId, sourceAccountId, started.generationId)
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[carousel/generate] background', message)
          })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/generate]', message)
        send(500, { error: message })
      }
    })
    return
  }

  // POST /carousel/resume - Continue a failed generation from the first missing step
  if (pathName === '/resume' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const { generationId } = JSON.parse(body)
        if (!generationId) {
          send(400, { error: 'Missing generationId' })
          return
        }

        const resumed = await carouselModule.resumeInstagramCarousel(db, tenantId, generationId)
        send(202, {
          generationId: resumed.generationId,
          status: resumed.status,
          resumedFromStep: resumed.resumedFromStep,
        })

        void carouselModule
          .generateInstagramCarousel(
            db,
            tenantId,
            resumed.postId,
            resumed.accountId,
            resumed.generationId,
            resumed.existingOutputs,
          )
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[carousel/resume] background', message)
          })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/resume]', message)
        send(500, { error: message })
      }
    })
    return
  }

  // GET /carousel/status/:generationId - Poll generation status
  const statusMatch = pathName.match(/^\/status\/([^/]+)$/)
  if (statusMatch && req.method === 'GET') {
    try {
      const generationId = decodeURIComponent(statusMatch[1])
      const status = await carouselModule.getGenerationStatus(db, generationId)
      send(200, status)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/status]', message)
      send(500, { error: message })
    }
    return
  }

  // GET /carousel/brand-hub - Fetch the selected account's BrandHub from upstream MCP
  if (pathName === '/brand-hub' && req.method === 'GET') {
    try {
      const tenantKey = await api.getTenantMcpKey(db, tenantId)
      const mcpKey = mcpClient.resolveMcpApiKey(tenantKey)
      if (!mcpKey) {
        send(400, notConnectedBody)
        return
      }

      const brandHub = await mcpClient.fetchBrandHub(sourceAccountId, mcpKey)
      send(200, { brandHub })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/brand-hub]', message)
      send(500, { error: message })
    }
    return
  }

  // GET /carousel/posts/today - Fetch Instagram posts from upstream MCP
  if (pathName === '/posts/today' && req.method === 'GET') {
    try {
      const tenantKey = await api.getTenantMcpKey(db, tenantId)
      const mcpKey = mcpClient.resolveMcpApiKey(tenantKey)
      if (!mcpKey) {
        send(400, notConnectedBody)
        return
      }

      const posts = await mcpClient.fetchTodayPosts(sourceAccountId, mcpKey, 'INSTAGRAM')
      send(200, posts)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/posts/today]', message)
      send(500, { error: message })
    }
    return
  }

  // GET /carousel/list - List recent generations
  if (pathName === '/list' && req.method === 'GET') {
    try {
      const limit = parseInt(url.searchParams.get('limit') || '20', 10)
      const generations = await carouselModule.listGenerations(db, tenantId, limit)
      send(200, { generations })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/list]', message)
      send(500, { error: message })
    }
    return
  }

  // POST /carousel/figma/queue - Create a Figma import job (authenticated)
  if (pathName === '/figma/queue' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', async () => {
      try {
        const { generationId } = JSON.parse(body)
        if (!generationId) {
          send(400, { error: 'Missing generationId' })
          return
        }

        const job = await carouselModule.createFigmaJob(db, generationId, tenantId, sourceAccountId)
        send(201, job)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('[carousel/figma/queue]', message)
        send(500, { error: message })
      }
    })
    return
  }

  // GET /carousel/figma/status/:generationId - Get Figma job status (authenticated)
  const figmaStatusMatch = pathName.match(/^\/figma\/status\/([^/]+)$/)
  if (figmaStatusMatch && req.method === 'GET') {
    try {
      const generationId = decodeURIComponent(figmaStatusMatch[1])
      const status = await carouselModule.getFigmaJobStatus(db, generationId)
      if (status === null) {
        send(404, { error: 'No Figma job found for this generation' })
      } else {
        send(200, status)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/figma/status/:id]', message)
      send(500, { error: message })
    }
    return
  }

  // GET /carousel/assets/:generationId/:filename - Serve persisted carousel assets
  const assetsMatch = pathName.match(/^\/assets\/([^/]+)\/([^/]+)$/)
  if (assetsMatch && req.method === 'GET') {
    try {
      const generationId = decodeURIComponent(assetsMatch[1])
      const filename = decodeURIComponent(assetsMatch[2])
      const filePath = carouselModule.resolveCarouselAssetPath(generationId, filename)

      if (!filePath) {
        send(400, { error: 'Invalid generation ID or filename' })
        return
      }

      const fs = await import('node:fs/promises')
      try {
        const data = await fs.readFile(filePath)
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        res.writeHead(200)
        res.end(data)
      } catch (err) {
        send(404, { error: 'Asset not found' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[carousel/assets]', message)
      send(500, { error: message })
    }
    return
  }

  send(404, { error: `Unknown carousel path: ${pathName}` })
}

interface SnapshotDbModule {
  getPool: () => unknown
  loadSnapshots: (
    db: unknown,
    tenantId: string,
    opts: { startDate: string; endDate: string; screens?: string[] },
  ) => Promise<unknown>
  loadTenant: (
    db: unknown,
    tenantId: string,
  ) => Promise<{
    id: string
    name: string | null
    domain: string | null
    source_account_id: string | null
    enabled: boolean
  } | null>
  getTenantMcpKey: (db: unknown, tenantId: string) => Promise<string | null>
  setTenantMcpKey: (db: unknown, tenantId: string, key: string | null) => Promise<void>
  setTenantSourceConnection: (
    db: unknown,
    tenantId: string,
    key: string | null,
    workspaceId?: string | null,
  ) => Promise<void>
  listAvailableDays: (db: unknown, tenantId: string) => Promise<unknown>
  SCREEN_KEYS: string[]
}

interface AuthModule {
  verifyToken: (authHeader: string) => Promise<{ userId: string; email: string; name?: string }>
  upsertUser: (
    db: unknown,
    user: { userId: string; email: string; name?: string },
  ) => Promise<{ id: string; email: string; name: string | null; isAdmin: boolean }>
  canAccessTenant: (
    db: unknown,
    userId: string,
    tenantId: string,
    isAdmin: boolean,
  ) => Promise<boolean>
}

interface AccountsModule {
  listAccessibleTenants: (db: unknown, userId: string, isAdmin: boolean) => Promise<unknown>
  connectFirstAccount: (
    db: unknown,
    user: { id: string; isAdmin: boolean },
    connectionUrl: string,
  ) => Promise<unknown>
}

interface GeoApiModule {
  geoMeta: (db: unknown, tenantId: string) => Promise<unknown>
  geoDashboard: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoMentions: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoSentiment: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoPrompts: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoTags: (db: unknown, tenantId: string) => Promise<unknown>
  geoCreateTag: (db: unknown, tenantId: string, input: unknown) => Promise<unknown>
  geoSetPromptTags: (
    db: unknown,
    tenantId: string,
    promptId: string,
    input: unknown,
  ) => Promise<unknown>
  geoDeleteTag: (db: unknown, tenantId: string, tagId: string) => Promise<unknown>
  geoCompetitors: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoResponses: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoResponseDetail: (db: unknown, tenantId: string, responseId: string) => Promise<unknown>
  geoProviderMentionPrompts: (
    db: unknown,
    tenantId: string,
    q: Record<string, string>,
    provider: string,
  ) => Promise<unknown>
  geoTenantScanDays: (db: unknown, tenantId: string) => Promise<unknown>
  geoTraffic: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
  geoCrawlers: (db: unknown, tenantId: string, q: Record<string, string>) => Promise<unknown>
}

function readConnectJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += String(chunk)
    })
    req.on('end', () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function snapshotsApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'snapshots-api-dev',
    configureServer(server) {
      server.middlewares.use(createSnapshotsMiddleware(env))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createSnapshotsMiddleware(env))
    },
  }
}

function createSnapshotsMiddleware(env: Record<string, string>): Connect.NextHandleFunction {
  let apiPromise: Promise<SnapshotDbModule> | null = null
  let apiLoadedAt = 0

  const loadApi = () => {
    const dbFile = path.join(__dirname, 'functions/snapshots-api/db.mjs')
    const mtime = statSync(dbFile).mtimeMs
    if (!apiPromise || mtime > apiLoadedAt) {
      process.env.DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL
      process.env.DESCOPE_PROJECT_ID = env.DESCOPE_PROJECT_ID || process.env.DESCOPE_PROJECT_ID
      apiLoadedAt = mtime
      const modPath = pathToFileURL(dbFile).href
      apiPromise = import(`${modPath}?v=${mtime}`) as Promise<SnapshotDbModule>
    }
    return apiPromise
  }

  const loadAuth = () => {
    process.env.DESCOPE_PROJECT_ID = env.DESCOPE_PROJECT_ID || process.env.DESCOPE_PROJECT_ID
    const modPath = pathToFileURL(
      path.join(__dirname, 'functions/snapshots-api/auth.mjs'),
    ).href
    return import(`${modPath}?v=${Date.now()}`) as Promise<AuthModule>
  }

  const loadAccounts = () => {
    const modPath = pathToFileURL(
      path.join(__dirname, 'functions/snapshots-api/accounts.mjs'),
    ).href
    return import(`${modPath}?v=${Date.now()}`) as Promise<AccountsModule>
  }

  const loadGeo = () => {
    process.env.DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL
    if (env.SOURCE_API_BASE) process.env.SOURCE_API_BASE = env.SOURCE_API_BASE
    if (env.SOURCE_API_KEY) process.env.SOURCE_API_KEY = env.SOURCE_API_KEY
    if (env.MCP_API_KEY) process.env.MCP_API_KEY = env.MCP_API_KEY
    const bust = Date.now()
    const geoPath = pathToFileURL(path.join(__dirname, 'functions/snapshots-api/geo.mjs')).href
    const clientPath = pathToFileURL(
      path.join(__dirname, 'functions/snapshots-api/sourceClient.mjs'),
    ).href
    // Bust both modules — Node caches sourceClient if only geo.mjs is re-imported.
    return import(clientPath + `?v=${bust}`).then(
      () => import(`${geoPath}?v=${bust}`) as Promise<GeoApiModule>,
    )
  }

  const getHeader = (headers: Connect.IncomingMessage['headers'], name: string): string | undefined => {
    const lower = name.toLowerCase()
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) {
        return Array.isArray(value) ? value[0] : value
      }
    }
    return undefined
  }

  return async (req, res, next) => {
    // Handle both /api/snapshots and /api/carousel routes
    if (!req.url?.startsWith('/api/snapshots') && !req.url?.startsWith('/api/carousel')) {
      return next()
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Alora-Tenant-Id, ngrok-skip-browser-warning',
    }

    const send = (status: number, body: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      for (const [key, value] of Object.entries(corsHeaders)) {
        res.setHeader(key, value)
      }
      res.end(JSON.stringify(body))
    }

    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        const requested = getHeader(req.headers, 'access-control-request-headers')
        for (const [key, value] of Object.entries(corsHeaders)) {
          res.setHeader(key, value)
        }
        if (requested) {
          res.setHeader('Access-Control-Allow-Headers', requested)
        }
        res.end()
        return
      }

      // Handle carousel routes - require auth and tenant
      if (req.url.startsWith('/api/carousel')) {
        const api = await loadApi()
        const db = api.getPool()

        // Allow health check without auth
        const url = new URL(req.url, 'http://localhost')
        const pathName = url.pathname.replace(/^\/api\/carousel/, '') || '/'
        if (pathName === '/' || pathName === '/health') {
          send(200, { ok: true, service: 'carousel' })
          return
        }

        const isPluginPublicRoute =
          req.method === 'POST' &&
          (pathName === '/figma/claim' ||
            pathName === '/figma/status' ||
            pathName === '/figma/complete' ||
            pathName === '/figma/qa')
        if (isPluginPublicRoute) {
          await handleCarouselRoutes(req, res, send, env, db, null, null, null, api)
          return
        }

        const publicAsset = pathName.match(/^\/assets\/([0-9a-f-]{36})\/(slide_\d+\.png)$/i)
        if (publicAsset && req.method === 'GET') {
          const filePath = path.join(
            __dirname,
            'functions/data/carousel-assets',
            publicAsset[1],
            publicAsset[2],
          )
          try {
            const { readFile } = await import('node:fs/promises')
            const bytes = await readFile(filePath)
            res.statusCode = 200
            res.setHeader('Content-Type', 'image/png')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Cache-Control', 'private, max-age=3600')
            res.end(bytes)
          } catch {
            send(404, { error: 'Asset not found' })
          }
          return
        }

        // Require authentication for all other carousel routes
        const authHeader = getHeader(req.headers, 'authorization')
        const auth = await loadAuth()
        let authUser
        try {
          authUser = await auth.verifyToken(authHeader || '')
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[carousel-api] auth failed:', message)
          send(401, { error: 'Unauthorized: ' + message })
          return
        }

        // Upsert user record
        const user = await auth.upsertUser(db, authUser)

        // Require X-Alora-Tenant-Id header
        const tenantId = getHeader(req.headers, 'x-alora-tenant-id')
        if (!tenantId) {
          send(400, { error: 'Missing X-Alora-Tenant-Id header' })
          return
        }

        // Check membership/access
        const hasAccess = await auth.canAccessTenant(db, user.id, tenantId, user.isAdmin)
        if (!hasAccess) {
          send(403, { error: 'Forbidden: no access to this tenant' })
          return
        }

        // Load tenant to get source_account_id (workspace)
        const tenant = await api.loadTenant(db, tenantId)
        if (!tenant) {
          send(404, { error: 'Tenant not found' })
          return
        }

        const sourceAccountId = tenant.source_account_id || null

        await handleCarouselRoutes(req, res, send, env, db, user, tenantId, sourceAccountId, api)
        return
      }

      const api = await loadApi()
      const db = api.getPool()
      const url = new URL(req.url, 'http://localhost')
      const pathName = url.pathname.replace(/^\/api\/snapshots/, '') || '/'
      const promptTagsMatch = pathName.match(/^\/geo\/prompts\/([^/]+)\/tags$/)
      const deleteTagMatch = pathName.match(/^\/geo\/tags\/([^/]+)$/)
      const isAllowedWrite =
        (req.method === 'POST' && pathName === '/accounts') ||
        (req.method === 'POST' && pathName === '/geo/tags') ||
        (req.method === 'PATCH' && Boolean(promptTagsMatch)) ||
        (req.method === 'DELETE' && Boolean(deleteTagMatch) && pathName !== '/geo/tags')

      if (req.method !== 'GET' && !isAllowedWrite) {
        send(405, { error: 'Method not allowed' })
        return
      }

      if (pathName === '/' || pathName === '/health') {
        send(200, { ok: true, screens: api.SCREEN_KEYS })
        return
      }

      // All other routes require authentication
      const authHeader = getHeader(req.headers, 'authorization')
      const auth = await loadAuth()
      let authUser
      try {
        authUser = await auth.verifyToken(authHeader || '')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[snapshots-api] auth failed:', message)
        send(401, { error: 'Unauthorized: ' + message })
        return
      }

      // Upsert user record
      const user = await auth.upsertUser(db, authUser)

      if (pathName === '/accounts' && req.method === 'GET') {
        const accountsModule = await loadAccounts()
        const accounts = await accountsModule.listAccessibleTenants(db, user.id, user.isAdmin)
        send(200, { accounts })
        return
      }

      if (pathName === '/accounts' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk.toString()
        })
        req.on('end', async () => {
          try {
            const parsed = body ? JSON.parse(body) : {}
            const connectionUrl = typeof parsed.connectionUrl === 'string' ? parsed.connectionUrl : ''
            const accountsModule = await loadAccounts()
            const account = await accountsModule.connectFirstAccount(db, user, connectionUrl)
            send(201, { account })
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error('[snapshots-api] create account failed:', message)
            send((error as { statusCode?: number })?.statusCode || 400, { error: message })
          }
        })
        return
      }

      // All data routes require X-Alora-Tenant-Id header
      const tenantId = getHeader(req.headers, 'x-alora-tenant-id')
      if (!tenantId) {
        send(400, { error: 'Missing X-Alora-Tenant-Id header' })
        return
      }

      // Check membership/access
      const hasAccess = await auth.canAccessTenant(db, user.id, tenantId, user.isAdmin)
      if (!hasAccess) {
        send(403, { error: 'Forbidden: no access to this tenant' })
        return
      }

      if (pathName === '/tenant') {
        const tenant = await api.loadTenant(db, tenantId)
        if (!tenant) {
          send(404, { error: 'Configured tenant was not found' })
          return
        }
        if (!tenant.enabled) {
          send(403, { error: 'Configured tenant is disabled' })
          return
        }
        const geo = await loadGeo()
        let availableDays: unknown = []
        try {
          availableDays = await geo.geoTenantScanDays(db, tenantId)
        } catch (err) {
          if ((err as { statusCode?: number })?.statusCode !== 400) throw err
        }
        send(200, {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            sourceAccountId: tenant.source_account_id,
          },
          availableDays,
        })
        return
      }

      if (pathName === '/traffic' || pathName === '/crawlers') {
        const geo = await loadGeo()
        const q = Object.fromEntries(url.searchParams.entries())
        const data =
          pathName === '/traffic'
            ? await geo.geoTraffic(db, tenantId, q)
            : await geo.geoCrawlers(db, tenantId, q)
        send(200, data)
        return
      }

      if (pathName === '/snapshots') {
        const screensParam = url.searchParams.get('screens')
        const screens = screensParam
          ? screensParam
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined
        const startDate = url.searchParams.get('startDate') || url.searchParams.get('day') || ''
        const endDate =
          url.searchParams.get('endDate') ||
          url.searchParams.get('day') ||
          url.searchParams.get('startDate') ||
          ''
        const data = await api.loadSnapshots(db, tenantId, { startDate, endDate, screens })
        send(200, data)
        return
      }

      if (pathName.startsWith('/geo/')) {
        const geo = await loadGeo()
        const q = Object.fromEntries(url.searchParams.entries())
        const providerPromptsMatch = pathName.match(/^\/geo\/provider-mentions\/([^/]+)\/prompts$/)
        const responseDetailMatch = pathName.match(/^\/geo\/responses\/([^/]+)$/)
        if (req.method === 'GET' && pathName === '/geo/tags') {
          send(200, await geo.geoTags(db, tenantId))
          return
        }
        if (req.method === 'POST' && pathName === '/geo/tags') {
          const input = await readConnectJsonBody(req)
          send(201, await geo.geoCreateTag(db, tenantId, input))
          return
        }
        if (req.method === 'PATCH' && promptTagsMatch) {
          const input = await readConnectJsonBody(req)
          send(200, await geo.geoSetPromptTags(db, tenantId, decodeURIComponent(promptTagsMatch[1]), input))
          return
        }
        if (req.method === 'DELETE' && deleteTagMatch) {
          send(200, await geo.geoDeleteTag(db, tenantId, decodeURIComponent(deleteTagMatch[1])))
          return
        }
        const geoHandlers: Record<string, () => Promise<unknown>> = {
          '/geo/meta': () => geo.geoMeta(db, tenantId),
          '/geo/dashboard': () => geo.geoDashboard(db, tenantId, q),
          '/geo/mentions': () => geo.geoMentions(db, tenantId, q),
          '/geo/sentiment': () => geo.geoSentiment(db, tenantId, q),
          '/geo/prompts': () => geo.geoPrompts(db, tenantId, q),
          '/geo/tags': () => geo.geoTags(db, tenantId),
          '/geo/competitors': () => geo.geoCompetitors(db, tenantId, q),
          '/geo/responses': () => geo.geoResponses(db, tenantId, q),
        }
        const geoHandler = providerPromptsMatch
          ? () =>
              geo.geoProviderMentionPrompts(
                db,
                tenantId,
                q,
                decodeURIComponent(providerPromptsMatch[1]),
              )
          : responseDetailMatch
            ? () =>
                geo.geoResponseDetail(db, tenantId, decodeURIComponent(responseDetailMatch[1]))
            : geoHandlers[pathName]
        if (!geoHandler) {
          send(404, { error: `Unknown path ${pathName}` })
          return
        }
        send(200, await geoHandler())
        return
      }

      send(404, { error: `Unknown path ${pathName}` })
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode || 500
      const message = err instanceof Error ? err.message : String(err)
      console.error('[snapshots-api]', message)
      send(status, { error: message })
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), snapshotsApiPlugin(env)],
    server: {
      allowedHosts: true,
      cors: {
        origin: true,
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Alora-Tenant-Id',
          'ngrok-skip-browser-warning',
        ],
      },
    },
  }
})
