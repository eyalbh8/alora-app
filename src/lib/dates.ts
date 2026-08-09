import { format, subDays } from 'date-fns'

export interface DateRange {
  start_date: string
  end_date: string
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Yesterday's date as YYYY-MM-dd in local time. */
export function yesterdayISO(): string {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd')
}

/**
 * Last N days ending yesterday. Use for `/analytics` which rejects end_date >= today.
 */
export function lastNDaysEndingYesterday(days: number): DateRange {
  const end = subDays(new Date(), 1)
  const start = subDays(end, days - 1)
  return {
    start_date: format(start, 'yyyy-MM-dd'),
    end_date: format(end, 'yyyy-MM-dd'),
  }
}

/**
 * Last N days through today. Matches the AirOps UI date picker.
 * Safe for `/citations/list` (allows today); clamp via `clampAnalyticsEndDate` for `/analytics`.
 */
export function lastNDaysThroughToday(days: number): DateRange {
  const end = new Date()
  const start = subDays(end, days - 1)
  return {
    start_date: format(start, 'yyyy-MM-dd'),
    end_date: format(end, 'yyyy-MM-dd'),
  }
}

/**
 * Analytics rejects end_date >= today. Clamp so shared UI ranges that include
 * today still work for getAnalytics calls.
 */
export function clampAnalyticsEndDate(range: Pick<DateRange, 'start_date' | 'end_date'>): DateRange {
  const yesterday = yesterdayISO()
  const end_date = range.end_date > yesterday ? yesterday : range.end_date
  const start_date = range.start_date > end_date ? end_date : range.start_date
  return { start_date, end_date }
}

/** "Jul 10 – Aug 8, 2026" */
export function formatRangeLabel(range: DateRange): string {
  const start = new Date(`${range.start_date}T00:00:00`)
  const end = new Date(`${range.end_date}T00:00:00`)
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = format(start, sameYear ? 'MMM d' : 'MMM d, yyyy')
  return `${startLabel} – ${format(end, 'MMM d, yyyy')}`
}

/** "Jun 1" – short label for chart axes. */
export function shortDateLabel(isoDate: string): string {
  return format(new Date(`${isoDate}T00:00:00`), 'MMM d')
}
