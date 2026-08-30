import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import type { DailyContentPost } from '../../api/dailyContent'
import {
  useRemovePostImage,
  useReplacePostImage,
} from '../../hooks/use-daily-content-runs'

const MAX_BYTES = 5 * 1024 * 1024

function ImageWithFallback({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--paper-soft)] text-xs text-[var(--muted)] ${className || ''}`}
      >
        Image unavailable
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}

export function PostImageControls({
  runId,
  post,
}: {
  runId: string
  post: DailyContentPost
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const replace = useReplacePostImage(runId)
  const remove = useRemovePostImage(runId)
  const [error, setError] = useState<string | null>(null)

  if (post.platform === 'X') return null

  const current =
    post.imagesUrl?.length > 0
      ? post.imagesUrl[post.imagesUrl.length - 1]
      : null
  const busy = replace.isPending || remove.isPending
  const published = post.isPublished || post.state === 'POSTED'

  const onPick = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 5MB.')
      return
    }
    try {
      await replace.mutateAsync({
        postId: post.postId,
        file,
        currentImageUrl: current,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onRemove = async () => {
    if (!current) return
    setError(null)
    try {
      await remove.mutateAsync({ postId: post.postId, imageUrl: current })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  return (
    <div className="rounded-[var(--r-row)] border border-[var(--line)] bg-[var(--paper-soft)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--ink)]">Image</p>
        {!published ? (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--ink)] disabled:opacity-50"
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-3 animate-spin" />
              ) : current ? (
                <Upload className="size-3" />
              ) : (
                <ImagePlus className="size-3" />
              )}
              {current ? 'Replace' : 'Upload'}
            </button>
            {current ? (
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--error)] disabled:opacity-50"
                onClick={() => void onRemove()}
              >
                <Trash2 className="size-3" />
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {current ? (
        <ImageWithFallback
          src={current}
          alt="Post image"
          className="mx-auto max-h-48 max-w-full rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[var(--line)] bg-white text-xs text-[var(--muted)]">
          No image
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-[var(--error)]">{error}</p> : null}
    </div>
  )
}

export { ImageWithFallback }
