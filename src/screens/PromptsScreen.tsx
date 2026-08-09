import { useEffect, useMemo, useState } from 'react'
import { listPrompts, listTopics } from '../api/airops'
import type { ApiFilter, PromptRow, PromptVolume } from '../api/types'
import { DataTable, type Column } from '../components/DataTable'
import { Pill, toneFromColor, type PillTone } from '../components/Pill'
import { TrendBadge } from '../components/TrendBadge'
import { useApi } from '../hooks/useApi'
import { lastNDaysEndingYesterday } from '../lib/dates'
import { formatPercent } from '../lib/format'

const VOLUME_CONFIG: Record<PromptVolume, { label: string; tone: PillTone }> = {
  very_low: { label: 'Very low', tone: 'grey' },
  low: { label: 'Low', tone: 'blue' },
  medium: { label: 'Medium', tone: 'orange' },
  high: { label: 'High', tone: 'green' },
}

function VolumePill({ volume }: { volume: PromptVolume | null }) {
  if (!volume || !(volume in VOLUME_CONFIG)) {
    return <span className="text-slate-300">—</span>
  }
  const { label, tone } = VOLUME_CONFIG[volume]
  return <Pill tone={tone}>{label}</Pill>
}

export function PromptsScreen() {
  const range = useMemo(() => lastNDaysEndingYesterday(30), [])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('-mention_rate')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [topicId, setTopicId] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  const topics = useApi(listTopics, [])
  const topicById = useMemo(
    () => new Map((topics.data ?? []).map((topic) => [topic.id, topic])),
    [topics.data],
  )

  const filters = useMemo(() => {
    const list: ApiFilter[] = []
    if (debouncedSearch) list.push({ field: 'text', operator: 'CONTAINS', value: debouncedSearch })
    if (topicId) list.push({ field: 'topic_id', operator: 'EQ', value: Number(topicId) })
    return list
  }, [debouncedSearch, topicId])

  useEffect(() => setPage(1), [filters, sort])

  const prompts = useApi(
    () =>
      listPrompts({
        ...range,
        filters: filters.length ? filters : undefined,
        includes: ['topic'],
        sort,
        page,
        per_page: 25,
      }),
    [range, filters, sort, page],
  )

  const columns: Column<PromptRow>[] = [
    {
      key: 'text',
      header: 'Prompt',
      sortable: true,
      render: (row) => (
        <span className="block max-w-md font-medium text-slate-800" title={row.text}>
          {row.text}
        </span>
      ),
    },
    {
      key: 'keyword',
      header: 'Keyword',
      render: (row) => <span className="text-slate-500">{row.keyword || '—'}</span>,
    },
    {
      key: 'topic',
      header: 'Topic',
      render: (row) => {
        // Prefer the included topic object; fall back to topic_id resolved via /topics/list.
        const topic = row.topic ?? (row.topic_id ? topicById.get(row.topic_id) : undefined)
        if (!topic) return <span className="text-slate-300">—</span>
        return <Pill tone={toneFromColor(topic.color)}>{topic.name}</Pill>
      },
    },
    {
      key: 'prompt_volume',
      header: 'Volume',
      render: (row) => <VolumePill volume={row.prompt_volume} />,
    },
    {
      key: 'mention_rate',
      header: 'Mention Rate',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <span>{formatPercent(row.mention_rate)}</span>
          <TrendBadge value={row.mention_rate_trend} percent />
        </div>
      ),
    },
    {
      key: 'citation_rate',
      header: 'Citation Rate',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <span>{formatPercent(row.citation_rate)}</span>
          <TrendBadge value={row.citation_rate_trend} percent />
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts…"
          className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 focus:outline-none"
        />
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm focus:border-indigo-400 focus:outline-none"
        >
          <option value="">All topics</option>
          {(topics.data ?? []).map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={prompts.data?.data ?? []}
        rowKey={(row) => row.id}
        loading={prompts.loading}
        error={prompts.error}
        onRetry={prompts.retry}
        sort={sort}
        onSortChange={setSort}
        page={page}
        totalPages={prompts.data?.meta.total_pages ?? 1}
        totalCount={prompts.data?.meta.total_count}
        onPageChange={setPage}
        emptyTitle="No prompts found"
        emptyMessage="No tracked prompts match the current filters."
      />
    </div>
  )
}
