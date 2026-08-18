import { formatNumber } from '../../lib/format'
import { SENTIMENT_TEAL, SENTIMENT_TEAL_LIGHT } from './constants'

interface CurrentSentimentScoreProps {
  score: number | null
}

export function CurrentSentimentScore({ score }: CurrentSentimentScoreProps) {
  const value = score != null && !Number.isNaN(score) ? Math.min(100, Math.max(0, Math.round(score))) : null
  const ringBackground =
    value == null
      ? '#e2e8f0'
      : `conic-gradient(${SENTIMENT_TEAL} 0% ${value}%, ${SENTIMENT_TEAL_LIGHT} ${value}% 100%)`

  return (
    <section aria-labelledby="current-sentiment-title">
      <h2 id="current-sentiment-title" className="mb-5 text-[19px] font-semibold text-[#101414]">
        Current Sentiment Score
      </h2>
      <div
        className="mx-auto flex h-[170px] w-[170px] items-center justify-center rounded-full lg:mx-0"
        style={{ background: ringBackground }}
        role="img"
        aria-label={value == null ? 'No current sentiment score' : `Current sentiment score: ${value} out of 100`}
      >
        <div className="flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full bg-[#faf9f7]">
          {value == null ? (
            <span className="font-serif text-[28px] font-semibold text-slate-400">—</span>
          ) : (
            <>
              <span className="font-serif text-[28px] font-semibold tracking-tight text-[#101414]">
                {formatNumber(value, 0)}
              </span>
              <span className="mt-0.5 text-[11px] text-[#9a938a]">/ 100</span>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
