import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Send } from 'lucide-react'
import { PageLoader } from '../components/loading'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import {
  PostPreviewDrawer,
  StatusPill,
} from '../components/dailyContent/PostPreviewDrawer'
import type { DailyContentPost, PublishPlatformResult } from '../api/dailyContent'
import { stripUnsplashCredit } from '../lib/blogHtml'
import {
  useDailyContentDayPosts,
  useDailyContentDays,
  useDailyContentPublishTargets,
  usePublishDailyContentPost,
  usePublishDailyContentRun,
} from '../hooks/use-daily-content-runs'

const PLATFORM_DOT: Record<string, string> = {
  BLOG: '#2d4f9e',
  LINKEDIN: '#0a66c2',
  FACEBOOK: '#1877F3',
  INSTAGRAM: '#dd2a7b',
  X: '#111111',
}

function postExcerpt(post: DailyContentPost): string {
  if (post.platform === 'BLOG' && post.title) return post.title
  if (post.title) return post.title
  const body = stripUnsplashCredit(post.body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!body) return 'Untitled post'
  return body.length > 120 ? `${body.slice(0, 117)}…` : body
}

function RowPublishButton({
  runId,
  post,
  connected,
  statusesAvailable,
  onOpenDrawer,
}: {
  runId: string
  post: DailyContentPost
  connected: boolean
  statusesAvailable: boolean
  onOpenDrawer: () => void
}) {
  const publish = usePublishDailyContentPost(runId)
  const [message, setMessage] = useState<string | null>(null)
  const [liveUrl, setLiveUrl] = useState<string | null>(post.platformPostUrl ?? null)
  const published = post.isPublished || post.state === 'POSTED' || Boolean(liveUrl)
  const canTryPublish = !statusesAvailable || connected

  if (published) {
    return liveUrl ? (
      <a
        href={liveUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700"
        onClick={(e) => e.stopPropagation()}
      >
        Live <ExternalLink className="size-2.5" />
      </a>
    ) : (
      <span className="inline-flex rounded-full border border-emerald-500 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600">
        Published
      </span>
    )
  }

  if (post.platform === 'BLOG') {
    return (
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink)] disabled:opacity-50"
        disabled={!canTryPublish}
        title={
          canTryPublish
            ? 'Open preview to choose WordPress site and publish'
            : 'BLOG is not connected. Connect a WordPress site in Integrations.'
        }
        onClick={(e) => {
          e.stopPropagation()
          onOpenDrawer()
        }}
      >
        <Send className="size-3" />
        Publish
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        disabled={!canTryPublish || publish.isPending}
        title={
          canTryPublish
            ? `Publish to ${post.platform}`
            : `${post.platform} is not connected. Connect it in Integrations first.`
        }
        onClick={(e) => {
          e.stopPropagation()
          setMessage(null)
          void publish
            .mutateAsync({ postId: post.postId })
            .then((res) => {
              if (res.platformPostUrl) setLiveUrl(res.platformPostUrl)
              setMessage(res.ok ? 'Published' : res.error || 'Failed')
            })
            .catch((err) =>
              setMessage(err instanceof Error ? err.message : 'Publish failed'),
            )
        }}
      >
        <Send className="size-3" />
        {publish.isPending ? '…' : 'Publish'}
      </button>
      {message ? (
        <span
          className={`max-w-[140px] text-right text-[10px] ${
            message === 'Published' ? 'text-emerald-700' : 'text-[var(--error)]'
          }`}
        >
          {message}
        </span>
      ) : null}
    </div>
  )
}

