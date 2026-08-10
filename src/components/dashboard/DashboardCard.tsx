import type { ReactNode } from 'react'
import { DASHBOARD_CARD_HEIGHT } from './constants'

interface DashboardCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function DashboardCard({
  title,
  subtitle,
  children,
  className = '',
  contentClassName = 'overflow-auto',
}: DashboardCardProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm ${className}`}
      style={{ height: DASHBOARD_CARD_HEIGHT, minHeight: DASHBOARD_CARD_HEIGHT }}
    >
      <div className="shrink-0 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-medium text-[#101414]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className={`min-h-0 flex-1 ${contentClassName}`}>{children}</div>
    </div>
  )
}
