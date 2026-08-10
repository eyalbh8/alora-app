import { format, subDays, parseISO, differenceInCalendarDays } from 'date-fns'

export interface DateRange {
  startDate: string
  endDate: string
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function yesterdayISO(): string {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd')
}

/** Last N days ending on `end` (inclusive). */
export function lastNDaysEnding(days: number, end: string = yesterdayISO()): DateRange {
  const endDate = parseISO(end)
  const startDate = subDays(endDate, days - 1)
  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  }
}

export function daysInRange(range: DateRange): number {
  return differenceInCalendarDays(parseISO(range.endDate), parseISO(range.startDate)) + 1
}

/** "Jul 10 – Aug 8, 2026" */
export function formatRangeLabel(range: DateRange): string {
  const start = new Date(`${range.startDate}T00:00:00`)
  const end = new Date(`${range.endDate}T00:00:00`)
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = format(start, sameYear ? 'MMM d' : 'MMM d, yyyy')
  return `${startLabel} – ${format(end, 'MMM d, yyyy')}`
}

export function shortDateLabel(isoDate: string): string {
  return format(new Date(`${isoDate.slice(0, 10)}T00:00:00`), 'MMM d')
}

export function formatPulledAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'MMM d, yyyy HH:mm')
  } catch {
    return iso
  }
}

export const TIME_PRESETS = [1, 7, 14, 30, 90] as const
