/**
 * iGEO traffic API helpers — date ranges and snapshot fetch paths.
 *
 * The ai-dashboard-data endpoint requires all four date params; without them
 * it returns empty llmProviders / historicalData (only hasEvents + preferences).
 */

/** @param {number} days inclusive window ending today UTC */
export function trafficDateRange(days = 90, end = new Date()) {
  const endDate = new Date(end)
  endDate.setUTCHours(23, 59, 59, 999)

  const startDate = new Date(endDate)
  startDate.setUTCDate(startDate.getUTCDate() - days + 1)
  startDate.setUTCHours(0, 0, 0, 0)

  const prevEndDate = new Date(startDate.getTime() - 1)
  prevEndDate.setUTCHours(23, 59, 59, 999)

  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setUTCDate(prevStartDate.getUTCDate() - days + 1)
  prevStartDate.setUTCHours(0, 0, 0, 0)

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    prevStartDate: prevStartDate.toISOString(),
    prevEndDate: prevEndDate.toISOString(),
  }
}

export function aiDashboardPath(accountId, days = 90, end = new Date()) {
  const q = new URLSearchParams(trafficDateRange(days, end))
  return `/traffic/${accountId}/ai-dashboard-data?${q.toString()}`
}

export function crawlerAnalyticsPath(accountId, days = 90, end = new Date()) {
  const q = new URLSearchParams({ ...trafficDateRange(days, end), range: String(days) })
  return `/traffic/${accountId}/cloudflare/crawler-analytics?${q.toString()}`
}
