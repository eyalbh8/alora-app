import type { CitationRow } from '../api/types'

export interface SubredditAggregate {
  subreddit: string
  label: string
  citationCount: number
  citationRate: number
  citationShare: number
  urls: CitationRow[]
}

const REDDIT_HOST = /(?:^|\.)reddit\.com$/i

/** True when the citation URL/domain is Reddit. */
export function isRedditCitation(row: CitationRow): boolean {
  try {
    const host = new URL(row.url).hostname.replace(/^www\./, '')
    if (REDDIT_HOST.test(host)) return true
  } catch {
    // fall through to domain_name check
  }
  return /reddit/i.test(row.domain_name ?? '')
}

/**
 * Extract `/r/name` from a Reddit URL. Returns null when the path has no subreddit.
 */
export function parseSubreddit(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const match = path.match(/^\/r\/([^/]+)/i)
    return match ? match[1].toLowerCase() : null
  } catch {
    return null
  }
}

/** Filter citation inventory down to Reddit URLs. */
export function filterRedditCitations(rows: CitationRow[]): CitationRow[] {
  return rows.filter(isRedditCitation)
}

/**
 * Aggregate Reddit URLs by subreddit.
 * Citation rate uses the max URL rate (lower bound for “any URL in this subreddit”).
 * Citation share is recalculated from citation counts within the Reddit set.
 */
export function aggregateSubreddits(rows: CitationRow[]): SubredditAggregate[] {
  const reddit = filterRedditCitations(rows)
  const bySub = new Map<string, SubredditAggregate>()

  for (const row of reddit) {
    const name = parseSubreddit(row.url) ?? 'unknown'
    const existing = bySub.get(name)
    if (existing) {
      existing.citationCount += row.citation_count ?? 0
      existing.urls.push(row)
      if ((row.citation_rate ?? 0) > existing.citationRate) {
        existing.citationRate = row.citation_rate ?? 0
      }
    } else {
      bySub.set(name, {
        subreddit: name,
        label: `/r/${name}`,
        citationCount: row.citation_count ?? 0,
        citationRate: row.citation_rate ?? 0,
        citationShare: 0,
        urls: [row],
      })
    }
  }

  const total = [...bySub.values()].reduce((sum, s) => sum + s.citationCount, 0) || 1

  return [...bySub.values()]
    .map((s) => ({
      ...s,
      citationShare: (s.citationCount / total) * 100,
    }))
    .sort((a, b) => b.citationRate - a.citationRate || b.citationCount - a.citationCount)
}

export interface RedditCommunitySummary {
  citationCount: number
  /** Max URL citation rate across Reddit URLs (proxy for Reddit citation rate). */
  citationRate: number
  urls: CitationRow[]
  subreddits: SubredditAggregate[]
}

export function summarizeRedditCommunity(rows: CitationRow[]): RedditCommunitySummary {
  const urls = filterRedditCitations(rows)
  const citationCount = urls.reduce((sum, r) => sum + (r.citation_count ?? 0), 0)
  const citationRate = urls.reduce((max, r) => Math.max(max, r.citation_rate ?? 0), 0)
  return {
    citationCount,
    citationRate,
    urls: [...urls].sort((a, b) => (b.citation_count ?? 0) - (a.citation_count ?? 0)),
    subreddits: aggregateSubreddits(urls),
  }
}
