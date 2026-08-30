import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBlogSiteCategories,
  getDailyContentDayPosts,
  getDailyContentDays,
  getDailyContentPublishTargets,
  getDailyContentRunPosts,
  getDailyContentRuns,
  getDailyContentSettings,
  publishDailyContentPost,
  updateDailyContentPost,
  updateDailyContentSettings,
  type DailyContentPostPatch,
  type DailyContentSettings,
} from '../api/dailyContent'
import { queryKeys } from '../api/queryKeys'
import { useAccountStore } from '../store/useAccountStore'

export function useDailyContentRuns(take = 30) {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.runs(selectedAccount?.id, take),
    queryFn: () => getDailyContentRuns(take),
    enabled: Boolean(selectedAccount?.id),
    refetchInterval: 30_000,
  })
}

export function useDailyContentDays(take = 60) {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.days(selectedAccount?.id, take),
    queryFn: () => getDailyContentDays(take),
    enabled: Boolean(selectedAccount?.id),
  })
}

export function useDailyContentDayPosts(date: string | null) {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.dayPosts(selectedAccount?.id, date || ''),
    queryFn: () => getDailyContentDayPosts(date!),
    enabled: Boolean(selectedAccount?.id && date),
    staleTime: 60_000,
  })
}

export function useDailyContentRunPosts(runId: string | null) {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.runPosts(selectedAccount?.id, runId || ''),
    queryFn: () => getDailyContentRunPosts(runId!),
    enabled: Boolean(selectedAccount?.id && runId),
  })
}

export function useDailyContentSettings() {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.settings(selectedAccount?.id),
    queryFn: getDailyContentSettings,
    enabled: Boolean(selectedAccount?.id),
  })
}

export function useUpdateDailyContentSettings() {
  const queryClient = useQueryClient()
  const { selectedAccount } = useAccountStore()
  return useMutation({
    mutationFn: (patch: Partial<DailyContentSettings>) => updateDailyContentSettings(patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(
        queryKeys.dailyContent.settings(selectedAccount?.id),
        settings,
      )
    },
  })
}

export function useDailyContentPublishTargets(enabled = true) {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.publishTargets(selectedAccount?.id),
    queryFn: getDailyContentPublishTargets,
    enabled: Boolean(selectedAccount?.id && enabled),
    staleTime: 30_000,
    retry: false,
  })
}

export function useBlogSiteCategories(siteId: string | null) {
  const { selectedAccount } = useAccountStore()
  return useQuery({
    queryKey: queryKeys.dailyContent.blogSiteCategories(
      selectedAccount?.id,
      siteId || '',
    ),
    queryFn: () => getBlogSiteCategories(siteId!),
    enabled: Boolean(selectedAccount?.id && siteId),
    staleTime: 60_000,
  })
}

export function useUpdateDailyContentPost(runId: string) {
  const queryClient = useQueryClient()
  const { selectedAccount } = useAccountStore()
  return useMutation({
    mutationFn: ({
      postId,
      patch,
    }: {
      postId: string
      patch: DailyContentPostPatch
    }) => updateDailyContentPost(runId, postId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dailyContent.runPosts(selectedAccount?.id, runId),
      })
      void queryClient.invalidateQueries({
        queryKey: ['dailyContent', 'dayPosts', selectedAccount?.id],
      })
    },
  })
}

export function usePublishDailyContentPost(runId: string) {
  const queryClient = useQueryClient()
  const { selectedAccount } = useAccountStore()
  return useMutation({
    mutationFn: ({
      postId,
      siteIds,
      categoryBySite,
    }: {
      postId: string
      siteIds?: string[]
      categoryBySite?: Record<string, number>
    }) => publishDailyContentPost(runId, postId, { siteIds, categoryBySite }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dailyContent.runPosts(selectedAccount?.id, runId),
      })
      void queryClient.invalidateQueries({
        queryKey: ['dailyContent', 'dayPosts', selectedAccount?.id],
      })
    },
  })
}
