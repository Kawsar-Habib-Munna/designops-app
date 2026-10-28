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
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  checklist: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
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
  { icon: 'bar', label: 'Reports', href: '#' },
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
                {NAV_ITEMS.map((item) => {
                  const active = item.label === route.active;
                  return (
                    <Link key={item.label} href={item.href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <span className="n-icon">
                        <Icon name={item.icon} />
                      </span>{' '}
                      {item.label}
                    </Link>
                  );
                })}
                <div className="nav-divider"></div>
                {NAV_ITEMS_BOTTOM.map((item) => {
                  const active = item.label === route.active;
                  return (
                    <Link key={item.label} href={item.href} className={`nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
                      <span className="n-icon">
                        <Icon name={item.icon} />
                      </span>{' '}
                      {item.label}
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
