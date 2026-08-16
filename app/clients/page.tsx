'use client';

// Screen 6 — Admin Client List। /projects, /todos-এর মতোই real Supabase ডেটা,
// একই শেল/KPI/ফিল্টার-পিল কনভেনশন। clients.status-এর আসল ভ্যালু (schema.sql-এ
// ডকুমেন্টেড: lead | discussion | active | retainer | completed, প্লাস
// onboarding থেকে আসা 'submitted') অনুযায়ী KPI/ফিল্টার বানানো হয়েছে — স্পেকের
// দেওয়া জেনেরিক CRM স্টেজ (Proposal/Negotiation/Won ইত্যাদি) বাস্তবে কোথাও নেই,
// তাই সেগুলো ব্যবহার না করে আসল ডেটার সাথে মেলানো হয়েছে।

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './clients.css';
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
  checklist: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  mail: '<path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
  portal: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><circle cx="12" cy="14" r="1.5"/><path d="M12 14v6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'checklist', label: 'To-Do', href: '/todos' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '/clients', active: true },
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
  lead: { label: 'লিড', cls: 's-todo' },
  submitted: { label: 'তথ্য জমা হয়েছে', cls: 's-review' },
  discussion: { label: 'আলোচনা চলছে', cls: 's-review' },
  active: { label: 'সক্রিয়', cls: 's-progress' },
  retainer: { label: 'রিটেইনার', cls: 's-progress' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
};
const STATUS_ORDER = ['lead', 'submitted', 'discussion', 'active', 'retainer', 'completed'];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ManagerOption = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };

