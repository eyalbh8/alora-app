import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountSwitcher } from './AccountSwitcher'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/prompts', label: 'Prompts' },
  { to: '/mentions', label: 'Mentions' },
  { to: '/citations', label: 'Citations' },
  { to: '/sentiment', label: 'Sentiment' },
  { to: '/competitors', label: 'Competitors' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/ai-traffic', label: 'AI Traffic' },
  { to: '/ai-crawlers', label: 'AI Crawlers' },
]

function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? window.scrollY / max : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="scroll-progress" aria-hidden="true">
      <span style={{ height: `${progress * 100}%` }} />
    </div>
  )
}

export function BrandMark() {
  return <span className="brand__mark" aria-hidden="true" />
}

export function Layout() {
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

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
    document.body.classList.toggle('nav-open', navOpen)
    if (!navOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavOpen(false)
        toggleRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('nav-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [navOpen])

  return (
    <div className="site bg-bg text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ScrollProgress />

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="app-sidebar-scrim"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${navOpen ? 'is-open' : ''}`}>
        <div className="mb-6 flex items-start justify-between gap-3 border-b border-line pb-6">
          <Link className="brand" to="/" aria-label="Alora, home">
            <BrandMark />
            <span className="brand__name">Alora</span>
          </Link>
          <button
            type="button"
            className="nav-toggle app-sidebar__close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="mb-5">
          <AccountSwitcher onNavigate={() => setNavOpen(false)} />
        </div>

        <nav className="app-sidebar__links" aria-label="Primary navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              onClick={() => setNavOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={navOpen}
            aria-controls="primary-menu"
            onClick={() => setNavOpen(true)}
            ref={toggleRef}
          >
            <span className="sr-only">Open navigation</span>
            <span aria-hidden="true">Menu</span>
          </button>
          <Link className="brand" to="/" aria-label="Alora, home">
            <BrandMark />
            <span className="brand__name">Alora</span>
          </Link>
        </header>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
