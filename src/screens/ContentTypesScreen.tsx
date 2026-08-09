import { useBrandKitEdit } from '../context/BrandKitEditContext'
import type { ContentType } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { MarkdownRule } from '../components/MarkdownRule'
import { nextTempIdValue } from '../lib/normalize'

const HEADER_CASE_OPTIONS = [
  { value: 'title_case', label: 'Title case' },
  { value: 'sentence_case', label: 'Sentence case' },
  { value: 'custom', label: 'Custom' },
]

export function ContentTypesScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  if (!draft) return null

  const update = (id: number, patch: Partial<ContentType>) => {
    setDraft({
      ...draft,
      content_types: draft.content_types.map((ct) =>
        ct.id === id ? { ...ct, ...patch } : ct,
      ),
    })
  }

  const add = () => {
    setDraft({
      ...draft,
      content_types: [
        ...draft.content_types,
        {
          id: nextTempIdValue(),
          name: 'New content type',
          template_outline: '',
          cta_text: '',
          cta_url: '',
          header_case: 'title_case',
          content_samples: [],
          writing_rules: [],
        },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#101414]">Content Types</h2>
          <p className="text-sm text-slate-500">
            Formats like blog posts, landing pages, and social copy.
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add Content Type
        </button>
      </div>

      {draft.content_types.length === 0 ? (
        <EmptyState
          title="No content types yet"
          message="Add one to define formats like blog posts or landing pages."
        >
          <button
            type="button"
            onClick={add}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            Add Content Type
          </button>
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {draft.content_types.map((ct) => (
            <article
              key={ct.id}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <input
                value={ct.name}
                onChange={(e) => update(ct.id, { name: e.target.value })}
                className="mb-3 w-full border-0 bg-transparent text-base font-semibold text-slate-900 outline-none"
              />
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Template outline
                </span>
                <textarea
                  value={ct.template_outline ?? ''}
                  onChange={(e) => update(ct.id, { template_outline: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs outline-none ring-brand-700/30 focus:ring-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">CTA text</span>
                  <input
                    value={ct.cta_text ?? ''}
                    onChange={(e) => update(ct.id, { cta_text: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-700/30"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">CTA URL</span>
                  <input
                    value={ct.cta_url ?? ''}
                    onChange={(e) => update(ct.id, { cta_url: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-700/30"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Header case</span>
                  <select
                    value={ct.header_case ?? 'title_case'}
                    onChange={(e) => update(ct.id, { header_case: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-700/30"
                  >
                    {HEADER_CASE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Scoped writing rules
                  </h4>
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-800"
                    onClick={() =>
                      update(ct.id, {
                        writing_rules: [
                          ...(ct.writing_rules ?? []),
                          { id: nextTempIdValue(), text: '**New rule**\n\n- …' },
                        ],
                      })
                    }
                  >
                    Add rule
                  </button>
                </div>
                {(ct.writing_rules ?? []).map((rule) => (
                  <MarkdownRule
                    key={rule.id}
                    text={rule.text}
                    defaultEditing={rule.id < 0}
                    onChange={(text) =>
                      update(ct.id, {
                        writing_rules: (ct.writing_rules ?? []).map((r) =>
                          r.id === rule.id ? { ...r, text } : r,
                        ),
                      })
                    }
                    onRemove={() =>
                      update(ct.id, {
                        writing_rules: (ct.writing_rules ?? []).filter((r) => r.id !== rule.id),
                      })
                    }
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
