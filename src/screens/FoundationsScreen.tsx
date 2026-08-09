import { useBrandKitEdit } from '../context/BrandKitEditContext'
import { EditableField } from '../components/EditableField'
import { MarkdownRule } from '../components/MarkdownRule'
import { nextTempIdValue } from '../lib/normalize'

export function FoundationsScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  if (!draft) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Foundations</h2>
        <p className="text-sm text-slate-500">
          Core identity, voice, and global writing rules for {draft.brand_name}.
        </p>
      </div>

      <div className="grid gap-4">
        <EditableField
          label="Brand name"
          value={draft.brand_name}
          multiline={false}
          onChange={(brand_name) => setDraft({ ...draft, brand_name })}
        />
        <EditableField
          label="Brand URL"
          value={draft.brand_url}
          multiline={false}
          onChange={(brand_url) => setDraft({ ...draft, brand_url })}
        />
        <EditableField
          label="About your brand"
          value={draft.brand_about}
          rows={6}
          onChange={(brand_about) => setDraft({ ...draft, brand_about })}
        />
        <EditableField
          label="Writing persona"
          value={draft.writing_persona}
          rows={6}
          onChange={(writing_persona) => setDraft({ ...draft, writing_persona })}
        />
        <EditableField
          label="Writing tone"
          value={draft.writing_tone}
          rows={6}
          onChange={(writing_tone) => setDraft({ ...draft, writing_tone })}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Global writing rules</h3>
            <p className="text-xs text-slate-500">Markdown-friendly rules applied across content.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraft({
                ...draft,
                writing_rules: [
                  ...draft.writing_rules,
                  {
                    id: nextTempIdValue(),
                    text: '**New rule**\n\n- Describe the rule here',
                  },
                ],
              })
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Add Rule
          </button>
        </div>

        <div className="space-y-3">
          {draft.writing_rules.map((rule) => (
            <MarkdownRule
              key={rule.id}
              text={rule.text}
              defaultEditing={rule.id < 0}
              onChange={(text) =>
                setDraft({
                  ...draft,
                  writing_rules: draft.writing_rules.map((r) =>
                    r.id === rule.id ? { ...r, text } : r,
                  ),
                })
              }
              onRemove={() =>
                setDraft({
                  ...draft,
                  writing_rules: draft.writing_rules.filter((r) => r.id !== rule.id),
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}
