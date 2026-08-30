import { type PropsWithChildren, useEffect } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useSession } from '@descope/react-sdk'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '../api/accounts'
import { useAccountStore } from '../store/useAccountStore'
import { queryKeys } from '../api/queryKeys'
import { FirstAccountSetup } from './FirstAccountSetup'
import { FullScreenLoader } from './loading'

export function AuthGuard({ children }: PropsWithChildren) {
  const { isAuthenticated, isSessionLoading } = useSession()
  const location = useLocation()
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
    return <FullScreenLoader />
  }

  if (!isAuthenticated) {
    // Keep OAuth query/hash so the Descope widget on /login can finish Google.
    return <Navigate to={`/login${location.search}${location.hash}`} replace />
  }

  if (accountsLoading) {
    return <FullScreenLoader />
  }

  if (accountsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="rounded-lg border border-error/20 bg-error-surface p-8">
          <p className="eyebrow mb-3 text-error">Failed to load accounts</p>
          <p className="text-[15px] text-error-link">Please try refreshing the page.</p>
          {accountsErrorDetail instanceof Error ? (
            <p className="mt-3 max-w-md text-[13px] text-error-link">{accountsErrorDetail.message}</p>
          ) : null}
        </div>
      </div>
    )
  }

  if (!accounts || accounts.length === 0) {
    return <FirstAccountSetup />
  }

  if (!selectedAccount) {
    return <FullScreenLoader />
  }

  return <>{children}</>
}
