'use client';

// Notifications — সম্পূর্ণ রিয়েল Supabase ডেটা (notifications টেবিল, শুধু
// recipient নিজের রো-ই দেখতে পারে — schema.sql দ্রষ্টব্য)। পাঠানো মকআপের
// কিছু অংশ honest কারণে বাদ/পরিবর্তন করা হয়েছে:
//   - মকআপের ফেক "demo state switcher" (Empty/Unread/Loading বাটন) বাদ —
//     এখন আসল loading/error/empty স্টেট ডেটার উপর নির্ভর করে দেখায়।
//   - মকআপের "Push Notifications" সেটিংস (Task/Discussion/Vote/Project/File
//     আলাদা আলাদা ক্যাটাগরি) সরিয়ে honest ভাবে শুধু Email + WhatsApp টগল
//     দেখানো হয়েছে — আর সেগুলোও শুধু Discussions আর Votes-এর জন্যই কাজ করে
//     (ব্যবহারকারীর অনুরোধ অনুযায়ী), কারণ dispatch route এই দুই টাইপই পাঠায়।
//   - Project/File টাইপের ফিল্টার পিল বাদ — notifications টেবিলে ওই টাইপ
//     এখনো তৈরি হয় না (শুধু task_assigned/discussion_*/vote_created)।
//   - "Open" হোভার-অ্যাকশন বাদ — পুরো রো-ই ক্লিকযোগ্য লিংক, ডুপ্লিকেট অ্যাকশন
//     রাখা হয়নি।

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import './notifications.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { relativeTimeBn } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';
import Avatar from '@/app/components/Avatar';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  'bar-chart': '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.3"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  dot: '<circle cx="12" cy="12" r="9"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'bar', label: 'Reports', href: '#' },
];
const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'bell', label: 'Notifications', href: '/notifications', active: true },
  { icon: 'settings', label: 'Settings', href: '#' },
];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null };

type SettingsProfile = {
  id: string;
  whatsapp_number: string | null;
  notify_email_discussions: boolean;
  notify_email_votes: boolean;
  notify_whatsapp_discussions: boolean;
  notify_whatsapp_votes: boolean;
};

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  entity_type: string | null;
  entity_id: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
  profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
};

const NOTIF_SELECT = 'id, recipient_id, actor_id, type, title, subtitle, meta, entity_type, entity_id, link, is_read, created_at, profiles!actor_id(full_name, avatar_color, avatar_url)';

