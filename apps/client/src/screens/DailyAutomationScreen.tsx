import { useMemo, useState } from 'react'
import { PageLoader } from '../components/loading'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import {
  PostPreviewDrawer,
  StatusPill,
} from '../components/dailyContent/PostPreviewDrawer'
import type { DailyContentRun, PlatformState } from '../api/dailyContent'
import {
  useDailyContentRunPosts,
  useDailyContentRuns,
  useDailyContentSettings,
  useUpdateDailyContentSettings,
} from '../hooks/use-daily-content-runs'

const PLATFORMS = ['BLOG', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'X'] as const

function hasViewablePosts(run: DailyContentRun): boolean {
  return PLATFORMS.some((provider) => {
    const state = run.platforms?.[provider]
    return Boolean(state?.selectedPostId || state?.postIds?.length || state?.generationId)
  })
}

function PlatformCell({ state }: { state?: PlatformState }) {
  if (!state) {
    return <span className="text-sm text-[var(--muted)]">—</span>
  }
  return (
    <div className="flex flex-col gap-1">
      <StatusPill status={state.status} />
      {state.error ? (
        <span className="text-xs text-[var(--error)] line-clamp-2" title={state.error}>
          {state.error}
        </span>
      ) : null}
      {state.selectedPostId ? (
        <span className="font-mono text-[10px] text-[var(--muted)]">
          {state.selectedPostId.slice(0, 8)}…
        </span>
      ) : null}
    </div>
  )
}

function AdminRunPostsDrawer({
  runId,
  onClose,
}: {
  runId: string
  onClose: () => void
}) {
  const { data, isLoading, error, refetch } = useDailyContentRunPosts(runId)
  const posts = useMemo(() => data?.posts ?? [], [data?.posts])

  return (
    <PostPreviewDrawer
      runId={runId}
      posts={posts}
      promptText={data?.run?.promptText}
      localDate={data?.run?.localDate}
      isLoading={isLoading}
      error={error}
      onRetry={() => void refetch()}
      onClose={onClose}
    />
  )
}

function RunCard({
  run,
  onViewPosts,
}: {
  run: DailyContentRun
  onViewPosts: (runId: string) => void
}) {
  const canView = hasViewablePosts(run)

  return (
    <article className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusPill status={run.status} />
            <span className="text-sm text-[var(--muted)]">{run.localDate}</span>
            {run.visibilityAtSelection != null ? (
              <span className="text-sm text-[var(--muted)]">
                visibility {run.visibilityAtSelection}
              </span>
            ) : null}
          </div>
          <p className="text-base font-medium text-[var(--ink)] line-clamp-2">
            {run.promptText || 'No prompt selected'}
          </p>
          {run.selectionRationale ? (
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{run.selectionRationale}</p>
          ) : null}
          {run.skipReason ? (
            <p className="mt-1 text-sm text-amber-800">Skipped: {run.skipReason}</p>
          ) : null}
          {run.error ? <p className="mt-1 text-sm text-[var(--error)]">{run.error}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-xs text-[var(--muted)]">
            <div>Started {new Date(run.startedAt).toLocaleString()}</div>
            {run.completedAt ? (
              <div>Done {new Date(run.completedAt).toLocaleString()}</div>
            ) : null}
          </div>
          {canView ? (
            <button
              type="button"
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--ink)]"
              onClick={() => onViewPosts(run.id)}
            >
              View posts
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PLATFORMS.map((provider) => (
          <div
            key={provider}
            className="rounded-[var(--r-row)] border border-[var(--line)] bg-[var(--paper-soft)] p-3"
          >
            <div className="mb-2 text-xs font-semibold tracking-wide text-[var(--ink-soft)]">
              {provider}
            </div>
            <PlatformCell state={run.platforms?.[provider]} />
          </div>
        ))}
      </div>
    </article>
  )
}

function SettingsPanel() {
  const { data: settings, isLoading, error, refetch } = useDailyContentSettings()
  const update = useUpdateDailyContentSettings()

  if (isLoading && !settings) return <PageLoader />
  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : String(error)}
        onRetry={() => void refetch()}
      />
    )
  }
  if (!settings) return null

  return (
    <section className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
      <h2 className="mb-1 text-lg font-semibold text-[var(--ink)]">Automation settings</h2>
      <p className="mb-4 text-sm text-[var(--ink-soft)]">
        When enabled, Menchly runs once per local day at the configured hour: picks a 50-day-stale
        opportunity prompt, generates blog + social posts via MCP, then optimizes the winners.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={settings.dailyContentAutomation}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate({ dailyContentAutomation: e.target.checked })
            }
          />
          Enable daily content automation
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--ink-soft)]">
          Timezone
          <input
            key={`tz-${settings.dailyContentTimezone}`}
            type="text"
            className="rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]"
            defaultValue={settings.dailyContentTimezone}
            disabled={update.isPending}
            onBlur={(e) => {
              const value = e.target.value.trim()
              if (value && value !== settings.dailyContentTimezone) {
                update.mutate({ dailyContentTimezone: value })
              }
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-[var(--ink-soft)]">
          Local hour (0–23)
          <input
            key={`hour-${settings.dailyContentHour}`}
            type="number"
            min={0}
            max={23}
            className="w-24 rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-3 py-2 text-[var(--ink)]"
            defaultValue={settings.dailyContentHour}
            disabled={update.isPending}
            onBlur={(e) => {
              const hour = Number(e.target.value)
              if (
                Number.isInteger(hour) &&
                hour >= 0 &&
                hour <= 23 &&
                hour !== settings.dailyContentHour
              ) {
                update.mutate({ dailyContentHour: hour })
              }
            }}
          />
        </label>
      </div>

      {update.isError ? (
        <p className="mt-3 text-sm text-[var(--error)]">
          {update.error instanceof Error ? update.error.message : 'Failed to save settings'}
        </p>
      ) : null}
      {update.isSuccess ? (
        <p className="mt-3 text-sm text-emerald-700">Settings saved.</p>
      ) : null}
    </section>
  )
}

export function DailyAutomationScreen() {
  const runsQuery = useDailyContentRuns(30)
  const runs = runsQuery.data ?? []
  const [viewRunId, setViewRunId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="screen-title">Daily automation</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Scheduled content generation and optimization for this workspace.
        </p>
      </div>

      <SettingsPanel />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Recent runs</h2>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-[var(--ink)]"
            onClick={() => void runsQuery.refetch()}
          >
            Refresh
          </button>
        </div>

        {runsQuery.isLoading && runs.length === 0 ? <PageLoader /> : null}
        {runsQuery.error ? (
          <ErrorState
            message={
              runsQuery.error instanceof Error
                ? runsQuery.error.message
                : String(runsQuery.error)
            }
            onRetry={() => void runsQuery.refetch()}
          />
        ) : null}
        {!runsQuery.isLoading && !runsQuery.error && runs.length === 0 ? (
          <EmptyState
            title="No runs yet"
            message="Enable automation above. Runs appear after the next local scheduled hour."
          />
        ) : null}

        <div className={`flex flex-col gap-4${runsQuery.isFetching ? ' opacity-80' : ''}`}>
          {runs.map((run) => (
            <RunCard key={run.id} run={run} onViewPosts={setViewRunId} />
          ))}
        </div>
      </section>

      {viewRunId ? (
        <AdminRunPostsDrawer runId={viewRunId} onClose={() => setViewRunId(null)} />
      ) : null}
    </div>
  )
}
