import { useBrandKitEdit } from '../context/BrandKitEditContext'
import type { Audience } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { MarkdownRule } from '../components/MarkdownRule'
import { nextTempIdValue } from '../lib/normalize'

export function AudiencesScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  if (!draft) return null

  const update = (id: number, patch: Partial<Audience>) => {
    setDraft({
      ...draft,
      audiences: draft.audiences.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })
  }

  const add = () => {
    setDraft({
      ...draft,
      audiences: [
        ...draft.audiences,
        {
          id: nextTempIdValue(),
          name: 'New audience',
          description: '',
          writing_rules: [],
        },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audiences</h2>
          <p className="text-sm text-slate-500">Who you write for, with optional scoped rules.</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-900"
        >
          Add Audience
        </button>
      </div>

      {draft.audiences.length === 0 ? (
        <EmptyState title="No audiences yet" message="Add an audience to target your messaging." />
      ) : (
        <div className="space-y-4">
          {draft.audiences.map((aud) => (
            <article
              key={aud.id}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <input
                value={aud.name}
                onChange={(e) => update(aud.id, { name: e.target.value })}
                className="mb-2 w-full border-0 bg-transparent text-base font-semibold text-slate-900 outline-none"
              />
              <textarea
                value={aud.description}
                onChange={(e) => update(aud.id, { description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm outline-none ring-emerald-700/30 focus:ring-2"
              />
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Scoped writing rules
                  </h4>
                  <button
                    type="button"
                    className="text-xs font-medium text-emerald-800"
                    onClick={() =>
                      update(aud.id, {
                        writing_rules: [
                          ...aud.writing_rules,
                          { id: nextTempIdValue(), text: '**New rule**\n\n- …' },
                        ],
                      })
                    }
                  >
                    Add rule
                  </button>
                </div>
                {aud.writing_rules.map((rule) => (
                  <MarkdownRule
                    key={rule.id}
                    text={rule.text}
                    defaultEditing={rule.id < 0}
                    onChange={(text) =>
                      update(aud.id, {
                        writing_rules: aud.writing_rules.map((r) =>
                          r.id === rule.id ? { ...r, text } : r,
                        ),
                      })
                    }
                    onRemove={() =>
                      update(aud.id, {
                        writing_rules: aud.writing_rules.filter((r) => r.id !== rule.id),
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
