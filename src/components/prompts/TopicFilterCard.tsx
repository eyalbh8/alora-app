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
      <div className="mb-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-dark uppercase">
          Explore
        </p>
        <h2 id="prompt-topics-heading" className="mt-1 font-display text-xl text-ink">
          Topics
        </h2>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter prompts by topic">
        <button
          type="button"
          onClick={onClearTopics}
          aria-pressed={allActive}
          className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            allActive
              ? 'border-accent bg-surface text-ink'
              : 'border-line bg-transparent text-muted hover:border-ink hover:text-ink'
          }`}
        >
          All Topics
          <span className="font-display text-muted">{topics.length}</span>
        </button>

        {topics.map((topic) => {
          const active = selectedTopicIds.some((id) => String(id) === String(topic.id))
          const count = formatNumber(topic.promptsCount, 0)
          return (
            <button
              key={topic.id}
              type="button"
              title={topic.name}
              onClick={() => onToggleTopic(topic.id)}
              aria-pressed={active}
              className={`group relative z-0 inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition hover:z-30 focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? 'border-accent bg-surface text-ink'
                  : 'border-line bg-transparent text-muted hover:border-ink hover:text-ink'
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 ${topicStateDot(topic.state)}`} />
              <span className="max-w-[140px] truncate">{topic.name}</span>
              <span className="font-display text-muted">{count}</span>
              <span
                aria-hidden
                className={`pointer-events-none absolute top-0 left-0 z-10 hidden h-full items-center gap-2 whitespace-nowrap border px-3 group-hover:inline-flex group-focus-visible:inline-flex ${
                  active
                    ? 'border-accent bg-surface text-ink'
                    : 'border-ink bg-surface text-ink'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 ${topicStateDot(topic.state)}`} />
                {topic.name}
                <span className="font-display text-muted">{count}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
