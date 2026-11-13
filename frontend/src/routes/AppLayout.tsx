import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { useSite } from '../services/site';
import { useAuth, useTheme } from '../services';
import TheWire from '../components/TheWire';
import RateLimitNotice from '../components/RateLimitNotice';

const baseNavItems = [
  { to: '/', label: 'Home' },
  { to: '/search', label: 'Search' },
  { to: '/explore', label: 'Explore' },
  { to: '/episodes', label: 'VODs' },
  { to: '/saved', label: 'Saved' },
];

// Icon geometry from Simple Icons (CC0). Destinations follow Studio's social-links.ts.
const studioSocials = [
  {
    label: 'SUBCULT on Bluesky',
    href: 'https://bsky.app/profile/subcult.tv',
    path: 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z',
  },
  {
    label: 'SUBCULT on Instagram',
    href: 'https://www.instagram.com/subcult.tv/',
    path: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  },
  {
    label: 'SUBCULT on X',
    href: 'https://x.com/subcult_tv',
    path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  },
];

const routeMeta: Array<{ match: RegExp; title: string; description: string }> = [
  {
    match: /^\/$/,
    title: '{name} — Broadcast archive',
    description: 'Search and watch the public {creator} broadcast archive.',
  },
  {
    match: /^\/search/,
    title: 'Search transcripts — {name}',
    description: 'Find timestamped, citation-backed moments across the archive.',
  },
  {
    match: /^\/explore/,
    title: 'Explore topics — {name}',
    description: 'Explore public archive topics, periods, and evidence.',
  },
  {
    match: /^\/(episodes|streams)/,
    title: 'Watch the archive — {name}',
    description: 'Browse the latest VODs, topics, and cited transcript moments.',
  },
  {
    match: /^\/timeline/,
    title: 'Archive timeline — {name}',
    description: 'Browse broadcasts chronologically.',
  },
  {
    match: /^\/topics\//,
    title: 'Topic evidence — {name}',
    description: 'Review a topic through timestamped transcript evidence.',
  },
  {
    match: /^\/v\//,
    title: 'Episode transcript — {name}',
    description: 'Watch a source VOD with its interactive transcript.',
  },
  {
    match: /^\/saved/,
    title: 'Saved moments — {name}',
    description: 'Return to saved searches and transcript moments.',
  },
  {
    match: /^\/account/,
    title: 'Account — {name}',
    description: 'Manage your {name} account.',
  },
  {
    match: /^\/support/,
    title: 'Support the archive — {name}',
    description: 'Help keep {name} public, searchable, and independently maintained.',
  },
  {
    match: /^\/about/,
    title: 'About the archive — {name}',
    description: 'How {name} turns public broadcasts into a searchable, cited record.',
  },
  {
    match: /^\/(privacy|terms)/,
    title: 'Project policies — {name}',
    description: 'Privacy and terms for the {name} public archive.',
  },
  {
    match: /^\/admin/,
    title: 'Archive administration — {name}',
    description: 'Operate the {name} archive.',
  },
];

function RouteTransitionManager() {
  const site = useSite();
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);
  const positions = useRef(new Map<string, number>());
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const meta = routeMeta.find((item) => item.match.test(location.pathname)) ?? {
      title: '{name}',
      description: 'Public broadcast archive.',
    };
    document.title = meta.title.replaceAll('{name}', site.name);
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.appendChild(description);
    }
    description.content =
      location.pathname === '/'
        ? site.description
        : meta.description
            .replaceAll('{name}', site.name)
            .replaceAll('{creator}', site.creator_name);

    for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
      link.href = site.favicon_url || '/icon.svg';
      link.removeAttribute('type');
    }
    // Keep the crawler-visible raster image rendered by the frontend entrypoint.

    const pathChanged = previousPath.current !== location.pathname;
    if (!pathChanged) return;
    positions.current.set(previousPath.current, window.scrollY);
    previousPath.current = location.pathname;
    window.requestAnimationFrame(() => {
      if (navigationType === 'POP') {
        window.scrollTo({ top: positions.current.get(location.pathname) ?? 0 });
      } else if (!location.hash) {
        window.scrollTo({ top: 0 });
        const target = document.querySelector<HTMLElement>('main h1');
        const active = document.activeElement;
        const userMovedFocus =
          active instanceof HTMLElement &&
          active !== document.body &&
          active !== document.documentElement;
        if (target && !userMovedFocus) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
      setAnnouncement(meta.title.replace(' — {name}', '').replaceAll('{name}', site.name));
    });
  }, [location.pathname, location.hash, navigationType, site]);

  return (
    <span className="sr-only" aria-live="polite">
      {announcement}
    </span>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  return (
    <form
      role="search"
      aria-label="Search the archive"
      className="header-search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (!query) return;
        navigate(`/search?q=${encodeURIComponent(query)}`);
        setValue('');
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        name="header-q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search every transcript…"
        aria-label="Search transcripts"
        autoComplete="off"
      />
    </form>
  );
}

