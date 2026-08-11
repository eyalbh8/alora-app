import type { CompetitorPerformance, DashboardData, ProviderMention } from '../../api/types'
import { providerLabel } from '../format'

export interface BriefSignal {
  title: string
  detail: string
}

export interface BriefAction {
  title: string
  detail: string
  href: '/mentions' | '/competitors' | '/sentiment' | '/prompts'
  provider?: string
}

export interface BriefSnapshot {
  totalMentions: number
  shareOfVoice: number | null
  averageRank: number | null
  rankDelta: number | null
  sentiment: number | null
  sentimentDelta: number | null
  promptsCount: number | null
}

export interface AccountBrief {
  snapshot: BriefSnapshot
  account: CompetitorPerformance | null
  wins: BriefSignal[]
  risks: BriefSignal[]
  actions: BriefAction[]
}

function accountRow(rows: CompetitorPerformance[]): CompetitorPerformance | null {
  return rows.find((row) => row.isAccount || row.id.toLowerCase() === 'account') ?? null
}

function signedPoints(value: number): string {
  return `${Math.round(Math.abs(value))} ${Math.round(Math.abs(value)) === 1 ? 'point' : 'points'}`
}

function providerChanges(rows: ProviderMention[], direction: 'up' | 'down') {
  return rows
    .filter((row) =>
      direction === 'up' ? (row.countChange ?? 0) > 0 : (row.countChange ?? 0) < 0,
    )
    .sort((a, b) => Math.abs(b.countChange ?? 0) - Math.abs(a.countChange ?? 0))
}

export function buildAccountBrief(
  payload: Pick<DashboardData, 'promptsCount'>,
  providers: ProviderMention[],
  competitors: CompetitorPerformance[],
): AccountBrief {
  const account = accountRow(competitors)
  const totalMentions = providers.reduce((sum, row) => sum + (row.count ?? 0), 0)
  const categoryMentions = competitors.reduce((sum, row) => sum + (row.occurrences ?? 0), 0)
  const shareOfVoice =
    account?.occurrences != null && categoryMentions > 0
      ? (account.occurrences / categoryMentions) * 100
      : null

  const wins: BriefSignal[] = []
  const risks: BriefSignal[] = []

  for (const row of providerChanges(providers, 'up').slice(0, 2)) {
    wins.push({
      title: `${providerLabel(row.provider)} is gaining`,
      detail: `Mentions increased ${Math.round(Math.abs(row.countChange ?? 0))}% this period.`,
    })
  }
  if (account?.position === 1) {
    wins.push({
      title: 'You lead the category',
      detail: 'Your brand has the highest mention volume in the tracked market.',
    })
  } else if ((account?.avgRankDelta ?? 0) < 0) {
    wins.push({
      title: 'Average rank improved',
      detail: `Your position moved up by ${signedPoints(account?.avgRankDelta ?? 0)}.`,
    })
  }
  if ((account?.sentimentScoreDelta ?? 0) > 0) {
    wins.push({
      title: 'Brand sentiment strengthened',
      detail: `Sentiment increased by ${signedPoints(account?.sentimentScoreDelta ?? 0)}.`,
    })
  }

  for (const row of providerChanges(providers, 'down').slice(0, 2)) {
    risks.push({
      title: `${providerLabel(row.provider)} visibility declined`,
      detail: `Mentions fell ${Math.round(Math.abs(row.countChange ?? 0))}% this period.`,
    })
  }
  if ((account?.avgRankDelta ?? 0) > 0) {
    risks.push({
      title: 'Average rank slipped',
      detail: `Your position moved down by ${signedPoints(account?.avgRankDelta ?? 0)}.`,
    })
  }
  if ((account?.sentimentScoreDelta ?? 0) < 0) {
    risks.push({
      title: 'Sentiment needs attention',
      detail: `Brand sentiment dropped by ${signedPoints(account?.sentimentScoreDelta ?? 0)}.`,
    })
  }

  const risingLeader = competitors
    .filter(
      (row) =>
        !row.isAccount &&
        row.id.toLowerCase() !== 'account' &&
        (row.position ?? Infinity) < (account?.position ?? Infinity) &&
        (row.occurrencesDelta ?? 0) > 0,
    )
    .sort((a, b) => (b.occurrencesDelta ?? 0) - (a.occurrencesDelta ?? 0))[0]
  if (risingLeader) {
    risks.push({
      title: `${risingLeader.name} is building momentum`,
      detail: `Mentions are up ${Math.round(risingLeader.occurrencesDelta ?? 0)}% while they rank ahead.`,
    })
  }

  const actions: BriefAction[] = []
  const weakestProvider = providerChanges(providers, 'down')[0]
  if (weakestProvider) {
    actions.push({
      title: `Review ${providerLabel(weakestProvider.provider)} answers`,
      detail: 'Find the prompts and sources behind the visibility drop.',
      href: '/mentions',
      provider: weakestProvider.provider,
    })
  }
  if ((account?.avgRankDelta ?? 0) > 0 || (account?.position ?? 0) > 3 || risingLeader) {
    actions.push({
      title: 'Close the competitor gap',
      detail: 'Compare the prompts and citations where leading brands outperform you.',
      href: '/competitors',
    })
  }
  if ((account?.sentimentScoreDelta ?? 0) < 0) {
    actions.push({
      title: 'Inspect sentiment drivers',
      detail: 'Review responses that may be weakening brand perception.',
      href: '/sentiment',
    })
  }
  if (actions.length === 0) {
    actions.push({
      title: 'Expand prompt coverage',
      detail: 'Add or refine tracked questions to uncover the next growth opportunity.',
      href: '/prompts',
    })
  }

  return {
    snapshot: {
      totalMentions,
      shareOfVoice,
      averageRank: account?.avgRank ?? null,
      rankDelta: account?.avgRankDelta ?? null,
      sentiment: account?.sentimentScore ?? null,
      sentimentDelta: account?.sentimentScoreDelta ?? null,
      promptsCount: payload.promptsCount ?? null,
    },
    account,
    wins: wins.slice(0, 3),
    risks: risks.slice(0, 3),
    actions: actions.slice(0, 3),
  }
}