type ClientRow = {
  id: string;
  company_name: string;
  primary_contact: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  website: string | null;
  status: string;
  priority: string;
  account_manager_id: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  account_manager: ManagerOption | ManagerOption[] | null;
  client_requirements: { project_name: string | null; updated_at: string } | { project_name: string | null; updated_at: string }[] | null;
  projects: { id: string; name: string; status: string; budget: number | null }[] | null;
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function ClientsListPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newStatus, setNewStatus] = useState('lead');
  const [newManagerId, setNewManagerId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [clientsRes, profileRes, managersRes] = await Promise.all([
        supabase
          .from('clients')
          .select(
            'id, company_name, primary_contact, contact_email, contact_phone, industry, website, status, priority, account_manager_id, notes, user_id, created_at, account_manager:profiles!account_manager_id(id, full_name, avatar_color, avatar_url), client_requirements(project_name, updated_at), projects(id, name, status, budget)'
          )
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
        supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
      ]);

      if (clientsRes.error) setError(clientsRes.error.message);
      setClients((clientsRes.data as unknown as ClientRow[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setManagers((managersRes.data as ManagerOption[]) ?? []);
      setLoading(false);
    }

    run();
  }, [user]);

  const kpis = useMemo(
    () => ({
      total: clients.length,
      new: clients.filter((c) => c.status === 'lead').length,
      active: clients.filter((c) => c.status === 'active' || c.status === 'retainer').length,
      pending: clients.filter((c) => c.status === 'submitted' || c.status === 'discussion').length,
      completed: clients.filter((c) => c.status === 'completed').length,
    }),
    [clients]
  );

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newCompany.trim()) return;

    setCreating(true);
    const { data, error: createError } = await supabase
      .from('clients')
      .insert({
        company_name: newCompany.trim(),
        primary_contact: newContact.trim() || null,
        contact_email: newEmail.trim() || null,
        contact_phone: newPhone.trim() || null,
        industry: newIndustry.trim() || null,
        website: newWebsite.trim() || null,
        status: newStatus,
        account_manager_id: newManagerId || null,
      })
      .select('id, company_name, primary_contact, contact_email, contact_phone, industry, website, status, priority, account_manager_id, notes, user_id, created_at')
      .single();

    if (createError) {
      setError(createError.message);
      setCreating(false);
      return;
    }

    if (data) {
      const manager = managers.find((m) => m.id === newManagerId) ?? null;
      const row: ClientRow = { ...(data as ClientRow), account_manager: manager, client_requirements: null, projects: [] };
      setClients((prev) => [row, ...prev]);
      if (user) {
        await supabase.from('activity_log').insert({
          actor_id: user.id,
          action: 'client_added',
          entity_type: 'client',
          entity_id: row.id,
          detail: `"${row.company_name}" ক্লায়েন্ট হিসেবে যোগ করা হয়েছে`,
        });
      }
    }

    setNewCompany('');
    setNewContact('');
    setNewEmail('');
    setNewPhone('');
    setNewIndustry('');
    setNewWebsite('');
    setNewStatus('lead');
    setNewManagerId('');
    setCreating(false);
    setShowCreate(false);
  }

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = clients;
    if (statusFilter !== 'all') filtered = filtered.filter((c) => c.status === statusFilter);
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.company_name.toLowerCase().includes(q) ||
          (c.primary_contact ?? '').toLowerCase().includes(q) ||
          (c.contact_email ?? '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [clients, search, statusFilter]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`clientslist-root${dark ? ' dark' : ''}`}>
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
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
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
                <h1 className="page-title">Clients</h1>
                <p className="page-sub">সব ক্লায়েন্ট এক জায়গায় — বিস্তারিত দেখতে যেকোনো একটাতে ক্লিক করুন।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" size={14} /> Add Client
                </button>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon">
                    <Icon name="building" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>
                  {loading ? '—' : kpis.total}
                </div>
                <div className="kpi-label">Total Clients</div>
                <div className="kpi-deco">
                  <Icon name="building" size={56} />
                </div>
              </div>
              <div className="kpi-card clickable" onClick={() => setStatusFilter('lead')}>
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--surface-muted)', color: 'var(--ink-soft)' }}>
                    <Icon name="portal" />
                  </div>
                </div>
                <div className="kpi-value tabular">{loading ? '—' : kpis.new}</div>
                <div className="kpi-label">New</div>
                <div className="kpi-deco">
                  <Icon name="portal" size={56} />
                </div>
              </div>
              <div className="kpi-card clickable" onClick={() => setStatusFilter('active')}>
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Icon name="check" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>
                  {loading ? '—' : kpis.active}
                </div>
                <div className="kpi-label">Active</div>
                <div className="kpi-deco" style={{ color: 'var(--accent)' }}>
                  <Icon name="check" size={56} />
                </div>
              </div>
              <div className="kpi-card clickable" onClick={() => setStatusFilter('submitted')}>
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                    <Icon name="checklist" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>
                  {loading ? '—' : kpis.pending}
                </div>
                <div className="kpi-label">Pending Review</div>
                <div className="kpi-deco" style={{ color: 'var(--warning)' }}>
                  <Icon name="checklist" size={56} />
                </div>
              </div>
              <div className="kpi-card clickable" onClick={() => setStatusFilter('completed')}>
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}>
                    <Icon name="check-circle" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>
                  {loading ? '—' : kpis.completed}
                </div>
                <div className="kpi-label">Completed</div>
                <div className="kpi-deco" style={{ color: 'var(--positive)' }}>
                  <Icon name="check-circle" size={56} />
                </div>
              </div>
            </div>

            <div className="toolbar">
              <div className="toolbar-search">
                <Icon name="search" size={13} />
                <input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button className={`filter-pill${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>
                All
              </button>
              {STATUS_ORDER.map((s) => (
                <button key={s} className={`filter-pill${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <button className="empty-icon" onClick={() => setShowCreate(true)} aria-label="নতুন ক্লায়েন্ট যোগ করুন">
                  <Icon name="plus" />
                </button>
                <div className="empty-title">এখনও কোনো ক্লায়েন্ট নেই</div>
                <button className="btn btn-accent btn-sm" onClick={() => setShowCreate(true)} style={{ marginTop: 10 }}>
                  + প্রথম ক্লায়েন্ট যোগ করুন
                </button>
              </div>
            ) : visibleClients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">এই ফিল্টারে কোনো ক্লায়েন্ট নেই</div>
              </div>
            ) : (
              <div className="client-list">
                {visibleClients.map((c) => {
                  const meta = STATUS_META[c.status] ?? { label: c.status, cls: 's-todo' };
                  const manager = toOne(c.account_manager);
                  const requirements = toOne(c.client_requirements);
                  const projects = c.projects ?? [];
                  const dealValue = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
                  const lastActivity = requirements?.updated_at && requirements.updated_at > c.created_at ? requirements.updated_at : c.created_at;

                  return (
                    <Link className="client-row" key={c.id} href={`/clients/${c.id}`}>
                      <Avatar person={{ full_name: c.company_name, avatar_color: 'var(--accent)' }} size={36} />
                      <div className="client-row-main">
                        <div className="client-row-name">{c.company_name}</div>
                        <div className="client-row-sub">
                          {c.primary_contact ?? '—'} {c.contact_email ? `· ${c.contact_email}` : ''}
                        </div>
                      </div>
                      <div className="client-row-col client-row-project">
                        {projects.length > 0 ? projects[0].name : requirements?.project_name ? <span className="ink-faint">{requirements.project_name} (unreviewed)</span> : <span className="ink-faint">No project</span>}
                      </div>
                      <div className="client-row-col">
                        <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="client-row-col client-row-value tabular">{dealValue > 0 ? `৳${dealValue.toLocaleString('en-US')}` : '—'}</div>
                      <div className="client-row-col client-row-manager">{manager ? <Avatar person={manager} size={24} title={manager.full_name} /> : <span className="ink-faint">—</span>}</div>
                      <div className="client-row-col client-row-activity">{relativeTimeBn(lastActivity)}</div>
                    </Link>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {showCreate && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon">
                <Icon name="building" size={16} />
              </div>
              <div className="modal-title">নতুন ক্লায়েন্ট যোগ করুন</div>
              <button type="button" className="modal-close" onClick={() => setShowCreate(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Company Name</label>
                  <input className="modal-input" type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Acme Inc." autoFocus required />
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Contact Name</label>
                    <input className="modal-input" type="text" value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Email</label>
                    <input className="modal-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Phone</label>
                    <input className="modal-input" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Industry</label>
                    <input className="modal-input" type="text" value={newIndustry} onChange={(e) => setNewIndustry(e.target.value)} placeholder="ঐচ্ছিক" />
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Website</label>
                  <input className="modal-input" type="text" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} placeholder="ঐচ্ছিক" />
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Status</label>
                    <select className="modal-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Assigned Manager</label>
                    <select className="modal-select" value={newManagerId} onChange={(e) => setNewManagerId(e.target.value)}>
                      <option value="">কেউ না</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                  বাতিল
                </button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !newCompany.trim()}>
                  {creating ? 'যোগ হচ্ছে…' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
