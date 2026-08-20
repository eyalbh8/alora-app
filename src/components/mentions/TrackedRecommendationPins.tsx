import { useEffect, useRef, useState } from 'react'
import type { TrackedRecommendation } from '../../api/types'
import { formatNumber } from '../../lib/format'
import {
  isBlogRecommendation,
  recommendationCited,
  recommendationTitle,
  recommendationTypeLabel,
  recommendationUrl,
} from '../../lib/trackedRecommendations'

function formatCardDate(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function BlogGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="8" cy="8" r="7.25" fill="#2f6fb0" />
      <path
        fill="#fff"
        d="M4.4 11.7V4.4h2.2c1.7 0 2.6.8 2.6 2.1 0 .9-.5 1.6-1.3 1.9 1 .2 1.6 1 1.6 2.1 0 1.5-1.1 2.2-2.8 2.2H4.4zm1.5-4.1h.6c.7 0 1.1-.3 1.1-.9s-.4-.9-1.1-.9h-.6v1.8zm0 2.9h.8c.8 0 1.3-.4 1.3-1.1s-.5-1.1-1.3-1.1h-.8v2.2z"
      />
    </svg>
  )
}

function LinkGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        d="M6.4 9.6 9.6 6.4M7.2 4.8l.4-.4a2.4 2.4 0 1 1 3.4 3.4l-.4.4M8.8 11.2l-.4.4a2.4 2.4 0 1 1-3.4-3.4l.4-.4"
      />
    </svg>
  )
}

function RecommendationCard({ rec }: { rec: TrackedRecommendation }) {
  const href = recommendationUrl(rec)
  const cited = recommendationCited(rec)
  const image = rec.imageUrl
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[10px] text-muted">
        {isBlogRecommendation(rec) ? <BlogGlyph /> : <LinkGlyph />}
        <span className="font-medium text-muted">{recommendationTypeLabel(rec)}</span>
        {rec.createdAt && <span className="ml-auto">{formatCardDate(rec.createdAt)}</span>}
      </div>
      {image && (
        <div className="mt-2 overflow-hidden bg-paper-soft">
          <img src={image} alt="" className="h-20 w-full object-cover" />
        </div>
      )}
      <p
        className="mt-2 min-w-0 truncate text-[13px] font-medium text-ink"
        title={recommendationTitle(rec)}
      >
        {recommendationTitle(rec)}
      </p>
      <p className="mt-2 text-[11px] text-muted">Cited: {formatNumber(cited, 0)}</p>
    </>
  )

  const cardClass = 'block w-full bg-surface p-3 text-left transition-colors hover:bg-bg'

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cardClass}>
        {body}
      </a>
    )
  }

  return <div className={cardClass}>{body}</div>
}

function RecommendationPinIcon({ count }: { count: number }) {
  return (
    <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-button px-1.5 text-xs font-semibold tabular-nums leading-none text-button-ink">
      {count > 9 ? '9+' : count}
    </span>
  )
}

interface TrackedRecommendationPinProps {
  items: TrackedRecommendation[]
  align?: 'left' | 'center' | 'right'
}

export function TrackedRecommendationPin({
  items,
  align = 'center',
}: TrackedRecommendationPinProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (items.length === 0) return null

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'left'
        ? 'left-0'
        : 'left-1/2 -translate-x-1/2'

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex items-center justify-center outline-offset-2 transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-ink"
        aria-expanded={open}
        aria-label={`${items.length} tracked recommendation${items.length === 1 ? '' : 's'}`}
        onClick={() => setOpen((current) => !current)}
      >
        <RecommendationPinIcon count={items.length} />
      </button>

      {open && (
        <div
          className={`absolute bottom-full z-30 mb-2 w-64 ${alignClass}`}
          role="dialog"
          aria-label="Tracked recommendations"
        >
          <div className="max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-line bg-surface ">
            {items.map((rec, index) => (
              <div
                key={rec.id}
                className={index > 0 ? 'border-t border-line' : undefined}
              >
                <RecommendationCard rec={rec} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface TrackedRecommendationAxisProps {
  dates: string[]
  pinsByDay: Map<string, TrackedRecommendation[]>
}

export function TrackedRecommendationAxis({
  dates,
  pinsByDay,
}: TrackedRecommendationAxisProps) {
  if (dates.length === 0 || pinsByDay.size === 0) return null

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-2 h-10">
      {dates.map((date, index) => {
        const items = pinsByDay.get(date)
        if (!items?.length) return null
        const pct = dates.length === 1 ? 50 : (index / (dates.length - 1)) * 100
        const align =
          index > dates.length - 3 ? 'right' : index < 2 ? 'left' : 'center'

        return (
          <div
            key={date}
            className="pointer-events-auto absolute bottom-0 -translate-x-1/2"
            style={{ left: `${pct}%` }}
          >
            <TrackedRecommendationPin items={items} align={align} />
          </div>
        )
      })}
    </div>
  )
}
