import { useState } from 'react'
import { useBrandKitEdit } from '../context/BrandKitEditContext'
import { ColorSwatch } from '../components/ColorSwatch'
import { EmptyState } from '../components/EmptyState'

type VisualTab = 'logos' | 'colors' | 'typography'

export function VisualGuidelinesScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  const [tab, setTab] = useState<VisualTab>('logos')
  if (!draft) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Visual Guidelines</h2>
        <p className="text-sm text-slate-500">
          Logos, colors, and typography. Public REST does not return these collections —
          values may be seeded for local editing.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            ['logos', 'Logos'],
            ['colors', 'Colors'],
            ['typography', 'Typography'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'logos' && (
        <div className="space-y-4">
          {draft.logo_variants.length === 0 ? (
            <EmptyState title="No logo variants" message="Add logos in AirOps or seed locally." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {draft.logo_variants.map((logo) => (
                <article
                  key={logo.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div
                    className="mb-3 flex h-28 items-center justify-center rounded-lg border border-slate-100"
                    style={{ backgroundColor: logo.background_color || '#fff' }}
                  >
                    {logo.file_url ? (
                      <img
                        src={logo.file_url}
                        alt={logo.name}
                        className="max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No file_url</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{logo.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{logo.background_color}</p>
                  <textarea
                    value={logo.usage_instructions}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        logo_variants: draft.logo_variants.map((l) =>
                          l.id === logo.id
                            ? { ...l, usage_instructions: e.target.value }
                            : l,
                        ),
                      })
                    }
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/40 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-700/30"
                  />
                </article>
              ))}
            </div>
          )}

          {draft.logo_sizes.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Logo sizes</h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/80">
                {draft.logo_sizes.map((size) => (
                  <li key={size.id} className="px-4 py-3 text-sm">
                    <p className="font-medium text-slate-900">{size.name}</p>
                    <p className="text-xs text-slate-500">
                      {size.width ?? '—'}×{size.height ?? '—'}px
                      {size.usage_instructions ? ` · ${size.usage_instructions}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <UsageRulesList
            rules={draft.usage_rules.filter((r) => r.applies_to === 'logo')}
          />
        </div>
      )}

      {tab === 'colors' && (
        <div className="space-y-6">
          {draft.palettes.length === 0 ? (
            <EmptyState title="No palettes" message="Color palettes are empty." />
          ) : (
            draft.palettes.map((palette) => (
              <section key={palette.id}>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">{palette.name}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {palette.colors.map((color) => (
                    <ColorSwatch
                      key={color.id}
                      name={color.name}
                      value={color.value}
                      usageInstructions={color.usage_instructions}
                      onUsageChange={(usage_instructions) =>
                        setDraft({
                          ...draft,
                          palettes: draft.palettes.map((p) =>
                            p.id === palette.id
                              ? {
                                  ...p,
                                  colors: p.colors.map((c) =>
                                    c.id === color.id ? { ...c, usage_instructions } : c,
                                  ),
                                }
                              : p,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}
          <UsageRulesList
            rules={draft.usage_rules.filter((r) => r.applies_to === 'color')}
          />
        </div>
      )}

      {tab === 'typography' && (
        <div className="space-y-6">
          {draft.fonts.length === 0 ? (
            <EmptyState title="No fonts" message="Typography is empty." />
          ) : (
            draft.fonts.map((font) => {
              const sizes = draft.type_sizes.filter((t) => t.font_id === font.id)
              return (
                <article
                  key={font.id}
                  className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{font.name}</h3>
                    {font.google_font_link && (
                      <a
                        href={font.google_font_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-800 hover:underline"
                      >
                        Google Fonts
                      </a>
                    )}
                  </div>
                  <textarea
                    value={font.usage_instructions}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fonts: draft.fonts.map((f) =>
                          f.id === font.id
                            ? { ...f, usage_instructions: e.target.value }
                            : f,
                        ),
                      })
                    }
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/40 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-700/30"
                  />
                  {sizes.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[480px] text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400">
                            <th className="py-2 pr-3 font-medium">Name</th>
                            <th className="py-2 pr-3 font-medium">Weight</th>
                            <th className="py-2 pr-3 font-medium">Size</th>
                            <th className="py-2 pr-3 font-medium">Line</th>
                            <th className="py-2 font-medium">Usage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sizes.map((ts) => (
                            <tr key={ts.id} className="border-b border-slate-50 text-slate-700">
                              <td className="py-2 pr-3 font-medium">{ts.name}</td>
                              <td className="py-2 pr-3">{ts.weight}</td>
                              <td className="py-2 pr-3">{ts.size}px</td>
                              <td className="py-2 pr-3">{ts.line_height}</td>
                              <td className="py-2 text-slate-500">{ts.usage_instructions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              )
            })
          )}
          <UsageRulesList
            rules={draft.usage_rules.filter((r) => r.applies_to === 'typography')}
          />
        </div>
      )}
    </div>
  )
}

function UsageRulesList({ rules }: { rules: Array<{ id: number; name: string }> }) {
  if (rules.length === 0) return null
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">Usage rules</h3>
      <ul className="space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs leading-relaxed text-slate-700"
          >
            {rule.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
