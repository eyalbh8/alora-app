import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBrandKitEdit } from '../context/BrandKitEditContext'
import { DiffRow } from '../components/DiffRow'
import { EmptyState } from '../components/EmptyState'
import { SubmitDisclaimer } from '../components/SubmitDisclaimer'

export function ReviewScreen() {
  const {
    isDirty,
    getDiff,
    submit,
    submitting,
    submitError,
    submitSuccess,
    clearSubmitFeedback,
  } = useBrandKitEdit()

  const diff = useMemo(() => getDiff(), [getDiff, isDirty])
  const changes = diff?.changes ?? []

  const grouped = useMemo(() => {
    const map = new Map<string, typeof changes>()
    for (const change of changes) {
      const list = map.get(change.entity) ?? []
      list.push(change)
      map.set(change.entity, list)
    }
    return [...map.entries()]
  }, [changes])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[#101414]">Review & Submit</h2>
          <p className="text-sm text-slate-500">
            Here&apos;s what changed locally vs. the last fetched Brand Kit.
          </p>
        </div>
        <Link to="/brand-kit" className="text-sm font-medium text-slate-500 hover:text-slate-800">
          ← Back to editor
        </Link>
      </div>

      <SubmitDisclaimer />

      {!isDirty || changes.length === 0 ? (
        <EmptyState
          title="No local changes"
          message="Edit a field on any tab, then return here to review the diff."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([entity, items]) => (
            <section key={entity} className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">{entity}</h3>
              <div className="space-y-2">
                {items.map((change) => (
                  <DiffRow key={`${change.path}-${change.label}`} change={change} />
                ))}
              </div>
            </section>
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                clearSubmitFeedback()
                void submit()
              }}
              className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-900 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Confirm & send for review'}
            </button>
            <p className="text-xs text-slate-400">
              Posts the diff to <code className="rounded bg-slate-100 px-1">VITE_SUBMIT_WEBHOOK_URL</code>
              — not to api.airops.com.
            </p>
          </div>
        </div>
      )}

      {submitSuccess && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {submitSuccess}
        </div>
      )}
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {submitError}
        </div>
      )}
    </div>
  )
}
