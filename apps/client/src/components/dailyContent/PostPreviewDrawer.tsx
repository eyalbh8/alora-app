import { useEffect, useMemo, useState } from 'react'
import { PageLoader } from '../loading'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import type { DailyContentPost } from '../../api/dailyContent'
import { BlogPostPreview } from './BlogPostPreview'
import { PostImageControls } from './PostImageControls'
import { PublishBar } from './PublishBar'
import { SocialPostCard } from './SocialPostCard'

function statusTone(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'OPTIMIZED':
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-800'
    case 'FAILED':
      return 'bg-red-50 text-red-800'
    case 'SKIPPED':
    case 'PARTIAL':
      return 'bg-amber-50 text-amber-900'
    case 'OPTIMIZING':
    case 'GENERATING':
    case 'PENDING':
    case 'GENERATED':
      return 'bg-blue-50 text-blue-800'
    default:
      return 'bg-[var(--chip)] text-[var(--ink-soft)]'
  }
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone(status)}`}
    >
      {status}
    </span>
  )
}

type PostPreviewDrawerProps = {
  runId: string
  posts: DailyContentPost[]
  promptText?: string | null
  localDate?: string | null
  initialPlatform?: string | null
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  onClose: () => void
}

export function PostPreviewDrawer({
  runId,
  posts,
  promptText,
  localDate,
  initialPlatform = null,
  isLoading = false,
  error,
  onRetry,
  onClose,
}: PostPreviewDrawerProps) {
  const [activePlatform, setActivePlatform] = useState<string | null>(
    initialPlatform,
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!posts.length) {
      setActivePlatform(null)
      return
    }
    setActivePlatform((current) => {
      if (initialPlatform && posts.some((p) => p.platform === initialPlatform)) {
        return initialPlatform
      }
      if (current && posts.some((p) => p.platform === current)) return current
      return posts[0]?.platform ?? null
    })
  }, [posts, initialPlatform])

  const activePost = useMemo(
    () => posts.find((p) => p.platform === activePlatform) ?? posts[0] ?? null,
    [posts, activePlatform],
  )

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-ink/30"
        aria-label="Close posts viewer"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-4xl flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--card-shadow)]"
        role="dialog"
        aria-modal="true"
        aria-label="Run posts"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Run posts
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink)] line-clamp-2">
              {promptText || 'Generated posts'}
            </h2>
            {localDate ? (
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{localDate}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--ink)]"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? <PageLoader /> : null}
          {error ? (
            <ErrorState
              message={error instanceof Error ? error.message : String(error)}
              onRetry={onRetry}
            />
          ) : null}
          {!isLoading && !error && posts.length === 0 ? (
            <EmptyState
              title="No posts found"
              message="This run has no fetchable posts yet."
            />
          ) : null}

          {posts.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {posts.map((post) => (
                  <button
                    key={post.postId}
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      activePost?.postId === post.postId
                        ? 'bg-[var(--accent)] text-white'
                        : 'border border-[var(--line)] bg-white text-[var(--ink-soft)]'
                    }`}
                    onClick={() => setActivePlatform(post.platform)}
                  >
                    {post.platform}
                  </button>
                ))}
              </div>

              {activePost ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      status={
                        activePost.isPublished || activePost.state === 'POSTED'
                          ? 'POSTED'
                          : activePost.state || 'UNKNOWN'
                      }
                    />
                    {activePost.selected ? (
                      <span className="text-xs font-medium text-emerald-700">Selected</span>
                    ) : null}
                    <span className="font-mono text-[10px] text-[var(--muted)]">
                      {activePost.postId}
                    </span>
                  </div>

                  <PostImageControls runId={runId} post={activePost} />

                  {activePost.platform === 'BLOG' ? (
                    <BlogPostPreview runId={runId} post={activePost} />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <PublishBar runId={runId} post={activePost} />
                      <SocialPostCard post={activePost} />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
