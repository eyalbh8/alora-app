import type { AgentPost } from '../../api/types'
import { DashboardCard } from './DashboardCard'

interface RecentAgentPostsCardProps {
  posts: AgentPost[]
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

export function RecentAgentPostsCard({ posts }: RecentAgentPostsCardProps) {
  const rows = posts.slice(0, 5)
  const isEmpty = rows.length === 0

  return (
    <DashboardCard
      title="Work shipped"
      subtitle="Recent deliverables from your AI agents"
      variant="editorial"
      contentClassName="overflow-x-auto"
    >
      {isEmpty ? (
        <div className="flex min-h-52 items-center justify-center border border-dashed border-line px-6 text-xs text-muted">
          No agent deliverables in this period.
        </div>
      ) : (
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-line text-[12px] font-medium text-muted">
              <th className="pb-2.5 text-left font-semibold">Channel</th>
              <th className="px-4 pb-2.5 text-left font-semibold">Published</th>
              <th className="pb-2.5 text-left font-semibold">Topic / prompt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post, i) => (
              <tr key={post.generationId ?? i} className="border-b border-line">
                <td className="py-3 text-ink">
                  {post.socialMediaProvider ?? 'Agent'}
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(post.createdAt)}</td>
                <td className="max-w-[180px] truncate py-3 font-medium text-ink">
                  {post.topic ?? post.prompt ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardCard>
  )
}
