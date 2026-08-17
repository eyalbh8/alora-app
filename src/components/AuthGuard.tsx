import { type PropsWithChildren, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useSession } from '@descope/react-sdk'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '../api/accounts'
import { useAccountStore } from '../store/useAccountStore'
import { queryKeys } from '../api/queryKeys'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-brand-600">Loading...</p>
      </div>
    </div>
  )
}

export function AuthGuard({ children }: PropsWithChildren) {
  const { isAuthenticated, isSessionLoading } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedAccount, setSelectedAccount, refreshSelectedAccount } = useAccountStore()

  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
    error: accountsErrorDetail,
  } = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
    enabled: isAuthenticated,
    staleTime: Infinity,
    retry: 1,
  })

  // Handle ?accountId= param
  useEffect(() => {
    const paramAccountId = searchParams.get('accountId')
    if (paramAccountId && accounts) {
      const matchingAccount = accounts.find((acc) => acc.id === paramAccountId)
      if (matchingAccount) {
        setSelectedAccount(matchingAccount)
        // Remove the param after selection
        searchParams.delete('accountId')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [searchParams, setSearchParams, accounts, setSelectedAccount])

  // Initialize selection on first load
  useEffect(() => {
    if (!accounts || accounts.length === 0) return

    if (selectedAccount) {
      // Refresh the selected account in case it changed
      refreshSelectedAccount(accounts)
      // Verify the stored account is still accessible
      const isStillAccessible = accounts.some((acc) => acc.id === selectedAccount.id)
      if (!isStillAccessible && accounts.length > 0) {
        // Fall back to first account
        setSelectedAccount(accounts[0])
      }
    } else {
      // No selection yet, pick the first account
      if (accounts.length > 0) {
        setSelectedAccount(accounts[0])
      }
    }
  }, [accounts, selectedAccount, setSelectedAccount, refreshSelectedAccount])

  if (isSessionLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (accountsLoading) {
    return <LoadingScreen />
  }

  if (accountsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-brand-900">Failed to load accounts</h2>
          <p className="text-sm text-brand-600">Please try refreshing the page.</p>
          {accountsErrorDetail instanceof Error ? (
            <p className="mt-3 max-w-md text-xs text-brand-500">{accountsErrorDetail.message}</p>
          ) : null}
        </div>
      </div>
    )
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7]">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-brand-900">No accounts available</h2>
          <p className="text-sm text-brand-600">
            You don't have access to any accounts yet. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  if (!selectedAccount) {
    return <LoadingScreen />
  }

  return <>{children}</>
}
