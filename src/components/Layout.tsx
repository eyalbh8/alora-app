import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
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
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (media.matches) setNavOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!navOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [navOpen])

  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col bg-brand-950 py-6 transition-transform duration-200 ease-out lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 flex items-start justify-between border-b border-white/10 px-7 pb-7 pt-2">
          <div className="flex flex-col">
            <span className="font-serif text-[26px] font-semibold leading-none tracking-[-0.01em] text-brand-50">
              Alora
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300">
              AI Favorite
            </span>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="mt-0.5 rounded-sm p-1 text-brand-50/60 hover:text-brand-50 lg:hidden"
            onClick={() => setNavOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
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

      <div className="ml-0 flex min-w-0 flex-1 flex-col lg:ml-[236px]">
        <header className="flex min-h-[77px] items-center gap-3 border-b border-[#eae6de] px-4 py-5 sm:px-6 lg:px-14">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="shrink-0 rounded-sm p-1 text-[#101414] hover:bg-[#efeae1] lg:hidden"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="min-w-0 truncate font-serif text-lg font-semibold tracking-[-0.01em] text-[#101414] sm:text-[22px]">
              {accountName}
            </h1>
            {accountDomain && (
              <span className="truncate text-xs text-[#9a938a]">{accountDomain}</span>
            )}
          </div>
        </header>
        <main className="w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-14 lg:py-11">
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
