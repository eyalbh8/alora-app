import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, RefreshCw } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { getTrackerStatus } from '../api/traffic'
import { queryKeys } from '../api/queryKeys'
import { trackerEndpointUrl, trackerScriptUrl } from '../config'
import { useApi } from '../hooks/useApi'
import { useAccountStore } from '../store/useAccountStore'

function buildSnippet(tenantId: string): string {
  return `<script
  src="${trackerScriptUrl()}"
  data-account-id="${tenantId}"
  data-endpoint="${trackerEndpointUrl()}"
  async
></script>`
}

function buildPixelSnippet(tenantId: string): string {
  const pixel = `${trackerEndpointUrl()}/pixel.gif?a=${tenantId}`
  return `<noscript><img src="${pixel}" alt="" width="1" height="1" /></noscript>`
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    })
  }, [value])

  return (
    <button
      type="button"
      className="button inline-flex items-center gap-1.5"
      onClick={copy}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-line bg-[#f7f7f8] p-4 text-[12.5px] leading-[1.7] text-ink">
      <code>{code}</code>
    </pre>
  )
}

export function TrackerSetupScreen() {
  const { selectedAccount } = useAccountStore()
  const queryClient = useQueryClient()
  const tenantId = selectedAccount?.id

  const { data: status, loading, fetching, retry } = useApi(
    queryKeys.trackerStatus(tenantId),
    getTrackerStatus,
    { enabled: Boolean(tenantId) },
  )

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trackerStatus(tenantId) })
    retry()
  }, [queryClient, retry, tenantId])

  if (!tenantId) {
    return (
      <EmptyState
        title="No workspace selected"
        message="Pick a workspace to get its tracker install snippet."
      />
    )
  }

  const snippet = buildSnippet(tenantId)
  const pixelSnippet = buildPixelSnippet(tenantId)
  const installed = status?.hasEvents ?? false

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <Link
          to="/ai-traffic"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
        >
          <ArrowLeft size={14} />
          Back to AI Traffic
        </Link>
        <h1 className="screen-title">Tracker setup</h1>
        <p className="max-w-2xl text-[15px] leading-[1.7] text-muted">
          Add this snippet to your site to start measuring visits that arrive from
          AI assistants. It only reports a visit when someone arrives from an AI
          chat interface, so ordinary traffic is never sent.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-surface px-6 py-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="eyebrow mb-0">Status</p>
            <p className="font-display text-[22px] leading-none tracking-[-0.02em] text-ink">
              {loading
                ? 'Checking...'
                : installed
                  ? 'Receiving events'
                  : 'No events yet'}
            </p>
            <p className="text-[13.5px] text-muted">
              {installed
                ? `${status?.eventCount.toLocaleString() ?? 0} events recorded${
                    status?.lastEventAt
                      ? `, most recently ${new Date(status.lastEventAt).toLocaleString()}`
                      : ''
                  }.`
                : 'Install the snippet, then visit your site from an AI assistant or use a tagged link to verify.'}
            </p>
          </div>
          <button
            type="button"
            className="button inline-flex items-center gap-1.5"
            onClick={refresh}
            disabled={fetching}
          >
            <RefreshCw size={14} className={fetching ? 'animate-spin' : undefined} />
            {fetching ? 'Checking' : 'Test connection'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-0">Step 1</p>
            <h2 className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink">
              Add the snippet
            </h2>
          </div>
          <CopyButton value={snippet} label="Copy snippet" />
        </div>
        <p className="max-w-2xl text-[14px] leading-[1.7] text-muted">
          Paste it into the <code>&lt;head&gt;</code> of every page you want to
          measure, or into your site-wide template or tag manager.
        </p>
        <CodeBlock code={snippet} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-0">Step 2 (optional)</p>
            <h2 className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink">
              Catch agents that do not run JavaScript
            </h2>
          </div>
          <CopyButton value={pixelSnippet} label="Copy pixel" />
        </div>
        <p className="max-w-2xl text-[14px] leading-[1.7] text-muted">
          AI crawlers read your HTML without executing scripts, so the snippet
          above cannot see them. This pixel catches some of them. Crawler volume
          is reported separately on the AI Crawlers screen.
        </p>
        <CodeBlock code={pixelSnippet} />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <p className="eyebrow mb-0">Step 3</p>
          <h2 className="font-display text-[20px] leading-none tracking-[-0.02em] text-ink">
            Verify it works
          </h2>
        </div>
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 text-[14px] leading-[1.7] text-muted">
          <li>
            Open your site with a tagged link such as{' '}
            <code>?utm_source=chatgpt</code>, then press Test connection above.
          </li>
          <li>
            Or ask an AI assistant a question that surfaces your site and click
            through from its answer.
          </li>
          <li>
            Events usually appear within a few seconds. A regular visit will not
            register, which is expected.
          </li>
        </ul>
      </div>
    </div>
  )
}
