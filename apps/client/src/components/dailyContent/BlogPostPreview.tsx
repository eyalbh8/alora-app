import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Copy, Pencil, Save, X } from 'lucide-react'
import type { DailyContentPost } from '../../api/dailyContent'
import { useUpdateDailyContentPost } from '../../hooks/use-daily-content-runs'
import {
  buildBlogBody,
  detectHebrew,
  extractPlainTextFromHtml,
  extractSchemaFromPost,
  stripJsonLdSchema,
  stripTitleFromContent,
} from '../../lib/blogHtml'
import { PublishBar } from './PublishBar'
import { ImageWithFallback } from './PostImageControls'
import { RichTextEditor } from './RichTextEditor'

export function BlogPostPreview({
  runId,
  post,
}: {
  runId: string
  post: DailyContentPost
}) {
  const update = useUpdateDailyContentPost(runId)
  const [isEditing, setIsEditing] = useState(false)
  const [titleHtml, setTitleHtml] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [titleSnapshot, setTitleSnapshot] = useState('')
  const [contentSnapshot, setContentSnapshot] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [focusKeyphrase, setFocusKeyphrase] = useState('')
  const [slug, setSlug] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [schemaText, setSchemaText] = useState('')
  const [schemaSnapshot, setSchemaSnapshot] = useState('')
  const [isEditingSchema, setIsEditingSchema] = useState(false)
  const [schemaCopied, setSchemaCopied] = useState(false)
  const [isEditingSeo, setIsEditingSeo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const body = post.body || ''
    const title = post.title || ''
    const titleFromBody = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    setTitleHtml(titleFromBody || title || '')
    setHtmlContent(stripJsonLdSchema(stripTitleFromContent(body)))
    setTags(post.tags || [])
    setFocusKeyphrase(post.focusKeyphrase || '')
    setSlug(post.slug || '')
    setMetaDescription(post.metaDescription || '')
    setSchemaText(extractSchemaFromPost(body))
    setIsEditing(false)
    setIsEditingSchema(false)
    setIsEditingSeo(false)
    setError(null)
  }, [
    post.postId,
    post.body,
    post.title,
    post.tags,
    post.focusKeyphrase,
    post.slug,
    post.metaDescription,
  ])

  const rtl = useMemo(
    () => detectHebrew(titleHtml) || detectHebrew(htmlContent),
    [titleHtml, htmlContent],
  )

  const heroImage = post.imagesUrl?.length
    ? post.imagesUrl[post.imagesUrl.length - 1]
    : null

  const readTimeLabel = `${post.readTime || 5} min read`
  const category = post.topic || 'Article'
  const published = post.isPublished || post.state === 'POSTED'

  const startEdit = () => {
    setTitleSnapshot(titleHtml)
    setContentSnapshot(htmlContent)
    setIsEditing(true)
    setError(null)
  }

  const cancelEdit = () => {
    setTitleHtml(titleSnapshot)
    setHtmlContent(contentSnapshot)
    setIsEditing(false)
  }

  const saveContent = async () => {
    setError(null)
    try {
      const body = buildBlogBody(titleHtml, htmlContent, schemaText)
      const plainTitle = extractPlainTextFromHtml(titleHtml)
      await update.mutateAsync({
        postId: post.postId,
        patch: {
          title: plainTitle,
          body,
          tags,
        },
      })
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const saveTags = async (nextTags: string[]) => {
    setTags(nextTags)
    setError(null)
    try {
      await update.mutateAsync({
        postId: post.postId,
        patch: { tags: nextTags },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tags')
    }
  }

  const saveSeo = async () => {
    setError(null)
    try {
      await update.mutateAsync({
        postId: post.postId,
        patch: {
          focusKeyphrase,
          slug,
          metaDescription,
        },
      })
      setIsEditingSeo(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SEO')
    }
  }

  const saveSchema = async () => {
    setError(null)
    try {
      if (schemaText.trim()) JSON.parse(schemaText)
      const body = buildBlogBody(titleHtml, htmlContent, schemaText)
      const plainTitle = extractPlainTextFromHtml(titleHtml)
      await update.mutateAsync({
        postId: post.postId,
        patch: { title: plainTitle, body },
      })
      setIsEditingSchema(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid JSON schema or save failed',
      )
    }
  }

  const copySchema = async () => {
    const wrapped = `<script type="application/ld+json">\n${schemaText}\n</script>`
    await navigator.clipboard.writeText(wrapped)
    setSchemaCopied(true)
    setTimeout(() => setSchemaCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <PublishBar runId={runId} post={post} />

      <article className="rounded-[var(--r-row)] border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--chip)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink-soft)]">
              {category}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <Clock className="size-3.5" />
              {readTimeLabel}
            </span>
            {published ? (
              <span className="rounded-full border border-emerald-500 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                Published
              </span>
            ) : null}
          </div>
          {!published ? (
            isEditing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
                  onClick={cancelEdit}
                  disabled={update.isPending}
                >
                  <X className="size-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  onClick={() => void saveContent()}
                  disabled={update.isPending}
                >
                  <Save className="size-3.5" />
                  {update.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={startEdit}
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            )
          ) : null}
        </div>

        {isEditing ? (
          <div className="flex flex-col gap-3" dir={rtl ? 'rtl' : 'ltr'}>
            <RichTextEditor
              value={titleHtml}
              onChange={setTitleHtml}
              placeholder="Post title"
              simpleToolbar
              dir={rtl ? 'rtl' : 'ltr'}
              minHeight="64px"
            />
            {heroImage ? (
              <ImageWithFallback
                src={heroImage}
                alt=""
                className="mx-auto max-w-full rounded-lg"
              />
            ) : null}
            <RichTextEditor
              value={htmlContent}
              onChange={setHtmlContent}
              placeholder="Post content"
              dir={rtl ? 'rtl' : 'ltr'}
              minHeight="320px"
            />
          </div>
        ) : (
          <div dir={rtl ? 'rtl' : 'ltr'} style={{ textAlign: rtl ? 'right' : 'left' }}>
            <h1
              className="blog-title"
              dangerouslySetInnerHTML={{ __html: titleHtml || 'Untitled' }}
            />
            {heroImage ? (
              <div className="my-4 text-center">
                <ImageWithFallback
                  src={heroImage}
                  alt=""
                  className="mx-auto max-w-full rounded-lg"
                />
              </div>
            ) : null}
            <div
              className="blog-content"
              data-blog-content
              dangerouslySetInnerHTML={{
                __html: htmlContent || '<p>No body content.</p>',
              }}
            />
          </div>
        )}

        {/* Tags */}
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--chip)] px-2.5 py-0.5 text-xs text-[var(--ink-soft)]"
              >
                {tag}
                {!published ? (
                  <button
                    type="button"
                    className="text-[var(--muted)] hover:text-[var(--error)]"
                    aria-label={`Remove ${tag}`}
                    onClick={() => void saveTags(tags.filter((t) => t !== tag))}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))}
            {!published ? (
              <form
                className="inline-flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  const next = newTag.trim()
                  if (!next || tags.includes(next)) return
                  void saveTags([...tags, next])
                  setNewTag('')
                }}
              >
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add tag"
                  className="w-28 rounded-full border border-[var(--line)] px-2 py-0.5 text-xs"
                />
              </form>
            ) : null}
          </div>
        </div>

        {/* SEO */}
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--ink)]">SEO</p>
            {!published ? (
              isEditingSeo ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs"
                    onClick={() => setIsEditingSeo(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs text-white"
                    onClick={() => void saveSeo()}
                    disabled={update.isPending}
                  >
                    Save SEO
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs"
                  onClick={() => setIsEditingSeo(true)}
                >
                  Edit SEO
                </button>
              )
            ) : null}
          </div>
          {isEditingSeo ? (
            <div className="grid gap-2 sm:grid-cols-1">
              <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
                Focus keyphrase
                <input
                  className="rounded-[var(--r-sm)] border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                  value={focusKeyphrase}
                  onChange={(e) => setFocusKeyphrase(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
                Slug
                <input
                  className="rounded-[var(--r-sm)] border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
                Meta description
                <textarea
                  className="min-h-20 rounded-[var(--r-sm)] border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)]"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-1 text-xs text-[var(--ink-soft)]">
              <p>
                <span className="font-medium text-[var(--ink)]">Focus:</span>{' '}
                {focusKeyphrase || '—'}
              </p>
              <p>
                <span className="font-medium text-[var(--ink)]">Slug:</span>{' '}
                {slug || '—'}
              </p>
              <p>
                <span className="font-medium text-[var(--ink)]">Meta:</span>{' '}
                {metaDescription || '—'}
              </p>
            </div>
          )}
        </div>

        {/* Schema */}
        {(schemaText || post.body) && (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--ink)]">Schema</p>
              <div className="flex items-center gap-1">
                {!isEditingSchema ? (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--line)] p-1.5"
                      title={schemaCopied ? 'Copied' : 'Copy schema'}
                      onClick={() => void copySchema()}
                    >
                      {schemaCopied ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                    {!published ? (
                      <button
                        type="button"
                        className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs"
                        onClick={() => {
                          setSchemaSnapshot(schemaText)
                          setIsEditingSchema(true)
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs"
                      onClick={() => {
                        setSchemaText(schemaSnapshot)
                        setIsEditingSchema(false)
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-xs text-white"
                      onClick={() => void saveSchema()}
                      disabled={update.isPending}
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
            {isEditingSchema ? (
              <textarea
                className="min-h-48 w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--paper-soft)] p-3 font-mono text-xs text-[var(--ink)]"
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
              />
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--paper-soft)] p-3 font-mono text-xs text-[var(--ink-soft)]">
                {schemaText
                  ? `<script type="application/ld+json">\n${schemaText}\n</script>`
                  : 'No schema available'}
              </pre>
            )}
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-[var(--error)]">{error}</p> : null}
      </article>
    </div>
  )
}
