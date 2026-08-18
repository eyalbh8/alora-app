/**
 * Instagram Carousel Generation - React Query Hooks
 * Client-side API hooks for carousel generation
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSessionToken } from '@descope/react-sdk'
import { useAccountStore } from '../store/useAccountStore'
import { queryKeys } from './queryKeys'

// API base URL
const API_BASE = '/api/carousel'

/**
 * Build auth headers for carousel API calls
 */
function getAuthHeaders(): HeadersInit {
  const token = getSessionToken()
  const selectedAccount = useAccountStore.getState().selectedAccount

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (selectedAccount?.id) {
    headers['X-Alora-Tenant-Id'] = selectedAccount.id
  }

  return headers
}

export interface McpConnectionStatus {
  connected: boolean
  keyPrefix: string | null
  workspaceId: string | null
}

export interface InstagramCarouselFormat {
  id: 'instagram-portrait-4x5'
  width: 1080
  height: 1350
  aspectRatio: '4:5'
}

export interface BrandHubData {
  id: string
  title: string
  logo: string | null
  names: string[]
  domains: string[]
  about: string
  industryCategory: string
  subIndustryCategory: string
  language: string
  targetAudience: string[]
  toneOfVoice: string[]
  values: string[]
  personality: string[]
  keyFeatures: string[]
  knowledgeSources: string[]
  postGuidelines: {
    dos: string[]
    donts: string[]
  }
  brandColors: Array<{
    hex: string
    r?: number
    g?: number
    b?: number
    name?: string | null
  }>
  typography: {
    headlineFont: string
    bodyFont: string
    labelFont: string
    headlineWeight: string
    bodyWeight: string
    labelWeight: string
  }
  socials: Record<string, string>
}

/**
 * Load whether this Alora account has a saved iGEO MCP key (masked only).
 */
