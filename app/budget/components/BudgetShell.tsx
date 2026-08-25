'use client';

// Budget & Quote Generator মডিউলের শেয়ার্ড sidebar/topbar shell। বাকি অ্যাপে
// প্রতিটা পাতা নিজের শেল নিজে ডুপ্লিকেট করে (client portal-এর SowShell/
// HistoryShell যেমন), কিন্তু এই মডিউলে ৬টা পাতা (Overview/Generate Quote/
// Services/History/Settings + placeholder) সবগুলোই হুবহু একই nav+active-state
// লজিক শেয়ার করে — এখানে ডুপ্লিকেট করলে ৬ জায়গায় active-route হাইলাইট বাগ
// আলাদাভাবে ফিক্স করতে হতো। তাই ব্যতিক্রম হিসেবে একটাই শেয়ার্ড কম্পোনেন্ট,
// শুধু এই মডিউলের ভেতরেই ব্যবহৃত হয় (বাকি অ্যাপে না)।

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import ProfileMenu from '@/app/components/ProfileMenu';
import '../budget-shared.css';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
};
type IconName = keyof typeof ICON_PATHS;
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

export type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null; is_admin?: boolean };
export type BudgetNavKey = 'overview' | 'new' | 'services' | 'history' | 'settings';

const NAV_ITEMS: { key: BudgetNavKey; icon: IconName; label: string; href: string }[] = [
  { key: 'overview', icon: 'grid', label: 'Overview', href: '/budget' },
  { key: 'new', icon: 'plus', label: 'Generate Quote', href: '/budget/new' },
  { key: 'services', icon: 'layers', label: 'Services', href: '/budget/services' },
  { key: 'history', icon: 'clock', label: 'Quote History', href: '/budget/history' },
];

export default function BudgetShell({
  active,
  topbarTitle,
  profile,
  email,
  onProfileUpdated,
  children,
}: {
  active: BudgetNavKey;
  topbarTitle: string;
  profile: ProfileRow | null;
  email: string;
  onProfileUpdated: (p: ProfileRow) => void;
  children: ReactNode;
}) {
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdmin = !!profile?.is_admin;

  return (
    <div className={`budget-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="Budget নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div>
                <div className="brand-name">Budget</div>
                <div className="brand-sub">FLOW 53 · Quote Generator</div>
              </div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <Link href="/dashboard" className="nav-item" style={{ marginBottom: 10 }}>
              <Icon name="back" /> Back to Dashboard
            </Link>
            <div className="nav-divider"></div>
            <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
              {NAV_ITEMS.map((item) => (
                <Link key={item.key} href={item.href} className={`nav-item${active === item.key ? ' active' : ''}`} aria-current={active === item.key ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
              ))}
              <Link href="/team" className="nav-item">
                <Icon name="users" /> Team
              </Link>
              {isAdmin && (
                <Link href="/budget/settings" className={`nav-item${active === 'settings' ? ' active' : ''}`} aria-current={active === 'settings' ? 'page' : undefined}>
                  <Icon name="settings" /> Settings
                </Link>
              )}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={email} onUpdated={onProfileUpdated} dark={dark} />
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">{topbarTitle}</span>
            <div className="topbar-spacer"></div>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}>
              <Icon name={dark ? 'moon' : 'sun'} />
            </button>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </div>
  );
}
