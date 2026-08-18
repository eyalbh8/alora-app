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
}

export function DashboardCard({
  title,
  subtitle,
  children,
  className = '',
  contentClassName = 'overflow-auto',
  variant = 'card',
  fill = false,
}: DashboardCardProps) {
  if (variant === 'editorial') {
    return (
      <section
        className={`min-w-0 border border-line bg-surface p-[22px] ${fill ? 'flex h-full flex-col' : ''} ${className}`}
      >
        <header className={`mb-5 shrink-0 ${PAIRED_SECTION_HEADER_MIN_CLASS}`}>
          <p className="eyebrow mb-2">{title}</p>
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
      className={`flex flex-col overflow-hidden border border-line bg-surface ${className}`}
      style={{ height: DASHBOARD_CARD_HEIGHT, minHeight: DASHBOARD_CARD_HEIGHT }}
    >
      <div className="shrink-0 border-b border-line px-5 py-4">
        <p className="eyebrow mb-0">{title}</p>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      <div className={`min-h-0 flex-1 ${contentClassName}`}>{children}</div>
    </div>
  )
}