function PublishAllBar({
  runId,
  posts,
  connected,
}: {
  runId: string
  posts: DailyContentPost[]
  connected: Record<string, boolean>
}) {
  const publishAll = usePublishDailyContentRun(runId)
  const [results, setResults] = useState<PublishPlatformResult[] | null>(null)

  const pending = posts.filter(
    (p) =>
      !(p.isPublished || p.state === 'POSTED' || p.platformPostUrl) &&
      p.platform !== 'BLOG' &&
      connected[p.platform],
  )
  const disconnected = posts.filter(
    (p) =>
      !(p.isPublished || p.state === 'POSTED' || p.platformPostUrl) &&
      p.platform !== 'BLOG' &&
      !connected[p.platform],
  )

  if (pending.length === 0 && disconnected.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">Publish all social</p>
          <p className="text-xs text-[var(--ink-soft)]">
            {pending.length
              ? `Will publish: ${pending.map((p) => p.platform).join(', ')}`
              : 'No connected social platforms ready to publish.'}
            {disconnected.length ? (
              <>
                {' '}
                Skipped (not connected): {disconnected.map((p) => p.platform).join(', ')}.{' '}
                <Link to="/integrations" className="text-[var(--accent)] underline">
                  Connect
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="button button--primary inline-flex items-center gap-1.5"
          disabled={pending.length === 0 || publishAll.isPending}
          onClick={() => {
            setResults(null)
            void publishAll
              .mutateAsync({
                platforms: pending.map((p) => p.platform),
              })
              .then((res) => setResults(res.results))
              .catch((err) =>
                setResults([
                  {
                    ok: false,
                    provider: 'ALL',
                    postId: '',
                    error: err instanceof Error ? err.message : 'Publish all failed',
                  },
                ]),
              )
          }}
        >
          <Send className="size-3.5" />
          {publishAll.isPending ? 'Publishing…' : 'Publish all'}
        </button>
      </div>
      {results ? (
        <ul className="flex flex-col gap-1 text-xs">
          {results.map((r) => (
            <li
              key={`${r.provider}-${r.postId}`}
              className={r.ok ? 'text-emerald-700' : 'text-amber-800'}
            >
              {r.provider}:{' '}
              {r.ok ? (
                r.platformPostUrl ? (
                  <a
                    href={r.platformPostUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    live post
                  </a>
                ) : (
                  'published'
                )
              ) : r.skipped ? (
                `skipped — ${r.error}`
              ) : (
                r.error || 'failed'
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ContentScreen() {
  const daysQuery = useDailyContentDays(60)
  const days = useMemo(() => daysQuery.data ?? [], [daysQuery.data])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [drawerPlatform, setDrawerPlatform] = useState<string | null>(null)

  useEffect(() => {
    if (!days.length) return
    setSelectedDate((current) => {
      if (current && days.some((d) => d.localDate === current)) return current
      return days[0]?.localDate ?? null
    })
  }, [days])

  const postsQuery = useDailyContentDayPosts(selectedDate)
  const posts = useMemo(() => postsQuery.data?.posts ?? [], [postsQuery.data?.posts])
  const run = postsQuery.data?.run ?? null
  const targets = useDailyContentPublishTargets(Boolean(selectedDate))

  const selectedIndex = useMemo(
    () => days.findIndex((d) => d.localDate === selectedDate),
    [days, selectedDate],
  )
  const canPrev = selectedIndex >= 0 && selectedIndex < days.length - 1
  const canNext = selectedIndex > 0

  const goPrev = () => {
    if (!canPrev) return
    setSelectedDate(days[selectedIndex + 1]?.localDate ?? null)
  }
  const goNext = () => {
    if (!canNext) return
    setSelectedDate(days[selectedIndex - 1]?.localDate ?? null)
  }

  const openDrawer = (platform: string) => setDrawerPlatform(platform)

  if (daysQuery.isLoading && days.length === 0) return <PageLoader />
  if (daysQuery.error) {
    return (
      <ErrorState
        message={
          daysQuery.error instanceof Error
            ? daysQuery.error.message
            : String(daysQuery.error)
        }
        onRetry={() => void daysQuery.refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="screen-title">Content</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Posts generated by daily automation for this workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] disabled:opacity-40"
            disabled={!canPrev}
            aria-label="Previous day with posts"
            onClick={goPrev}
          >
            <ChevronLeft className="size-4" />
          </button>
          <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
            Day
            <input
              type="date"
              className="rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
              value={selectedDate || ''}
              list="content-run-days"
              onChange={(e) => {
                const value = e.target.value
                if (!value) return
                if (days.some((d) => d.localDate === value)) {
                  setSelectedDate(value)
                }
              }}
            />
            <datalist id="content-run-days">
              {days.map((d) => (
                <option key={d.localDate} value={d.localDate} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] disabled:opacity-40"
            disabled={!canNext}
            aria-label="Next day with posts"
            onClick={goNext}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {run?.promptText ? (
        <p className="text-sm text-[var(--ink-soft)]">
          <span className="font-medium text-[var(--ink)]">Prompt:</span> {run.promptText}
        </p>
      ) : null}

      {run?.id && posts.length > 0 ? (
        <PublishAllBar
          runId={run.id}
          posts={posts}
          connected={targets.data?.connected ?? {}}
        />
      ) : null}

      {days.length === 0 ? (
        <EmptyState
          title="No content yet"
          message="Posts appear here after a daily automation run completes for this workspace."
        />
      ) : postsQuery.isLoading && posts.length === 0 ? (
        <PageLoader />
      ) : postsQuery.error ? (
        <ErrorState
          message={
            postsQuery.error instanceof Error
              ? postsQuery.error.message
              : String(postsQuery.error)
          }
          onRetry={() => void postsQuery.refetch()}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="No posts for this day"
          message="No posts were generated for this day."
        />
      ) : (
        <div className={`table-bleed${postsQuery.isFetching ? ' opacity-70' : ''}`}>
          <div className="table-bleed__scroll">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-soft">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[12px] font-medium text-muted">
                    Platform
                  </th>
                  <th className="min-w-0 px-4 py-3 text-left text-[12px] font-medium text-muted">
                    Title / excerpt
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[12px] font-medium text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[12px] font-medium text-muted">
                    Tags
                  </th>
                  <th className="w-px whitespace-nowrap px-4 py-3 text-right text-[12px] font-medium text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const tags = post.tags || []
                  const shown = tags.slice(0, 2)
                  const rest = tags.length - shown.length
                  const status =
                    post.isPublished || post.state === 'POSTED' || post.platformPostUrl
                      ? 'POSTED'
                      : post.state || 'UNKNOWN'
                  return (
                    <tr
                      key={post.postId}
                      className="cursor-pointer border-b border-line transition hover:bg-paper-soft/70"
                      onClick={() => openDrawer(post.platform)}
                    >
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex items-center gap-2 font-medium text-ink">
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{
                              backgroundColor: PLATFORM_DOT[post.platform] || '#6b7488',
                            }}
                          />
                          {post.platform}
                        </span>
                      </td>
                      <td className="max-w-md min-w-0 px-4 py-3.5 text-ink">
                        <span className="line-clamp-2">{postExcerpt(post)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StatusPill status={status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {shown.length ? (
                          <div className="flex flex-wrap gap-1">
                            {shown.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]"
                              >
                                {tag}
                              </span>
                            ))}
                            {rest > 0 ? (
                              <span className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                                +{rest}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="w-px whitespace-nowrap px-4 py-3.5">
                        <div
                          className="flex shrink-0 items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink)]"
                            onClick={() => openDrawer(post.platform)}
                          >
                            <Eye className="size-3" />
                            View
                          </button>
                          {run?.id ? (
                            <RowPublishButton
                              runId={run.id}
                              post={post}
                              connected={targets.data?.connected?.[post.platform] === true}
                              statusesAvailable={targets.data?.statusesAvailable === true}
                              onOpenDrawer={() => openDrawer(post.platform)}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawerPlatform && run?.id ? (
        <PostPreviewDrawer
          runId={run.id}
          posts={posts}
          promptText={run.promptText}
          localDate={run.localDate}
          initialPlatform={drawerPlatform}
          onClose={() => setDrawerPlatform(null)}
        />
      ) : null}
    </div>
  )
}
