'use client';

// The dashboard shell: sidebar + top bar, rendered ONCE by app/(app)/layout.tsx so it stays mounted while you move
// between pages; only the content area (children) changes. The wrapper element keeps the same DOM node and just swaps
// the page's scoped CSS root class (lib/appShellRoutes.ts), so each page keeps its own styling. Theme, profile and the
// unread badge live here too, so they no longer reset or refetch on every navigation.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { shellRouteFor } from '@/lib/appShellRoutes';
import SignInScreen from './SignInScreen';
import ProfileMenu from './ProfileMenu';
import { AppShellContext, type ShellProfile } from './appShellContext';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect width="7" height="9" x="3" y="3" rx="1.5"/><rect width="7" height="5" x="14" y="3" rx="1.5"/><rect width="7" height="9" x="14" y="12" rx="1.5"/><rect width="7" height="5" x="3" y="16" rx="1.5"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>',
  check: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  checklist: '<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  users: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  file: '<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
  bar: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  settings: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  message: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
};
type IconName = keyof typeof ICON_PATHS;
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'checklist', label: 'To-Do', href: '/todos' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '/clients' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'layers', label: 'Portfolio', href: '/portfolio' },
  { icon: 'sparkles', label: 'AI Prompts', href: '/prompts' },
  { icon: 'bar', label: 'Reports', href: '/reports' },
];
const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '/notifications' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

const DARK_KEY = 'flow53-dashboard-dark';

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = shellRouteFor(pathname);
  const { user, loading } = useSession();
  const unreadCount = useUnreadCount(user);

  const [dark, setDarkState] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(DARK_KEY) === '1';
    } catch {
      return false;
    }
  });
  // the drawer is open for one path only, so it closes itself as soon as the page changes
  const [navOpenPath, setNavOpenPath] = useState<string | null>(null);
  const mobileNavOpen = navOpenPath === pathname;
  const setMobileNavOpen = useCallback((open: boolean) => setNavOpenPath(open ? pathname : null), [pathname]);
  const [profile, setProfile] = useState<ShellProfile | null>(null);
  const [leftEl, setLeftEl] = useState<HTMLElement | null>(null);
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);
  const [leftOverride, setLeftOverride] = useState(false);

  const setDark = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setDarkState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(DARK_KEY, value ? '1' : '0');
      } catch {
        // ignore
      }
      return value;
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setProfile(data as ShellProfile);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const ctx = useMemo(() => ({ dark, setDark, user, profile, leftEl, actionsEl, setLeftOverride }), [dark, setDark, user, profile, leftEl, actionsEl]);

  // pages that are not part of the shell (e.g. the printable receipt) render on their own
  if (!route) return <>{children}</>;
  if (loading) return null;
  if (!user) return <SignInScreen />;

  return (
    <AppShellContext.Provider value={ctx}>
      <div className={`${route.root}${dark ? ' dark' : ''}`}>
        <div className="shell">
          <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
          <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
            <div>
              <div className="brand brand-topbar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/New Logo.png" alt="Flow53 — Innovate · Design · Elevate" className="brand-logo-new" />
                <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
                  <Icon name="close" size={16} />
                </button>
              </div>
              <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
                <div className="nav-label">Workspace</div>
                {NAV_ITEMS.map((item) => {
                  const active = item.label === route.active;
                  return (
                    <Link key={item.label} href={item.href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <span className="n-icon">
                        <Icon name={item.icon} size={17} />
                      </span>
                      <span className="n-text">{item.label}</span>
                    </Link>
                  );
                })}
                <div className="nav-divider"></div>
                <div className="nav-label">Account</div>
                {NAV_ITEMS_BOTTOM.map((item) => {
                  const active = item.label === route.active;
                  return (
                    <Link key={item.label} href={item.href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <span className="n-icon">
                        <Icon name={item.icon} size={17} />
                      </span>
                      <span className="n-text">{item.label}</span>
                      {item.label === 'Notifications' && unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="main">
            <header className="topbar">
              <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
                <Icon name="menu" />
              </button>
              {!leftOverride && (
                <button className="search-box" onClick={() => window.dispatchEvent(new Event('app:open-search'))}>
                  <Icon name="search" size={14} />
                  <span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — প্রজেক্ট, টাস্ক, মানুষ...</span>
                  <span className="kbd">⌘K</span>
                </button>
              )}
              <div style={{ display: 'contents' }} ref={setLeftEl}></div>
              <div className="topbar-spacer"></div>
              <div style={{ display: 'contents' }} ref={setActionsEl}></div>
              <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
                <Icon name="bell" />
                {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </Link>
              <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}>
                <Icon name={dark ? 'moon' : 'sun'} />
              </button>
              <ProfileMenu variant="topbar" profile={profile as never} email={user.email ?? ''} onUpdated={(p) => setProfile((prev) => ({ ...(prev ?? p), ...p }) as ShellProfile)} dark={dark} />
            </header>
            {children}
          </div>
        </div>
      </div>
    </AppShellContext.Provider>
  );
}
