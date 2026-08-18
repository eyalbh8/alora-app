import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFirstAccount } from '../api/accounts'
import { queryKeys } from '../api/queryKeys'
import { useAccountStore } from '../store/useAccountStore'
import { BrandMark } from './Layout'

export function FirstAccountSetup() {
  const queryClient = useQueryClient()
  const setSelectedAccount = useAccountStore((s) => s.setSelectedAccount)
  const [connectionUrl, setConnectionUrl] = useState('')

  const mutation = useMutation({
    mutationFn: createFirstAccount,
    onSuccess: async (account) => {
      setSelectedAccount(account)
      queryClient.setQueryData(queryKeys.accounts, [account])
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })

  const handleSave = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = connectionUrl.trim()
    if (!trimmed) return
    mutation.mutate(trimmed)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-xl border border-line bg-surface p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <BrandMark />
          <span className="brand__name">Alora</span>
        </div>
        <p className="eyebrow">First-time setup</p>
        <h1 className="screen-title">
          Connect your first <span className="screen-title__rest">iGEO account</span>
        </h1>
        <p className="mt-4 text-[15px] leading-[1.7] text-muted">
          You&apos;re signed in. Paste the iGEO MCP URL for this workspace. We&apos;ll save the
          API key and workspace id on your first Alora account.
        </p>

        <form onSubmit={handleSave} className="mt-8 flex flex-col gap-4">
          <div className="form-field">
            <label htmlFor="first-account-url">MCP URL — required</label>
            <input
              id="first-account-url"
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://api.igeo.ai/mcp?mcp_token=igeo_live_…&workspace_id=…"
              value={connectionUrl}
              onChange={(event) => setConnectionUrl(event.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={mutation.isPending || !connectionUrl.trim()}
            className="button button--primary"
          >
            <span>{mutation.isPending ? 'Verifying…' : 'Connect account'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>

        {mutation.isError && (
          <p className="field-error">
            {mutation.error instanceof Error ? mutation.error.message : 'Could not connect this account.'}
          </p>
        )}
      </div>
    </div>
  )
}
