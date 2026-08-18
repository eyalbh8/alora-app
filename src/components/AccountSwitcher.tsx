import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDescope } from '@descope/react-sdk'
import { useAccountStore, type Account } from '../store/useAccountStore'
import { getAccounts } from '../api/accounts'
import { queryKeys } from '../api/queryKeys'

export function AccountSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { logout } = useDescope()
  const queryClient = useQueryClient()
  const { selectedAccount, setSelectedAccount } = useAccountStore()

  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: getAccounts,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const filteredAccounts = accounts.filter((account) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const title = account.account?.title?.toLowerCase() || ''
    const name = account.name?.toLowerCase() || ''
    const domain = account.domain?.toLowerCase() || ''
    const accountDomains = account.account?.domains?.map((d) => d.toLowerCase()) || []
    return (
      title.includes(query) ||
      name.includes(query) ||
      domain.includes(query) ||
      accountDomains.some((d) => d.includes(query))
    )
  })

  const handleSelectAccount = (account: Account) => {
    setSelectedAccount(account)
    setIsOpen(false)
    setSearchQuery('')
    onNavigate?.()
    void queryClient.invalidateQueries()
  }

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const displayName = selectedAccount?.account?.title || selectedAccount?.name || 'Account'

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="nav-assessment"
        aria-expanded={isOpen}
        title={displayName}
      >
        <span className="nav-assessment__name">{displayName}</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-32px))] border border-line bg-surface"
        >
          <div className="form-field border-b border-line p-3">
            <label htmlFor="account-search">Account — search</label>
            <input
              id="account-search"
              type="text"
              placeholder="Search accounts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {filteredAccounts.length === 0 ? (
              <div className="px-4 py-8 text-center font-mono text-[12px] uppercase tracking-[0.1em] text-muted-dark">
                No accounts found
              </div>
            ) : (
              filteredAccounts.map((account, index) => {
                const accountTitle = account.account?.title || account.name || 'Account'
                const accountDomain = account.account?.domains?.[0] || account.domain || ''
                const isSelected = selectedAccount?.id === account.id

                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleSelectAccount(account)}
                    className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-paper-soft"
                  >
                    <span className="card-number">
                      // {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] text-ink">{accountTitle}</div>
                      {accountDomain && (
                        <div className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-muted-dark">
                          {accountDomain}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                        Active
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <button type="button" onClick={handleLogout} className="text-link">
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
