import { useState } from 'react'
import { useBrandKitEdit } from '../context/BrandKitEditContext'
import type { ProductLine } from '../api/types'
import { EmptyState } from '../components/EmptyState'
import { nextTempIdValue } from '../lib/normalize'

export function ProductLinesScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  const [openId, setOpenId] = useState<number | 'all' | null>('all')
  if (!draft) return null

  const updateLine = (id: number, patch: Partial<ProductLine>) => {
    setDraft({
      ...draft,
      product_lines: draft.product_lines.map((pl) =>
        pl.id === id ? { ...pl, ...patch } : pl,
      ),
    })
  }

  const addLine = () => {
    const id = nextTempIdValue()
    setDraft({
      ...draft,
      product_lines: [
        ...draft.product_lines,
        {
          id,
          name: 'New product line',
          details: '',
          positioning: '',
          ideal_customer_profile: '',
          url: '',
          competitors: [],
        },
      ],
    })
    setOpenId(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#101414]">Product Lines</h2>
          <p className="text-sm text-slate-500">Offerings, positioning, ICP, and competitors.</p>
        </div>
        <button
          type="button"
          onClick={addLine}
          className="rounded-lg bg-brand-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add Product Line
        </button>
      </div>

      {draft.product_lines.length === 0 ? (
        <EmptyState
          title="No product lines yet"
          message="Add a product line to describe what you sell and who it’s for."
        />
      ) : (
        <div className="space-y-3">
          {draft.product_lines.map((pl) => {
            const open = openId === 'all' || openId === pl.id
            return (
              <div
                key={pl.id}
                className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                  onClick={() => setOpenId(open && openId !== 'all' ? null : pl.id)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{pl.name}</p>
                    <p className="text-xs text-slate-400">{pl.url || 'No URL'}</p>
                  </div>
                  <span className="text-xs text-slate-400">{open ? 'Collapse' : 'Expand'}</span>
                </button>

                {open && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                    <Field
                      label="Name"
                      value={pl.name}
                      onChange={(name) => updateLine(pl.id, { name })}
                    />
                    <Field
                      label="Details"
                      value={pl.details}
                      multiline
                      onChange={(details) => updateLine(pl.id, { details })}
                    />
                    <Field
                      label="Positioning"
                      value={pl.positioning}
                      multiline
                      onChange={(positioning) => updateLine(pl.id, { positioning })}
                    />
                    <Field
                      label="Ideal customer profile"
                      value={pl.ideal_customer_profile}
                      multiline
                      onChange={(ideal_customer_profile) =>
                        updateLine(pl.id, { ideal_customer_profile })
                      }
                    />
                    <Field
                      label="URL"
                      value={pl.url}
                      onChange={(url) => updateLine(pl.id, { url })}
                    />

                    <div className="pt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-800">Competitors</h4>
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-800 hover:underline"
                          onClick={() =>
                            updateLine(pl.id, {
                              competitors: [
                                ...pl.competitors,
                                {
                                  id: nextTempIdValue(),
                                  name: 'New competitor',
                                  domain: '',
                                  details: null,
                                },
                              ],
                            })
                          }
                        >
                          Add competitor
                        </button>
                      </div>
                      <div className="space-y-2">
                        {pl.competitors.map((c) => (
                          <div
                            key={c.id}
                            className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-[1fr_1fr_auto]"
                          >
                            <input
                              value={c.name}
                              onChange={(e) =>
                                updateLine(pl.id, {
                                  competitors: pl.competitors.map((x) =>
                                    x.id === c.id ? { ...x, name: e.target.value } : x,
                                  ),
                                })
                              }
                              placeholder="Name"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-700/30"
                            />
                            <input
                              value={c.domain}
                              onChange={(e) =>
                                updateLine(pl.id, {
                                  competitors: pl.competitors.map((x) =>
                                    x.id === c.id ? { ...x, domain: e.target.value } : x,
                                  ),
                                })
                              }
                              placeholder="domain.com"
                              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-700/30"
                            />
                            <button
                              type="button"
                              className="text-xs font-medium text-red-500 hover:text-red-700"
                              onClick={() =>
                                updateLine(pl.id, {
                                  competitors: pl.competitors.filter((x) => x.id !== c.id),
                                })
                              }
                            >
                              Remove
                            </button>
                            <textarea
                              value={c.details ?? ''}
                              onChange={(e) =>
                                updateLine(pl.id, {
                                  competitors: pl.competitors.map((x) =>
                                    x.id === c.id
                                      ? { ...x, details: e.target.value || null }
                                      : x,
                                  ),
                                })
                              }
                              placeholder="Details (optional)"
                              rows={2}
                              className="sm:col-span-3 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-700/30"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm outline-none ring-brand-700/30 focus:ring-2"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-sm outline-none ring-brand-700/30 focus:ring-2"
        />
      )}
    </label>
  )
}
