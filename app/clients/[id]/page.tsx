'use client';

// Screen 7 — Admin Client Details। /projects/[id]-এর মতো একই ধাঁচ: breadcrumb +
// header + summary card, তারপর দুই-কলামে Requirements/Projects (বাম) আর
// Files/Activity (ডান)। Activity টাইমলাইন বিদ্যমান activity_log টেবিল রিইউজ করে
// (entity_type='client') — নতুন কোনো audit টেবিল বানানো হয়নি।

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import '../clients.css';
import './client-detail.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { relativeTimeBn, formatBnDate } from '@/lib/format';
import { driveThumbnailUrl } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';

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
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
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

const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'চলছে', cls: 's-progress' },
  review: { label: 'রিভিউ', cls: 's-review' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
  on_hold: { label: 'হোল্ডে', cls: 's-todo' },
};

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ManagerOption = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };

type ClientDetail = {
  id: string;
  company_name: string;
  primary_contact: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  industry: string | null;
  website: string | null;
  designation: string | null;
  company_size: string | null;
  status: string;
  priority: string;
  account_manager_id: string | null;
  notes: string | null;
  user_id: string | null;
  admin_request: string | null;
  admin_request_at: string | null;
  is_archived: boolean;
  created_at: string;
};

type Requirements = {
  project_name: string | null;
  project_type: string | null;
  project_description: string | null;
  goals: string | null;
  target_audience: string | null;
  required_features: string | null;
  expected_timeline: string | null;
  budget_range: string | null;
  reference_notes: string | null;
};

