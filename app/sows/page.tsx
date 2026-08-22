'use client';

// SOW-01 — All SOWs। এজেন্সি-ওয়াইড ops ভিউ: প্রতিটা প্রজেক্টের বর্তমান
// (সর্বশেষ ভার্সন) SOW এক টেবিলে — কোন ক্লায়েন্টের কোন SOW সাইনেচারের অপেক্ষায়
// আছে সেটা এক নজরে দেখার জন্য। প্রতি-প্রজেক্ট পূর্ণ ভার্সন হিস্ট্রি এখানে না
// (ওটা /projects/[id]/sow-এ ভার্সন ট্যাব দিয়ে, বা ক্লায়েন্ট সাইডে
// /client/project/[id]/sow/history দিয়ে ইতিমধ্যেই কভার করা) — এই পাতা শুধু
// "বর্তমানে কী অবস্থায় আছে" এর জন্য, তাই superseded ভার্সনগুলো বাদ দিয়ে
// প্রতি প্রজেক্টের সর্বোচ্চ ভার্সন-ই রাখা হয়েছে।
//
// গ্লোবাল সাইডবার নেভে যোগ করা হয়নি — এই অ্যাপের কনভেনশনে প্রতিটা admin পাতা
// নিজের সাইডবার নিজে ডুপ্লিকেট করে (কোনো শেয়ার্ড লেআউট কম্পোনেন্ট নেই), তাই
// নতুন একটা nav আইটেম যোগ করতে হলে প্রতিটা admin পাতা আলাদাভাবে এডিট করতে হতো।
// তার বদলে /projects/[id]/sow পাতা থেকে "All SOWs" লিঙ্ক দিয়ে এখানে আসা যায়।

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './sows.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDateLong, todayISO } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';
import Avatar from '@/app/components/Avatar';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  checklist: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
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
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
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

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 's-todo' },
  sent: { label: 'Awaiting Signature', cls: 's-review' },
  signed: { label: 'Signed', cls: 's-done' },
  cancelled: { label: 'Voided', cls: 's-archived' },
};
const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ClientBrief = { company_name: string };
type ProjectBrief = { id: string; name: string; clients: ClientBrief | ClientBrief[] | null };
type SowRow = {
  id: string;
  project_id: string;
  version: number;
  sow_number: string | null;
  status: string;
  project_value: number | null;
  currency: string | null;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  projects: ProjectBrief | ProjectBrief[] | null;
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const PAGE_SIZE = 15;

export default function AllSowsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [sows, setSows] = useState<SowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('recent');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [sowsRes, profileRes] = await Promise.all([
        supabase
          .from('sows')
          .select('id, project_id, version, sow_number, status, project_value, currency, sent_at, signed_at, created_at, projects(id, name, clients(company_name))')
          .order('version', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);

      if (sowsRes.error) setError(sowsRes.error.message);
      setSows((sowsRes.data as unknown as SowRow[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user]);

  // প্রতি প্রজেক্টের সর্বোচ্চ ভার্সন-ই "বর্তমান SOW" — sows ইতিমধ্যেই version
  // desc অর্ডারে আসে, তাই প্রথম occurrence-ই latest।
  const currentSows = useMemo(() => {
    const seen = new Set<string>();
    const result: SowRow[] = [];
    for (const s of sows) {
      if (seen.has(s.project_id)) continue;
      seen.add(s.project_id);
      result.push(s);
    }
    return result;
  }, [sows]);

  const kpis = useMemo(() => {
    const draft = currentSows.filter((s) => s.status === 'draft').length;
    const sent = currentSows.filter((s) => s.status === 'sent').length;
    const signed = currentSows.filter((s) => s.status === 'signed');
    const signedValue = signed.reduce((sum, s) => sum + (s.project_value ?? 0), 0);
    return { total: currentSows.length, draft, sent, signed: signed.length, signedValue };
  }, [currentSows]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = currentSows.filter((s) => (statusFilter === 'all' ? true : s.status === statusFilter));

    if (q) {
      list = list.filter((s) => {
        const proj = toOne(s.projects);
        const client = proj ? toOne(proj.clients) : null;
        return (client?.company_name ?? '').toLowerCase().includes(q) || (proj?.name ?? '').toLowerCase().includes(q) || (s.sow_number ?? '').toLowerCase().includes(q);
      });
    }

    const sorted = [...list];
    const dateOf = (s: SowRow) => s.signed_at ?? s.sent_at ?? s.created_at;
    if (sortKey === 'recent') sorted.sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
    else if (sortKey === 'oldest') sorted.sort((a, b) => (dateOf(a) > dateOf(b) ? 1 : -1));
    else if (sortKey === 'value-high') sorted.sort((a, b) => (b.project_value ?? 0) - (a.project_value ?? 0));
    else if (sortKey === 'value-low') sorted.sort((a, b) => (a.project_value ?? 0) - (b.project_value ?? 0));

    return sorted;
  }, [currentSows, search, statusFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filteredSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }

  function goToSow(projectId: string) {
    router.push(`/projects/${projectId}/sow`);
  }

  function handleExport() {
    const header = ['Client', 'Project', 'SOW Number', 'Version', 'Status', 'Value', 'Currency', 'Date'];
    const rows = filteredSorted.map((s) => {
      const proj = toOne(s.projects);
      const client = proj ? toOne(proj.clients) : null;
      return [client?.company_name ?? '', proj?.name ?? '', s.sow_number ?? '', String(s.version), STATUS_META[s.status]?.label ?? s.status, String(s.project_value ?? ''), s.currency ?? '', (s.signed_at ?? s.sent_at ?? s.created_at).slice(0, 10)];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sows-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`sowslist-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div>
                <div className="brand-name">FLOW 53</div>
                <div className="brand-sub">Innovate · Design · Elevate</div>
              </div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} href={item.href} className="nav-item">
                  <Icon name={item.icon} /> {item.label}
                </Link>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <Link key={item.label} href={item.href} className="nav-item">
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
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <div className="topbar-spacer"></div>
            <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}>
              <Icon name={dark ? 'moon' : 'sun'} />
            </button>
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">All SOWs</h1>
                <p className="page-sub">প্রতিটা প্রজেক্টের বর্তমান Statement of Work এক জায়গায় — কোনটা সাইনেচারের অপেক্ষায় আছে দেখুন।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filteredSorted.length === 0}>
                  <Icon name="download" size={13} /> Export
                </button>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card" onClick={resetFilters}>
                <div className="kpi-top">
                  <div className="kpi-icon">
                    <Icon name="doc" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>
                  {loading ? '—' : kpis.total}
                </div>
                <div className="kpi-label">Total SOWs</div>
              </div>
              <div
                className="kpi-card"
                onClick={() => {
                  setStatusFilter('sent');
                  setPage(1);
                }}
              >
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                    <Icon name="checklist" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>
                  {loading ? '—' : kpis.sent}
                </div>
                <div className="kpi-label">Awaiting Signature</div>
              </div>
              <div
                className="kpi-card"
                onClick={() => {
                  setStatusFilter('signed');
                  setPage(1);
                }}
              >
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}>
                    <Icon name="check" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>
                  {loading ? '—' : kpis.signed}
                </div>
                <div className="kpi-label">Signed</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}>
                    <Icon name="bar" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>
                  {loading ? '—' : `৳${kpis.signedValue.toLocaleString('en-US')}`}
                </div>
                <div className="kpi-label">Signed Value</div>
              </div>
            </div>

            <div className="toolbar">
              <div className="toolbar-search">
                <Icon name="search" size={13} />
                <input
                  placeholder="Search client, project, SOW number..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Status: All</option>
                <option value="draft">Draft</option>
                <option value="sent">Awaiting Signature</option>
                <option value="signed">Signed</option>
                <option value="cancelled">Voided</option>
              </select>
              <div className="toolbar-spacer"></div>
              <select className="filter-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="recent">Sort: Most Recent</option>
                <option value="oldest">Oldest</option>
                <option value="value-high">Value: High to Low</option>
                <option value="value-low">Value: Low to High</option>
              </select>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : currentSows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icon name="doc" />
                </div>
                <div className="empty-title">এখনও কোনো SOW তৈরি হয়নি</div>
              </div>
            ) : filteredSorted.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icon name="search" />
                </div>
                <div className="empty-title">এই ফিল্টারে কোনো SOW নেই</div>
                <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ marginTop: 10 }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="result-count tabular">{filteredSorted.length} SOWs</div>

                <div className="table-scroll">
                  <table className="sow-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>SOW</th>
                        <th>Status</th>
                        <th>Value</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((s) => {
                        const meta = STATUS_META[s.status] ?? { label: s.status, cls: 's-todo' };
                        const proj = toOne(s.projects);
                        const client = proj ? toOne(proj.clients) : null;
                        const sym = CURRENCY_SYMBOL[s.currency ?? 'BDT'] ?? s.currency ?? '';
                        const dateLabel = s.signed_at ?? s.sent_at ?? s.created_at;

                        return (
                          <tr key={s.id} className="sow-row" onClick={() => goToSow(s.project_id)}>
                            <td>
                              <div className="client-cell">
                                <Avatar person={{ full_name: client?.company_name ?? '—', avatar_color: 'var(--accent)' }} size={32} />
                                <span className="cname">{client?.company_name ?? '—'}</span>
                              </div>
                            </td>
                            <td>
                              <div className="proj-name">{proj?.name ?? '—'}</div>
                            </td>
                            <td>
                              <div className="ccompany">{s.sow_number ?? `v${s.version}`}</div>
                              <div className="sow-number">v{s.version}.0</div>
                            </td>
                            <td>
                              <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                            </td>
                            <td>{s.project_value != null ? <span className="value-cell tabular">{sym}{s.project_value.toLocaleString('en-US')}</span> : <span className="value-cell notset">Not set</span>}</td>
                            <td className="time-cell tabular">{formatBnDateLong(dateLabel)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-list">
                  {paged.map((s) => {
                    const meta = STATUS_META[s.status] ?? { label: s.status, cls: 's-todo' };
                    const proj = toOne(s.projects);
                    const client = proj ? toOne(proj.clients) : null;
                    const sym = CURRENCY_SYMBOL[s.currency ?? 'BDT'] ?? s.currency ?? '';
                    const dateLabel = s.signed_at ?? s.sent_at ?? s.created_at;

                    return (
                      <div className="msow-card" key={s.id} onClick={() => goToSow(s.project_id)}>
                        <div className="msow-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar person={{ full_name: client?.company_name ?? '—', avatar_color: 'var(--accent)' }} size={32} />
                            <span className="cname">{client?.company_name ?? '—'}</span>
                          </div>
                          <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <div className="msow-project">
                          {proj?.name ?? '—'} · {s.sow_number ?? `v${s.version}`}
                        </div>
                        <div className="msow-meta-row">
                          <span>Value</span>
                          {s.project_value != null ? <span className="tabular" style={{ color: 'var(--ink)', fontWeight: 600 }}>{sym}{s.project_value.toLocaleString('en-US')}</span> : <span>Not set</span>}
                        </div>
                        <div className="msow-meta-row">
                          <span>Date</span>
                          <span className="tabular">{formatBnDateLong(dateLabel)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pagination-row">
                    <span className="pagination-info tabular">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSorted.length)} of {filteredSorted.length} SOWs
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn nav" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} className={`page-btn${n === currentPage ? ' active' : ''}`} onClick={() => setPage(n)}>
                          {n}
                        </button>
                      ))}
                      <button className="page-btn nav" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
