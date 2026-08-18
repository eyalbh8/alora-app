import { useState, type FormEvent } from 'react'
import { useMcpConnection, useSaveMcpConnection } from '../api/carouselGeneration'
import { useAccountStore } from '../store/useAccountStore'

export function IgeoConnectionPanel({ compact = false }: { compact?: boolean }) {
  const selectedAccount = useAccountStore((s) => s.selectedAccount)
  const connection = useMcpConnection()
  const saveMutation = useSaveMcpConnection()
  const [connectionUrl, setConnectionUrl] = useState('')

  const accountName = selectedAccount?.account?.title || selectedAccount?.name || 'this account'
  const connected = connection.data?.connected === true
  const workspaceId = connection.data?.workspaceId

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = connectionUrl.trim()
    if (!trimmed) return
    saveMutation.mutate(trimmed, {
      onSuccess: () => setConnectionUrl(''),
    })
  }

  return (
    <div
      className={
        compact
          ? 'rounded-lg border border-gray-200 bg-white p-4 shadow-sm'
          : 'rounded-lg border border-[#d8d2c7] bg-white p-6 shadow-sm'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#101414]">iGEO connection</h2>
          <p className="mt-1 text-sm text-[#6b655e]">
            {connected
              ? `${accountName} is connected${connection.data?.keyPrefix ? ` (${connection.data.keyPrefix})` : ''}${workspaceId ? ` · ${workspaceId}` : ''}.`
              : `Paste the iGEO MCP URL for ${accountName}. The key and workspace_id are saved on this Alora account.`}
          </p>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => saveMutation.mutate(null)}
            disabled={saveMutation.isPending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
      </div>

      {!connected && (
        <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://api.igeo.ai/mcp?mcp_token=igeo_live_…&workspace_id=…"
            value={connectionUrl}
            onChange={(event) => setConnectionUrl(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
          />
          <button
            type="submit"
            disabled={saveMutation.isPending || !connectionUrl.trim()}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Verifying…' : 'Connect'}
          </button>
        </form>
      )}

      {connection.isError && (
        <p className="mt-3 text-sm text-red-600">{connection.error.message}</p>
      )}
      {saveMutation.isError && (
        <p className="mt-3 text-sm text-red-600">{saveMutation.error.message}</p>
      )}
    </div>
  )
}
