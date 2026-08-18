import { useState, type FormEvent } from 'react'
import { useMcpConnection, useSaveMcpConnection } from '../api/carouselGeneration'
import { useAccountStore } from '../store/useAccountStore'

export function WorkspaceConnectionPanel({ compact = false }: { compact?: boolean }) {
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
    <div className={compact ? 'border border-line bg-surface p-4' : 'border border-line bg-surface p-6'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">Workspace connection</p>
          <p className="mt-1 text-[15px] text-muted">
            {connected
              ? `${accountName} is connected${connection.data?.keyPrefix ? ` (${connection.data.keyPrefix})` : ''}${workspaceId ? ` · ${workspaceId}` : ''}.`
              : `Paste the MCP URL for ${accountName}. The key and workspace_id are saved on this Alora account.`}
          </p>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => saveMutation.mutate(null)}
            disabled={saveMutation.isPending}
            className="button button--outline"
          >
            <span>{saveMutation.isPending ? 'Disconnecting…' : 'Disconnect'}</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {!connected && (
        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="form-field min-w-0 flex-1">
            <label htmlFor="workspace-mcp-url">MCP URL — required</label>
            <input
              id="workspace-mcp-url"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://…/mcp?mcp_token=…&workspace_id=…"
              value={connectionUrl}
              onChange={(event) => setConnectionUrl(event.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={saveMutation.isPending || !connectionUrl.trim()}
            className="button button--primary"
          >
            <span>{saveMutation.isPending ? 'Verifying…' : 'Connect'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}

      {connection.isError && <p className="field-error">{connection.error.message}</p>}
      {saveMutation.isError && <p className="field-error">{saveMutation.error.message}</p>}
    </div>
  )
}