const TYPE_META: Record<string, { icon: IconName; color: string; bg: string }> = {
  task_assigned: { icon: 'check', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  discussion_created: { icon: 'message', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  discussion_mention: { icon: 'at', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  discussion_reply: { icon: 'message', color: 'var(--accent)', bg: 'var(--accent-soft)' },
  vote_created: { icon: 'bar-chart', color: 'var(--warning)', bg: 'var(--warning-soft)' },
};
function typeMeta(t: string) {
  return TYPE_META[t] ?? { icon: 'bell', color: 'var(--ink-faint)', bg: 'var(--surface-muted)' };
}

const FILTER_PILLS: { key: string; label: string }[] = [
  { key: 'all', label: 'সব' },
  { key: 'unread', label: 'না পড়া' },
  { key: 'task', label: 'টাস্ক' },
  { key: 'discussion', label: 'আলোচনা' },
  { key: 'vote', label: 'ভোট' },
];

function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (d >= startOfToday) return 'আজ';
  if (d >= startOfYesterday) return 'গতকাল';
  if (d >= startOfWeek) return 'এই সপ্তাহে';
  return 'আগে';
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`toggle-switch${on ? ' on' : ''}`} onClick={onChange} disabled={disabled} aria-pressed={on}>
      <span className="toggle-knob"></span>
    </button>
  );
}

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const router = useRouter();

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const [activeFilter, setActiveFilter] = useState('all');

  const [showSettings, setShowSettings] = useState(false);
  const [settingsProfile, setSettingsProfile] = useState<SettingsProfile | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadNotifications() {
    if (!user) return { errorMessage: null, rows: [] as NotificationRow[] };
    const { data, error: err } = await supabase
      .from('notifications')
      .select(NOTIF_SELECT)
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    return { errorMessage: err?.message ?? null, rows: (data as unknown as NotificationRow[]) ?? [] };
  }

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        loadNotifications(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setNotifications(result.rows);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleReload() {
    setReloading(true);
    const result = await loadNotifications();
    setError(result.errorMessage);
    setNotifications(result.rows);
    setReloading(false);
  }

  async function markRead(id: string, read: boolean) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: read } : n)));
    const { error: err } = await supabase.from('notifications').update({ is_read: read }).eq('id', id).select('id');
    if (err) setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: !read } : n)));
  }

  async function deleteNotification(id: string) {
    setBusyId(id);
    const prev = notifications;
    setNotifications((cur) => cur.filter((n) => n.id !== id));
    const { error: err } = await supabase.from('notifications').delete().eq('id', id).select('id');
    setBusyId(null);
    if (err) setNotifications(prev);
  }

  async function markAllRead() {
    if (!user) return;
    setMarkingAll(true);
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', user.id).eq('is_read', false).select('id');
    setMarkingAll(false);
    if (unreadIds.length === 0) return;
  }

  async function openSettings() {
    if (!user) return;
    setShowSettings(true);
    setSettingsError(null);
    setSettingsLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('id, whatsapp_number, notify_email_discussions, notify_email_votes, notify_whatsapp_discussions, notify_whatsapp_votes')
      .eq('id', user.id)
      .single();
    setSettingsLoading(false);
    if (err || !data) { setSettingsError('সেটিংস লোড করা যায়নি।'); return; }
    setSettingsProfile(data as SettingsProfile);
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settingsProfile || !user) return;
    setSavingSettings(true);
    setSettingsError(null);
    const { error: err } = await supabase
      .from('profiles')
      .update({
        whatsapp_number: settingsProfile.whatsapp_number?.trim() || null,
        notify_email_discussions: settingsProfile.notify_email_discussions,
        notify_email_votes: settingsProfile.notify_email_votes,
        notify_whatsapp_discussions: settingsProfile.notify_whatsapp_discussions,
        notify_whatsapp_votes: settingsProfile.notify_whatsapp_votes,
      })
      .eq('id', user.id)
      .select('id');
    setSavingSettings(false);
    if (err) { setSettingsError('সেভ করা যায়নি — আবার চেষ্টা করুন।'); return; }
    setShowSettings(false);
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: notifications.length, unread: 0, task: 0, discussion: 0, vote: 0 };
    for (const n of notifications) {
      if (!n.is_read) c.unread++;
      if (n.type.startsWith('task')) c.task++;
      else if (n.type.startsWith('discussion')) c.discussion++;
      else if (n.type.startsWith('vote')) c.vote++;
    }
    return c;
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.is_read;
      if (activeFilter === 'all') return true;
      return n.type.startsWith(activeFilter);
    });
  }, [notifications, activeFilter]);

  const grouped = useMemo(() => {
    const buckets: { label: string; items: NotificationRow[] }[] = [];
    for (const n of filtered) {
      const label = dateGroupLabel(n.created_at);
      let bucket = buckets.find((b) => b.label === label);
      if (!bucket) { bucket = { label, items: [] }; buckets.push(bucket); }
      bucket.items.push(n);
    }
    return buckets;
  }, [filtered]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`notif-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div><div className="brand-name">FLOW 53</div><div className="brand-sub">Innovate · Design · Elevate</div></div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন"><Icon name="close" size={16} /></button>
            </div>
            <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                  {item.label === 'Notifications' && unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                </Link>
              ))}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} dark={dark} />
        </aside>

        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
            <button className="search-box"><Icon name="search" /><span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন...</span></button>
            <div className="topbar-spacer"></div>
            <button className="icon-btn" onClick={() => setDark((d) => !d)} aria-label="থিম"><Icon name={dark ? 'moon' : 'sun'} /></button>
            <button className="icon-btn" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">Notifications</h1>
                <p className="page-sub">টাস্ক অ্যাসাইনমেন্ট, আলোচনা আর ভোটের সব আপডেট এক জায়গায়।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleReload} disabled={reloading}><Icon name="refresh" size={13} /> {reloading ? 'রিলোড হচ্ছে…' : 'রিলোড'}</button>
                <button className="btn btn-ghost btn-sm" onClick={markAllRead} disabled={markingAll || counts.unread === 0}><Icon name="check-circle" size={13} /> সব পড়া হয়েছে বলে চিহ্নিত করুন</button>
                <button className="btn btn-ghost btn-sm" onClick={openSettings}><Icon name="settings" size={13} /> সেটিংস</button>
              </div>
            </div>

            {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

            <div className="filter-bar">
              {FILTER_PILLS.map((p) => (
                <button key={p.key} className={`filter-pill${activeFilter === p.key ? ' active' : ''}`} onClick={() => setActiveFilter(p.key)}>
                  {p.label}<span className="fp-count">{counts[p.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div className="state-view">
                <div className="state-icon"><Icon name="bell" size={22} /></div>
                <div className="state-title">লোড হচ্ছে…</div>
                <div className="state-sub">নোটিফিকেশন আনা হচ্ছে।</div>
              </div>
            ) : error ? (
              <div className="state-view">
                <div className="state-icon err"><Icon name="alert" size={22} /></div>
                <div className="state-title">লোড করা যায়নি</div>
                <div className="state-sub">নেটওয়ার্ক বা সার্ভার সমস্যা হতে পারে — আবার চেষ্টা করুন।</div>
                <button className="btn btn-ghost btn-sm" onClick={handleReload}><Icon name="refresh" size={13} /> আবার চেষ্টা করুন</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="state-view">
                <div className="state-icon"><Icon name="check-circle" size={22} /></div>
                <div className="state-title">{activeFilter === 'unread' ? 'সব পড়া হয়ে গেছে' : 'কোনো নোটিফিকেশন নেই'}</div>
                <div className="state-sub">{activeFilter === 'all' ? 'নতুন টাস্ক অ্যাসাইন হলে, কেউ আলোচনায় মেনশন করলে বা নতুন ভোট এলে এখানে দেখা যাবে।' : 'এই ফিল্টারে এখন কিছু নেই।'}</div>
              </div>
            ) : (
              <div>
                {grouped.map((group) => (
                  <div key={group.label}>
                    <div className="date-group-label">{group.label}</div>
                    <div className="notif-list">
                      {group.items.map((n) => {
                        const meta = typeMeta(n.type);
                        return (
                          <div
                            key={n.id}
                            className={`notif-row${n.is_read ? '' : ' unread'}`}
                            onClick={() => {
                              if (!n.is_read) markRead(n.id, true);
                              if (n.link) router.push(n.link);
                            }}
                          >
                            <span className={`notif-unread-dot${n.is_read ? ' hidden' : ''}`}></span>
                            <span className="notif-icon-badge" style={{ background: meta.bg, color: meta.color }}>
                              <Icon name={meta.icon} size={16} />
                              {n.profiles && <Avatar person={n.profiles} size={16} className="avatar avatar-mini" />}
                            </span>
                            <span className="notif-main">
                              <span className="notif-text">{n.title}</span>
                              {n.subtitle && <div className="notif-item-title">{n.subtitle}</div>}
                              {n.meta && <div className="notif-meta">{n.meta}</div>}
                            </span>
                            <span className="notif-time">{relativeTimeBn(n.created_at)}</span>
                            <span className="notif-hover-actions">
                              <button className="nha-btn" title={n.is_read ? 'না পড়া হিসেবে চিহ্নিত করুন' : 'পড়া হয়েছে বলে চিহ্নিত করুন'} onClick={(e) => { e.stopPropagation(); markRead(n.id, !n.is_read); }}>
                                <Icon name={n.is_read ? 'dot' : 'check-circle'} size={14} />
                              </button>
                              <button className="nha-btn danger" title="মুছে ফেলুন" disabled={busyId === n.id} onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}>
                                <Icon name="trash" size={14} />
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-icon"><Icon name="settings" size={16} /></div>
              <div className="modal-title">নোটিফিকেশন সেটিংস</div>
              <button className="modal-close" onClick={() => setShowSettings(false)}><Icon name="close" size={16} /></button>
            </div>
            <div className="modal-body">
              {settingsLoading ? (
                <div className="state-view" style={{ padding: '30px 10px' }}><div className="state-sub">লোড হচ্ছে…</div></div>
              ) : !settingsProfile ? (
                <div className="state-view" style={{ padding: '30px 10px' }}><div className="state-sub">{settingsError ?? 'লোড করা যায়নি।'}</div></div>
              ) : (
                <form onSubmit={saveSettings}>
                  <div className="settings-section-label">ইমেইল নোটিফিকেশন</div>
                  <div className="toggle-row">
                    <span className="toggle-label">নতুন আলোচনা, রিপ্লাই ও মেনশন</span>
                    <Toggle on={settingsProfile.notify_email_discussions} onChange={() => setSettingsProfile((p) => p && { ...p, notify_email_discussions: !p.notify_email_discussions })} />
                  </div>
                  <div className="toggle-row">
                    <span className="toggle-label">নতুন ভোট</span>
                    <Toggle on={settingsProfile.notify_email_votes} onChange={() => setSettingsProfile((p) => p && { ...p, notify_email_votes: !p.notify_email_votes })} />
                  </div>

                  <div className="settings-section-label">WhatsApp নোটিফিকেশন</div>
                  <label className="field-label" htmlFor="wa-number">WhatsApp নম্বর (কান্ট্রি কোডসহ)</label>
                  <input
                    id="wa-number"
                    className="field-input"
                    placeholder="+8801XXXXXXXXX"
                    value={settingsProfile.whatsapp_number ?? ''}
                    onChange={(e) => setSettingsProfile((p) => p && { ...p, whatsapp_number: e.target.value })}
                  />
                  <div className="toggle-row" style={{ marginTop: 4 }}>
                    <span className="toggle-label">নতুন আলোচনা, রিপ্লাই ও মেনশন</span>
                    <Toggle on={settingsProfile.notify_whatsapp_discussions} onChange={() => setSettingsProfile((p) => p && { ...p, notify_whatsapp_discussions: !p.notify_whatsapp_discussions })} />
                  </div>
                  <div className="toggle-row">
                    <span className="toggle-label">নতুন ভোট</span>
                    <Toggle on={settingsProfile.notify_whatsapp_votes} onChange={() => setSettingsProfile((p) => p && { ...p, notify_whatsapp_votes: !p.notify_whatsapp_votes })} />
                  </div>

                  <div className="settings-note">
                    টাস্ক অ্যাসাইনমেন্টের নোটিফিকেশন এখনো শুধু in-app ফিডেই দেখা যাবে — ইমেইল/WhatsApp-এ শুধু আলোচনা আর ভোট পাঠানো হয়। WhatsApp পেতে হলে Twilio Sandbox নম্বরে একবার &quot;join&quot; মেসেজ পাঠাতে হবে (অ্যাডমিনের কাছে জেনে নিন)।
                  </div>

                  {settingsError && <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: 12 }}>{settingsError}</div>}

                  <div className="modal-foot" style={{ margin: '14px -18px -18px -18px' }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSettings(false)}>বাতিল</button>
                    <button type="submit" className="btn btn-accent btn-sm" disabled={savingSettings}>{savingSettings ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
