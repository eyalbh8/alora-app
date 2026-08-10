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
    <DashboardCard title="Recent Agent Posts" subtitle="Latest content published by your agents">
      {isEmpty ? (
        <div className="flex h-full items-center justify-center px-6 text-sm text-slate-500">
          No recent agent posts.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-500">
              <th className="px-5 py-3 text-left font-medium">Agents</th>
              <th className="px-5 py-3 text-left font-medium">Date And Time</th>
              <th className="px-5 py-3 text-left font-medium">Topic</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post, i) => (
              <tr key={post.generationId ?? i} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3 text-slate-700">
                  {post.socialMediaProvider ?? 'Agent'}
                </td>
                <td className="px-5 py-3 text-slate-600">{formatDateTime(post.createdAt)}</td>
                <td className="max-w-[180px] truncate px-5 py-3 font-medium text-slate-800">
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
