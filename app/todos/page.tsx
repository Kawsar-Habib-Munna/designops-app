'use client';

// To-Do — Tasks পেজের প্রজেক্ট-ভিত্তিক workflow থেকে আলাদা, ছোট "কে কী করবে"
// লিস্ট। শুধু এডমিনরা নতুন To-Do তৈরি/অ্যাসাইন/রিঅ্যাসাইন/ডিলিট করতে পারবে,
// যেকোনো মেম্বার নিজের নামে থাকা To-Do complete/incomplete টগল করতে পারবে।

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './todos.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { sendNotifications } from '@/lib/notify';
import { todayISO, formatBnDate, formatTimeBn } from '@/lib/format';
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
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'checklist', label: 'To-Do', href: '/todos', active: true },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'layers', label: 'Portfolio', href: '/portfolio' },
  { icon: 'bar', label: 'Reports', href: '#' },
];

const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '/notifications' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; is_admin?: boolean };
type ProjectRow = { id: string; name: string };
type Priority = 'high' | 'medium' | 'low';
type TodoStatus = 'pending' | 'completed';

type TodoRow = {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  created_by: string | null;
  priority: Priority;
  due_date: string | null;
  due_time: string | null;
  project_id: string | null;
  status: TodoStatus;
  completed_at: string | null;
  created_at: string;
};

const TODO_SELECT = 'id, title, description, assignee_id, created_by, priority, due_date, due_time, project_id, status, completed_at, created_at';

const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

const FILTER_PILLS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'আজকের কাজ' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'high', label: 'High Priority' },
  { key: 'medium', label: 'Medium Priority' },
  { key: 'low', label: 'Low Priority' },
];

function isOverdue(t: TodoRow) {
  return t.status === 'pending' && !!t.due_date && t.due_date < todayISO();
}
function isDueToday(t: TodoRow) {
  return t.status === 'pending' && t.due_date === todayISO();
}
function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function dueLabel(t: TodoRow) {
  if (!t.due_date) return '';
  if (t.status === 'pending' && isOverdue(t)) return 'ওভারডিউ';
  if (t.due_date === todayISO()) return 'আজ';
  if (t.due_date === tomorrowISO()) return 'আগামীকাল';
  return formatBnDate(t.due_date);
}

async function fetchAll() {
  const [profRes, projRes, todoRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, is_admin').order('full_name'),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('todos').select(TODO_SELECT).order('created_at', { ascending: false }),
  ]);
  return {
    errorMessage: profRes.error?.message ?? projRes.error?.message ?? todoRes.error?.message ?? null,
    profiles: (profRes.data as ProfileRow[]) ?? [],
    projects: (projRes.data as ProjectRow[]) ?? [],
    todos: (todoRes.data as TodoRow[]) ?? [],
  };
}

