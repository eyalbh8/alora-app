import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import type { DailyContentPost } from '../../api/dailyContent'
import {
  useBlogSiteCategories,
  useDailyContentPublishTargets,
  usePublishDailyContentPost,
} from '../../hooks/use-daily-content-runs'

function SiteCategoryPicker({
  siteId,
  siteName,
  value,
  onChange,
}: {
  siteId: string
  siteName: string
  value: number | ''
  onChange: (categoryId: number) => void
}) {
  const { data: categories, isLoading } = useBlogSiteCategories(siteId)

  useEffect(() => {
    if (value !== '') return
    if (!categories?.length) return
    if (categories.length === 1) {
      onChange(categories[0].id)
      return
    }
    onChange(0)
  }, [categories, value, onChange])

  if (isLoading) {
    return (
      <p className="text-xs text-[var(--muted)]">Loading categories for {siteName}…</p>
    )
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
      Category on {siteName}
      <select
        className="rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-2 py-1.5 text-sm text-[var(--ink)]"
        value={value === '' ? '' : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value="">Select category</option>
        {(categories || []).map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
        {!categories?.some((c) => c.id === 0) ? (
          <option value="0">Uncategorized</option>
        ) : null}
      </select>
    </label>
  )
}

export function PublishBar({
  runId,
  post,
}: {
  runId: string
  post: DailyContentPost
}) {
  const targets = useDailyContentPublishTargets(true)
  const publish = usePublishDailyContentPost(runId)
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [categoryBySite, setCategoryBySite] = useState<Record<string, number>>({})
  const [message, setMessage] = useState<string | null>(null)

  const connected = targets.data?.connected?.[post.platform] === true
  const blogSites = targets.data?.blogSites ?? []
  const isBlog = post.platform === 'BLOG'
  const alreadyPublished = post.isPublished || post.state === 'POSTED'

  const canPublishBlog =
    isBlog &&
    connected &&
    selectedSiteIds.length > 0 &&
    selectedSiteIds.every((id) => categoryBySite[id] != null)

  const canPublishSocial = !isBlog && connected

  const handlePublish = async () => {
    setMessage(null)
    try {
      await publish.mutateAsync({
        postId: post.postId,
        siteIds: isBlog ? selectedSiteIds : undefined,
        categoryBySite: isBlog ? categoryBySite : undefined,
      })
      setMessage('Published successfully.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Publish failed')
    }
  }

  if (alreadyPublished) {
    return (
      <div className="rounded-[var(--r-row)] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        This post is already published.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--r-row)] border border-[var(--line)] bg-[var(--paper-soft)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Publish</p>
          {targets.isLoading ? (
            <p className="text-xs text-[var(--muted)]">Checking connections…</p>
          ) : connected ? (
            <p className="text-xs text-emerald-700">{post.platform} connected</p>
          ) : (
            <p className="text-xs text-amber-800">
              {post.platform} is not connected on this workspace. Connect it in
              iGEO (Integrations) first.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={
            publish.isPending ||
            targets.isLoading ||
            !(isBlog ? canPublishBlog : canPublishSocial)
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => void handlePublish()}
        >
          <Send className="size-3.5" />
          {publish.isPending ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      {isBlog && connected ? (
        <div className="flex flex-col gap-2">
          {blogSites.length === 0 ? (
            <p className="text-xs text-amber-800">
              No WordPress sites found. Connect a blog site in iGEO first.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
                WordPress sites
                <select
                  multiple
                  className="min-h-20 rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-2 py-1.5 text-sm text-[var(--ink)]"
                  value={selectedSiteIds}
                  onChange={(e) => {
                    const next = Array.from(e.target.selectedOptions).map((o) => o.value)
                    setSelectedSiteIds(next)
                    setCategoryBySite((prev) => {
                      const cleaned = { ...prev }
                      for (const key of Object.keys(cleaned)) {
                        if (!next.includes(key)) delete cleaned[key]
                      }
                      return cleaned
                    })
                  }}
                >
                  {blogSites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedSiteIds.map((siteId) => {
                const site = blogSites.find((s) => s.id === siteId)
                return (
                  <SiteCategoryPicker
                    key={siteId}
                    siteId={siteId}
                    siteName={site?.name || siteId}
                    value={categoryBySite[siteId] ?? ''}
                    onChange={(categoryId) =>
                      setCategoryBySite((prev) => ({ ...prev, [siteId]: categoryId }))
                    }
                  />
                )
              })}
            </>
          )}
        </div>
      ) : null}

      {message ? (
        <p
          className={`text-xs ${
            message.includes('success') ? 'text-emerald-700' : 'text-[var(--error)]'
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
