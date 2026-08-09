import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env with NO prefix filter so we can read the API key here in Node.
  // The key is injected into the proxy below and never referenced via
  // import.meta.env, so it stays out of the client bundle.
  //
  // NOTE: any env var actually prefixed with VITE_ is still exposed on
  // import.meta.env in the client bundle by Vite itself. Prefer the
  // un-prefixed AIROPS_API_KEY name (see .env.example) — the VITE_ variant
  // is only read here as a fallback.
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.AIROPS_API_KEY ?? env.VITE_AIROPS_API_KEY ?? ''
  const target = env.AIROPS_API_BASE ?? env.VITE_AIROPS_API_BASE ?? 'https://api.airops.com'

  // SECURITY: this proxy only exists while `vite dev` / `vite preview` is
  // running. A real deployment must NOT ship the API key to the browser —
  // replace this with a small backend or serverless function (Cloudflare
  // Worker, Vercel function, etc.) that holds the key server-side and
  // forwards requests to api.airops.com.
  const proxy: Record<string, ProxyOptions> = {
    '/api/airops': {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/airops/, ''),
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
  }
})
