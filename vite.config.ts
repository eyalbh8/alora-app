import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface SnapshotDbModule {
  getPool: () => unknown
  getTenantId: () => string
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
    source_account_id: string
    enabled: boolean
  } | null>
  listAvailableDays: (db: unknown, tenantId: string) => Promise<unknown>
  SCREEN_KEYS: string[]
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

  const loadApi = () => {
    if (!apiPromise) {
      process.env.DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL
      process.env.WHITELABEL_TENANT_ID =
        env.WHITELABEL_TENANT_ID || process.env.WHITELABEL_TENANT_ID
      const modPath = pathToFileURL(
        path.join(__dirname, 'functions/snapshots-api/db.mjs'),
      ).href
      apiPromise = import(modPath) as Promise<SnapshotDbModule>
    }
    return apiPromise
  }

  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/snapshots')) return next()

    const send = (status: number, body: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }

    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }
      if (req.method !== 'GET') {
        send(405, { error: 'Method not allowed' })
        return
      }

      const api = await loadApi()
      const db = api.getPool()
      const tenantId = api.getTenantId()
      const url = new URL(req.url, 'http://localhost')
      const pathName = url.pathname.replace(/^\/api\/snapshots/, '') || '/'

      if (pathName === '/' || pathName === '/health') {
        send(200, { ok: true, screens: api.SCREEN_KEYS })
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
        const availableDays = await api.listAvailableDays(db, tenantId)
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
  }
})
