import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_TIME_PRESET_DAYS,
  TIME_PRESET_OPTIONS,
  formatTimeFilterLabel,
  matchActivePresetDays,
  type DateRange,
} from '../../lib/dates'

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function inRange(day: Date, start: Date, end: Date): boolean {
  const [a, b] = isBefore(start, end) ? [start, end] : [end, start]
  return !isBefore(day, a) && !isAfter(day, b)
}

export function DateRangePicker({
  range,
  onChange,
  onPreset,
  onResetDefault,
  endDay,
  minDay,
  maxDay,
  align = 'end',
}: {
  range: DateRange
  onChange: (next: DateRange) => void
  onPreset: (days: number) => void
  onResetDefault: () => void
  endDay: string
  minDay?: string
  maxDay?: string
  /** `start` opens to the right of the trigger; `end` opens to the left on desktop. */
  align?: 'start' | 'end'
}) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => parseISO(range.endDate))
  const [draftStart, setDraftStart] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const activePreset = useMemo(
    () => matchActivePresetDays(range, endDay, minDay),
    [range, endDay, minDay],
  )

  const buttonLabel = useMemo(
    () => formatTimeFilterLabel(range, endDay, minDay),
    [range, endDay, minDay],
  )

  useEffect(() => {
    if (!open) return
    setViewMonth(parseISO(range.endDate))
    setDraftStart(null)
  }, [open, range.endDate])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setDraftStart(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const clampRange = (startDate: string, endDate: string): DateRange => {
    let start = startDate
    let end = endDate
    if (maxDay && end > maxDay) end = maxDay
    if (minDay && start < minDay) start = minDay
    if (maxDay && start > maxDay) start = maxDay
    if (minDay && end < minDay) end = minDay
    if (start > end) [start, end] = [end, start]
    return { startDate: start, endDate: end }
  }

  const selectDay = (iso: string) => {
    if (minDay && iso < minDay) return
    if (maxDay && iso > maxDay) return

    if (!draftStart) {
      setDraftStart(iso)
      return
    }

    onChange(clampRange(draftStart, iso))
    setDraftStart(null)
  }

  const rangeStart = parseISO(range.startDate)
  const rangeEnd = parseISO(range.endDate)
  const draftStartDate = draftStart ? parseISO(draftStart) : null

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
  })

  const isDisabled = (d: Date) => {
    const iso = toIso(d)
    if (minDay && iso < minDay) return true
    if (maxDay && iso > maxDay) return true
    return false
  }

  const dayClass = (d: Date) => {
    const disabled = isDisabled(d)
    const outside = !isSameMonth(d, viewMonth)

    let highlightStart = rangeStart
    let highlightEnd = rangeEnd
    if (draftStartDate) {
      highlightStart = draftStartDate
      highlightEnd = draftStartDate
    }

    const isStart = isSameDay(d, highlightStart)
    const isEnd = isSameDay(d, highlightEnd)
    const inSpan =
      !draftStartDate &&
      inRange(d, rangeStart, rangeEnd) &&
      !(isSameDay(rangeStart, rangeEnd) && isStart)

    let cls =
      'relative flex h-8 w-full min-w-0 items-center justify-center rounded-full text-xs tabular-nums transition-colors '
    if (disabled) cls += 'cursor-not-allowed text-muted-dark/40 '
    else cls += 'cursor-pointer '
    if (outside && !inSpan && !isStart && !isEnd) cls += 'text-muted-dark/50 '
    else if (!disabled) cls += 'text-ink '

    if (inSpan && !disabled) cls += 'bg-accent/20 '
    if ((isStart || isEnd) && !disabled) {
      cls += 'bg-accent font-medium text-button-ink hover:bg-accent '
    } else if (!disabled) {
      cls += 'hover:bg-paper-soft '
    }

    return cls
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
          open ? 'border-ink bg-paper-soft' : 'border-line bg-surface hover:border-ink hover:bg-paper-soft'
        }`}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-muted-dark" />
        <span className="font-medium text-ink">{buttonLabel}</span>
        <svg className="h-3 w-3 text-muted-dark" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute top-full z-[110] mt-1 flex w-max overflow-hidden rounded-lg border border-line bg-surface shadow-soft ${
            align === 'end' ? 'left-0 lg:left-auto lg:right-0' : 'left-0'
          }`}
        >
          <div className="flex w-44 shrink-0 flex-col border-r border-line py-2">
            {TIME_PRESET_OPTIONS.map(({ days, label }) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  onPreset(days)
                  setDraftStart(null)
                }}
                className={`px-4 py-2 text-left text-[13px] font-medium transition-colors ${
                  activePreset === days
                    ? 'bg-paper-soft font-medium text-ink'
                    : 'text-muted hover:bg-paper-soft hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="mt-2 border-t border-line pt-2">
              <button
                type="button"
                onClick={() => {
                  onResetDefault()
                  setDraftStart(null)
                }}
                className="w-full px-4 py-2 text-left text-[13px] text-muted-dark hover:bg-paper-soft hover:text-ink"
              >
                Reset to default
              </button>
            </div>
          </div>

          <div className="w-72 shrink-0 p-3">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="p-1 text-muted-dark hover:bg-surface hover:text-ink"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="text-[13px] font-medium text-ink">
                {format(viewMonth, 'MMMM yyyy')}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="p-1 text-muted-dark hover:bg-surface hover:text-ink"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-dark">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5">
              {gridDays.map((d, i) => {
                const iso = toIso(d)
                return (
                  <button
                    key={`${iso}-${i}`}
                    type="button"
                    disabled={isDisabled(d)}
                    onClick={() => selectDay(iso)}
                    className={dayClass(d)}
                  >
                    {format(d, 'd')}
                  </button>
                )
              })}
            </div>

            <p className="mt-3 text-[12px] text-muted-dark">
              {draftStart
                ? 'Select end date'
                : `${format(rangeStart, 'MMM d, yyyy')} – ${format(rangeEnd, 'MMM d, yyyy')}`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export { DEFAULT_TIME_PRESET_DAYS }
