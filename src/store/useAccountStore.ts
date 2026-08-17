import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Account {
  id: string
  name: string | null
  domain: string | null
  sourceAccountId: string
  account: {
    id: string
    title: string
    domains: string[]
    logo: string | null
  } | null
}

interface AccountStore {
  selectedAccount: Account | null
  setSelectedAccount: (account: Account) => void
  clearSelectedAccount: () => void
  refreshSelectedAccount: (accounts: Account[]) => void
}

export const useAccountStore = create<AccountStore>()(
  persist(
    (set, get) => ({
      selectedAccount: null,
      setSelectedAccount: (account) => set({ selectedAccount: account }),
      clearSelectedAccount: () => set({ selectedAccount: null }),
      refreshSelectedAccount: (accounts) => {
        const currentSelected = get().selectedAccount
        if (currentSelected) {
          const updatedAccount = accounts.find((acc) => acc.id === currentSelected.id)
          if (updatedAccount) {
            set({ selectedAccount: updatedAccount })
          }
        }
      },
    }),
    {
      name: 'alora-selected-account',
    }
  )
)
