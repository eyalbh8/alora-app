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
}: {
  range: DateRange
  onChange: (next: DateRange) => void
  onPreset: (days: number) => void
  onResetDefault: () => void
  endDay: string
  minDay?: string
  maxDay?: string
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
      'relative flex h-8 w-8 items-center justify-center text-xs transition-colors '
    if (disabled) cls += 'cursor-not-allowed text-slate-300 '
    else cls += 'cursor-pointer '
    if (outside && !inSpan && !isStart && !isEnd) cls += 'text-slate-300 '
    else if (!disabled) cls += 'text-slate-700 '

    if (inSpan && !disabled) cls += 'bg-teal-50 '
    if ((isStart || isEnd) && !disabled) {
      cls += 'rounded-full bg-teal-600 font-medium text-white hover:bg-teal-700 '
    } else if (!disabled) {
      cls += 'rounded-full hover:bg-teal-50 '
    }

    return cls
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${
          open
            ? 'border-teal-300 bg-teal-50/40'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium text-slate-700">{buttonLabel}</span>
        <svg className="h-3 w-3 text-slate-400" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex w-44 flex-col border-r border-slate-100 py-2">
            {TIME_PRESET_OPTIONS.map(({ days, label }) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  onPreset(days)
                  setDraftStart(null)
                }}
                className={`px-4 py-2 text-left text-sm transition-colors ${
                  activePreset === days
                    ? 'bg-teal-50 font-medium text-teal-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="mt-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => {
                  onResetDefault()
                  setDraftStart(null)
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                Reset to default
              </button>
            </div>
          </div>

          <div className="w-72 p-3">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="text-sm font-medium text-slate-800">
                {format(viewMonth, 'MMMM yyyy')}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Next month"
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
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

            <p className="mt-3 text-[11px] text-slate-400">
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
