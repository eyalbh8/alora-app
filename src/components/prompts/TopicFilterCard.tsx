import type { TopicRow } from '../../api/types'
import { formatNumber } from '../../lib/format'

function topicStateDot(state: string | null | undefined) {
  const normalized = (state ?? 'ACTIVE').toUpperCase()
  if (normalized === 'ACTIVE') return 'bg-brand-500'
  if (normalized === 'PAUSED' || normalized === 'DRAFT') return 'bg-amber-400'
  return 'bg-slate-300'
}

interface TopicFilterCardProps {
  topics: TopicRow[]
  selectedTopicIds: string[]
  onToggleTopic: (topicId: string) => void
  onClearTopics: () => void
}

export function TopicFilterCard({
  topics,
  selectedTopicIds,
  onToggleTopic,
  onClearTopics,
}: TopicFilterCardProps) {
  const allActive = selectedTopicIds.length === 0

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#101414]">Topics</h2>
        <button
          type="button"
          disabled
          title="Manage topics in iGEO"
          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white opacity-90"
        >
          Manage Topics
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClearTopics}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            allActive
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          All Topics
          <span className={allActive ? 'text-brand-100' : 'text-slate-400'}>/ {topics.length}</span>
        </button>

        {topics.map((topic) => {
          const active = selectedTopicIds.includes(topic.id)
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onToggleTopic(topic.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'border-brand-200 bg-brand-50 text-brand-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${topicStateDot(topic.state)}`} />
              <span className="max-w-[140px] truncate">{topic.name}</span>
              <span className="text-slate-400">/ {formatNumber(topic.promptsCount, 0)}</span>
              {active && (
                <span
                  role="presentation"
                  className="ml-0.5 text-slate-400 hover:text-slate-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleTopic(topic.id)
                  }}
                >
                  ×
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
