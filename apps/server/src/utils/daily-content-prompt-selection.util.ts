/**
 * Pure prompt eligibility + opportunity scoring for daily content automation.
 */

export type SelectablePrompt = {
  id: string;
  prompt: string;
  topicId?: string | null;
  topicName?: string | null;
  topicPriority?: number | null;
  type?: string | null;
  stage?: string | null;
  volume?: number | null;
  avgVisibility?: number | null;
  visibilityChange?: number | null;
};

export type RecentPostLink = {
  promptId?: string | null;
  promptText?: string | null;
  createdAt?: string | Date | null;
};

export type PromptSelectionResult = {
  prompt: SelectablePrompt;
  score: number;
  rationale: string;
  visibilityAtSelection: number | null;
};

export function normalizePromptText(text: string | null | undefined): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a set of prompt IDs that already have content in the window.
 * Links via recommendation.promptId or normalized prompt text.
 */
export function buildRecentWorkPromptIds(
  posts: RecentPostLink[],
  promptTextToId: Map<string, string>,
): Set<string> {
  const recent = new Set<string>();
  for (const post of posts) {
    if (post.promptId) {
      recent.add(String(post.promptId));
      continue;
    }
    const key = normalizePromptText(post.promptText);
    if (!key) continue;
    const id = promptTextToId.get(key);
    if (id) recent.add(id);
  }
  return recent;
}

function isCommercial(prompt: SelectablePrompt): boolean {
  const type = String(prompt.type ?? '').toUpperCase();
  const stage = String(prompt.stage ?? '').toLowerCase();
  return (
    type === 'COMMERCIAL' ||
    stage.includes('commercial') ||
    stage.includes('option evaluation')
  );
}

/**
 * Higher score = better automation candidate (low visibility, declining, commercial).
 */
export function scorePromptOpportunity(prompt: SelectablePrompt): number {
  const visibility =
    typeof prompt.avgVisibility === 'number' && Number.isFinite(prompt.avgVisibility)
      ? prompt.avgVisibility
      : 50;
  const change =
    typeof prompt.visibilityChange === 'number' && Number.isFinite(prompt.visibilityChange)
      ? prompt.visibilityChange
      : 0;
  const volume =
    typeof prompt.volume === 'number' && Number.isFinite(prompt.volume) ? prompt.volume : 0;
  const topicPriority =
    typeof prompt.topicPriority === 'number' && Number.isFinite(prompt.topicPriority)
      ? prompt.topicPriority
      : 0;

  // Prefer low visibility (0 → 100 pts, 100 → 0 pts)
  const visibilityScore = Math.max(0, 100 - visibility);
  // Declining visibility is good for "improvement" direction
  const declineScore = change < 0 ? Math.min(40, Math.abs(change)) : change > 5 ? -10 : 0;
  const commercialBonus = isCommercial(prompt) ? 25 : 0;
  const volumeTiebreak = Math.min(15, volume / 100);
  const priorityTiebreak = Math.min(10, topicPriority);

  return visibilityScore + declineScore + commercialBonus + volumeTiebreak + priorityTiebreak;
}

export function buildSelectionRationale(
  prompt: SelectablePrompt,
  score: number,
): string {
  const parts: string[] = [];
  const vis =
    typeof prompt.avgVisibility === 'number' ? Math.round(prompt.avgVisibility) : null;
  if (vis != null) parts.push(`visibility ${vis}`);
  if (typeof prompt.visibilityChange === 'number' && prompt.visibilityChange < 0) {
    parts.push(`declining ${prompt.visibilityChange.toFixed(1)}`);
  }
  if (isCommercial(prompt)) parts.push('commercial intent');
  if (prompt.topicName) parts.push(`topic "${prompt.topicName}"`);
  parts.push(`score ${score.toFixed(1)}`);
  return parts.join('; ');
}

/**
 * Filter out prompts with recent work (posts or prior daily runs), score, return best.
 */
export function selectDailyContentPrompt(args: {
  prompts: SelectablePrompt[];
  recentWorkPromptIds: Set<string>;
  recentRunPromptIds: Set<string>;
}): PromptSelectionResult | null {
  const eligible = args.prompts.filter((p) => {
    if (!p.id || !normalizePromptText(p.prompt)) return false;
    if (args.recentWorkPromptIds.has(p.id)) return false;
    if (args.recentRunPromptIds.has(p.id)) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const ranked = eligible
    .map((prompt) => {
      const score = scorePromptOpportunity(prompt);
      return {
        prompt,
        score,
        rationale: buildSelectionRationale(prompt, score),
        visibilityAtSelection:
          typeof prompt.avgVisibility === 'number' ? Math.round(prompt.avgVisibility) : null,
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}
