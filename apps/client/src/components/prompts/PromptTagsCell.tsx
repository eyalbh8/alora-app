import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createGeoTag, deleteGeoTag, getGeoTags, setGeoPromptTags } from '../../api/geo'
import { queryKeys } from '../../api/queryKeys'
import type { PromptRow, PromptTag } from '../../api/types'
import {
  TAG_COLOR_ROWS,
  normalizeTag,
  normalizeTags,
  tagColor,
  toPromptTag,
  type NormalizedTag,
} from '../../lib/tags'
import { useAccountStore } from '../../store/useAccountStore'

function TagPill({
  tag,
  onRemove,
  disabled,
}: {
  tag: NormalizedTag
  onRemove?: () => void
  disabled?: boolean
}) {
  return (
    <span
      className="inline-flex max-w-[140px] items-center gap-1.5 border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink"
      title={tag.name}
    >
      <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: tagColor(tag.colorRow) }} />
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="text-muted-dark hover:text-ink disabled:opacity-50"
          aria-label={`Remove tag ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  )
}

export function PromptTagsCell({
  prompt,
  onTagsChange,
}: {
  prompt: PromptRow
  onTagsChange: (promptId: string, tags: PromptTag[]) => void
}) {
  const queryClient = useQueryClient()
  const accountId = useAccountStore((s) => s.selectedAccount?.id)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [colorRow, setColorRow] = useState('E')
  const [error, setError] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const rootRef = useRef<HTMLDivElement>(null)
  const assigned = useMemo(() => normalizeTags(prompt.tags), [prompt.tags])

  const catalogQuery = useQuery({
    queryKey: queryKeys.geo.tags(accountId),
    queryFn: getGeoTags,
    enabled: Boolean(accountId),
  })

  const catalog = useMemo(() => {
    const byId = new Map<string, NormalizedTag>()
    for (const tag of catalogQuery.data?.tags ?? []) {
      const mapped = normalizeTag(tag)
      if (mapped) byId.set(mapped.tagId, mapped)
    }
    for (const tag of assigned) byId.set(tag.tagId, tag)
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [assigned, catalogQuery.data])

  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 256
      const left = Math.min(rect.left, window.innerWidth - width - 12)
      setMenuPos({ top: rect.bottom + 6, left: Math.max(12, left) })
    }
    place()
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
        setError(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['geo', 'prompts'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.geo.tags(accountId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.geo.meta(accountId) }),
    ])
  }

  const setTags = useMutation({
    mutationFn: (tags: NormalizedTag[]) => setGeoPromptTags(prompt.id, tags.map(toPromptTag)),
    onSuccess: (result) => {
      onTagsChange(prompt.id, result.prompt.tags ?? [])
      setError(null)
      void invalidate()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not update tags')
    },
  })

  const createTag = useMutation({
    mutationFn: () => createGeoTag({ name: query.trim(), colorRow }),
    onSuccess: async (result) => {
      const created = normalizeTag(result.tag)
      setQuery('')
      if (created) {
        await setTags.mutateAsync([...assigned, created])
      } else {
        void invalidate()
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not create tag')
    },
  })

  const removeCatalogTag = useMutation({
    mutationFn: (tagId: string) => deleteGeoTag(tagId),
    onSuccess: () => {
      void invalidate()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not delete tag')
    },
  })

  const busy = setTags.isPending || createTag.isPending || removeCatalogTag.isPending
  const q = query.trim().toLowerCase()
  const filteredCatalog = catalog.filter((tag) => !q || tag.name.toLowerCase().includes(q))
  const assignedIds = new Set(assigned.map((tag) => tag.tagId))
  const canCreate =
    query.trim().length > 0 &&
    !catalog.some((tag) => tag.name.toLowerCase() === query.trim().toLowerCase())

  const toggleTag = (tag: NormalizedTag) => {
    const next = assignedIds.has(tag.tagId)
      ? assigned.filter((item) => item.tagId !== tag.tagId)
      : [...assigned, tag]
    setTags.mutate(next)
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {assigned.length === 0 && (
          <span className="text-xs text-muted-dark">—</span>
        )}
        {assigned.slice(0, 3).map((tag) => (
          <TagPill key={tag.tagId} tag={tag} disabled={busy} onRemove={() => toggleTag(tag)} />
        ))}
        {assigned.length > 3 && (
          <span className="text-[11px] text-muted-dark">+{assigned.length - 3}</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-6 w-6 items-center justify-center border border-line text-xs text-muted hover:border-ink hover:text-ink"
          aria-expanded={open}
          aria-label={`Edit tags for ${prompt.prompt}`}
        >
          +
        </button>
      </div>

      {open && (
        <div
          className="fixed z-50 w-64 border border-line bg-paper-soft p-2"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <div className="form-field">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search or create tag…"
              className="min-h-9"
              autoFocus
            />
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto">
            {filteredCatalog.length === 0 && !canCreate ? (
              <p className="px-1 py-2 text-[11px] text-muted-dark uppercase">No tags yet</p>
            ) : (
              filteredCatalog.map((tag) => {
                const selected = assignedIds.has(tag.tagId)
                return (
                  <div key={tag.tagId} className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleTag(tag)}
                      className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-surface ${
                        selected ? 'text-ink' : 'text-muted'
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0"
                        style={{ backgroundColor: tagColor(tag.colorRow) }}
                      />
                      <span className="truncate">{tag.name}</span>
                      {selected && <span className="ml-auto text-[10px] text-accent">On</span>}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      title="Delete tag from workspace"
                      onClick={() => removeCatalogTag.mutate(tag.tagId)}
                      className="px-1 text-muted-dark hover:text-ink"
                      aria-label={`Delete tag ${tag.name}`}
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
          {canCreate && (
            <div className="mt-2 border-t border-line pt-2">
              <p className="mb-1.5 px-1 text-[10px] tracking-wide text-muted-dark uppercase">
                New tag color
              </p>
              <div className="mb-2 flex flex-wrap gap-1 px-1">
                {TAG_COLOR_ROWS.map((row) => (
                  <button
                    key={row}
                    type="button"
                    onClick={() => setColorRow(row)}
                    className={`h-4 w-4 ${colorRow === row ? 'outline outline-1 outline-offset-1 outline-ink' : ''}`}
                    style={{ backgroundColor: tagColor(row) }}
                    aria-label={`Color ${row}`}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => createTag.mutate()}
                className="text-link px-1"
              >
                Create “{query.trim()}”
              </button>
            </div>
          )}
          {assigned.length > 0 && (
            <div className="mt-2 border-t border-line px-1 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setTags.mutate([])}
                className="text-link"
              >
                Clear tags on this prompt
              </button>
            </div>
          )}
          {error && <p className="mt-2 px-1 text-[11px] text-error">{error}</p>}
        </div>
      )}
    </div>
  )
}
