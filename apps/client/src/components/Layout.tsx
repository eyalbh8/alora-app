import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Bot,
  CalendarClock,
  Heart,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Newspaper,
  Plug,
  Quote,
  Store,
  Users,
} from "lucide-react";
import { AccountSwitcher } from "./AccountSwitcher";
import { MenchlyLogo } from "./MenchlyLogo";
import { useIsAdmin } from "../hooks/useCurrentUser";

const NAV: Array<{
  to: string;
  label: string;
  end?: boolean;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  adminOnly?: boolean;
}> = [
  { to: "/", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/prompts", label: "Prompts", icon: MessageSquareText },
  { to: "/mentions", label: "Mentions", icon: Quote },
  { to: "/citations", label: "Citations", icon: Link2 },
  { to: "/sentiment", label: "Sentiment", icon: Heart },
  { to: "/competitors", label: "Competitors", icon: Users },
  { to: "/marketplace", label: "Marketplace", icon: Store },
  { to: "/ai-traffic", label: "AI Traffic", icon: Activity },
  { to: "/ai-crawlers", label: "AI Crawlers", icon: Bot },
  { to: "/content", label: "Content", icon: Newspaper },
  { to: "/integrations", label: "Integrations", icon: Plug },
  {
    to: "/daily-automation",
    label: "Daily automation",
    icon: CalendarClock,
    adminOnly: true,
  },
];

export function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <MenchlyLogo />
    </span>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isAdmin = useIsAdmin();
  const navItems = NAV.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (media.matches) setNavOpen(false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-open", navOpen);
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("nav-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen]);

  return (
    <div className="site bg-bg text-ink">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="app-sidebar-scrim"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${navOpen ? "is-open" : ""}`}>
        <div className="mb-5 flex items-start justify-between gap-3 px-1">
          <Link className="brand" to="/" aria-label="Menchly, home">
            <BrandMark />
            <span className="brand__name">Menchly</span>
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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "is-active" : undefined
                }
                onClick={() => setNavOpen(false)}
              >
                <Icon
                  width={16}
                  height={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {item.label}
              </NavLink>
            );
          })}
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
          <Link className="brand" to="/" aria-label="Menchly, home">
            <BrandMark />
            <span className="brand__name">Menchly</span>
          </Link>
        </header>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