export function useMcpConnection() {
  const selectedAccountId = useAccountStore((s) => s.selectedAccount?.id)

  return useQuery<McpConnectionStatus>({
    queryKey: ['carousel', 'mcp-connection', selectedAccountId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/mcp-connection`, {
        headers: getAuthHeaders(),
      })
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error('Carousel API is not available on this host')
      }
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch MCP connection')
      }
      return payload
    },
    enabled: !!selectedAccountId,
    staleTime: 30 * 1000,
  })
}

/**
 * Save or disconnect the iGEO MCP connection for the selected account.
 * Pass the full MCP URL, or null to disconnect.
 */
export function useSaveMcpConnection() {
  const queryClient = useQueryClient()
  const selectedAccountId = useAccountStore((s) => s.selectedAccount?.id)

  return useMutation({
    mutationFn: async (connectionUrl: string | null): Promise<McpConnectionStatus> => {
      const response = await fetch(`${API_BASE}/mcp-connection`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ connectionUrl }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save MCP connection')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['carousel', 'mcp-connection', selectedAccountId], data)
      void queryClient.invalidateQueries({ queryKey: ['carousel'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant(selectedAccountId) })
      void queryClient.invalidateQueries({ queryKey: ['geo'] })
      void queryClient.invalidateQueries({ queryKey: ['traffic'] })
      void queryClient.invalidateQueries({ queryKey: ['crawlers'] })
      const current = useAccountStore.getState().selectedAccount
      if (current && data.workspaceId) {
        useAccountStore.getState().setSelectedAccount({
          ...current,
          sourceAccountId: data.workspaceId,
        })
      }
    },
  })
}

/**
 * Load the selected account's BrandHub directly from iGEO MCP.
 */
export function useBrandHub(enabled = true) {
  const selectedAccountId = useAccountStore((s) => s.selectedAccount?.id)

  return useQuery<BrandHubData>({
    queryKey: ['carousel', 'brand-hub', selectedAccountId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/brand-hub`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch BrandHub')
      }
      const data = await response.json()
      return data.brandHub
    },
    enabled: enabled && !!selectedAccountId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// Types
export interface InstagramPost {
  id: string
  generationId: string
  accountId: string
  topic: string
  prompt: string
  socialMediaProvider: string
  title: string
  body: string
  tags: string[]
  imagesUrl: string[]
  state: 'SUGGESTED' | 'SCHEDULED' | 'PUBLISHED'
  createdAt: string
}

interface GenerationStatus {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps_completed: number
  current_step: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  error: string | null
  final_caption: string | null
  figma_file_url: string | null
  image_urls: string[]
  format?: InstagramCarouselFormat
  stepOutputs: Array<{
    step_number: number
    step_name: string
    output_json: unknown
    duration_ms: number
    error: string | null
    completed_at: string
  }>
  progress: {
    current: number
    total: number
    percentage: number
  }
}

interface GenerateCarouselRequest {
  postId: string
}

interface GenerateCarouselResponse {
  generationId: string
  status: string
}

/**
 * Fetch Instagram posts from iGEO MCP (last 14 days)
 */
export function useTodayInstagramPosts(enabled = true) {
  const selectedAccountId = useAccountStore((s) => s.selectedAccount?.id)

  return useQuery({
    queryKey: ['carousel', 'posts', 'today', selectedAccountId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/posts/today`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const error = await response.json()
        const err = new Error(error.error || 'Failed to fetch posts') as Error & { code?: string }
        if (error.code) err.code = error.code
        throw err
      }
      return response.json()
    },
    enabled: enabled && !!selectedAccountId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

/**
 * Generate Instagram carousel mutation
 */
export function useGenerateCarousel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: GenerateCarouselRequest): Promise<GenerateCarouselResponse> => {
      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate carousel')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carousel', 'list'] })
    },
  })
}

/**
 * Poll generation status
 */
export function useGenerationStatus(generationId: string | null, enabled = true) {
  return useQuery<GenerationStatus>({
    queryKey: ['carousel', 'status', generationId],
    queryFn: async (): Promise<GenerationStatus> => {
      if (!generationId) {
        throw new Error('No generation ID provided')
      }

      const response = await fetch(`${API_BASE}/status/${encodeURIComponent(generationId)}`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch generation status')
      }
      return response.json()
    },
    enabled: enabled && !!generationId,
    refetchInterval: (query) => {
      // Poll every 2 seconds while running
      const data = query.state.data
      if (!data) return 2000
      const status = data.status
      if (status === 'pending' || status === 'running') {
        return 2000
      }
      // Stop polling when completed or failed
      return false
    },
    refetchOnWindowFocus: false,
  })
}

/**
 * List recent carousel generations
 */
export interface CarouselGenerationSummary {
  id: string
  account_id: string
  selected_post_id: string | null
  post_prompt: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps_completed: number
  created_at: string
  finished_at: string | null
  error: string | null
  image_urls?: string[] | null
  figma_file_url?: string | null
}

export function useCarouselGenerations(limit = 20) {
  const selectedAccountId = useAccountStore((s) => s.selectedAccount?.id)

  return useQuery<{ generations: CarouselGenerationSummary[] }>({
    queryKey: ['carousel', 'list', selectedAccountId, limit],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/list?limit=${limit}`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch generations')
      }
      return response.json()
    },
    enabled: !!selectedAccountId,
    staleTime: 30 * 1000,
  })
}

/**
 * Resume a failed carousel generation from the first incomplete step
 */
export function useResumeCarousel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (generationId: string): Promise<GenerateCarouselResponse> => {
      const response = await fetch(`${API_BASE}/resume`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ generationId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resume carousel')
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['carousel', 'status', data.generationId], (old: GenerationStatus | undefined) =>
        old
          ? { ...old, status: 'running' as const, error: null }
          : old,
      )
      queryClient.invalidateQueries({ queryKey: ['carousel', 'status', data.generationId] })
      queryClient.invalidateQueries({ queryKey: ['carousel', 'list'] })
    },
  })
}
export function useCarouselGeneration() {
  const generateMutation = useGenerateCarousel()
  const resumeMutation = useResumeCarousel()
  const [trackedId, setTrackedId] = useState<string | null>(null)
  const generationId =
    trackedId ??
    resumeMutation.data?.generationId ??
    generateMutation.data?.generationId ??
    null
  const statusQuery = useGenerationStatus(generationId, !!generationId)

  const status = statusQuery.data
  const isResuming = resumeMutation.isPending
  const isFailed = status?.status === 'failed' && !isResuming
  const failedMessage = isFailed ? status?.error : null

  return {
    isGenerating:
      generateMutation.isPending ||
      isResuming ||
      status?.status === 'running' ||
      status?.status === 'pending',
    isResuming,
    generationError: generateMutation.error || resumeMutation.error,
    status,
    isPolling: statusQuery.isFetching,
    statusError: statusQuery.error,
    startGeneration: (request: GenerateCarouselRequest) => {
      generateMutation.mutate(request, {
        onSuccess: (data) => setTrackedId(data.generationId),
      })
    },
    loadGeneration: (generationIdToOpen: string) => {
      setTrackedId(generationIdToOpen)
    },
    resumeGeneration: (generationIdToResume: string) => {
      setTrackedId(generationIdToResume)
      resumeMutation.mutate(generationIdToResume)
    },
    isComplete: status?.status === 'completed',
    isFailed,
    progress: status?.progress,
    currentStep: status?.current_step ?? null,
    failedMessage,
    generationId,
  }
}

/**
 * Create a Figma import job
 */
export function useCreateFigmaJob() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (generationId: string) => {
      const response = await fetch(`${API_BASE}/figma/queue`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ generationId }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create Figma job')
      }
      
      return response.json() as Promise<{
        jobId: string
        importCode: string
        expiresAt: string
      }>
    },
    onSuccess: (_data, generationId) => {
      queryClient.invalidateQueries({ queryKey: ['carousel', 'figma-status', generationId] })
    },
  })
}

/**
 * Poll Figma job status
 */
export function useFigmaJobStatus(generationId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['carousel', 'figma-status', generationId],
    queryFn: async () => {
      if (!generationId) throw new Error('No generation ID')
      
      const response = await fetch(`${API_BASE}/figma/status/${generationId}`, {
        headers: getAuthHeaders(),
      })
      
      if (response.status === 404) {
        return null
      }
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch Figma job status')
      }
      
      return response.json() as Promise<{
        id: string
        status: 'queued' | 'claimed' | 'importing' | 'completed' | 'failed'
        figma_file_url: string | null
        exported_slide_urls: Array<{ slideIndex: number; url: string }> | null
        error: string | null
        created_at: string
        completed_at: string | null
      } | null>
    },
    enabled: enabled && !!generationId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Stop polling when completed or failed
      if (!status || status === 'completed' || status === 'failed') {
        return false
      }
      // Poll every 2 seconds while importing
      return 2000
    },
    staleTime: 1000,
  })
}

