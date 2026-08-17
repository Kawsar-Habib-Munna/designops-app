'use client';

// Screen 6 — Admin Client List। রিডিজাইন: real Supabase ডেটা দিয়ে desktop টেবিল +
// মোবাইল কার্ড লিস্ট, ৬টা KPI, মাল্টি-ফিল্টার টুলবার, সর্ট, পেজিনেশন, প্রতি-রো
// অ্যাকশন ড্রপডাউন। মকআপের কিছু জিনিস বাদ দেওয়া হয়েছে বা রিয়েল ডেটার সাথে
// রিম্যাপ করা হয়েছে যেহেতু fake/disconnected UI দেখানো হয় না:
// - মকআপের ৮-ভ্যালু status vocabulary (new/review/action/ready/active/hold/
//   completed/archived) ব্যবহার না করে আসল clients.status (lead/submitted/
//   discussion/active/retainer/completed) + admin_request ওভাররাইড + নতুন
//   is_archived ফ্ল্যাগ দিয়ে একই ভিজ্যুয়াল ভাষা বানানো হয়েছে — Screen 5/7-এর
//   সাথে vocabulary সামঞ্জস্যপূর্ণ রাখতে।
// - "Payment Due" attention লেবেল আসল invoices টেবিল থেকে (status='pending'
//   ও due_date পার হয়ে গেছে এমন ইনভয়েস আছে কিনা)।
// - "Upload File" রো-অ্যাকশন বাদ দেওয়া হয়েছে — এই পেজে সেটার জন্য কোনো আসল
//   টার্গেট (কোন প্রজেক্ট/ক্যাটাগরি) নেই, তাই fake link না বসিয়ে বাদ দেওয়া হলো।
// - "Assign Manager" আসল কুইক-মডাল, "Archive/Unarchive" আসল টগল (স্ট্যাটাস
//   ওভাররাইট না করে আলাদা is_archived কলামে, যাতে আনআর্কাইভ করলে আগের স্টেজ
//   ফিরে পাওয়া যায়), "Export" আসল ক্লায়েন্ট-সাইড CSV ডাউনলোড।

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './clients.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { relativeTimeBn, todayISO } from '@/lib/format';
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
  portal: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><circle cx="12" cy="14" r="1.5"/><path d="M12 14v6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  eye: '<path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  'folder-plus': '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/><path d="M12 11v4"/><path d="M10 13h4"/>',
  'user-plus': '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
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
const FILTER_OPTIONS = [
  { value: 'all', label: 'Status: All' },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label })),
  { value: 'action', label: 'তথ্য দরকার (Action Required)' },
  { value: 'archived', label: 'আর্কাইভড' },
];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ManagerOption = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };
type ProjectRow = { id: string; name: string; status: string; budget: number | null; created_at: string };

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
  admin_request: string | null;
  admin_request_at: string | null;
  is_archived: boolean;
  created_at: string;
  account_manager: ManagerOption | ManagerOption[] | null;
  client_requirements: { project_name: string | null; updated_at: string } | { project_name: string | null; updated_at: string }[] | null;
  projects: ProjectRow[] | null;
};

const CLIENT_SELECT =
  'id, company_name, primary_contact, contact_email, contact_phone, industry, website, status, priority, account_manager_id, notes, user_id, admin_request, admin_request_at, is_archived, created_at, account_manager:profiles!account_manager_id(id, full_name, avatar_color, avatar_url), client_requirements(project_name, updated_at), projects(id, name, status, budget, created_at)';

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function displayStatus(c: ClientRow): { label: string; cls: string } {
  if (c.is_archived) return { label: 'আর্কাইভড', cls: 's-archived' };
  if (c.admin_request) return { label: 'তথ্য দরকার', cls: 's-action' };
  return STATUS_META[c.status] ?? { label: c.status, cls: 's-todo' };
}

