import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMcpConnection } from '../api/carouselGeneration'
import { useGeoMeta } from '../context/GeoMetaContext'
import { useSnapshots } from '../context/SnapshotContext'
import { AccountSwitcher } from './AccountSwitcher'
import { IgeoConnectionPanel } from './IgeoConnectionPanel'

const NAV = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
  },
  {
    to: '/prompts',
    label: 'Prompts',
  },
  {
    to: '/mentions',
    label: 'Mentions',
  },
  {
    to: '/sentiment',
    label: 'Sentiment',
  },
  {
    to: '/competitors',
    label: 'Competitors',
  },
  {
    to: '/ai-traffic',
    label: 'AI Traffic',
  },
  {
    to: '/ai-crawlers',
    label: 'AI Crawlers',
  },
  {
    to: '/carousel',
    label: 'Carousel',
  },
]

export function Layout() {
  const { tenant } = useSnapshots()
  const { meta } = useGeoMeta()
  const { pathname } = useLocation()
  const connection = useMcpConnection()
  const igeoConnected = connection.data?.connected === true
  const accountName = meta?.account?.title || tenant.name || 'Account'
  const accountDomain = meta?.account?.domains[0] || tenant.domain

  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-[236px] flex-col bg-brand-950 py-6">
        <div className="mb-5 flex flex-col border-b border-white/10 px-7 pb-7 pt-2">
          <span className="font-serif text-[26px] font-semibold leading-none tracking-[-0.01em] text-brand-50">
            Alora
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">
            AI Favorite
          </span>
        </div>

        <div className="mb-4 px-4">
          <AccountSwitcher />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-4">
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
                  `flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13.5px] transition-colors ${
                    isActive
                      ? 'font-semibold text-white'
                      : 'font-medium text-brand-50/55 hover:text-brand-50'
                  }`
                }
              >
                <span
                  aria-hidden="true"
                  className={`h-[5px] w-[5px] shrink-0 ${
                    isActive ? 'bg-brand-400' : 'bg-transparent'
                  }`}
                />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="ml-[236px] flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[77px] flex-wrap items-center gap-3 border-b border-[#eae6de] px-14 py-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-serif text-[22px] font-semibold tracking-[-0.01em] text-[#101414]">
              {accountName}
            </h1>
            {accountDomain && (
              <span className="text-xs text-[#9a938a]">{accountDomain}</span>
            )}
          </div>
        </header>
        <main className="w-full max-w-[1400px] flex-1 px-14 py-11">
          {connection.isLoading ? null : !igeoConnected && pathname !== '/carousel' ? (
            <IgeoConnectionPanel />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
