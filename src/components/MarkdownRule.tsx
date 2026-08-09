import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface MarkdownRuleProps {
  text: string
  onChange?: (text: string) => void
  onRemove?: () => void
  /** When true, start in edit mode (e.g. newly added rule). */
  defaultEditing?: boolean
}

/** Renders a writing rule's markdown-ish text with optional edit mode. */
export function MarkdownRule({
  text,
  onChange,
  onRemove,
  defaultEditing = false,
}: MarkdownRuleProps) {
  const [editing, setEditing] = useState(defaultEditing)

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Writing rule
        </span>
        <div className="flex gap-2">
          {onChange && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs font-medium text-slate-500 hover:text-brand-800"
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {editing && onChange ? (
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 outline-none ring-brand-700/30 focus:ring-2"
        />
      ) : (
        <div className="prose-rule text-sm leading-relaxed text-slate-700">
          <ReactMarkdown
            components={{
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-900">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">{children}</ul>
              ),
              li: ({ children }) => <li>{children}</li>,
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
