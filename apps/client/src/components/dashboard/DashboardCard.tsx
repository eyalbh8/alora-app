import type { ReactNode } from 'react'
import { DASHBOARD_CARD_HEIGHT, PAIRED_SECTION_HEADER_MIN_CLASS } from './constants'

interface DashboardCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  contentClassName?: string
  variant?: 'card' | 'editorial'
  fill?: boolean
  framed?: boolean
}

export function DashboardCard({
  title,
  subtitle,
  children,
  className = '',
  contentClassName = 'overflow-auto',
  variant = 'card',
  fill = false,
  framed = true,
}: DashboardCardProps) {
  if (variant === 'editorial') {
    return (
      <section
        className={`min-w-0 ${framed ? 'rounded-lg border border-line bg-surface p-6 shadow-soft' : ''} ${fill ? 'flex h-full flex-col' : ''} ${className}`}
      >
        <header className={`mb-5 shrink-0 ${PAIRED_SECTION_HEADER_MIN_CLASS}`}>
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </header>
        <div className={`${fill ? 'flex min-h-0 flex-1 flex-col' : ''} ${contentClassName}`}>
          {children}
        </div>
      </section>
    )
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft ${className}`}
      style={{ height: DASHBOARD_CARD_HEIGHT, minHeight: DASHBOARD_CARD_HEIGHT }}
    >
      <div className="shrink-0 border-b border-line px-5 py-4">
        <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      <div className={`min-h-0 flex-1 ${contentClassName}`}>{children}</div>
    </div>
  )
}
