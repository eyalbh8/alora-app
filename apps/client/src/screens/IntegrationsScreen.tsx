import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ExternalLink, Plug, RefreshCw, Unplug } from 'lucide-react'
import { PageLoader } from '../components/loading'
import { ErrorState } from '../components/ErrorState'
import { IntegrationBrandIcon } from '../components/integrations/IntegrationBrandIcon'
import {
  useConnectBlogProvider,
  useConnectPlatform,
  useConnectShopify,
  useDisconnectAccount,
  useIntegrations,
} from '../hooks/useIntegrations'
import type {
  IntegrationBlogProvider,
  IntegrationSocialRow,
} from '../api/integrations'

const PLATFORM_META: Record<
  string,
  { label: string; description: string; color: string }
> = {
  INSTAGRAM: {
    label: 'Instagram',
    description: 'Feed posts and carousels',
    color:
      'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
  },
  FACEBOOK: {
    label: 'Facebook',
    description: 'Pages and feed posts',
    color: '#1877F2',
  },
  LINKEDIN: {
    label: 'LinkedIn',
    description: 'Personal or company posts',
    color: '#0A66C2',
  },
  X: {
    label: 'X',
    description: 'Posts and threads',
    color: '#111111',
  },
}

const BLOG_META: Record<
  string,
  { label: string; description: string; color: string }
> = {
  wordpress: {
    label: 'WordPress',
    description: 'Sites linked via iGEO',
    color: '#21759B',
  },
  lovable: {
    label: 'Lovable',
    description: 'Sites linked via iGEO',
    color: 'linear-gradient(135deg, #FF0105 0%, #FF66F4 45%, #4B73FF 100%)',
  },
  shopify: {
    label: 'Shopify',
    description: 'Storefront blog via Zernio',
    color: '#7AB55C',
  },
}

