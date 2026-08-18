import type { TopicRow } from '../../api/types'
import { formatNumber } from '../../lib/format'

function topicStateDot(state: string | null | undefined) {
  const normalized = (state ?? 'ACTIVE').toUpperCase()
  if (normalized === 'ACTIVE') return 'bg-accent'
  if (normalized === 'PAUSED' || normalized === 'DRAFT') return 'bg-amber-500'
  return 'bg-muted-dark'
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
    <section className="border-y border-line py-5" aria-labelledby="prompt-topics-heading">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-dark uppercase">
            Explore
          </p>
          <h2 id="prompt-topics-heading" className="mt-1 font-display text-xl text-ink">
            Topics
          </h2>
        </div>
        <span className="text-[11px] tracking-wide text-muted-dark uppercase">Managed in iGEO</span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter prompts by topic">
        <button
          type="button"
          onClick={onClearTopics}
          aria-pressed={allActive}
          className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            allActive
              ? 'border-ink bg-button text-button-ink'
              : 'border-line bg-transparent text-muted hover:border-ink hover:text-ink'
          }`}
        >
          All Topics
          <span className={allActive ? 'text-button-ink' : 'text-muted'}>{topics.length}</span>
        </button>

        {topics.map((topic) => {
          const active = selectedTopicIds.includes(topic.id)
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onToggleTopic(topic.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? 'border-accent bg-surface text-ink'
                  : 'border-line bg-transparent text-muted hover:border-ink hover:text-ink'
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 ${topicStateDot(topic.state)}`} />
              <span className="max-w-[140px] truncate">{topic.name}</span>
              <span className="font-display text-muted">{formatNumber(topic.promptsCount, 0)}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
