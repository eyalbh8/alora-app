import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  connectBlogProvider,
  connectPlatform,
  connectShopify,
  disconnectAccount,
  getIntegrations,
} from '../api/integrations'
import { queryKeys } from '../api/queryKeys'
import { useAccountStore } from '../store/useAccountStore'

export function useIntegrations() {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.integrations.list(selectedAccount?.id),
    queryFn: getIntegrations,
    enabled: Boolean(selectedAccount?.id),
  })
}

export function useConnectPlatform() {
  return useMutation({
    mutationFn: (platform: string) => connectPlatform(platform),
  })
}

export function useConnectShopify() {
  return useMutation({
    mutationFn: (shop: string) => connectShopify(shop),
  })
}

export function useConnectBlogProvider() {
  const queryClient = useQueryClient()
  const { selectedAccount } = useAccountStore()
  return useMutation({
    mutationFn: (provider: 'wordpress' | 'lovable') => connectBlogProvider(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.list(selectedAccount?.id),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dailyContent.publishTargets(selectedAccount?.id),
      })
    },
  })
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient()
  const { selectedAccount } = useAccountStore()
  return useMutation({
    mutationFn: (accountId: string) => disconnectAccount(accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.list(selectedAccount?.id),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dailyContent.publishTargets(selectedAccount?.id),
      })
    },
  })
}
