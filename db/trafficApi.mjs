/**
 * iGEO traffic API helpers — per-day snapshot fetch paths.
 *
 * Daily sync stores one snapshot row per SYNC_DAY. Each call covers that day
 * only (previous calendar day is used for changePercent on ai-dashboard-data).
 */

/** @param {string} day YYYY-MM-DD (UTC) */
export function syncDayDateRange(day) {
  const startDate = new Date(`${day}T00:00:00.000Z`)
  const endDate = new Date(`${day}T23:59:59.999Z`)

  const prevEndDate = new Date(startDate.getTime() - 1)
  prevEndDate.setUTCHours(23, 59, 59, 999)

  const prevStartDate = new Date(prevEndDate)
  prevStartDate.setUTCHours(0, 0, 0, 0)

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    prevStartDate: prevStartDate.toISOString(),
    prevEndDate: prevEndDate.toISOString(),
  }
}

/** @param {string} accountId @param {string} syncDay YYYY-MM-DD */
export function aiDashboardPath(accountId, syncDay) {
  const q = new URLSearchParams(syncDayDateRange(syncDay))
  return `/traffic/${accountId}/ai-dashboard-data?${q.toString()}`
}

/** @param {string} accountId @param {string} syncDay YYYY-MM-DD */
export function crawlerAnalyticsPath(accountId, syncDay) {
  const q = new URLSearchParams(syncDayDateRange(syncDay))
  return `/traffic/${accountId}/cloudflare/crawler-analytics?${q.toString()}`
}
