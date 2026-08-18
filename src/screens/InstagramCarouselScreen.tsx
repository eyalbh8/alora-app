/**
 * Instagram Carousel Generator Screen
 * 4-phase UI: Select Post → Review Config → Progress → Results
 */

import React, { useState } from 'react'
import {
  useTodayInstagramPosts,
  useCarouselGeneration,
  useCarouselGenerations,
  useBrandHub,
  useCreateFigmaJob,
  useFigmaJobStatus,
  type BrandHubData,
  type CarouselGenerationSummary,
} from '../api/carouselGeneration'
import { IgeoConnectionPanel } from '../components/IgeoConnectionPanel'

function isFigmaFileUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^https:\/\/([\w-]+\.)?figma\.com\//i.test(value)
  )
}

type Phase = 'select' | 'review' | 'progress' | 'results'
type SelectTab = 'new' | 'history'

interface SelectedPost {
  id: string
  prompt: string
  body: string
  topic: string
  createdAt: string
}

export default function InstagramCarouselScreen() {
  const [phase, setPhase] = useState<Phase>('select')
  const [selectTab, setSelectTab] = useState<SelectTab>('new')
  const [selectedPost, setSelectedPost] = useState<SelectedPost | null>(null)

  const postsQuery = useTodayInstagramPosts()
  const carouselGen = useCarouselGeneration()
  const generationsQuery = useCarouselGenerations(30)
  const brandHubQuery = useBrandHub(phase === 'review')
  const generationList = Array.isArray(generationsQuery.data?.generations)
    ? generationsQuery.data.generations
    : Array.isArray(generationsQuery.data)
      ? generationsQuery.data
      : []
  const resumable = generationList.find(
    (generation: { status?: string; steps_completed?: number }) =>
      generation.status === 'failed' && (generation.steps_completed || 0) >= 1,
  ) as
    | {
        id: string
        post_prompt?: string
        steps_completed?: number
        error?: string | null
      }
    | undefined

  const handleResumeLast = () => {
    if (!resumable?.id) return
    setPhase('progress')
    carouselGen.resumeGeneration(resumable.id)
  }

  const handleOpenGeneration = (generation: CarouselGenerationSummary) => {
    if (generation.status === 'failed') {
      setPhase('progress')
      carouselGen.resumeGeneration(generation.id)
      return
    }
    carouselGen.loadGeneration(generation.id)
    setPhase(generation.status === 'completed' ? 'results' : 'progress')
  }

  // Handle post selection
  const handleSelectPost = (post: SelectedPost) => {
    setSelectedPost(post)
    setPhase('review')
  }

  // Handle generation start
  const handleStartGeneration = () => {
    if (!selectedPost) return

    setPhase('progress')
    carouselGen.startGeneration({
      postId: selectedPost.id,
    })
  }

  // Monitor completion
  React.useEffect(() => {
    if (carouselGen.isComplete) {
      setPhase('results')
    }
  }, [carouselGen.isComplete])

  // Handle back navigation
  const handleBack = () => {
    if (phase === 'review') {
      setPhase('select')
      setSelectedPost(null)
    } else if (phase === 'results') {
      setPhase('select')
      setSelectTab('history')
      setSelectedPost(null)
    }
  }

  return (
    <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="screen-title">
            Instagram <span className="screen-title__rest">Carousel Generator</span>
          </h1>
          <p className="mt-3 text-[15px] text-muted">
            Transform your Instagram posts into professional carousels
          </p>
        </div>

        <div className="mb-8">
          <IgeoConnectionPanel compact />
        </div>

        {/* Phase Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {(['select', 'review', 'progress', 'results'] as Phase[]).map((p, idx) => (
              <div
                key={p}
                className={`flex items-center ${idx < 3 ? 'flex-1' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${
                    phase === p
                      ? 'bg-button text-button-ink'
                      : idx < ['select', 'review', 'progress', 'results'].indexOf(phase)
                      ? 'bg-accent text-button-ink'
                      : 'bg-paper-soft text-muted'
                  }`}
                >
                  {idx + 1}
                </div>
                <span className="ml-2 hidden text-sm font-medium text-ink capitalize sm:inline">
                  {p}
                </span>
                {idx < 3 && (
                  <div className="mx-2 h-1 flex-1 bg-paper-soft sm:mx-4">
                    <div
                      className={`h-full ${
                        idx < ['select', 'review', 'progress', 'results'].indexOf(phase)
                          ? 'bg-accent'
                          : ''
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-surface rounded-lg shadow">
          {phase === 'select' && (
            <>
              <div className="flex border-b border-line px-6 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectTab('new')}
                  className={`mr-6 border-b pb-3 font-mono text-[12px] font-medium tracking-[0.12em] uppercase ${
                    selectTab === 'new'
                      ? 'border-ink text-ink'
                      : 'border-transparent text-muted-dark hover:text-ink'
                  }`}
                >
                  New carousel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectTab('history')}
                  className={`border-b pb-3 font-mono text-[12px] font-medium tracking-[0.12em] uppercase ${
                    selectTab === 'history'
                      ? 'border-ink text-ink'
                      : 'border-transparent text-muted-dark hover:text-ink'
                  }`}
                >
                  History
                  {generationList.length > 0 ? ` (${generationList.length})` : ''}
                </button>
              </div>

              {selectTab === 'new' && (
                <>
                  {resumable && (
                    <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
                      <p className="text-sm font-medium text-amber-900">
                        Unfinished carousel
                        {resumable.post_prompt ? `: “${resumable.post_prompt}”` : ''}
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        Stopped after step {resumable.steps_completed} of 8. Resume skips
                        image generation and continues from step {(resumable.steps_completed || 0) + 1}.
                      </p>
                      <button
                        type="button"
                        onClick={handleResumeLast}
                        className="mt-3 rounded-md bg-button px-4 py-2 text-sm font-medium text-button-ink hover:bg-button"
                      >
                        Resume from step {(resumable.steps_completed || 0) + 1}
                      </button>
                    </div>
                  )}
                  <SelectPostPhase
                    posts={postsQuery.data}
                    isLoading={postsQuery.isLoading}
                    error={postsQuery.error}
                    onSelect={handleSelectPost}
                  />
                </>
              )}

              {selectTab === 'history' && (
                <HistoryPhase
                  generations={generationList}
                  isLoading={generationsQuery.isLoading}
                  error={generationsQuery.error}
                  onOpen={handleOpenGeneration}
                />
              )}
            </>
          )}

          {phase === 'review' && selectedPost && (
            <ReviewPhase
              post={selectedPost}
              brandHub={brandHubQuery.data}
              brandHubLoading={brandHubQuery.isLoading}
              brandHubError={brandHubQuery.error}
              onBack={handleBack}
              onConfirm={handleStartGeneration}
            />
          )}

          {phase === 'progress' && (
            <ProgressPhase
              progress={carouselGen.progress}
              currentStep={
                carouselGen.currentStep ||
                (carouselGen.isGenerating ? 'fetching_input' : null)
              }
              error={
                carouselGen.isResuming
                  ? null
                  : carouselGen.failedMessage
                    ? new Error(carouselGen.failedMessage)
                    : carouselGen.generationError && !carouselGen.generationId
                      ? carouselGen.generationError
                      : null
              }
              onResume={
                carouselGen.generationId
                  ? () => carouselGen.resumeGeneration(carouselGen.generationId!)
                  : undefined
              }
            />
          )}

          {phase === 'results' && (
            carouselGen.status ? (
              <ResultsPhase
                status={carouselGen.status}
                generationId={carouselGen.generationId}
                onBack={handleBack}
                onRegenerateVisuals={
                  carouselGen.generationId
                    ? () => {
                        setPhase('progress')
                        carouselGen.resumeGeneration(carouselGen.generationId!)
                      }
                    : undefined
                }
              />
            ) : (
              <div className="p-8 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-accent" />
                <p className="mt-4 text-muted">Loading generation…</p>
              </div>
            )
          )}
        </div>
    </div>
  )
}

function firstImageUrl(urls: string[] | null | undefined): string | null {
  if (!Array.isArray(urls)) return null
  return (
    urls.find(
      (url) =>
        typeof url === 'string' &&
        (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/api/carousel/assets/')),
    ) || null
  )
}

function statusLabel(status: CarouselGenerationSummary['status']) {
  if (status === 'completed') return { text: 'Completed', className: 'bg-green-100 text-green-800' }
  if (status === 'failed') return { text: 'Failed', className: 'bg-red-100 text-red-800' }
  if (status === 'running') return { text: 'In progress', className: 'bg-blue-100 text-blue-800' }
  return { text: 'Pending', className: 'bg-paper-soft text-ink' }
}

function HistoryPhase({
  generations,
  isLoading,
  error,
  onOpen,
}: {
  generations: CarouselGenerationSummary[]
  isLoading: boolean
  error: Error | null
  onOpen: (generation: CarouselGenerationSummary) => void
}) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-accent" />
        <p className="mt-4 text-muted">Loading history…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="font-medium text-red-600">Could not load history</p>
        <p className="mt-2 text-sm text-muted">{error.message}</p>
      </div>
    )
  }

  if (generations.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink font-medium">No carousels yet</p>
        <p className="mt-2 text-sm text-muted-dark">
          Generate a carousel from the New carousel tab and it will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Generation history</h2>
      <p className="text-sm text-muted mb-4">
        Open a completed carousel, or continue one that failed.
      </p>
      <div className="space-y-4">
        {generations.map((generation) => {
          const thumb = firstImageUrl(generation.image_urls)
          const badge = statusLabel(generation.status)
          const created = generation.created_at
            ? new Date(generation.created_at).toLocaleString()
            : ''
          const action =
            generation.status === 'completed'
              ? 'View'
              : generation.status === 'failed'
                ? 'Resume'
                : 'Open'

          return (
            <div
              key={generation.id}
              className="flex items-start gap-4 rounded-lg border p-4 hover:bg-paper-soft"
            >
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-paper-soft">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-dark">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink truncate">
                  {generation.post_prompt || 'Untitled carousel'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-dark">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.text}
                  </span>
                  <span>Step {generation.steps_completed || 0}/8</span>
                  {created && <span>{created}</span>}
                </div>
                {generation.status === 'failed' && generation.error && (
                  <p className="mt-1 text-xs text-red-600 line-clamp-2">{generation.error}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpen(generation)}
                className="flex-shrink-0 rounded-md bg-button px-4 py-2 text-sm font-medium text-button-ink hover:bg-button"
              >
                {action}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Phase 1: Select Post
function SelectPostPhase({
  posts,
  isLoading,
  error,
  onSelect,
}: {
  posts: any
  isLoading: boolean
  error: Error | null
  onSelect: (post: SelectedPost) => void
}) {
  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto" />
        <p className="mt-4 text-muted">Loading today's posts...</p>
      </div>
    )
  }

  if (error) {
    const notConnected =
      (error as Error & { code?: string }).code === 'MCP_NOT_CONNECTED' ||
      error.message.toLowerCase().includes('not connected to igeo mcp')

    return (
      <div className="p-8 text-center">
        {notConnected ? (
          <>
            <p className="text-ink font-medium">Connect iGEO to load posts</p>
            <p className="mt-2 text-sm text-muted-dark">
              Paste the full iGEO MCP URL in the panel above. It looks like
              https://api.igeo.ai/mcp?mcp_token=…&workspace_id=…
            </p>
          </>
        ) : (
          <>
            <div className="text-red-600 mb-4">Error loading posts</div>
            <p className="text-muted">{error.message}</p>
          </>
        )}
      </div>
    )
  }

  const postList = posts?.posts || []

  if (postList.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-dark mb-4">📭</div>
        <p className="text-muted">No Instagram posts found from the last 14 days.</p>
        <p className="mt-2 text-sm text-muted-dark">
          Generate some posts in iGEO first, then come back here.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Select an Instagram Post</h2>
      <p className="text-sm text-muted mb-4">
        Showing {postList.length} Instagram post{postList.length !== 1 ? 's' : ''} from the last 14 days
      </p>
      <div className="space-y-4">
        {postList.map((post: any) => (
          <div
            key={post.id}
            className="border rounded-lg p-4 hover:bg-paper-soft cursor-pointer transition"
            onClick={() => onSelect(post)}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-ink">{post.prompt}</h3>
                <p className="mt-1 text-sm text-muted line-clamp-2">
                  {post.body}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-dark">
                  <span>Topic: {post.topic}</span>
                  <span>
                    Created: {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button className="self-start rounded-md bg-button px-4 py-2 text-button-ink transition hover:bg-button sm:ml-4">
                Select
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Phase 2: Review Configuration
function ReviewPhase({
  post,
  brandHub,
  brandHubLoading,
  brandHubError,
  onBack,
  onConfirm,
}: {
  post: SelectedPost
  brandHub: BrandHubData | undefined
  brandHubLoading: boolean
  brandHubError: Error | null
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Review Configuration</h2>
      
      <div className="space-y-6">
        {/* Selected Post */}
        <div>
          <h3 className="text-sm font-medium text-ink mb-2">Selected Post</h3>
          <div className="bg-paper-soft rounded-lg p-4">
            <p className="font-medium">{post.prompt}</p>
            <p className="mt-2 text-sm text-muted">{post.body}</p>
          </div>
        </div>

        {/* BrandHub Summary from iGEO MCP */}
        <div>
          <h3 className="text-sm font-medium text-ink mb-2">BrandHub Guidelines</h3>
          <div className="bg-paper-soft rounded-lg p-4">
            {brandHubLoading && <p className="text-sm text-muted-dark">Loading BrandHub from iGEO…</p>}
            {brandHubError && (
              <p className="text-sm text-red-600">Could not load BrandHub: {brandHubError.message}</p>
            )}
            {brandHub && (
              <div className="space-y-4 text-sm">
                {brandHub.about && (
                  <p className="text-ink">{brandHub.about}</p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="text-muted-dark">Tone of voice</span>
                    <p className="mt-1 text-ink">
                      {brandHub.toneOfVoice.length
                        ? brandHub.toneOfVoice.join(', ')
                        : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-dark">Brand colors</span>
                    {brandHub.brandColors.length ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {brandHub.brandColors.map((color, index) => (
                          <div key={`${color.hex}-${index}`} className="flex items-center gap-2">
                            <div
                              className="h-7 w-7 rounded border border-black/10 "
                              style={{ backgroundColor: color.hex }}
                              title={color.name || color.hex}
                            />
                            <span className="text-xs text-muted">
                              {color.name || color.hex}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-ink">Not configured</p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-dark">Values</span>
                    <p className="mt-1 text-ink">
                      {brandHub.values.length ? brandHub.values.join(', ') : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-dark">Personality</span>
                    <p className="mt-1 text-ink">
                      {brandHub.personality.length
                        ? brandHub.personality.join(', ')
                        : 'Not configured'}
                    </p>
                  </div>
                </div>
                {(brandHub.postGuidelines.dos.length > 0 ||
                  brandHub.postGuidelines.donts.length > 0) && (
                  <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                    <div>
                      <span className="font-medium text-green-700">Do</span>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                        {brandHub.postGuidelines.dos.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-700">Don’t</span>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink">
                        {brandHub.postGuidelines.donts.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* What will happen */}
        <div>
          <h3 className="text-sm font-medium text-ink mb-2">Generation Process</h3>
          <div className="bg-paper-soft rounded-lg p-4">
            <ul className="space-y-2 text-sm text-ink">
              <li>✓ Step 1: Choose carousel content plan</li>
              <li>✓ Step 2: Define visual style direction</li>
              <li>✓ Step 3: Select visual templates</li>
              <li>✓ Step 4: Apply BrandHub guidelines</li>
              <li>✓ Step 5: Format Instagram caption</li>
              <li>✓ Step 6: Generate text-free visuals</li>
              <li>✓ Step 7: Design text layouts</li>
              <li>✓ Step 8: Assemble in Figma</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-line rounded-md hover:bg-paper-soft transition"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-6 py-2 bg-button text-button-ink rounded-md hover:bg-button transition"
        >
          Generate Carousel
        </button>
      </div>
    </div>
  )
}

// Phase 3: Progress
function ProgressPhase({
  progress,
  currentStep,
  error,
  onResume,
}: {
  progress: any
  currentStep: string | null
  error: Error | null
  onResume?: () => void
}) {
  const steps = [
    { key: 'step_1_carousel_plan', label: 'Content planning' },
    { key: 'step_2_visual_direction', label: 'Visual style direction' },
    { key: 'step_3_templates', label: 'Selecting templates' },
    { key: 'step_4_brandhub', label: 'Applying brand guidelines' },
    { key: 'step_5_caption', label: 'Formatting Instagram caption' },
    { key: 'step_6_visuals', label: 'Generating visuals (GPT Image 2)' },
    { key: 'step_7_text_layout', label: 'Designing text layouts' },
    { key: 'step_8_figma_assembly', label: 'Assembling in Figma' },
  ]

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-4 text-4xl">❌</div>
        <h3 className="text-xl font-semibold text-ink mb-2">Generation Failed</h3>
        <p className="text-muted mb-4">{error.message}</p>
        {onResume && (progress?.current || 0) >= 1 && (
          <button
            type="button"
            onClick={onResume}
            className="px-6 py-2 bg-button text-button-ink rounded-md hover:bg-button transition"
          >
            Resume from step {(progress?.current || 0) + 1}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Generating Carousel</h2>
      
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted mb-2">
          <span>Progress</span>
          <span>{progress?.percentage || 0}%</span>
        </div>
        <div className="w-full bg-paper-soft rounded-full h-2">
          <div
            className="bg-button h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress?.percentage || 0}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const mappedStep =
            currentStep === 'fetching_input' ? 'step_1_carousel_plan' : currentStep
          const isActive = step.key === mappedStep
          const isComplete = (progress?.current || 0) > idx
          
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                isActive ? 'bg-paper-soft' : isComplete ? 'bg-paper-soft' : 'bg-paper-soft'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-button text-button-ink'
                    : isComplete
                    ? 'bg-accent text-button-ink'
                    : 'bg-paper-soft text-muted'
                }`}
              >
                {isComplete ? '✓' : idx + 1}
              </div>
              <span className="flex-1 text-sm font-medium">{step.label}</span>
              {isActive && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Phase 4: Results
function ResultsPhase({
  status,
  generationId,
  onBack,
  onRegenerateVisuals,
}: {
  status: any
  generationId: string | null
  onBack: () => void
  onRegenerateVisuals?: () => void
}) {
  const [copiedCaption, setCopiedCaption] = useState(false)
  const [copiedImportCode, setCopiedImportCode] = useState(false)
  
  const createFigmaJobMutation = useCreateFigmaJob()
  const figmaJobQuery = useFigmaJobStatus(generationId, !!generationId)
  
  const imageCount = Array.isArray(status.image_urls)
    ? status.image_urls.filter((url: string) => typeof url === 'string' && (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/api/carousel/assets/'))).length
    : 0
  const incomplete = imageCount === 0

  const handleCopyCaption = () => {
    if (status.final_caption) {
      navigator.clipboard.writeText(status.final_caption)
      setCopiedCaption(true)
      setTimeout(() => setCopiedCaption(false), 2000)
    }
  }
  
  const handleCreateFigmaJob = () => {
    if (!generationId) return
    createFigmaJobMutation.mutate(generationId)
  }
  
  const handleCopyImportCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedImportCode(true)
    setTimeout(() => setCopiedImportCode(false), 2000)
  }
  
  const figmaJob = figmaJobQuery.data ?? null
  const figmaJobCompleted = figmaJob?.status === 'completed'
  const figmaJobFailed = figmaJob?.status === 'failed'
  const importCode = createFigmaJobMutation.data?.importCode
  const figmaJobImporting =
    (figmaJob?.status === 'importing' || figmaJob?.status === 'claimed') && !importCode
  const showCreateJob =
    !figmaJobCompleted &&
    !figmaJobImporting &&
    !importCode &&
    !createFigmaJobMutation.isPending
  const exportedSlideUrls = figmaJob?.exported_slide_urls ?? []
  const hasExportedSlides = Boolean(figmaJobCompleted && exportedSlideUrls.length > 0)

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <div className={`${incomplete ? 'text-amber-500' : figmaJobCompleted ? 'text-accent' : 'text-accent'} mb-4 text-4xl`}>
          {incomplete ? '⚠' : figmaJobCompleted ? '✓' : '📝'}
        </div>
        <h2 className="text-2xl font-semibold text-ink">
          {incomplete 
            ? 'Caption ready — slides are missing' 
            : figmaJobCompleted
              ? 'Carousel Complete in Figma!'
              : 'Carousel Generated — Ready for Figma'}
        </h2>
        <p className="text-muted mt-2">
          {incomplete
            ? 'The caption was saved, but slide images were not kept on disk. Generate visuals to finish this carousel.'
            : figmaJobCompleted
              ? 'Your carousel has been assembled in Figma with exported slides'
              : 'Creative generation complete. Send to Figma to create editable frames.'}
        </p>
        {incomplete && onRegenerateVisuals && (
          <button
            type="button"
            onClick={onRegenerateVisuals}
            className="mt-4 px-6 py-2 bg-button text-button-ink rounded-md hover:bg-button"
          >
            Generate missing slide images
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Instagram Caption */}
        {status.final_caption && (
          <div>
            <h3 className="text-sm font-medium text-ink mb-2">Instagram Caption</h3>
            <div className="bg-paper-soft rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{status.final_caption}</p>
              <button
                onClick={handleCopyCaption}
                className="mt-3 px-4 py-2 bg-button text-button-ink rounded-md hover:bg-button transition text-sm"
              >
                {copiedCaption ? 'Copied!' : 'Copy Caption'}
              </button>
            </div>
          </div>
        )}
        
        {/* Figma Import Section */}
        {!incomplete && (
          <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
            <h3 className="text-sm font-medium text-purple-900 mb-2">Figma Import</h3>
            
            {showCreateJob && (
              <div>
                <p className="text-sm text-purple-700 mb-3">
                  Alora does not create a Figma file by itself. Click Send to Figma, then paste the
                  import code into the Alora plugin in Figma Desktop.
                </p>
                <button
                  onClick={handleCreateFigmaJob}
                  className="px-4 py-2 bg-button text-button-ink rounded-md hover:bg-button transition text-sm"
                >
                  Send to Figma →
                </button>
                <p className="text-xs text-purple-700 mt-3">
                  Plugin setup: in Figma Desktop, Plugins → Development → Import plugin from manifest
                  → select <code>figma-plugin/dist/manifest.json</code>. Then run Alora Carousel Importer.
                </p>
              </div>
            )}
            
            {(createFigmaJobMutation.isPending || importCode) && !figmaJobImporting && !figmaJobCompleted && !figmaJobFailed && (
              <div className="bg-surface rounded p-4">
                <p className="text-sm font-medium text-ink mb-2">Import Code (expires in 24 hours):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-paper-soft rounded border border-line text-lg font-mono">
                    {importCode || '...'}
                  </code>
                  {importCode && (
                    <button
                      onClick={() => handleCopyImportCode(importCode)}
                      className="px-3 py-2 bg-paper-soft text-ink rounded hover:bg-paper-soft text-sm"
                    >
                      {copiedImportCode ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                <ol className="mt-3 list-decimal pl-4 text-xs text-muted space-y-1">
                  <li>Open Figma Desktop and the file where you want the carousel.</li>
                  <li>Run Plugins → Development → Alora Carousel Importer.</li>
                  <li>Paste this code and click Import Carousel.</li>
                </ol>
              </div>
            )}
            
            {createFigmaJobMutation.isError && (
              <p className="mt-2 text-sm text-red-600">{createFigmaJobMutation.error.message}</p>
            )}
            
            {figmaJobImporting && (
              <div className="bg-surface rounded p-4">
                <div className="flex items-center gap-2 text-purple-700">
                  <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium">Importing to Figma...</span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Status: {figmaJob?.status}. If the plugin failed, generate a new code.
                </p>
                <button
                  type="button"
                  onClick={handleCreateFigmaJob}
                  disabled={createFigmaJobMutation.isPending}
                  className="mt-3 px-3 py-1.5 bg-button text-button-ink rounded text-sm hover:bg-button disabled:opacity-50"
                >
                  {createFigmaJobMutation.isPending ? 'Creating…' : 'Get a new import code'}
                </button>
              </div>
            )}
            
            {figmaJobFailed && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-sm font-medium text-red-900">Import failed</p>
                <p className="text-xs text-red-700 mt-1">{figmaJob?.error}</p>
                <button
                  onClick={handleCreateFigmaJob}
                  className="mt-2 px-3 py-1 bg-error text-button-ink rounded text-sm hover:bg-error"
                >
                  Retry
                </button>
              </div>
            )}
            
            {figmaJobCompleted && figmaJob?.figma_file_url && (
              <div className="bg-surface rounded p-4">
                <p className="text-sm font-medium text-green-900 mb-2">✓ Imported successfully!</p>
                <a
                  href={figmaJob.figma_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-button text-button-ink rounded-md hover:bg-button transition text-sm"
                >
                  Open in Figma →
                </a>
              </div>
            )}
          </div>
        )}

        {/* Raw Generated Images (from Step 6) */}
        {!hasExportedSlides && status.image_urls && status.image_urls.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-ink mb-2">
              Raw Visual Assets ({status.image_urls.length})
            </h3>
            <p className="text-xs text-muted-dark mb-2">These are the generated backgrounds before Figma assembly</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {status.image_urls.map((url: string, idx: number) => (
                <div key={idx} className="aspect-square bg-paper-soft rounded-lg overflow-hidden">
                  <img
                    src={url}
                    alt={`Raw asset ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Final Exported Slides (from Figma) */}
        {hasExportedSlides && (
          <div>
            <h3 className="text-sm font-medium text-ink mb-2">
              Final Carousel Slides ({exportedSlideUrls.length})
            </h3>
            <p className="text-xs text-muted-dark mb-2">Exported from Figma with text overlays and branding</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exportedSlideUrls.map((slide: { slideIndex: number; url: string }) => (
                <div key={slide.slideIndex} className="aspect-square bg-paper-soft rounded-lg overflow-hidden">
                  <img
                    src={slide.url}
                    alt={`Slide ${slide.slideIndex}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Figma Link (legacy fallback) */}
        {!figmaJobCompleted && isFigmaFileUrl(status.figma_file_url) && (
          <div>
            <h3 className="text-sm font-medium text-ink mb-2">Figma File</h3>
            <a
              href={status.figma_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-button text-button-ink rounded-md hover:bg-button transition"
            >
              Open in Figma →
            </a>
          </div>
        )}
      </div>

      <div className="mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-paper-soft text-ink rounded-md hover:bg-paper-soft transition"
        >
          Generate Another Carousel
        </button>
      </div>
    </div>
  )
}
