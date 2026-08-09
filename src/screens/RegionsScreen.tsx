import { useBrandKitEdit } from '../context/BrandKitEditContext'
import type { Region } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { FlagIcon } from '../components/FlagIcon'
import { MarkdownRule } from '../components/MarkdownRule'
import { nextTempIdValue } from '../lib/normalize'

export function RegionsScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  if (!draft) return null

  const update = (id: number, patch: Partial<Region>) => {
    setDraft({
      ...draft,
      regions: draft.regions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })
  }

  const add = () => {
    setDraft({
      ...draft,
      regions: [
        ...draft.regions,
        {
          id: nextTempIdValue(),
          name: 'New region',
          description: '',
          icon_name: 'flag-us',
          writing_rules: [],
        },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#101414]">Regions</h2>
          <p className="text-sm text-slate-500">
            Markets and localization notes.
            {!draft.regions.length ? null : (
              <span className="ml-1 text-slate-400">
                (Seeded when not returned by the public REST API.)
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add Region
        </button>
      </div>

      {draft.regions.length === 0 ? (
        <EmptyState title="No regions yet" message="Add a region to describe market focus." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {draft.regions.map((region) => (
            <article
              key={region.id}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <FlagIcon iconName={region.icon_name} />
                <input
                  value={region.name}
                  onChange={(e) => update(region.id, { name: e.target.value })}
                  className="w-full border-0 bg-transparent text-base font-semibold text-slate-900 outline-none"
                />
              </div>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">icon_name</span>
                <input
                  value={region.icon_name}
                  onChange={(e) => update(region.id, { icon_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </label>
              <textarea
                value={region.description}
                onChange={(e) => update(region.id, { description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm outline-none ring-brand-700/30 focus:ring-2"
              />
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Scoped writing rules
                  </h4>
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-800"
                    onClick={() =>
                      update(region.id, {
                        writing_rules: [
                          ...region.writing_rules,
                          { id: nextTempIdValue(), text: '**New rule**\n\n- …' },
                        ],
                      })
                    }
                  >
                    Add rule
                  </button>
                </div>
                {region.writing_rules.map((rule) => (
                  <MarkdownRule
                    key={rule.id}
                    text={rule.text}
                    defaultEditing={rule.id < 0}
                    onChange={(text) =>
                      update(region.id, {
                        writing_rules: region.writing_rules.map((r) =>
                          r.id === rule.id ? { ...r, text } : r,
                        ),
                      })
                    }
                    onRemove={() =>
                      update(region.id, {
                        writing_rules: region.writing_rules.filter((r) => r.id !== rule.id),
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