export default function AppLayout() {
  const site = useSite();
  const navItems = site.community_enabled
    ? [...baseNavItems, { to: '/community', label: 'Community' }]
    : baseNavItems;
  const { user, loading, error: authError, login, loginTwitch, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setCompact((current) => window.scrollY > (current ? 48 : 128));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty(
        '--header-height',
        `${header.getBoundingClientRect().height}px`
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--header-height');
    };
  }, []);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink transition-colors">
      <RouteTransitionManager />
      <a
        href="#main-content"
        onClick={() =>
          window.requestAnimationFrame(() => document.getElementById('main-content')?.focus())
        }
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:min-h-[44px] focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
      >
        Skip to main content
      </a>

      <header ref={headerRef} className="site-header" data-compact={compact} role="banner">
        <div className="site-header-row mx-auto flex max-w-[100rem] items-center justify-between gap-4 px-4 lg:px-6">
          <div className="site-header-start flex min-w-0 flex-1 items-center gap-4">
            <Link
              to="/"
              className="group flex min-w-0 items-center gap-3"
              aria-label={`Home - ${site.name}`}
            >
              <img
                src={site.logo_url || '/icon.svg'}
                alt=""
                width="44"
                height="44"
                className="site-logo"
              />
              <span className="min-w-0">
                <span className="brand-name block truncate leading-none text-ink group-hover:text-accent">
                  {site.name}
                </span>
                <span className="mt-1 hidden text-[11px] font-medium text-subtle sm:block">
                  {site.tagline || 'Broadcast archive'}
                </span>
              </span>
            </Link>
            {!location.pathname.startsWith('/search') && <HeaderSearch />}
          </div>

          <nav className="hidden shrink-0 items-center gap-1 lg:flex" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
                {item.label}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'bg-surface-muted text-ink' : ''}`
                }
              >
                Account
              </NavLink>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-button ml-2"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'light' ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>

            <div className="ml-2 flex items-center gap-3 border-l border-border pl-4">
              {loading ? (
                <span className="text-subtle" aria-live="polite">
                  Loading…
                </span>
              ) : user ? (
                <>
                  <div className="hidden items-center gap-2 xl:flex">
                    {user.avatar_url && (
                      <img
                        src={user.avatar_url}
                        alt={`${user.name || user.email} avatar`}
                        width="32"
                        height="32"
                        className="h-8 w-8 rounded-full border border-border"
                      />
                    )}
                    <span className="max-w-[10rem] truncate text-sm text-muted">
                      {user.name || user.email}
                    </span>
                  </div>
                  <button type="button" onClick={logout} className="nav-link">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={login} className="nav-link">
                    Google
                  </button>
                  <button type="button" onClick={loginTwitch} className="nav-link">
                    Twitch
                  </button>
                </>
              )}
            </div>
          </nav>

          <button
            ref={menuButtonRef}
            type="button"
            className="icon-button lg:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        <TheWire />
        {mobileMenuOpen && (
          <nav
            id="mobile-menu"
            className="border-t border-border/80 bg-canvas/95 px-4 backdrop-blur-2xl lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="mx-auto flex max-w-[100rem] flex-col gap-2 py-4">
              <div className="archive-eyebrow mb-2 self-start">Navigation deck</div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-link block ${isActive ? 'bg-surface-muted text-ink' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              {user && (
                <NavLink
                  to="/account"
                  className={({ isActive }) =>
                    `nav-link block ${isActive ? 'bg-surface-muted text-ink' : ''}`
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Account
                </NavLink>
              )}

              <div className="mt-3 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="nav-link flex w-full items-center gap-2 text-left"
                >
                  {theme === 'light' ? (
                    <>
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                      Dark mode
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                      Light mode
                    </>
                  )}
                </button>

                {loading ? (
                  <span className="block py-2 text-subtle" aria-live="polite">
                    Loading…
                  </span>
                ) : user ? (
                  <>
                    <div className="flex items-center gap-3 py-2">
                      {user.avatar_url && (
                        <img
                          src={user.avatar_url}
                          alt={`${user.name || user.email} avatar`}
                          width="32"
                          height="32"
                          className="h-8 w-8 rounded-full border border-border"
                        />
                      )}
                      <span className="text-muted">{user.name || user.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="nav-link block w-full text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        login();
                        setMobileMenuOpen(false);
                      }}
                      className="nav-link block w-full text-left"
                    >
                      Google
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        loginTwitch();
                        setMobileMenuOpen(false);
                      }}
                      className="nav-link block w-full text-left"
                    >
                      Twitch
                    </button>
                  </>
                )}
              </div>
            </div>
          </nav>
        )}
        {authError && (
          <div
            className="border-t border-warning/30 bg-warning-soft px-4 py-2 text-center text-sm text-warning"
            role="alert"
          >
            {authError}
          </div>
        )}
      </header>

      <RateLimitNotice />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[100rem] flex-1 px-4 py-4 lg:px-6 lg:py-5"
        role="main"
      >
        <Outlet />
      </main>

      <footer
        className="border-t border-border/80 bg-canvas/80 backdrop-blur-xl"
        role="contentinfo"
      >
        <div className="mx-auto grid max-w-[100rem] gap-5 px-4 py-7 text-sm text-muted sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center lg:px-6">
          <p>
            &copy; {new Date().getFullYear()} {site.name}.{' '}
            {site.operator_url ? (
              <a href={site.operator_url} className="action-link underline underline-offset-2">
                {site.operator_name}
              </a>
            ) : (
              site.operator_name
            )}
          </p>
          <nav
            aria-label="Project and legal"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-subtle sm:justify-end"
          >
            <Link to="/about" className="action-link">
              About
            </Link>
            <Link to="/privacy" className="action-link">
              Privacy
            </Link>
            <Link to="/terms" className="action-link">
              Terms
            </Link>
            <Link to="/support" className="action-link text-accent">
              {site.operator_name?.toUpperCase() === 'SUBCULT' ? 'Support SUBCULT' : 'Support'}
            </Link>
            {site.operator_name?.toUpperCase() === 'SUBCULT' && (
              <span className="footer-socials">
                {studioSocials.map((social) => (
                  <a
                    key={social.href}
                    href={social.href}
                    className="footer-social"
                    aria-label={social.label}
                    title={social.label}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d={social.path} />
                    </svg>
                  </a>
                ))}
              </span>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