function currentProject(c: ClientRow): ProjectRow | null {
  const projects = [...(c.projects ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return projects.find((p) => p.status !== 'completed') ?? projects[0] ?? null;
}

function projectState(c: ClientRow): 'none' | 'active' | 'completed' {
  const projects = c.projects ?? [];
  if (projects.length === 0) return 'none';
  if (projects.some((p) => p.status !== 'completed')) return 'active';
  return 'completed';
}

function dealValue(c: ClientRow): number {
  return (c.projects ?? []).reduce((sum, p) => sum + (p.budget ?? 0), 0);
}

function lastActivity(c: ClientRow): string {
  const req = toOne(c.client_requirements);
  let latest = c.created_at;
  if (req?.updated_at && req.updated_at > latest) latest = req.updated_at;
  if (c.admin_request_at && c.admin_request_at > latest) latest = c.admin_request_at;
  return latest;
}

function waLink(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '880' + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('1')) digits = '880' + digits;
  return `https://wa.me/${digits}`;
}

const PAGE_SIZE = 10;

export default function ClientsListPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [overdueClientIds, setOverdueClientIds] = useState<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState('recent');
  const [page, setPage] = useState(1);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  const [assignFor, setAssignFor] = useState<ClientRow | null>(null);
  const [assignManagerId, setAssignManagerId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [clientsRes, profileRes, managersRes, invoicesRes] = await Promise.all([
        supabase.from('clients').select(CLIENT_SELECT).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
        supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
        supabase.from('invoices').select('client_id, due_date').eq('status', 'pending'),
      ]);

      if (clientsRes.error) setError(clientsRes.error.message);
      setClients((clientsRes.data as unknown as ClientRow[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setManagers((managersRes.data as ManagerOption[]) ?? []);

      const today = todayISO();
      const overdue = new Set<string>();
      ((invoicesRes.data as { client_id: string; due_date: string | null }[]) ?? []).forEach((inv) => {
        if (inv.due_date && inv.due_date < today) overdue.add(inv.client_id);
      });
      setOverdueClientIds(overdue);
      setNowMs(Date.now());

      setLoading(false);
    }

    run();
  }, [user]);

  useEffect(() => {
    if (!openMenuId) return;
    function closeMenu() {
      setOpenMenuId(null);
    }
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [openMenuId]);

  const kpis = useMemo(() => {
    const active = clients.filter((c) => !c.is_archived);
    return {
      total: clients.length,
      new: active.filter((c) => c.status === 'lead').length,
      pending: active.filter((c) => c.status === 'submitted' || c.status === 'discussion').length,
      inProgress: active.filter((c) => c.status === 'active' || c.status === 'retainer').length,
      completed: active.filter((c) => c.status === 'completed').length,
      needsAttention: active.filter((c) => c.admin_request || overdueClientIds.has(c.id)).length,
    };
  }, [clients, overdueClientIds]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients.filter((c) => {
      if (statusFilter === 'archived') return c.is_archived;
      if (statusFilter === 'action') return !c.is_archived && !!c.admin_request;
      if (statusFilter !== 'all') return !c.is_archived && c.status === statusFilter;
      return true;
    });

    if (projectFilter) list = list.filter((c) => projectState(c) === projectFilter);
    if (managerFilter) list = list.filter((c) => c.account_manager_id === managerFilter);
    if (dateFilter) {
      const diffDays = (c: ClientRow) => (nowMs - new Date(c.created_at).getTime()) / 86400000;
      if (dateFilter === 'today') list = list.filter((c) => diffDays(c) < 1);
      else if (dateFilter === '7d') list = list.filter((c) => diffDays(c) < 7);
      else if (dateFilter === '30d') list = list.filter((c) => diffDays(c) < 30);
    }
    if (q) {
      list = list.filter((c) => {
        const proj = currentProject(c);
        const req = toOne(c.client_requirements);
        return (
          c.company_name.toLowerCase().includes(q) ||
          (c.primary_contact ?? '').toLowerCase().includes(q) ||
          (c.contact_email ?? '').toLowerCase().includes(q) ||
          (proj?.name ?? '').toLowerCase().includes(q) ||
          (req?.project_name ?? '').toLowerCase().includes(q)
        );
      });
    }

    const sorted = [...list];
    if (sortKey === 'recent') sorted.sort((a, b) => (lastActivity(a) < lastActivity(b) ? 1 : -1));
    else if (sortKey === 'newest') sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    else if (sortKey === 'oldest') sorted.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    else if (sortKey === 'az') sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
    else if (sortKey === 'za') sorted.sort((a, b) => b.company_name.localeCompare(a.company_name));
    else if (sortKey === 'value-high') sorted.sort((a, b) => dealValue(b) - dealValue(a));
    else if (sortKey === 'value-low') sorted.sort((a, b) => dealValue(a) - dealValue(b));

    return sorted;
  }, [clients, search, statusFilter, projectFilter, managerFilter, dateFilter, sortKey, nowMs]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filteredSorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetFilters() {
    setSearch('');
    setStatusFilter('all');
    setProjectFilter('');
    setManagerFilter('');
    setDateFilter('');
    setPage(1);
  }

  function goToClient(id: string) {
    router.push(`/clients/${id}`);
  }

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
      .select(
        'id, company_name, primary_contact, contact_email, contact_phone, industry, website, status, priority, account_manager_id, notes, user_id, admin_request, admin_request_at, is_archived, created_at'
      )
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

  async function handleAssignManager(e: FormEvent) {
    e.preventDefault();
    if (!assignFor) return;
    setAssigning(true);

    const { error: updateError } = await supabase
      .from('clients')
      .update({ account_manager_id: assignManagerId || null })
      .eq('id', assignFor.id);

    if (updateError) {
      setError(updateError.message);
      setAssigning(false);
      return;
    }

    const manager = managers.find((m) => m.id === assignManagerId) ?? null;
    setClients((prev) => prev.map((c) => (c.id === assignFor.id ? { ...c, account_manager_id: assignManagerId || null, account_manager: manager } : c)));

    if (user) {
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'manager_assigned',
        entity_type: 'client',
        entity_id: assignFor.id,
        detail: manager ? `${manager.full_name}-কে অ্যাকাউন্ট ম্যানেজার হিসেবে অ্যাসাইন করা হয়েছে` : 'অ্যাকাউন্ট ম্যানেজার আনঅ্যাসাইন করা হয়েছে',
      });
    }

    setAssigning(false);
    setAssignFor(null);
  }

  async function handleToggleArchive(c: ClientRow) {
    const nextArchived = !c.is_archived;
    const confirmMsg = nextArchived ? `"${c.company_name}" আর্কাইভ করতে চান?` : `"${c.company_name}" আনআর্কাইভ করতে চান?`;
    if (!window.confirm(confirmMsg)) return;

    const { error: updateError } = await supabase.from('clients').update({ is_archived: nextArchived }).eq('id', c.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setClients((prev) => prev.map((row) => (row.id === c.id ? { ...row, is_archived: nextArchived } : row)));

    if (user) {
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: nextArchived ? 'client_archived' : 'client_unarchived',
        entity_type: 'client',
        entity_id: c.id,
        detail: nextArchived ? `"${c.company_name}" আর্কাইভ করা হয়েছে` : `"${c.company_name}" আনআর্কাইভ করা হয়েছে`,
      });
    }
  }

  function handleExport() {
    const header = ['Company', 'Contact', 'Email', 'Phone', 'Status', 'Manager', 'Project Value', 'Added'];
    const rows = filteredSorted.map((c) => {
      const manager = toOne(c.account_manager);
      return [c.company_name, c.primary_contact ?? '', c.contact_email ?? '', c.contact_phone ?? '', displayStatus(c).label, manager?.full_name ?? '', String(dealValue(c)), c.created_at.slice(0, 10)];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-${todayISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const rowActionsMenu = (c: ClientRow) => (
    <div className="row-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="row-actions-btn"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId((id) => (id === c.id ? null : c.id));
        }}
        aria-label="আরও অপশন"
      >
        <Icon name="more" />
      </button>
      <div className={`row-actions-menu${openMenuId === c.id ? ' open' : ''}`}>
        <Link className="ram-item" href={`/clients/${c.id}`}>
          <Icon name="eye" size={13} /> View Client
        </Link>
        {c.contact_phone ? (
          <a className="ram-item" href={waLink(c.contact_phone)} target="_blank" rel="noopener noreferrer">
            <Icon name="message" size={13} /> Send Message
          </a>
        ) : c.contact_email ? (
          <a className="ram-item" href={`mailto:${c.contact_email}`}>
            <Icon name="message" size={13} /> Send Message
          </a>
        ) : null}
        {projectState(c) === 'none' && (
          <Link className="ram-item" href={`/clients/${c.id}/create-project`}>
            <Icon name="folder-plus" size={13} /> Create Project
          </Link>
        )}
        <button
          type="button"
          className="ram-item"
          onClick={() => {
            setAssignFor(c);
            setAssignManagerId(c.account_manager_id ?? '');
            setOpenMenuId(null);
          }}
        >
          <Icon name="user-plus" size={13} /> Assign Manager
        </button>
        <Link className="ram-item" href={`/clients/${c.id}?edit=1`}>
          <Icon name="edit" size={13} /> Edit Client
        </Link>
        <div className="ram-divider"></div>
        <button type="button" className="ram-item danger" onClick={() => handleToggleArchive(c)}>
          <Icon name="archive" size={13} /> {c.is_archived ? 'Unarchive Client' : 'Archive Client'}
        </button>
      </div>
    </div>
  );

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
                <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={filteredSorted.length === 0}>
                  <Icon name="download" size={13} /> Export
                </button>
                <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" size={14} /> Add Client
                </button>
              </div>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card" onClick={resetFilters}>
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
              <div
                className="kpi-card clickable"
                onClick={() => {
                  setStatusFilter('lead');
                  setPage(1);
                }}
              >
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
              <div
                className="kpi-card clickable"
                onClick={() => {
                  setStatusFilter('submitted');
                  setPage(1);
                }}
              >
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                    <Icon name="checklist" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>
                  {loading ? '—' : kpis.pending}
                </div>
                <div className="kpi-label">Awaiting Review</div>
                <div className="kpi-deco" style={{ color: 'var(--warning)' }}>
                  <Icon name="checklist" size={56} />
                </div>
              </div>
              <div
                className="kpi-card clickable"
                onClick={() => {
                  setStatusFilter('active');
                  setPage(1);
                }}
              >
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Icon name="check" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>
                  {loading ? '—' : kpis.inProgress}
                </div>
                <div className="kpi-label">Active</div>
                <div className="kpi-deco" style={{ color: 'var(--accent)' }}>
                  <Icon name="check" size={56} />
                </div>
              </div>
              <div
                className="kpi-card clickable"
                onClick={() => {
                  setStatusFilter('completed');
                  setPage(1);
                }}
              >
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
              <div
                className="kpi-card clickable attention"
                onClick={() => {
                  setStatusFilter('action');
                  setPage(1);
                }}
              >
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                    <Icon name="alert" />
                  </div>
                </div>
                <div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>
                  {loading ? '—' : kpis.needsAttention}
                </div>
                <div className="kpi-label">Needs Attention</div>
                <div className="kpi-deco" style={{ color: 'var(--warning)' }}>
                  <Icon name="alert" size={56} />
                </div>
              </div>
            </div>

            <div className="toolbar">
              <div className="toolbar-search">
                <Icon name="search" size={13} />
                <input
                  placeholder="Search clients..."
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
                {FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="filter-select"
                value={projectFilter}
                onChange={(e) => {
                  setProjectFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Project: All</option>
                <option value="active">Has Active Project</option>
                <option value="none">No Project</option>
                <option value="completed">Completed Project</option>
              </select>
              <select
                className="filter-select"
                value={managerFilter}
                onChange={(e) => {
                  setManagerFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Manager: All</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
              <select
                className="filter-select"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Date Added: Any</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <div className="toolbar-spacer"></div>
              <select className="filter-select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="recent">Sort: Recently Active</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="az">Name A–Z</option>
                <option value="za">Name Z–A</option>
                <option value="value-high">Value: High to Low</option>
                <option value="value-low">Value: Low to High</option>
              </select>
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
            ) : filteredSorted.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Icon name="search" />
                </div>
                <div className="empty-title">এই ফিল্টারে কোনো ক্লায়েন্ট নেই</div>
                <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ marginTop: 10 }}>
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="result-count tabular">{filteredSorted.length} clients</div>

                <div className="table-scroll">
                  <table className="client-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Project</th>
                        <th>Status</th>
                        <th>Project Value</th>
                        <th>Manager</th>
                        <th>Last Activity</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((c) => {
                        const meta = displayStatus(c);
                        const manager = toOne(c.account_manager);
                        const requirements = toOne(c.client_requirements);
                        const proj = currentProject(c);
                        const value = dealValue(c);
                        const attention = !c.is_archived && overdueClientIds.has(c.id) ? 'পেমেন্ট বাকি' : null;
                        const isNew = c.status === 'lead' && !c.is_archived;

                        return (
                          <tr key={c.id} className="client-row" onClick={() => goToClient(c.id)}>
                            <td>
                              <div className="client-cell">
                                <Avatar person={{ full_name: c.company_name, avatar_color: 'var(--accent)' }} size={32} />
                                <div>
                                  <div className="client-name-row">
                                    <span className="cname">{c.company_name}</span>
                                    {isNew && (
                                      <span className="new-badge">
                                        <span className="dot"></span>New
                                      </span>
                                    )}
                                  </div>
                                  <div className="ccompany">{c.primary_contact ?? c.contact_email ?? '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {proj ? (
                                <>
                                  <div className="proj-name">{proj.name}</div>
                                  <div className="proj-sub">{proj.status === 'completed' ? 'Completed' : proj.status === 'on_hold' ? 'On Hold' : proj.status === 'review' ? 'In Review' : 'Active'}</div>
                                </>
                              ) : requirements?.project_name ? (
                                <div className="proj-name proj-none">{requirements.project_name} (unreviewed)</div>
                              ) : (
                                <div className="proj-name proj-none">No project yet</div>
                              )}
                            </td>
                            <td>
                              <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                              {attention && <span className="attention-label">{attention}</span>}
                            </td>
                            <td>{value > 0 ? <span className="value-cell tabular">৳{value.toLocaleString('en-US')}</span> : <span className="value-cell notset">Not set</span>}</td>
                            <td>{manager ? <div className="manager-cell"><Avatar person={manager} size={22} fontSize={9} />{manager.full_name}</div> : <span className="manager-unassigned">Unassigned</span>}</td>
                            <td className="time-cell tabular">{relativeTimeBn(lastActivity(c))}</td>
                            <td>{rowActionsMenu(c)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-list">
                  {paged.map((c) => {
                    const meta = displayStatus(c);
                    const manager = toOne(c.account_manager);
                    const proj = currentProject(c);
                    const value = dealValue(c);
                    const isNew = c.status === 'lead' && !c.is_archived;

                    return (
                      <div className="mclient-card" key={c.id} onClick={() => goToClient(c.id)}>
                        <div className="mclient-top">
                          <div className="mclient-left">
                            <Avatar person={{ full_name: c.company_name, avatar_color: 'var(--accent)' }} size={36} />
                            <div>
                              <div className="client-name-row">
                                <span className="cname">{c.company_name}</span>
                                {isNew && (
                                  <span className="new-badge">
                                    <span className="dot"></span>New
                                  </span>
                                )}
                              </div>
                              <div className="ccompany">{c.primary_contact ?? c.contact_email ?? '—'}</div>
                            </div>
                          </div>
                          <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <div className="mclient-project">{proj ? proj.name : 'No project yet'}</div>
                        <div className="mclient-meta-row">
                          <span>Value</span>
                          {value > 0 ? <span className="tabular" style={{ color: 'var(--ink)', fontWeight: 600 }}>৳{value.toLocaleString('en-US')}</span> : <span>Not set</span>}
                        </div>
                        <div className="mclient-meta-row">
                          <span>Manager</span>
                          <span style={{ color: 'var(--ink)' }}>{manager ? manager.full_name : 'Unassigned'}</span>
                        </div>
                        <div className="mclient-meta-row">
                          <span>Last activity</span>
                          <span className="tabular">{relativeTimeBn(lastActivity(c))}</span>
                        </div>
                        <div className="mclient-foot">
                          <Link href={`/clients/${c.id}`} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>
                            View Client
                          </Link>
                          {rowActionsMenu(c)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pagination-row">
                    <span className="pagination-info tabular">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSorted.length)} of {filteredSorted.length} clients
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

      {assignFor && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAssignFor(null);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon">
                <Icon name="user-plus" size={16} />
              </div>
              <div className="modal-title">ম্যানেজার অ্যাসাইন করুন — {assignFor.company_name}</div>
              <button type="button" className="modal-close" onClick={() => setAssignFor(null)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <form onSubmit={handleAssignManager}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Account Manager</label>
                  <select className="modal-select" value={assignManagerId} onChange={(e) => setAssignManagerId(e.target.value)} autoFocus>
                    <option value="">কেউ না</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssignFor(null)}>
                  বাতিল
                </button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={assigning}>
                  {assigning ? 'সেভ হচ্ছে…' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
