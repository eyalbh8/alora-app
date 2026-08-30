import { apiGet, apiSend } from './client'

export type PlatformRunStatus = 'PENDING' | 'GENERATED' | 'OPTIMIZED' | 'FAILED'

export type PlatformState = {
  generationId?: string | null
  postIds: string[]
  selectedPostId?: string | null
  discardedPostIds: string[]
  status: PlatformRunStatus
  error?: string | null
}

export type DailyContentRun = {
  id: string
  tenantId: string
  localDate: string
  status: string
  skipReason: string | null
  promptId: string | null
  promptText: string | null
  topicId: string | null
  selectionRationale: string | null
  visibilityAtSelection: number | null
  lastContentAt: string | null
  platforms: Partial<Record<string, PlatformState>>
  error: string | null
  startedAt: string
  completedAt: string | null
}

export type DailyContentSettings = {
  dailyContentAutomation: boolean
  dailyContentTimezone: string
  dailyContentHour: number
}

export type DailyContentPost = {
  platform: string
  postId: string
  generationId: string | null
  title: string | null
  body: string | null
  state: string | null
  slug: string | null
  metaTitle: string | null
  metaDescription: string | null
  focusKeyphrase: string | null
  createdAt: string | null
  selected: boolean
  imagesUrl: string[]
  tags: string[]
  topic: string | null
  readTime: number | null
  publishAt: string | null
  isPublished: boolean
  platformPostUrl?: string | null
  trackedRecommendationId?: string | null
}

export type DailyContentRunPosts = {
  run: {
    id: string
    localDate: string
    status: string
    promptText: string | null
    selectionRationale: string | null
  } | null
  posts: DailyContentPost[]
}

export type DailyContentDay = {
  localDate: string
  runId: string
  status: string
  promptText: string | null
  completedAt: string | null
}

export type DailyContentPostPatch = {
  body?: string
  title?: string
  tags?: string[]
  focusKeyphrase?: string
  metaDescription?: string
  slug?: string
  publishAt?: string | null
  removeImages?: boolean
  state?: string
}

export type DailyContentPublishTargets = {
  connected: Record<string, boolean>
  statusesAvailable: boolean
  statuses: Record<string, unknown>
  blogSites: Array<{ id: string; name: string; url?: string | null }>
  publishedByPostId?: Record<
    string,
    {
      platform: string
      platformPostUrl: string | null
      trackedRecommendationId: string | null
      linked: boolean
    }
  >
}

export type PublishPlatformResult = {
  ok: boolean
  skipped?: boolean
  provider: string
  postId: string
  platformPostUrl?: string | null
  zernioPostId?: string | null
  trackedRecommendationId?: string | null
  error?: string | null
}

export type BlogSiteCategory = {
  id: number
  name: string
  parent: number
}

export type PostImageUploadSlot = {
  signedUrl: string
  imagesUrl: string[]
  message: string
}

export async function getDailyContentRuns(take = 30): Promise<DailyContentRun[]> {
  const res = await apiGet<{ runs: DailyContentRun[] }>(`/daily-content/runs?take=${take}`)
  return res.runs
}

export async function getDailyContentDays(take = 60): Promise<DailyContentDay[]> {
  const res = await apiGet<{ days: DailyContentDay[] }>(`/daily-content/days?take=${take}`)
  return res.days
}

export async function getDailyContentDayPosts(date: string): Promise<DailyContentRunPosts> {
  return apiGet<DailyContentRunPosts>(
    `/daily-content/days/${encodeURIComponent(date)}/posts`,
  )
}

export async function getDailyContentRunPosts(runId: string): Promise<DailyContentRunPosts> {
  return apiGet<DailyContentRunPosts>(`/daily-content/runs/${encodeURIComponent(runId)}/posts`)
}

export async function updateDailyContentPost(
  runId: string,
  postId: string,
  patch: DailyContentPostPatch,
): Promise<DailyContentPost> {
  const res = await apiSend<{ post: DailyContentPost }>(
    `/daily-content/runs/${encodeURIComponent(runId)}/posts/${encodeURIComponent(postId)}`,
    'PATCH',
    patch,
  )
  return res.post
}

export async function publishDailyContentPost(
  runId: string,
  postId: string,
  options: {
    siteIds?: string[]
    categoryBySite?: Record<string, number>
  } = {},
): Promise<PublishPlatformResult> {
  return apiSend(
    `/daily-content/runs/${encodeURIComponent(runId)}/posts/${encodeURIComponent(postId)}/publish`,
    'POST',
    options,
  )
}

export async function publishDailyContentRun(
  runId: string,
  options: {
    platforms?: string[]
    siteIds?: string[]
    categoryBySite?: Record<string, number>
  } = {},
): Promise<{ results: PublishPlatformResult[] }> {
  return apiSend(
    `/daily-content/runs/${encodeURIComponent(runId)}/publish`,
    'POST',
    options,
  )
}

export async function requestPostImageUpload(
  runId: string,
  postId: string,
): Promise<PostImageUploadSlot> {
  return apiSend(
    `/daily-content/runs/${encodeURIComponent(runId)}/posts/${encodeURIComponent(postId)}/image-upload`,
    'POST',
  )
}

export async function removePostImage(
  runId: string,
  postId: string,
  imageUrl: string,
): Promise<{ success: boolean; postId: string; imagesUrl: string[]; message: string }> {
  return apiSend(
    `/daily-content/runs/${encodeURIComponent(runId)}/posts/${encodeURIComponent(postId)}/image-remove`,
    'POST',
    { imageUrl },
  )
}

/** Upload raw file bytes to an iGEO presigned S3 PUT URL. Do not use apiSend (JSON Content-Type). */
export async function uploadFileToSignedUrl(signedUrl: string, file: File): Promise<void> {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })
  if (!response.ok) {
    throw new Error(`S3 upload failed (${response.status})`)
  }
}

export async function getDailyContentPublishTargets(): Promise<DailyContentPublishTargets> {
  return apiGet<DailyContentPublishTargets>('/daily-content/publish-targets')
}

export async function getBlogSiteCategories(siteId: string): Promise<BlogSiteCategory[]> {
  const res = await apiGet<{ categories: BlogSiteCategory[] }>(
    `/daily-content/blog-sites/${encodeURIComponent(siteId)}/categories`,
  )
  return res.categories
}

export async function getDailyContentSettings(): Promise<DailyContentSettings> {
  const res = await apiGet<{ settings: DailyContentSettings }>('/daily-content/settings')
  return res.settings
}

export async function updateDailyContentSettings(
  patch: Partial<DailyContentSettings>,
): Promise<DailyContentSettings> {
  const res = await apiSend<{ settings: DailyContentSettings }>(
    '/daily-content/settings',
    'PATCH',
    patch,
  )
  return res.settings
}
