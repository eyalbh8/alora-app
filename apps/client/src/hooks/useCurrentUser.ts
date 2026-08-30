import { useQuery } from '@tanstack/react-query'
import { getMe } from '../api/accounts'
import { queryKeys } from '../api/queryKeys'
import { useSession } from '@descope/react-sdk'

export function useCurrentUser() {
  const { isAuthenticated } = useSession()
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: getMe,
    enabled: isAuthenticated,
    staleTime: Infinity,
  })
}

export function useIsAdmin(): boolean {
  const { data } = useCurrentUser()
  return Boolean(data?.isAdmin)
}