export default function TodosPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');

  const [showCreate, setShowCreate] = useState(false);
  const [cTitle, setCTitle] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cAssigneeId, setCAssigneeId] = useState('');
  const [cPriority, setCPriority] = useState<Priority>('medium');
  const [cDueDate, setCDueDate] = useState('');
  const [cDueTime, setCDueTime] = useState('');
  const [cProjectId, setCProjectId] = useState('');
  const [cNotify, setCNotify] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  async function reload() {
    const result = await fetchAll();
    setError(result.errorMessage);
    setProfiles(result.profiles);
    setProjects(result.projects);
    setTodos(result.todos);
  }

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchAll(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, is_admin').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setProfiles(result.profiles);
      setProjects(result.projects);
      setTodos(result.todos);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }
    run();
  }, [user]);

  const kpis = useMemo(() => ({
    total: todos.length,
    dueToday: todos.filter(isDueToday).length,
    pending: todos.filter((t) => t.status === 'pending').length,
    completed: todos.filter((t) => t.status === 'completed').length,
    overdue: todos.filter(isOverdue).length,
  }), [todos]);

  function matchesFilter(t: TodoRow) {
    if (search.trim() && !t.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    switch (activeFilter) {
      case 'all': return true;
      case 'today': return isDueToday(t);
      case 'pending': return t.status === 'pending';
      case 'completed': return t.status === 'completed';
      case 'overdue': return isOverdue(t);
      case 'high': case 'medium': case 'low': return t.priority === activeFilter;
      default: return true;
    }
  }

  const memberCards = useMemo(() => {
    const list = memberFilter === 'all' ? profiles : profiles.filter((p) => p.id === memberFilter);
    const noConstraint = activeFilter === 'all' && !search.trim();
    return list
      .map((p) => {
        const all = todos.filter((t) => t.assignee_id === p.id);
        const filtered = all.filter(matchesFilter);
        const completed = all.filter((t) => t.status === 'completed').length;
        const pending = all.length - completed;
        const pct = all.length > 0 ? Math.round((completed / all.length) * 100) : 0;
        return { profile: p, all, filtered, completed, pending, pct };
      })
      .filter((m) => noConstraint || m.filtered.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesFilter closes over search/activeFilter, both already listed
  }, [profiles, todos, memberFilter, activeFilter, search]);

  const detailTodo = todos.find((t) => t.id === detailId) ?? null;

  function canInteract(t: TodoRow) {
    return !!profile && (profile.is_admin || t.assignee_id === profile.id);
  }

  function resetCreateForm() {
    setCTitle('');
    setCDescription('');
    setCAssigneeId('');
    setCPriority('medium');
    setCDueDate('');
    setCDueTime('');
    setCProjectId('');
    setCNotify(true);
    setCreateError(null);
  }

  function openCreate(assigneeId?: string) {
    resetCreateForm();
    if (assigneeId) setCAssigneeId(assigneeId);
    setShowCreate(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!cAssigneeId) {
      setCreateError('একজন মেম্বার বেছে নিন।');
      return;
    }
    setCreating(true);
    setCreateError(null);

    const { data, error: err } = await supabase
      .from('todos')
      .insert({
        title: cTitle.trim(),
        description: cDescription.trim() || null,
        assignee_id: cAssigneeId,
        created_by: profile?.id ?? null,
        priority: cPriority,
        due_date: cDueDate || null,
        due_time: cDueTime || null,
        project_id: cProjectId || null,
      })
      .select(TODO_SELECT)
      .single();
    setCreating(false);

    if (err || !data) {
      setCreateError(err?.message ?? 'To-Do তৈরি করা যায়নি।');
      return;
    }

    setTodos((prev) => [data as TodoRow, ...prev]);
    if (cNotify && cAssigneeId !== profile?.id) {
      sendNotifications([{
        recipient_id: cAssigneeId,
        actor_id: profile?.id ?? null,
        type: 'todo_assigned',
        title: `${profile?.full_name?.trim() || 'কেউ একজন'} আপনাকে একটা নতুন To-Do দিয়েছে`,
        subtitle: cTitle.trim(),
        link: '/todos',
      }]);
    }
    showToast('To-Do তৈরি হয়েছে ✓');
    setShowCreate(false);
  }

  async function handleToggleComplete(t: TodoRow) {
    if (!canInteract(t)) return;
    const nextStatus: TodoStatus = t.status === 'completed' ? 'pending' : 'completed';
    const { data, error: err } = await supabase
      .from('todos')
      .update({ status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null })
      .eq('id', t.id)
      .select(TODO_SELECT)
      .single();
    if (err || !data) return;
    setTodos((prev) => prev.map((x) => (x.id === t.id ? (data as TodoRow) : x)));
    showToast(nextStatus === 'completed' ? 'To-Do সম্পন্ন হয়েছে' : 'আবার পেন্ডিং করা হয়েছে');
  }

  async function handleDelete(id: string) {
    if (!window.confirm('এই To-Do মুছে ফেলতে চান? এই অ্যাকশন ফেরানো যাবে না।')) return;
    setBusy(true);
    const { error: err } = await supabase.from('todos').delete().eq('id', id);
    setBusy(false);
    if (err) {
      showToast('মুছে ফেলা যায়নি।');
      return;
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setDetailId(null);
    showToast('To-Do মুছে ফেলা হয়েছে');
  }

  async function handleReassign(id: string) {
    if (!reassignTo) return;
    setBusy(true);
    const { data, error: err } = await supabase
      .from('todos')
      .update({ assignee_id: reassignTo })
      .eq('id', id)
      .select(TODO_SELECT)
      .single();
    setBusy(false);
    if (err || !data) {
      showToast('রিঅ্যাসাইন করা যায়নি।');
      return;
    }
    setTodos((prev) => prev.map((t) => (t.id === id ? (data as TodoRow) : t)));
    setReassigning(false);
    showToast('রিঅ্যাসাইন করা হয়েছে ✓');
    if (reassignTo !== profile?.id) {
      sendNotifications([{
        recipient_id: reassignTo,
        actor_id: profile?.id ?? null,
        type: 'todo_assigned',
        title: `${profile?.full_name?.trim() || 'কেউ একজন'} আপনাকে একটা To-Do রিঅ্যাসাইন করেছে`,
        subtitle: (data as TodoRow).title,
        link: '/todos',
      }]);
    }
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  function nameOf(id: string | null) {
    if (!id) return '—';
    return profiles.find((p) => p.id === id)?.full_name ?? '—';
  }
  function projectNameOf(id: string | null) {
    if (!id) return null;
    return projects.find((p) => p.id === id)?.name ?? null;
  }

  return (
    <div className={`todos-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        {/* ============ SIDEBAR ============ */}
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
                <Link key={item.label} href={item.href} className="nav-item">
                  <Icon name={item.icon} /> {item.label}
                  {item.label === 'Notifications' && unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                </Link>
              ))}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} dark={dark} />
        </aside>

        {/* ============ MAIN ============ */}
        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
            <button className="search-box">
              <Icon name="search" />
              <span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — To-Do...</span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>
            <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}><Icon name={dark ? 'moon' : 'sun'} /></button>
            <Avatar person={profile} size={30} />
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">To-Do</h1>
                <p className="page-sub">সবাই কী নিয়ে কাজ করছে দেখুন।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" size={13} /> রিলোড</button>
                {profile?.is_admin && <button className="btn btn-accent" onClick={() => openCreate()}><Icon name="plus" /> Create To-Do</button>}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* summary */}
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="checklist" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.total}</div><div className="kpi-label">Total To-Dos</div><div className="kpi-deco"><Icon name="checklist" size={56} /></div></div>
              <div className="kpi-card clickable" onClick={() => setActiveFilter('today')}><div className="kpi-top"><div className="kpi-icon"><Icon name="calendar" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.dueToday}</div><div className="kpi-label">Due Today</div><div className="kpi-deco"><Icon name="calendar" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="clock" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>{loading ? '—' : kpis.pending}</div><div className="kpi-label">Pending</div><div className="kpi-deco" style={{ color: 'var(--warning)' }}><Icon name="clock" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check-circle" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>{loading ? '—' : kpis.completed}</div><div className="kpi-label">Completed</div><div className="kpi-deco" style={{ color: 'var(--positive)' }}><Icon name="check-circle" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--danger)' }}>{loading ? '—' : kpis.overdue}</div><div className="kpi-label">Overdue</div><div className="kpi-deco" style={{ color: 'var(--danger)' }}><Icon name="alert" size={56} /></div></div>
            </div>

            {/* toolbar */}
            <div className="toolbar">
              <div className="toolbar-search"><Icon name="search" size={13} /><input placeholder="Search to-dos..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              {FILTER_PILLS.map((p) => (
                <button key={p.key} className={`filter-pill${activeFilter === p.key ? ' active' : ''}`} onClick={() => setActiveFilter(p.key)}>{p.label}</button>
              ))}
              <div className="toolbar-spacer"></div>
              <select className="member-select" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
                <option value="all">সব মেম্বার</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            {/* member grid */}
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : memberCards.length === 0 ? (
              <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="checklist" /></div><div className="empty-title">কিছু পাওয়া যায়নি</div></div></div>
            ) : (
              <div className="member-grid">
                {memberCards.map((m) => {
                  const isMine = m.profile.id === profile?.id;
                  return (
                    <div className={`member-card${isMine ? ' is-mine' : ''}`} key={m.profile.id}>
                      <div className="member-head">
                        <Avatar person={m.profile} size={34} />
                        <div className="member-name-wrap">
                          <div className="member-name-row">
                            <span className="member-name">{m.profile.full_name}</span>
                            {isMine && <span className="mine-chip">You</span>}
                          </div>
                          <div className="member-sub">{m.all.length === 0 ? 'No active To-Dos' : `${m.completed} completed · ${m.pending} pending`}</div>
                        </div>
                        <span className="member-count tabular">{m.all.length}</span>
                      </div>

                      {m.all.length > 0 && (
                        <div className="member-progress-wrap">
                          <div className="member-progress-top"><span className="member-progress-pct tabular">{m.pct}% complete</span></div>
                          <div className="progress-track"><div className="progress-fill" style={{ width: `${m.pct}%`, background: m.pct === 100 ? 'var(--positive)' : undefined }}></div></div>
                        </div>
                      )}

                      {m.all.length === 0 ? (
                        <div className="member-empty">
                          <div className="member-empty-icon"><Icon name="check" size={16} /></div>
                          <div className="member-empty-title">All clear</div>
                        </div>
                      ) : (
                        <div className="todo-list">
                          {m.filtered.map((t) => {
                            const interactive = canInteract(t);
                            const checked = t.status === 'completed';
                            return (
                              <div className={`todo-item${interactive ? '' : ' readonly'}`} key={t.id} onClick={() => setDetailId(t.id)}>
                                <span
                                  className={`todo-check${checked ? ' checked' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); if (interactive) handleToggleComplete(t); }}
                                >
                                  {checked ? '✓' : ''}
                                </span>
                                <div className="todo-main">
                                  <div className={`todo-title${checked ? ' done' : ''}`}>{t.title}</div>
                                  {checked ? (
                                    <div className="todo-meta completed-meta">Completed</div>
                                  ) : (
                                    <div className={`todo-meta${isOverdue(t) ? ' overdue' : ''}`}>
                                      <span className={`pri-dot pri-${t.priority}`}></span>
                                      {PRIORITY_LABEL[t.priority]}{t.due_date ? ` · ${dueLabel(t)}` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {profile?.is_admin && (
                        <div className="card-quick-assign">
                          <button className="quick-assign-btn" onClick={() => openCreate(m.profile.id)}>
                            <Icon name="plus" size={12} /> {isMine ? 'নিজেকে টাস্ক দিন' : `${m.profile.full_name}-কে টাস্ক দিন`}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ============ CREATE MODAL ============ */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon"><Icon name="plus" /></div>
              <span className="modal-title">নতুন To-Do তৈরি করুন</span>
              <button className="modal-close" onClick={() => setShowCreate(false)}><Icon name="close" size={14} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="modal-field"><label className="modal-label">To-Do শিরোনাম</label><input className="modal-input" value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="যেমন: Review homepage design" autoFocus required /></div>
                <div className="modal-field"><label className="modal-label">বিবরণ</label><textarea className="modal-textarea" value={cDescription} onChange={(e) => setCDescription(e.target.value)} placeholder="বিস্তারিত (ঐচ্ছিক)"></textarea></div>
                <div className="modal-field">
                  <label className="modal-label">Assign To</label>
                  <select className="modal-select" value={cAssigneeId} onChange={(e) => setCAssigneeId(e.target.value)} required>
                    <option value="" disabled>বেছে নিন</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div className="modal-field-grid">
                  <div className="modal-field"><label className="modal-label">Priority</label>
                    <select className="modal-select" value={cPriority} onChange={(e) => setCPriority(e.target.value as Priority)}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="modal-field"><label className="modal-label">Due Date</label><input type="date" className="modal-input" value={cDueDate} onChange={(e) => setCDueDate(e.target.value)} /></div>
                </div>
                <div className="modal-field"><label className="modal-label">Due Time <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(ঐচ্ছিক)</span></label><input type="time" className="modal-input" value={cDueTime} onChange={(e) => setCDueTime(e.target.value)} /></div>
                <div className="modal-field">
                  <label className="modal-label">সম্পর্কিত প্রজেক্ট (ঐচ্ছিক)</label>
                  <select className="modal-select" value={cProjectId} onChange={(e) => setCProjectId(e.target.value)}>
                    <option value="">কোনোটা না</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="toggle-row">
                  <span className="toggle-label">🔔 Notify member</span>
                  <button type="button" className={`toggle-switch${cNotify ? ' on' : ''}`} onClick={() => setCNotify((v) => !v)} aria-label="Notify member"><div className="toggle-knob"></div></button>
                </div>
                {createError && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createError}</p>}
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !cTitle.trim() || !cAssigneeId}>{creating ? 'তৈরি হচ্ছে…' : 'Create To-Do'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ DETAIL MODAL ============ */}
      {detailTodo && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setDetailId(null); setReassigning(false); } }}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon" style={{ background: 'var(--surface-muted)', color: 'var(--ink-soft)' }}><Icon name="check" /></div>
              <span className="modal-title">{detailTodo.title}</span>
              <button className="modal-close" onClick={() => { setDetailId(null); setReassigning(false); }}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              {!canInteract(detailTodo) && (
                <div className="readonly-banner">এটা অন্য একজন মেম্বারের To-Do — আপনি শুধু দেখতে পারবেন, এডিট/কমপ্লিট করতে পারবেন না।</div>
              )}
              <div className="detail-field-grid">
                <div><div className="detail-field-label">Assigned To</div><div className="detail-field-value">{nameOf(detailTodo.assignee_id)}</div></div>
                <div><div className="detail-field-label">Created By</div><div className="detail-field-value">{nameOf(detailTodo.created_by)}</div></div>
                <div><div className="detail-field-label">Priority</div><div className="detail-field-value">{PRIORITY_LABEL[detailTodo.priority]}</div></div>
                <div><div className="detail-field-label">Due Date &amp; Time</div><div className="detail-field-value">{detailTodo.due_date ? `${dueLabel(detailTodo)}${detailTodo.due_time ? `, ${formatTimeBn(detailTodo.due_time)}` : ''}` : '—'}</div></div>
                <div><div className="detail-field-label">Status</div><div className="detail-field-value">{detailTodo.status === 'completed' ? 'Completed' : isOverdue(detailTodo) ? 'Overdue' : 'Pending'}</div></div>
                <div><div className="detail-field-label">Related Project</div><div className="detail-field-value">{projectNameOf(detailTodo.project_id) ?? '—'}</div></div>
              </div>
              {detailTodo.description && (
                <>
                  <div className="detail-field-label" style={{ marginBottom: 6 }}>Description</div>
                  <p className="detail-desc">{detailTodo.description}</p>
                </>
              )}
              <div className="detail-field-label" style={{ marginBottom: 6 }}>Activity</div>
              <div className="detail-activity">
                {nameOf(detailTodo.created_by)} To-Do তৈরি করেছেন · {formatBnDate(detailTodo.created_at)}<br />
                {nameOf(detailTodo.assignee_id)}-কে অ্যাসাইন করা হয়েছে · {formatBnDate(detailTodo.created_at)}
                {detailTodo.status === 'completed' && detailTodo.completed_at && (<><br />{nameOf(detailTodo.assignee_id)} সম্পন্ন করেছেন · {formatBnDate(detailTodo.completed_at)}</>)}
              </div>

              {profile?.is_admin && reassigning && (
                <div className="reassign-row">
                  <select className="modal-select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  <button className="btn btn-accent btn-sm" disabled={busy || !reassignTo} onClick={() => handleReassign(detailTodo.id)}>সেভ</button>
                </div>
              )}
            </div>
            <div className="modal-foot split">
              <div>
                {profile?.is_admin && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleDelete(detailTodo.id)}>Delete</button>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setDetailId(null); setReassigning(false); }}>বন্ধ করুন</button>
                {profile?.is_admin && <button className="btn btn-ghost btn-sm" onClick={() => { setReassignTo(detailTodo.assignee_id); setReassigning((v) => !v); }}>Reassign</button>}
                {canInteract(detailTodo) && (
                  <button className="btn btn-accent btn-sm" onClick={() => handleToggleComplete(detailTodo)}>{detailTodo.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}
