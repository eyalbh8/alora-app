import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useBrandKit } from '../context/BrandKitContext'
import { useBrandKitEdit } from '../context/BrandKitEditContext'
import { formatRangeLabel, lastNDaysThroughToday } from '../lib/dates'
import { Skeleton } from './LoadingSpinner'
import { Pill } from './Pill'

const INSIGHTS_NAV = [
  {
    to: '/',
    label: 'Analytics',
    icon: 'M3 13.5V19a1.5 1.5 0 001.5 1.5H9V15a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 15v5.5h4.5A1.5 1.5 0 0021 19v-5.5L12 5l-9 8.5z',
    match: (pathname: string) =>
      pathname === '/' ||
      pathname === '/visibility' ||
      pathname === '/citations' ||
      pathname === '/sentiment',
  },
  {
    to: '/pages',
    label: 'Onsite',
    icon: 'M4.5 4.5h15v15h-15v-15zM4.5 9h15M9 9v10.5',
  },
  {
    to: '/prompts',
    label: 'Prompts',
    icon: 'M8 10h8M8 14h5m-8.5 5.5L8 17h9a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12.5z',
  },
  {
    to: '/offsite',
    label: 'Offsite',
    icon: 'M13.5 6H19v5.5M19 6l-8 8M10 6H6.5A1.5 1.5 0 005 7.5v10A1.5 1.5 0 006.5 19h10a1.5 1.5 0 001.5-1.5V14',
  },
]

const BRAND_KIT_NAV = [
  { to: '/brand-kit', label: 'Overview', end: true },
  { to: '/brand-kit/foundations', label: 'Foundations' },
  { to: '/brand-kit/product-lines', label: 'Product Lines' },
  { to: '/brand-kit/content-types', label: 'Content Types' },
  { to: '/brand-kit/audiences', label: 'Audiences' },
  { to: '/brand-kit/regions', label: 'Regions' },
  { to: '/brand-kit/visual-guidelines', label: 'Visual Guidelines' },
  { to: '/brand-kit/custom-variables', label: 'Custom Variables' },
]

function BrandHeader() {
  const { pathname } = useLocation()
  const { settings, loading } = useBrandKit()
  const { isDirty, discardChanges } = useBrandKitEdit()
  const navigate = useNavigate()
  const onBrandKit = pathname.startsWith('/brand-kit')
  const rangeLabel = formatRangeLabel(lastNDaysThroughToday(30))

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-white px-6 py-3.5">
      {loading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-36" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-lg font-semibold tracking-tight text-[#101414]">
            {settings?.brand_name ?? 'Alora'}
            {onBrandKit ? (
              <span className="ml-2 font-sans text-sm font-normal text-slate-400">Brand Kit</span>
            ) : null}
          </h1>
          {settings?.brand_url && (
            <a
              href={`https://${settings.brand_url.replace(/^https?:\/\//, '')}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-brand-700 hover:underline"
            >
              {settings.brand_url}
            </a>
          )}
          <div className="flex gap-1">
            {settings?.countries.map((country) => (
              <Pill key={country} tone="blue">
                {country}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {onBrandKit ? (
        <div className="flex flex-wrap items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={discardChanges}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Discard
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              isDirty
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-brand-200 bg-brand-50 text-brand-900'
            }`}
          >
            {isDirty ? 'Draft — unsaved changes' : 'Published'}
          </span>
          <button
            type="button"
            disabled={!isDirty}
            onClick={() => navigate('/brand-kit/review')}
            className="rounded-lg bg-brand-900 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review & Submit Changes
          </button>
        </div>
      ) : (
        <span className="text-xs font-medium text-slate-500">{rangeLabel}</span>
      )}
    </header>
  )
}

export function Layout() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <aside className="fixed inset-y-0 left-0 z-10 flex w-52 flex-col border-r border-slate-200/60 bg-white">
        <div className="flex flex-col gap-0.5 px-5 py-5">
          <span className="font-serif text-2xl font-medium leading-none tracking-tight text-brand-900">
            Alora
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-brand-500">
            AI Visibility
          </span>
        </div>

        <nav className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Insights
          </p>
          {INSIGHTS_NAV.map((item) => {
            const isActive = item.match
              ? item.match(pathname)
              : pathname === item.to || pathname.startsWith(`${item.to}/`)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
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

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Context
          </p>
          <NavLink
            to="/brand-kit"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive || pathname.startsWith('/brand-kit')
                  ? 'bg-brand-50 text-brand-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-[#101414]'
              }`
            }
          >
            Brand Kit
          </NavLink>
          {pathname.startsWith('/brand-kit') && (
            <div className="ml-2 mt-0.5 flex flex-col gap-0.5 border-l border-brand-100 pl-2">
              {BRAND_KIT_NAV.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'bg-white text-brand-900 shadow-sm ring-1 ring-brand-200/80'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-[#101414]'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>
      </aside>

      <div className="ml-52 flex min-w-0 flex-1 flex-col">
        <BrandHeader />
        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
