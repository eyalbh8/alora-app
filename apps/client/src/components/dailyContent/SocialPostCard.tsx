import { useMemo, useState } from 'react'
import {
  Bookmark,
  Heart,
  MessageCircle,
  Share2,
  ThumbsUp,
  Verified,
} from 'lucide-react'
import type { DailyContentPost } from '../../api/dailyContent'
import { detectHebrew, stripUnsplashCredit } from '../../lib/blogHtml'
import { brandLogoCandidates } from '../../lib/brandLogo'
import { useAccountStore } from '../../store/useAccountStore'

function useBrandProfile() {
  const account = useAccountStore((s) => s.selectedAccount)
  const title =
    account?.account?.title || account?.name || 'Your Business'
  const domain =
    account?.account?.domains?.[0] || account?.domain || null
  const logo = account?.account?.logo || null
  const candidates = brandLogoCandidates({
    name: title,
    logo,
    domain,
  })
  const [avatarIdx, setAvatarIdx] = useState(0)
  const avatarSrc = candidates[avatarIdx] || null
  return {
    title,
    avatarSrc,
    onAvatarError: () => setAvatarIdx((i) => i + 1),
  }
}

function TagChips({
  tags,
  variant = 'facebook',
}: {
  tags: string[]
  variant?: 'facebook' | 'linkedin' | 'instagram'
}) {
  if (!tags.length) return null
  if (variant === 'instagram') {
    return (
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
        {tags.map((tag) => (
          <span key={tag} className="text-sm text-[#00376b]">
            {tag.startsWith('#') ? tag : `#${tag}`}
          </span>
        ))}
      </div>
    )
  }
  const chipClass =
    variant === 'linkedin'
      ? 'rounded-full bg-[#0a66c2] px-2 py-0.5 text-[11px] font-medium text-white'
      : 'rounded-full bg-[#f0f2f5] px-2 py-0.5 text-xs text-[#1877F3]'
  const shown = tags.slice(0, 3)
  const rest = tags.length - shown.length
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((tag) => (
        <span key={tag} className={chipClass}>
          {tag}
        </span>
      ))}
      {rest > 0 ? <span className={chipClass}>+{rest}</span> : null}
    </div>
  )
}

function PostImage({
  urls,
  height,
  objectFit = 'cover',
}: {
  urls: string[]
  height: number
  objectFit?: 'cover' | 'contain'
}) {
  const src = urls.length ? urls[urls.length - 1] : null
  if (!src) return null
  return (
    <div
      className="mt-3 w-full overflow-hidden rounded-lg bg-[#f5f5f5]"
      style={{ height }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full"
        style={{ objectFit }}
      />
    </div>
  )
}

function FacebookCard({ post }: { post: DailyContentPost }) {
  const { title, avatarSrc, onAvatarError } = useBrandProfile()
  const caption = useMemo(
    () => stripUnsplashCredit(post.body || ''),
    [post.body],
  )
  const rtl = detectHebrew(caption)
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2.5">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            onError={onAvatarError}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-[#1877F3] text-sm font-semibold text-white">
            {title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-[var(--ink)]">{title}</p>
            <span className="inline-block size-3 rounded-full bg-[#1877F3]" />
          </div>
          <p className="text-xs text-[var(--muted)]">Just now</p>
        </div>
        {post.state === 'POSTED' || post.isPublished ? (
          <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            Published
          </span>
        ) : null}
      </header>
      <p
        className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink)]"
        dir={rtl ? 'rtl' : 'ltr'}
        style={{ textAlign: rtl ? 'right' : 'left' }}
      >
        {caption}
      </p>
      <TagChips tags={post.tags || []} variant="facebook" />
      <PostImage urls={post.imagesUrl || []} height={300} objectFit="contain" />
      <div className="mt-3 border-t border-[var(--line)] pt-2">
        <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#1877F3]">
              <ThumbsUp className="size-2.5 text-white" />
            </span>
            123 likes
          </span>
          <span>5 comments · 2 shares</span>
        </div>
        <div className="flex gap-2 border-t border-[var(--line)] pt-2">
          <button
            type="button"
            tabIndex={-1}
            className="pointer-events-none flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-medium text-[var(--ink-soft)]"
          >
            <ThumbsUp className="size-4" /> Like
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="pointer-events-none flex flex-1 items-center justify-center gap-1.5 py-1.5 text-sm font-medium text-[var(--ink-soft)]"
          >
            <MessageCircle className="size-4" /> Comment
          </button>
        </div>
      </div>
    </article>
  )
}