function SocialCard({ row }: { row: IntegrationSocialRow }) {
  const connect = useConnectPlatform()
  const disconnect = useDisconnectAccount()
  const meta = PLATFORM_META[row.platform] || {
    label: row.platform,
    description: '',
    color: 'var(--accent)',
  }

  const handleConnect = async () => {
    try {
      const { authUrl } = await connect.mutateAsync(row.platform)
      window.location.href = authUrl
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Connect failed')
    }
  }

  const handleDisconnect = async () => {
    if (!row.account?.id) return
    if (!window.confirm(`Disconnect ${meta.label}?`)) return
    try {
      await disconnect.mutateAsync(row.account.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Disconnect failed')
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-full text-white"
            style={{ background: meta.color }}
          >
            <IntegrationBrandIcon brand={row.platform} className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">{meta.label}</h3>
            <p className="text-xs text-[var(--ink-soft)]">{meta.description}</p>
          </div>
        </div>
        {row.connected ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
            Connected
          </span>
        ) : (
          <span className="rounded-full bg-[var(--paper-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">
            Not connected
          </span>
        )}
      </div>

      {row.connected && row.account ? (
        <p className="text-sm text-[var(--ink-soft)]">
          @{row.account.username || row.account.displayName || row.account.id}
        </p>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Connect so Menchly can publish daily content to {meta.label}.
        </p>
      )}

      <div className="mt-auto flex gap-2">
        {row.connected ? (
          <button
            type="button"
            className="button inline-flex items-center gap-1.5"
            disabled={disconnect.isPending}
            onClick={() => void handleDisconnect()}
          >
            <Unplug className="size-3.5" />
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            className="button button--primary inline-flex items-center gap-1.5"
            disabled={connect.isPending}
            onClick={() => void handleConnect()}
          >
            <Plug className="size-3.5" />
            {connect.isPending ? 'Opening…' : 'Connect'}
          </button>
        )}
      </div>
    </div>
  )
}

function BlogCard({ row }: { row: IntegrationBlogProvider }) {
  const syncBlog = useConnectBlogProvider()
  const connectShopify = useConnectShopify()
  const disconnect = useDisconnectAccount()
  const [shop, setShop] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const meta = BLOG_META[row.provider] || {
    label: row.provider,
    description: '',
    color: 'var(--accent)',
  }
  const isShopify = row.provider === 'shopify'
  const isIgeo = row.managedBy === 'igeo'

  const handleShopifyConnect = async () => {
    setMessage(null)
    try {
      const { authUrl } = await connectShopify.mutateAsync(shop.trim())
      window.location.href = authUrl
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connect failed')
    }
  }

  const handleIgeoSync = async () => {
    setMessage(null)
    try {
      const result = await syncBlog.mutateAsync(
        row.provider === 'lovable' ? 'lovable' : 'wordpress',
      )
      if (result.authUrl) {
        window.location.href = result.authUrl
        return
      }
      setMessage(result.message || (result.connected ? 'Synced.' : 'No sites found.'))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  const handleDisconnect = async () => {
    if (!row.account?.id) return
    if (!window.confirm(`Disconnect ${meta.label}?`)) return
    try {
      await disconnect.mutateAsync(row.account.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Disconnect failed')
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-full text-white"
            style={{ background: meta.color }}
          >
            <IntegrationBrandIcon brand={row.provider} className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">{meta.label}</h3>
            <p className="text-xs text-[var(--ink-soft)]">{meta.description}</p>
          </div>
        </div>
        {row.connected ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
            Connected
          </span>
        ) : (
          <span className="rounded-full bg-[var(--paper-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--muted)]">
            Not connected
          </span>
        )}
      </div>

      {isShopify && row.account ? (
        <p className="text-sm text-[var(--ink-soft)]">
          {row.account.username || row.account.displayName || row.account.id}
        </p>
      ) : null}

      {isIgeo && row.sites.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {row.sites.map((site) => (
            <li key={site.id} className="text-sm text-[var(--ink-soft)]">
              <span className="font-medium text-[var(--ink)]">{site.name}</span>
              {site.url ? (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex items-center gap-0.5 text-xs text-[var(--accent)]"
                >
                  open <ExternalLink className="size-2.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : isIgeo ? (
        <p className="text-sm text-[var(--muted)]">
          Sites appear here after they are connected on the linked iGEO workspace.
        </p>
      ) : !row.connected ? (
        <p className="text-sm text-[var(--muted)]">
          Connect a Shopify store to publish storefront blog articles via Zernio.
        </p>
      ) : null}

      {isShopify && !row.connected ? (
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
          Store domain
          <input
            type="text"
            className="rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-2 py-1.5 text-sm text-[var(--ink)]"
            placeholder="your-store.myshopify.com"
            value={shop}
            onChange={(e) => setShop(e.target.value)}
          />
        </label>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        {isShopify && row.connected ? (
          <button
            type="button"
            className="button inline-flex items-center gap-1.5"
            disabled={disconnect.isPending}
            onClick={() => void handleDisconnect()}
          >
            <Unplug className="size-3.5" />
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        ) : null}

        {isShopify && !row.connected ? (
          <button
            type="button"
            className="button button--primary inline-flex items-center gap-1.5"
            disabled={connectShopify.isPending || !shop.trim()}
            onClick={() => void handleShopifyConnect()}
          >
            <Plug className="size-3.5" />
            {connectShopify.isPending ? 'Opening…' : 'Connect'}
          </button>
        ) : null}

        {isIgeo ? (
          <button
            type="button"
            className="button button--primary inline-flex items-center gap-1.5"
            disabled={syncBlog.isPending}
            onClick={() => void handleIgeoSync()}
          >
            <RefreshCw className="size-3.5" />
            {syncBlog.isPending
              ? 'Syncing…'
              : row.connected
                ? 'Sync from iGEO'
                : 'Connect / Sync'}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="text-xs text-[var(--ink-soft)]">{message}</p>
      ) : null}
    </div>
  )
}

export function IntegrationsScreen() {
  const integrations = useIntegrations()
  const [params] = useSearchParams()
  const flash = useMemo(() => {
    if (params.get('connected') === '1')
      return { type: 'ok' as const, text: 'Account connected.' }
    const err = params.get('error')
    if (err) return { type: 'err' as const, text: err }
    return null
  }, [params])

  if (integrations.isLoading && !integrations.data) return <PageLoader />
  if (integrations.error) {
    return (
      <ErrorState
        message={
          integrations.error instanceof Error
            ? integrations.error.message
            : String(integrations.error)
        }
        onRetry={() => void integrations.refetch()}
      />
    )
  }

  const data = integrations.data
  if (!data) return null

  const blogRows = (Array.isArray(data.blog) ? data.blog : []).filter(
    (row) => row.provider === 'shopify',
  )

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="screen-title">Integrations</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Connect social accounts via Zernio, and Shopify for blog publishing.
        </p>
      </div>

      {flash ? (
        <div
          className={`rounded-[var(--r-row)] border px-3 py-2 text-sm ${
            flash.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Social</h2>
          <p className="text-sm text-[var(--ink-soft)]">
            Instagram, Facebook, LinkedIn, and X — one account per platform.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.social.map((row) => (
            <SocialCard key={row.platform} row={row} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Blog</h2>
          <p className="text-sm text-[var(--ink-soft)]">
            Shopify connects through Zernio.
          </p>
        </div>
        <div className="grid max-w-md gap-4">
          {blogRows.map((row) => (
            <BlogCard key={row.provider} row={row} />
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          Need help? Open the{' '}
          <Link to="/content" className="text-[var(--accent)] underline">
            Content
          </Link>{' '}
          screen to publish once accounts are connected.
        </p>
      </section>
    </div>
  )
}
