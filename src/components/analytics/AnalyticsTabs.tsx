import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/visibility', label: 'Visibility', end: false },
  { to: '/citations', label: 'Citations', end: false },
  { to: '/sentiment', label: 'Sentiment', end: false },
]

export function AnalyticsTabs() {
  return (
    <div className="flex gap-5 border-b border-slate-200">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `-mb-px border-b-2 pb-2.5 text-sm font-medium transition ${
              isActive
                ? 'border-emerald-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}