function LinkedInCard({ post }: { post: DailyContentPost }) {
  const { title, avatarSrc, onAvatarError } = useBrandProfile()
  const caption = post.body || ''
  const rtl = detectHebrew(caption)
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2.5">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            onError={onAvatarError}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-[#0a66c2] text-sm font-semibold text-white">
            {title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{title}</p>
          <p className="text-[13px] text-[var(--muted)]">Just now · LinkedIn</p>
        </div>
        {post.state === 'POSTED' || post.isPublished ? (
          <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            Published
          </span>
        ) : null}
      </header>
      <PostImage urls={post.imagesUrl || []} height={300} />
      <p
        className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-[var(--ink)]"
        dir={rtl ? 'rtl' : 'ltr'}
        style={{ textAlign: rtl ? 'right' : 'left' }}
      >
        {caption}
      </p>
      <TagChips tags={post.tags || []} variant="linkedin" />
      <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2 text-xs text-[var(--muted)]">
        <span>{caption.length} characters</span>
        <span className="font-semibold text-[#0a66c2]">Ready to publish</span>
      </div>
    </article>
  )
}

function InstagramCard({ post }: { post: DailyContentPost }) {
  const { title, avatarSrc, onAvatarError } = useBrandProfile()
  const caption = useMemo(
    () => stripUnsplashCredit(post.body || ''),
    [post.body],
  )
  const rtl = detectHebrew(caption)
  return (
    <article className="border border-[#dbdbdb] bg-white">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            onError={onAvatarError}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-xs font-semibold text-white">
            {title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="truncate text-sm font-semibold text-[#262626]">{title}</p>
      </header>
      {post.imagesUrl?.length ? (
        <div className="w-full bg-[#fafafa]" style={{ height: 400 }}>
          <img
            src={post.imagesUrl[post.imagesUrl.length - 1]}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className="flex w-full items-center justify-center bg-[#fafafa] text-sm text-[var(--muted)]"
          style={{ height: 240 }}
        >
          No image
        </div>
      )}
      <div className="px-3 py-2">
        <div className="mb-2 flex items-center gap-4 text-[#262626]">
          <Heart className="size-6" />
          <MessageCircle className="size-6" />
          <Share2 className="size-6" />
          <Bookmark className="ml-auto size-6" />
        </div>
        <p className="mb-1 text-sm font-semibold text-[#262626]">123 likes</p>
        <p
          className="whitespace-pre-wrap text-sm leading-snug text-[#262626]"
          dir={rtl ? 'rtl' : 'ltr'}
        >
          <span className="font-semibold">{title}</span> {caption}
        </p>
        <TagChips tags={post.tags || []} variant="instagram" />
      </div>
    </article>
  )
}

function XCard({ post }: { post: DailyContentPost }) {
  const { title, avatarSrc, onAvatarError } = useBrandProfile()
  const caption = post.body || ''
  const rtl = detectHebrew(caption)
  return (
    <article className="mx-auto max-w-[600px] rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-start gap-3">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            onError={onAvatarError}
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
            {title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            <p className="truncate text-[15px] font-bold text-[var(--ink)]">{title}</p>
            <Verified className="size-[18px] fill-[#1DA1F2] text-[#1DA1F2]" />
            <p className="text-[15px] text-[var(--muted)]">@UserNameHere</p>
          </div>
        </div>
        {post.state === 'POSTED' || post.isPublished ? (
          <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            Published
          </span>
        ) : null}
      </header>
      <p
        className="whitespace-pre-wrap text-[17px] leading-normal text-[var(--ink)]"
        dir={rtl ? 'rtl' : 'ltr'}
        style={{ textAlign: rtl ? 'right' : 'left' }}
      >
        {caption}
      </p>
    </article>
  )
}

export function SocialPostCard({ post }: { post: DailyContentPost }) {
  switch (post.platform) {
    case 'FACEBOOK':
      return <FacebookCard post={post} />
    case 'LINKEDIN':
      return <LinkedInCard post={post} />
    case 'INSTAGRAM':
      return <InstagramCard post={post} />
    case 'X':
      return <XCard post={post} />
    default:
      return (
        <pre className="whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--paper-soft)] p-4 text-sm">
          {post.body || 'No content'}
        </pre>
      )
  }
}
