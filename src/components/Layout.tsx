import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSnapshots } from '../context/SnapshotContext'

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: 'M3 13.5V19a1.5 1.5 0 001.5 1.5H9V15a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 15v5.5h4.5A1.5 1.5 0 0021 19v-5.5L12 5l-9 8.5z',
  },
  {
    to: '/prompts',
    label: 'Prompts',
    icon: 'M8 10h8M8 14h5m-8.5 5.5L8 17h9a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12.5z',
  },
  {
    to: '/mentions',
    label: 'Mentions',
    icon: 'M7 8h10M7 12h6m-8 8l2.5-2.5H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z',
  },
  {
    to: '/sentiment',
    label: 'Sentiment',
    icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zm-3.5-7.5c.8 1.2 2 2 3.5 2s2.7-.8 3.5-2M9 10h.01M15 10h.01',
  },
  {
    to: '/competitors',
    label: 'Competitors',
    icon: 'M4 19h16M7 16V9m5 7V5m5 11v-6',
  },
  {
    to: '/ai-traffic',
    label: 'AI Traffic',
    icon: 'M3 17l6-6 4 4 7-7M14 8h6v6',
  },
  {
    to: '/ai-crawlers',
    label: 'AI Crawlers',
    icon: 'M12 3v3m0 12v3M3 12h3m12 0h3M6.3 6.3l2.1 2.1m7.2 7.2l2.1 2.1m0-11.4l-2.1 2.1M8.4 15.6l-2.1 2.1M12 8a4 4 0 100 8 4 4 0 000-8z',
  },
]

export function Layout() {
  const { tenant } = useSnapshots()
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-52 flex-col border-r border-slate-200/60 bg-white">
        <div className="flex flex-col gap-0.5 px-5 py-5">
          <span className="font-serif text-2xl font-medium leading-none tracking-tight text-brand-900">
            Alora
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-500">
            AI Favorite
          </span>
        </div>

        <nav className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Screens
          </p>
          {NAV.map((item) => {
            const isActive = item.end
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(`${item.to}/`)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={() =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#101414]'
                  }`
                }
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.7}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="ml-52 flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-white px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-lg font-semibold tracking-tight text-[#101414]">
              {tenant.name ?? 'Tenant'}
            </h1>
            {tenant.domain && (
              <span className="text-xs text-slate-400">{tenant.domain}</span>
            )}
          </div>
        </header>
        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
