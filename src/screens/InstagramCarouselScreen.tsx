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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Instagram Carousel Generator
          </h1>
          <p className="mt-2 text-sm text-gray-600">
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
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    phase === p
                      ? 'bg-blue-600 text-white'
                      : idx < ['select', 'review', 'progress', 'results'].indexOf(phase)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {idx + 1}
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700 capitalize">
                  {p}
                </span>
                {idx < 3 && (
                  <div className="flex-1 h-1 mx-4 bg-gray-300">
                    <div
                      className={`h-full ${
                        idx < ['select', 'review', 'progress', 'results'].indexOf(phase)
                          ? 'bg-green-500'
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
        <div className="bg-white rounded-lg shadow">
          {phase === 'select' && (
            <>
              <div className="flex border-b border-gray-200 px-6 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectTab('new')}
                  className={`mr-6 border-b-2 pb-3 text-sm font-medium ${
                    selectTab === 'new'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  New carousel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectTab('history')}
                  className={`border-b-2 pb-3 text-sm font-medium ${
                    selectTab === 'history'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
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
                        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
                <p className="mt-4 text-gray-600">Loading generation…</p>
              </div>
            )
          )}
        </div>
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
  return { text: 'Pending', className: 'bg-gray-100 text-gray-700' }
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
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="mt-4 text-gray-600">Loading history…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="font-medium text-red-600">Could not load history</p>
        <p className="mt-2 text-sm text-gray-600">{error.message}</p>
      </div>
    )
  }

  if (generations.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-700 font-medium">No carousels yet</p>
        <p className="mt-2 text-sm text-gray-500">
          Generate a carousel from the New carousel tab and it will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Generation history</h2>
      <p className="text-sm text-gray-600 mb-4">
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
              className="flex items-start gap-4 rounded-lg border p-4 hover:bg-gray-50"
            >
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">
                  {generation.post_prompt || 'Untitled carousel'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
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
                className="flex-shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600">Loading today's posts...</p>
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
            <p className="text-gray-700 font-medium">Connect iGEO to load posts</p>
            <p className="mt-2 text-sm text-gray-500">
              Paste the full iGEO MCP URL in the panel above. It looks like
              https://api.igeo.ai/mcp?mcp_token=…&workspace_id=…
            </p>
          </>
        ) : (
          <>
            <div className="text-red-600 mb-4">Error loading posts</div>
            <p className="text-gray-600">{error.message}</p>
          </>
        )}
      </div>
    )
  }

  const postList = posts?.posts || []

  if (postList.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-400 mb-4">📭</div>
        <p className="text-gray-600">No Instagram posts found from the last 14 days.</p>
        <p className="mt-2 text-sm text-gray-500">
          Generate some posts in iGEO first, then come back here.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Select an Instagram Post</h2>
      <p className="text-sm text-gray-600 mb-4">
        Showing {postList.length} Instagram post{postList.length !== 1 ? 's' : ''} from the last 14 days
      </p>
      <div className="space-y-4">
        {postList.map((post: any) => (
          <div
            key={post.id}
            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
            onClick={() => onSelect(post)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{post.prompt}</h3>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {post.body}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>Topic: {post.topic}</span>
                  <span>
                    Created: {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
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
          <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Post</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium">{post.prompt}</p>
            <p className="mt-2 text-sm text-gray-600">{post.body}</p>
          </div>
        </div>

        {/* BrandHub Summary from iGEO MCP */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">BrandHub Guidelines</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            {brandHubLoading && <p className="text-sm text-gray-500">Loading BrandHub from iGEO…</p>}
            {brandHubError && (
              <p className="text-sm text-red-600">Could not load BrandHub: {brandHubError.message}</p>
            )}
            {brandHub && (
              <div className="space-y-4 text-sm">
                {brandHub.about && (
                  <p className="text-gray-700">{brandHub.about}</p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <span className="text-gray-500">Tone of voice</span>
                    <p className="mt-1 text-gray-900">
                      {brandHub.toneOfVoice.length
                        ? brandHub.toneOfVoice.join(', ')
                        : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Brand colors</span>
                    {brandHub.brandColors.length ? (
                      <div className="mt-2 flex flex-wrap gap-3">
                        {brandHub.brandColors.map((color, index) => (
                          <div key={`${color.hex}-${index}`} className="flex items-center gap-2">
                            <div
                              className="h-7 w-7 rounded border border-black/10 shadow-sm"
                              style={{ backgroundColor: color.hex }}
                              title={color.name || color.hex}
                            />
                            <span className="text-xs text-gray-600">
                              {color.name || color.hex}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-gray-900">Not configured</p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500">Values</span>
                    <p className="mt-1 text-gray-900">
                      {brandHub.values.length ? brandHub.values.join(', ') : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Personality</span>
                    <p className="mt-1 text-gray-900">
                      {brandHub.personality.length
                        ? brandHub.personality.join(', ')
                        : 'Not configured'}
                    </p>
                  </div>
                </div>
                {(brandHub.postGuidelines.dos.length > 0 ||
                  brandHub.postGuidelines.donts.length > 0) && (
                  <div className="grid gap-4 border-t border-gray-200 pt-4 md:grid-cols-2">
                    <div>
                      <span className="font-medium text-green-700">Do</span>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-700">
                        {brandHub.postGuidelines.dos.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-700">Don’t</span>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-700">
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
          <h3 className="text-sm font-medium text-gray-700 mb-2">Generation Process</h3>
          <div className="bg-blue-50 rounded-lg p-4">
            <ul className="space-y-2 text-sm text-gray-700">
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
          className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
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
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Generation Failed</h3>
        <p className="text-gray-600 mb-4">{error.message}</p>
        {onResume && (progress?.current || 0) >= 1 && (
          <button
            type="button"
            onClick={onResume}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
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
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{progress?.percentage || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
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
                isActive ? 'bg-blue-50' : isComplete ? 'bg-green-50' : 'bg-gray-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isComplete
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {isComplete ? '✓' : idx + 1}
              </div>
              <span className="flex-1 text-sm font-medium">{step.label}</span>
              {isActive && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
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
        <div className={`${incomplete ? 'text-amber-500' : figmaJobCompleted ? 'text-green-600' : 'text-blue-600'} mb-4 text-4xl`}>
          {incomplete ? '⚠' : figmaJobCompleted ? '✓' : '📝'}
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">
          {incomplete 
            ? 'Caption ready — slides are missing' 
            : figmaJobCompleted
              ? 'Carousel Complete in Figma!'
              : 'Carousel Generated — Ready for Figma'}
        </h2>
        <p className="text-gray-600 mt-2">
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
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Generate missing slide images
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Instagram Caption */}
        {status.final_caption && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Instagram Caption</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{status.final_caption}</p>
              <button
                onClick={handleCopyCaption}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm"
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
              <div className="bg-white rounded p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Import Code (expires in 24 hours):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 rounded border border-gray-300 text-lg font-mono">
                    {importCode || '...'}
                  </code>
                  {importCode && (
                    <button
                      onClick={() => handleCopyImportCode(importCode)}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                    >
                      {copiedImportCode ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                <ol className="mt-3 list-decimal pl-4 text-xs text-gray-600 space-y-1">
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
              <div className="bg-white rounded p-4">
                <div className="flex items-center gap-2 text-purple-700">
                  <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
                  <span className="text-sm font-medium">Importing to Figma...</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Status: {figmaJob?.status}. If the plugin failed, generate a new code.
                </p>
                <button
                  type="button"
                  onClick={handleCreateFigmaJob}
                  disabled={createFigmaJobMutation.isPending}
                  className="mt-3 px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
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
                  className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}
            
            {figmaJobCompleted && figmaJob?.figma_file_url && (
              <div className="bg-white rounded p-4">
                <p className="text-sm font-medium text-green-900 mb-2">✓ Imported successfully!</p>
                <a
                  href={figmaJob.figma_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm"
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
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Raw Visual Assets ({status.image_urls.length})
            </h3>
            <p className="text-xs text-gray-500 mb-2">These are the generated backgrounds before Figma assembly</p>
            <div className="grid grid-cols-3 gap-4">
              {status.image_urls.map((url: string, idx: number) => (
                <div key={idx} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
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
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Final Carousel Slides ({exportedSlideUrls.length})
            </h3>
            <p className="text-xs text-gray-500 mb-2">Exported from Figma with text overlays and branding</p>
            <div className="grid grid-cols-3 gap-4">
              {exportedSlideUrls.map((slide: { slideIndex: number; url: string }) => (
                <div key={slide.slideIndex} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
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
            <h3 className="text-sm font-medium text-gray-700 mb-2">Figma File</h3>
            <a
              href={status.figma_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
            >
              Open in Figma →
            </a>
          </div>
        )}
      </div>

      <div className="mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
        >
          Generate Another Carousel
        </button>
      </div>
    </div>
  )
}
