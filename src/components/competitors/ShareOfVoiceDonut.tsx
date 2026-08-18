import { useMemo } from 'react'
import type { CompetitorPerformance } from '../../api/types'
import { useCompetitorHover } from '../../context/CompetitorHoverContext'
import { useGeoMeta } from '../../context/GeoMetaContext'
import { findAccountCompetitor, isAccountCompetitor } from '../../lib/accountCompetitor'
import { formatNumber } from '../../lib/format'
import { SOV_COLORS } from './constants'

interface ShareOfVoiceDonutProps {
  competitors: CompetitorPerformance[]
}

interface VoiceSegment {
  id: string
  name: string
  value: number
  color: string
  isAccount: boolean
}

export function ShareOfVoiceDonut({ competitors }: ShareOfVoiceDonutProps) {
  const { hoveredCompetitor, setHoveredCompetitor } = useCompetitorHover()
  const { meta } = useGeoMeta()

  const segments = useMemo(() => {
    const active = competitors.filter((c) => (c.occurrences ?? 0) > 0)
    return active.map((c, index) => ({
      id: c.id,
      name: c.name,
      value: c.occurrences ?? 0,
      color: SOV_COLORS[index % SOV_COLORS.length],
      isAccount: isAccountCompetitor(c, meta?.account),
    })) satisfies VoiceSegment[]
  }, [competitors, meta?.account])

  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const account = findAccountCompetitor(competitors, meta?.account)
  const myShare =
    total > 0 && account ? Math.round(((account.occurrences ?? 0) / total) * 100) : 0

  return (
    <section aria-labelledby="share-of-voice-title">
      <h2 id="share-of-voice-title" className="text-[19px] font-semibold text-ink">
        Share of Voice
      </h2>
      {segments.length === 0 ? (
        <div className="mt-5 border-y border-line py-12 text-sm text-muted">
          No mention data for the selected period.
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[44px] font-semibold leading-none tracking-tight text-ink">
              {formatNumber(myShare, 0)}%
            </span>
            <span className="text-xs text-muted">My share of voice</span>
          </div>

          <div className="mt-[18px] flex h-2.5 w-full overflow-hidden bg-paper-soft">
            {segments.map((segment) => {
              const lit = !hoveredCompetitor || hoveredCompetitor === segment.name
              return (
                <button
                  key={segment.id}
                  type="button"
                  className="h-full min-w-px transition-opacity focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  style={{
                    width: `${(segment.value / total) * 100}%`,
                    backgroundColor: segment.color,
                    opacity: lit ? 1 : 0.24,
                  }}
                  title={`${segment.name}: ${Math.round((segment.value / total) * 100)}%`}
                  aria-label={`${segment.name}: ${Math.round((segment.value / total) * 100)}% share of voice`}
                  onMouseEnter={() => setHoveredCompetitor(segment.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                  onFocus={() => setHoveredCompetitor(segment.name)}
                  onBlur={() => setHoveredCompetitor(null)}
                />
              )
            })}
          </div>

          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-2">
            {segments.map((segment) => {
              const lit = !hoveredCompetitor || hoveredCompetitor === segment.name
              return (
                <button
                  key={segment.id}
                  type="button"
                  className={`flex items-center gap-1.5 text-[11.5px] text-muted transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    lit ? 'opacity-100' : 'opacity-35'
                  }`}
                  onMouseEnter={() => setHoveredCompetitor(segment.name)}
                  onMouseLeave={() => setHoveredCompetitor(null)}
                  onFocus={() => setHoveredCompetitor(segment.name)}
                  onBlur={() => setHoveredCompetitor(null)}
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className={segment.isAccount ? 'font-semibold text-ink' : ''}>
                    {segment.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
