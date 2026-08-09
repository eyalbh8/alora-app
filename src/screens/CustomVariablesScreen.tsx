import { useBrandKitEdit } from '../context/BrandKitEditContext'
import { EmptyState } from '../components/EmptyState'
import { nextTempIdValue } from '../lib/normalize'

export function CustomVariablesScreen() {
  const { draft, setDraft } = useBrandKitEdit()
  if (!draft) return null

  const add = () => {
    setDraft({
      ...draft,
      custom_variables: [
        ...draft.custom_variables,
        { id: nextTempIdValue(), name: 'new_variable', value: '' },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Custom Variables</h2>
          <p className="text-sm text-slate-500">Key–value pairs available to Playbooks and agents.</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-900"
        >
          Add Variable
        </button>
      </div>

      {draft.custom_variables.length === 0 ? (
        <EmptyState
          title="No custom variables"
          message="Add a variable to store reusable brand values."
        >
          <button
            type="button"
            onClick={add}
            className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium"
          >
            Add Variable
          </button>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Value</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {draft.custom_variables.map((variable) => (
                <tr key={variable.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <input
                      value={variable.name}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          custom_variables: draft.custom_variables.map((v) =>
                            v.id === variable.id ? { ...v, name: e.target.value } : v,
                          ),
                        })
                      }
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-700/30"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={variable.value}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          custom_variables: draft.custom_variables.map((v) =>
                            v.id === variable.id ? { ...v, value: e.target.value } : v,
                          ),
                        })
                      }
                      className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/30"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          custom_variables: draft.custom_variables.filter(
                            (v) => v.id !== variable.id,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
