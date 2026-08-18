/** upstream Sentiment page: average every historical point, then split the series in half. */

export function averageScore(scores: number[]): number | null {
  if (!scores.length) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

export function sentimentPeriodScores(
  historical: Array<{ sentimentScore?: number | null }>,
): { current: number | null; previous: number | null } {
  const scores = historical
    .map((row) => row.sentimentScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return {
    current: averageScore(scores),
    previous: averageScore(scores.slice(0, Math.floor(scores.length / 2))),
  }
}

/** upstream uses two decimal places: (75 - 74) / 74 → +1.35%. */
export function sentimentPctChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null || previous <= 0) return null
  return Math.round(((current - previous) / previous) * 10000) / 100
}
