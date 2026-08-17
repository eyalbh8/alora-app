import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Check, Search, LogOut } from 'lucide-react'
import { useDescope } from '@descope/react-sdk'
import { useAccountStore, type Account } from '../store/useAccountStore'
import { getAccounts } from '../api/accounts'
import { queryKeys } from '../api/queryKeys'

export function AccountSwitcher() {
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

  // Close popover when clicking outside
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
    // Invalidate all queries to refetch data for the new account
    void queryClient.invalidateQueries()
  }

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const displayName = selectedAccount?.account?.title || selectedAccount?.name || 'Account'
  const displayDomain =
    selectedAccount?.account?.domains?.[0] || selectedAccount?.domain || ''
  const logo = selectedAccount?.account?.logo

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
      >
        {logo ? (
          <img src={logo} alt="" className="h-6 w-6 rounded object-cover" />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-400 text-xs font-semibold text-brand-950">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-brand-50">{displayName}</div>
          {displayDomain && (
            <div className="truncate text-[11px] text-brand-300">{displayDomain}</div>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-brand-300" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-2 w-full min-w-[280px] rounded-lg border border-brand-800 bg-brand-900 shadow-xl"
        >
          {/* Search */}
          <div className="border-b border-white/10 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-brand-950 py-2 pl-9 pr-3 text-sm text-brand-50 placeholder:text-brand-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
          </div>

          {/* Account list */}
          <div className="max-h-[320px] overflow-y-auto">
            {filteredAccounts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-brand-500">No accounts found</div>
            ) : (
              filteredAccounts.map((account) => {
                const accountTitle = account.account?.title || account.name || 'Account'
                const accountDomain = account.account?.domains?.[0] || account.domain || ''
                const accountLogo = account.account?.logo
                const isSelected = selectedAccount?.id === account.id

                return (
                  <button
                    key={account.id}
                    onClick={() => handleSelectAccount(account)}
                    className="flex w-full items-center gap-2 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5 last:border-b-0"
                  >
                    {accountLogo ? (
                      <img src={accountLogo} alt="" className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-700 text-sm font-semibold text-brand-50">
                        {accountTitle.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-brand-50">
                        {accountTitle}
                      </div>
                      {accountDomain && (
                        <div className="truncate text-xs text-brand-400">{accountDomain}</div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-400" />}
                  </button>
                )
              })
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-white/10 p-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-brand-300 transition-colors hover:bg-white/5 hover:text-brand-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