type FileRow = { id: string; name: string; file_type: string | null; size_bytes: number | null; drive_url: string; uploaded_by: string; created_at: string };
type ProjectSummary = { id: string; name: string; status: string; progress: number | null; budget: number | null };
type ActivityRow = { id: string; action: string; detail: string | null; created_at: string; actor: { full_name: string } | { full_name: string }[] | null };

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const searchParams = useSearchParams();
  const editParamHandledRef = useRef(false);
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [manager, setManager] = useState<ManagerOption | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<ClientDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [requestText, setRequestText] = useState('');
  const [requestSaving, setRequestSaving] = useState(false);

  useEffect(() => {
    if (!user || !clientId) return;

    async function loadAll() {
      const [clientRes, requirementsRes, filesRes, projectsRes, activityRes, managersRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, company_name, primary_contact, contact_email, contact_phone, industry, website, designation, company_size, status, priority, account_manager_id, notes, user_id, admin_request, admin_request_at, is_archived, created_at, account_manager:profiles!account_manager_id(id, full_name, avatar_color, avatar_url)')
          .eq('id', clientId)
          .maybeSingle(),
        supabase.from('client_requirements').select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes').eq('client_id', clientId).maybeSingle(),
        supabase.from('client_files').select('id, name, file_type, size_bytes, drive_url, uploaded_by, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name, status, progress, budget').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('activity_log').select('id, action, detail, created_at, actor:profiles!actor_id(full_name)').eq('entity_type', 'client').eq('entity_id', clientId).order('created_at', { ascending: false }).limit(30),
        supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
      ]);

      if (clientRes.error) setError(clientRes.error.message);

      if (!clientRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const row = clientRes.data as unknown as ClientDetail & { account_manager: ManagerOption | ManagerOption[] | null };
      setClient(row);
      setManager(toOne(row.account_manager));
      setRequirements((requirementsRes.data as Requirements) ?? null);
      setFiles((filesRes.data as FileRow[]) ?? []);
      setProjects((projectsRes.data as ProjectSummary[]) ?? []);
      setActivity((activityRes.data as unknown as ActivityRow[]) ?? []);
      setManagers((managersRes.data as ManagerOption[]) ?? []);
      setLoading(false);
    }

    loadAll();
  }, [user, clientId, reloadKey]);

  // Screen 6-এর "Edit Client" রো-অ্যাকশন থেকে ?edit=1 দিয়ে আসলে এডিট মোডাল
  // অটোমেটিক খুলে যায় — শুধু প্রথমবার, সেভ করার পর reloadKey বদলালে আবার
  // খুলে যাওয়া থেকে আটকাতে editParamHandledRef ব্যবহার করা হয়েছে।
  useEffect(() => {
    if (!client || editParamHandledRef.current) return;
    if (searchParams.get('edit') !== '1') return;
    editParamHandledRef.current = true;
    const timer = setTimeout(() => {
      setEditForm(client);
      setShowEdit(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [client, searchParams]);

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editForm || !client) return;
    setSaving(true);

    const { error: updateError } = await supabase
      .from('clients')
      .update({
        company_name: editForm.company_name.trim(),
        primary_contact: editForm.primary_contact?.trim() || null,
        contact_email: editForm.contact_email?.trim() || null,
        contact_phone: editForm.contact_phone?.trim() || null,
        industry: editForm.industry?.trim() || null,
        website: editForm.website?.trim() || null,
        designation: editForm.designation?.trim() || null,
        company_size: editForm.company_size?.trim() || null,
        status: editForm.status,
        priority: editForm.priority,
        account_manager_id: editForm.account_manager_id || null,
        notes: editForm.notes?.trim() || null,
      })
      .eq('id', client.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    if (user && editForm.status !== client.status) {
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'status_changed',
        entity_type: 'client',
        entity_id: client.id,
        detail: `স্ট্যাটাস "${STATUS_META[client.status]?.label ?? client.status}" থেকে "${STATUS_META[editForm.status]?.label ?? editForm.status}"-এ পরিবর্তন করা হয়েছে`,
      });
    }

    setSaving(false);
    setShowEdit(false);
    setReloadKey((k) => k + 1);
  }

  // ক্লায়েন্টের কাছে অতিরিক্ত তথ্য চাওয়া — client ড্যাশবোর্ডে (Screen 5) সাথে সাথে
  // "Action Required" স্টেট হিসেবে দেখা যায়, কোনো আলাদা মেসেজিং টেবিল ছাড়াই।
  async function handleSendRequest() {
    if (!client || !user || !requestText.trim()) return;
    setRequestSaving(true);

    const { error: updateError } = await supabase
      .from('clients')
      .update({ admin_request: requestText.trim(), admin_request_at: new Date().toISOString() })
      .eq('id', client.id);

    if (updateError) {
      setError(updateError.message);
      setRequestSaving(false);
      return;
    }

    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'info_requested',
      entity_type: 'client',
      entity_id: client.id,
      detail: `ক্লায়েন্টের কাছে অতিরিক্ত তথ্য চাওয়া হয়েছে: "${requestText.trim()}"`,
    });

    setRequestText('');
    setRequestSaving(false);
    setReloadKey((k) => k + 1);
  }

  async function handleResolveRequest() {
    if (!client || !user) return;
    setRequestSaving(true);

    const { error: updateError } = await supabase.from('clients').update({ admin_request: null, admin_request_at: null }).eq('id', client.id);

    if (updateError) {
      setError(updateError.message);
      setRequestSaving(false);
      return;
    }

    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'info_request_resolved',
      entity_type: 'client',
      entity_id: client.id,
      detail: 'তথ্য অনুরোধ সমাধান হিসেবে চিহ্নিত করা হয়েছে',
    });

    setRequestSaving(false);
    setReloadKey((k) => k + 1);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  if (loading) {
    return (
      <div className={`clientslist-root client-detail-root${dark ? ' dark' : ''}`}>
        <div className="shell">
          <div className="main">
            <p style={{ padding: 40, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className={`clientslist-root client-detail-root${dark ? ' dark' : ''}`}>
        <div className="shell">
          <div className="main">
            <div style={{ padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>এই ক্লায়েন্ট পাওয়া যায়নি।</p>
              <Link href="/clients" className="btn btn-ghost btn-sm">
                Clients-এ ফিরে যান
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const meta = client.is_archived
    ? { label: 'আর্কাইভড', cls: 's-archived' }
    : client.admin_request
      ? { label: 'তথ্য দরকার', cls: 's-action' }
      : (STATUS_META[client.status] ?? { label: client.status, cls: 's-todo' });
  const source = client.user_id ? 'Client Portal (self-registered)' : 'Manually Added by Team';

  return (
    <div className={`clientslist-root client-detail-root${dark ? ' dark' : ''}`}>
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
            <div className="breadcrumb">
              <Link href="/clients">Clients</Link>
              <span className="sep">/</span>
              <span className="current">{client.company_name}</span>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="proj-header">
              <div className="proj-title-row" style={{ alignItems: 'flex-start' }}>
                <div className="proj-icon">{client.company_name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="proj-title-row">
                    <span className="proj-title">{client.company_name}</span>
                    <span className={`status-pill ${meta.cls}`} style={{ padding: '4px 10px' }}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="proj-sub-row">
                    {client.primary_contact && (
                      <>
                        <span>{client.primary_contact}</span>
                        <span className="dividerdot"></span>
                      </>
                    )}
                    {manager && (
                      <>
                        <span>Manager: {manager.full_name}</span>
                        <span className="dividerdot"></span>
                      </>
                    )}
                    <span>{source}</span>
                  </div>
                </div>
              </div>
              <div className="header-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEditForm(client);
                    setShowEdit(true);
                  }}
                >
                  <Icon name="edit" size={14} /> Edit
                </button>
                <Link className="btn btn-accent btn-sm" href={`/clients/${client.id}/create-project`}>
                  <Icon name="plus" size={14} /> Create Project
                </Link>
                <button className="icon-btn" disabled title="শীঘ্রই আসছে" aria-label="আরও অপশন">
                  <Icon name="more" />
                </button>
              </div>
            </div>

            <div className="summary-card">
              <div className="client-detail-grid">
                <div>
                  <div className="client-detail-label">Email</div>
                  <div className="client-detail-value">{client.contact_email ?? '—'}</div>
                </div>
                <div>
                  <div className="client-detail-label">Phone</div>
                  <div className="client-detail-value tabular">{client.contact_phone ?? '—'}</div>
                </div>
                <div>
                  <div className="client-detail-label">Website</div>
                  <div className="client-detail-value">{client.website ?? '—'}</div>
                </div>
                <div>
                  <div className="client-detail-label">Industry</div>
                  <div className="client-detail-value">{client.industry ?? '—'}</div>
                </div>
                <div>
                  <div className="client-detail-label">Company Size</div>
                  <div className="client-detail-value">{client.company_size ?? '—'}</div>
                </div>
                <div>
                  <div className="client-detail-label">Designation</div>
                  <div className="client-detail-value">{client.designation ?? '—'}</div>
                </div>
              </div>
              {client.notes && <p className="client-notes">{client.notes}</p>}
            </div>

            <div className="detail-two-col">
              <div className="detail-main-col">
                {client.user_id && (
                  <div className="side-card">
                    <div className="side-card-title">Request Information from Client</div>
                    {client.admin_request ? (
                      <>
                        <p className="req-text" style={{ marginBottom: 10 }}>&quot;{client.admin_request}&quot;</p>
                        <div className="client-detail-label" style={{ marginBottom: 12 }}>
                          {client.admin_request_at ? `পাঠানো হয়েছে ${relativeTimeBn(client.admin_request_at)}` : ''}
                        </div>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={handleResolveRequest} disabled={requestSaving}>
                          {requestSaving ? 'সেভ হচ্ছে…' : 'Mark Resolved'}
                        </button>
                      </>
                    ) : (
                      <>
                        <textarea
                          className="modal-textarea"
                          placeholder="ক্লায়েন্টের কাছে কী তথ্য দরকার লিখুন…"
                          value={requestText}
                          onChange={(e) => setRequestText(e.target.value)}
                          style={{ marginBottom: 10 }}
                        />
                        <button type="button" className="btn btn-accent btn-sm" onClick={handleSendRequest} disabled={requestSaving || !requestText.trim()}>
                          {requestSaving ? 'পাঠানো হচ্ছে…' : 'Send Request'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="side-card">
                  <div className="side-card-title">Project Requirements</div>
                  {requirements ? (
                    <>
                      <div className="client-detail-grid">
                        <div>
                          <div className="client-detail-label">Project Name</div>
                          <div className="client-detail-value">{requirements.project_name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="client-detail-label">Project Type</div>
                          <div className="client-detail-value">{requirements.project_type ?? '—'}</div>
                        </div>
                        <div>
                          <div className="client-detail-label">Timeline</div>
                          <div className="client-detail-value">{requirements.expected_timeline ?? '—'}</div>
                        </div>
                        <div>
                          <div className="client-detail-label">Budget</div>
                          <div className="client-detail-value">{requirements.budget_range ?? '—'}</div>
                        </div>
                      </div>
                      {requirements.project_description && (
                        <div className="req-block">
                          <div className="client-detail-label">Description</div>
                          <p className="req-text">{requirements.project_description}</p>
                        </div>
                      )}
                      {requirements.goals && (
                        <div className="req-block">
                          <div className="client-detail-label">Goals</div>
                          <p className="req-text">{requirements.goals}</p>
                        </div>
                      )}
                      {requirements.target_audience && (
                        <div className="req-block">
                          <div className="client-detail-label">Target Audience</div>
                          <p className="req-text">{requirements.target_audience}</p>
                        </div>
                      )}
                      {requirements.required_features && (
                        <div className="req-block">
                          <div className="client-detail-label">Required Features</div>
                          <p className="req-text">{requirements.required_features}</p>
                        </div>
                      )}
                      {requirements.reference_notes && (
                        <div className="req-block">
                          <div className="client-detail-label">References</div>
                          <p className="req-text">{requirements.reference_notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="side-empty">এই ক্লায়েন্ট এখনো কোনো requirements জমা দেননি।</p>
                  )}
                </div>

                <div className="side-card">
                  <div className="side-card-title">Projects</div>
                  {projects.length === 0 ? (
                    <p className="side-empty">এখনো কোনো প্রজেক্ট তৈরি হয়নি।</p>
                  ) : (
                    <div className="mini-list">
                      {projects.map((p) => {
                        const pm = PROJECT_STATUS_META[p.status] ?? { label: p.status, cls: 's-todo' };
                        return (
                          <Link className="mini-row" key={p.id} href={`/projects/${p.id}`}>
                            <span className="mini-row-name">{p.name}</span>
                            <span className={`status-pill ${pm.cls}`}>{pm.label}</span>
                            <span className="mini-row-progress tabular">{p.progress ?? 0}%</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-side-col">
                <div className="side-card">
                  <div className="side-card-title">Files</div>
                  {files.length === 0 ? (
                    <p className="side-empty">এখনো কোনো ফাইল শেয়ার করা হয়নি।</p>
                  ) : (
                    <div className="mini-list">
                      {files.map((f) => (
                        <a className="file-row" key={f.id} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer">
                          <Icon name="file" size={14} />
                          <div className="file-row-main">
                            <div className="file-row-name">{f.name}</div>
                            <div className="file-row-meta">
                              {formatBytes(f.size_bytes)} · {f.uploaded_by === 'client' ? 'Client' : 'Team'} · {formatBnDate(f.created_at)}
                            </div>
                          </div>
                          <Icon name="download" size={14} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="side-card">
                  <div className="side-card-title">Activity</div>
                  {activity.length === 0 ? (
                    <p className="side-empty">এখনো কোনো অ্যাক্টিভিটি নেই।</p>
                  ) : (
                    <div className="activity-list">
                      {activity.map((a) => {
                        const actor = toOne(a.actor);
                        return (
                          <div className="activity-item" key={a.id}>
                            <div className="activity-dot"></div>
                            <div>
                              <div className="activity-text">{a.detail ?? a.action}</div>
                              <div className="activity-meta">
                                {actor?.full_name ?? 'Client'} · {relativeTimeBn(a.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {showEdit && editForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEdit(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon">
                <Icon name="edit" size={16} />
              </div>
              <div className="modal-title">ক্লায়েন্ট এডিট করুন</div>
              <button type="button" className="modal-close" onClick={() => setShowEdit(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Company Name</label>
                  <input className="modal-input" type="text" value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} required />
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Contact Name</label>
                    <input className="modal-input" type="text" value={editForm.primary_contact ?? ''} onChange={(e) => setEditForm({ ...editForm, primary_contact: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Designation</label>
                    <input className="modal-input" type="text" value={editForm.designation ?? ''} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                  </div>
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Email</label>
                    <input className="modal-input" type="email" value={editForm.contact_email ?? ''} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Phone</label>
                    <input className="modal-input" type="tel" value={editForm.contact_phone ?? ''} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
                  </div>
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Industry</label>
                    <input className="modal-input" type="text" value={editForm.industry ?? ''} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Company Size</label>
                    <input className="modal-input" type="text" value={editForm.company_size ?? ''} onChange={(e) => setEditForm({ ...editForm, company_size: e.target.value })} />
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Website</label>
                  <input className="modal-input" type="text" value={editForm.website ?? ''} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field">
                    <label className="modal-label">Status</label>
                    <select className="modal-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Priority</label>
                    <select className="modal-select" value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}>
                      <option value="standard">Standard</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Assigned Manager</label>
                  <select className="modal-select" value={editForm.account_manager_id ?? ''} onChange={(e) => setEditForm({ ...editForm, account_manager_id: e.target.value })}>
                    <option value="">কেউ না</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Notes</label>
                  <textarea className="modal-textarea" value={editForm.notes ?? ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>
                  বাতিল
                </button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={saving || !editForm.company_name.trim()}>
                  {saving ? 'সেভ হচ্ছে…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
