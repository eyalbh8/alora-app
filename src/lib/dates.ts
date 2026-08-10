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

/** Previous period of equal length, ending the day before startDate (iGEO semantics). */
export function previousPeriodRange(range: DateRange): DateRange {
  const start = parseISO(range.startDate)
  const spanDays = daysInRange(range)
  const prevEnd = subDays(start, 1)
  const prevStart = subDays(prevEnd, spanDays - 1)
  return {
    startDate: format(prevStart, 'yyyy-MM-dd'),
    endDate: format(prevEnd, 'yyyy-MM-dd'),
  }
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

export const DEFAULT_TIME_PRESET_DAYS = 7

export const TIME_PRESET_OPTIONS: ReadonlyArray<{ days: (typeof TIME_PRESETS)[number]; label: string }> = [
  { days: 1, label: 'Last 24 hours' },
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

/** Resolve preset start date, clamped to optional min day. */
export function presetRange(
  days: number,
  endDay: string,
  minDay?: string | null,
): DateRange {
  let next = lastNDaysEnding(days, endDay)
  if (minDay && next.startDate < minDay) {
    next = { ...next, startDate: minDay }
  }
  return next
}

/** Returns matching preset day count, or null for a custom range. */
export function matchActivePresetDays(
  range: DateRange,
  endDay: string,
  minDay?: string | null,
): number | null {
  for (const days of TIME_PRESETS) {
    const ideal = presetRange(days, endDay, minDay)
    if (ideal.startDate === range.startDate && ideal.endDate === range.endDate) {
      return days
    }
  }
  return null
}

/** Button label: preset name or formatted custom span. */
export function formatTimeFilterLabel(
  range: DateRange,
  endDay: string,
  minDay?: string | null,
): string {
  const preset = matchActivePresetDays(range, endDay, minDay)
  if (preset != null) {
    return TIME_PRESET_OPTIONS.find((o) => o.days === preset)?.label ?? `Last ${preset} days`
  }
  return formatRangeLabel(range)
}
