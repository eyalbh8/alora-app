import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFirstAccount } from '../api/accounts'
import { queryKeys } from '../api/queryKeys'
import { useAccountStore } from '../store/useAccountStore'

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
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-6">
      <div className="w-full max-w-xl rounded-lg border border-[#d8d2c7] bg-white p-8 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
          First-time setup
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-[#101414]">
          Connect your first iGEO account
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#6b655e]">
          You&apos;re signed in. Paste the iGEO MCP URL for this workspace. We&apos;ll save the
          API key and workspace id on your first Alora account.
        </p>

        <form onSubmit={handleSave} className="mt-6 flex flex-col gap-3">
          <input
            type="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://api.igeo.ai/mcp?mcp_token=igeo_live_…&workspace_id=…"
            value={connectionUrl}
            onChange={(event) => setConnectionUrl(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !connectionUrl.trim()}
            className="rounded-md bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {mutation.isPending ? 'Verifying…' : 'Connect account'}
          </button>
        </form>

        {mutation.isError && (
          <p className="mt-4 text-sm text-red-600">
            {mutation.error instanceof Error ? mutation.error.message : 'Could not connect this account.'}
          </p>
        )}
      </div>
    </div>
  )
}