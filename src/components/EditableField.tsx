import { useEffect, useState } from 'react'

interface EditableFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  hint?: string
}

/** Click-to-edit field with pencil toggle, save/cancel, and dirty tracking. */
export function EditableField({
  label,
  value,
  onChange,
  multiline = true,
  rows = 4,
  placeholder,
  hint,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const dirty = draft !== value

  const save = () => {
    onChange(draft)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-emerald-800"
            aria-label={`Edit ${label}`}
          >
            <PencilIcon />
            Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-lg bg-emerald-800 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {editing ? (
        multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none ring-emerald-700/30 focus:ring-2"
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 outline-none ring-emerald-700/30 focus:ring-2"
          />
        )
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {value.trim() ? value : <span className="text-slate-400">{placeholder ?? 'Empty'}</span>}
        </p>
      )}
    </div>
  )
}

function PencilIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
    </svg>
  )
}
