'use client';

// Screen 7 — Admin Client Details। রিডিজাইন: header-এ quick status-switcher +
// more-menu, ৮-ধাপের lifecycle stepper, দুই-কলাম কার্ড লেআউট (Project/Project
// Request/Files/Overview/Activity/Internal Notes বাম দিকে, Next Action/Contact/
// Manager/Payment/Quick Actions ডান দিকে)। সব real Supabase ডেটা থেকে:
// - Lifecycle-এর প্রতিটা ধাপ (Account/Information/Agency Review/Project/SOW/
//   Payment/Delivery/Completion) আসল ডেটা থেকে ডেরাইভ করা — কোনো ফেক তৃতীয়
//   স্টেট নেই। SOW "sows.status='signed'" থেকে, Payment "invoices" টেবিল থেকে,
//   Delivery "projects.final_delivery_status='approved'" থেকে।
// - Next Action কার্ড সবসময় real পরবর্তী পদক্ষেপ দেখায় (কোনো hardcoded কপি না)।
// - Internal Notes নতুন client_notes টেবিল রিইউজ করে (ফেজ ৯) — ক্লায়েন্টের একক
//   notes ফিল্ড (Edit Client মোডালে) থেকে আলাদা, কারণ এটা একাধিক
//   timestamped/authored এন্ট্রি রাখে।
// - Payment কার্ড আসল invoices টেবিল থেকে মোট/পরিশোধিত পরিমাণ বের করে।
// - "Request Information" মোডালের "Notify Client" টগল WhatsApp-এই বাস্তবে
//   পাঠায় (এই কোডবেসে ক্লায়েন্টের জন্য কোনো push-notification চ্যানেল নেই)।
// - Client Files কার্ডে এখন সত্যিকারের আপলোড বাটন আছে (Drive পাইপলাইন রিইউজ)
//   — Screen 6-এর লিস্ট পেজে এটা বাদ দেওয়া হয়েছিল যেহেতু সেখানে client-context
//   ছিল না, কিন্তু এখানে আছে।
// - মকআপের "Assigned Team" কার্ড বাদ দেওয়া হয়েছে — স্কিমাতে প্রজেক্ট-লেভেল
//   মাল্টি-পারসন টিম অ্যাসাইনমেন্টের কোনো real কনসেপ্ট নেই (শুধু single
//   project_manager_id/account_manager_id), তাই fake মেম্বার লিস্ট না বসিয়ে
//   পুরো কার্ডটাই বাদ দেওয়া হলো।

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import '../clients.css';
import './client-detail.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { relativeTimeBn, formatBnDate } from '@/lib/format';
import { driveThumbnailUrl, uploadFileToDrive, guessFileType } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  'folder-plus': '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/><path d="M12 11v4"/><path d="M10 13h4"/>',
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
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-down': '<path d="M6 9l6 6 6-6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8 10a16 16 0 0 0 6 6l1.3-1.4a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
  link: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><path d="M8 12h8"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  eye: '<path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/>',
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

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  lead: { label: 'লিড', cls: 's-todo', dot: 'var(--ink-faint)' },
  submitted: { label: 'তথ্য জমা হয়েছে', cls: 's-review', dot: 'var(--warning)' },
  discussion: { label: 'আলোচনা চলছে', cls: 's-review', dot: 'var(--warning)' },
  active: { label: 'সক্রিয়', cls: 's-progress', dot: 'var(--accent)' },
  retainer: { label: 'রিটেইনার', cls: 's-progress', dot: 'var(--accent)' },
  completed: { label: 'সম্পন্ন', cls: 's-done', dot: 'var(--positive)' },
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
  country: string | null;
  timezone: string | null;
  preferred_contact_method: string | null;
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
  priority: string | null;
  competitors: string | null;
  existing_assets: string | null;
};

type FileRow = { id: string; name: string; file_type: string | null; size_bytes: number | null; drive_url: string; uploaded_by: string; created_at: string };
type ProjectSummary = { id: string; name: string; status: string; progress: number | null; budget: number | null; final_delivery_status: string | null; created_at: string };
type ActivityRow = { id: string; action: string; detail: string | null; created_at: string; actor: { full_name: string } | { full_name: string }[] | null };
type SowRow = { id: string; project_id: string; status: string };
type InvoiceRow = { id: string; amount: number; currency: string; status: string };
type NoteRow = { id: string; body: string; created_at: string; author_id: string | null; author: { full_name: string } | { full_name: string }[] | null };

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
function waLink(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '880' + digits.slice(1);
  else if (digits.length === 10 && digits.startsWith('1')) digits = '880' + digits;
  return `https://wa.me/${digits}`;
}
function currentProject(projects: ProjectSummary[]): ProjectSummary | null {
  const sorted = [...projects].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return sorted.find((p) => p.status !== 'completed') ?? sorted[0] ?? null;
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParamHandledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [sows, setSows] = useState<SowRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<ClientDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [openHeaderMenu, setOpenHeaderMenu] = useState<'status' | 'more' | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqMessage, setReqMessage] = useState('');
  const [reqWantsFile, setReqWantsFile] = useState(false);
  const [reqNotify, setReqNotify] = useState(true);
  const [requestSaving, setRequestSaving] = useState(false);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [descExpanded, setDescExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  useEffect(() => {
    if (!user || !clientId) return;

    async function loadAll() {
      const [clientRes, requirementsRes, filesRes, projectsRes, activityRes, managersRes, notesRes] = await Promise.all([
        supabase
          .from('clients')
          .select(
            'id, company_name, primary_contact, contact_email, contact_phone, industry, website, designation, company_size, country, timezone, preferred_contact_method, status, priority, account_manager_id, notes, user_id, admin_request, admin_request_at, is_archived, created_at, account_manager:profiles!account_manager_id(id, full_name, avatar_color, avatar_url)'
          )
          .eq('id', clientId)
          .maybeSingle(),
        supabase
          .from('client_requirements')
          .select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes, priority, competitors, existing_assets')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase.from('client_files').select('id, name, file_type, size_bytes, drive_url, uploaded_by, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name, status, progress, budget, final_delivery_status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('activity_log').select('id, action, detail, created_at, actor:profiles!actor_id(full_name)').eq('entity_type', 'client').eq('entity_id', clientId).order('created_at', { ascending: false }).limit(30),
        supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
        supabase.from('client_notes').select('id, body, created_at, author_id, author:profiles!author_id(full_name)').eq('client_id', clientId).order('created_at', { ascending: false }),
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
      const projectRows = (projectsRes.data as ProjectSummary[]) ?? [];
      setProjects(projectRows);
      setActivity((activityRes.data as unknown as ActivityRow[]) ?? []);
      setManagers((managersRes.data as ManagerOption[]) ?? []);
      setNotes((notesRes.data as unknown as NoteRow[]) ?? []);

      const projectIds = projectRows.map((p) => p.id);
      const [sowsRes, invoicesRes] = await Promise.all([
        projectIds.length > 0 ? supabase.from('sows').select('id, project_id, status').in('project_id', projectIds) : Promise.resolve({ data: [] }),
        supabase.from('invoices').select('id, amount, currency, status').eq('client_id', clientId),
      ]);
      setSows((sowsRes.data as SowRow[]) ?? []);
      setInvoices((invoicesRes.data as InvoiceRow[]) ?? []);

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

  useEffect(() => {
    if (!openHeaderMenu) return;
    function closeMenus() {
      setOpenHeaderMenu(null);
    }
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, [openHeaderMenu]);

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
        country: editForm.country?.trim() || null,
        timezone: editForm.timezone?.trim() || null,
        preferred_contact_method: editForm.preferred_contact_method?.trim() || null,
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

  async function handleQuickStatusChange(newStatus: string) {
    if (!client || newStatus === client.status) {
      setOpenHeaderMenu(null);
      return;
    }
    setStatusSaving(true);
    const { error: updateError } = await supabase.from('clients').update({ status: newStatus }).eq('id', client.id);
    if (updateError) {
      setError(updateError.message);
      setStatusSaving(false);
      return;
    }
    if (user) {
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'status_changed',
        entity_type: 'client',
        entity_id: client.id,
        detail: `স্ট্যাটাস "${STATUS_META[client.status]?.label ?? client.status}" থেকে "${STATUS_META[newStatus]?.label ?? newStatus}"-এ পরিবর্তন করা হয়েছে`,
      });
    }
    setStatusSaving(false);
    setOpenHeaderMenu(null);
    setReloadKey((k) => k + 1);
  }

  // ক্লায়েন্টের কাছে অতিরিক্ত তথ্য চাওয়া — client ড্যাশবোর্ডে (Screen 5) সাথে সাথে
  // "Action Required" স্টেট হিসেবে দেখা যায়। "Notify Client" টগল চেক থাকলে WhatsApp-এ
  // real মেসেজও পাঠানো হয় — এই কোডবেসে ক্লায়েন্টের জন্য কোনো in-app push-notification
  // চ্যানেল নেই, তাই এটাই একমাত্র সত্যিকারের "notify" পথ।
  async function handleSendRequest() {
    if (!client || !user || !reqMessage.trim()) return;
    setRequestSaving(true);

    const finalText = reqMessage.trim() + (reqWantsFile ? '\n\n📎 এর সাথে একটা ফাইলও অ্যাটাচ করে পাঠাতে হবে।' : '');

    const { error: updateError } = await supabase
      .from('clients')
      .update({ admin_request: finalText, admin_request_at: new Date().toISOString() })
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
      detail: `ক্লায়েন্টের কাছে অতিরিক্ত তথ্য চাওয়া হয়েছে: "${finalText}"`,
    });

    if (reqNotify && client.contact_phone) {
      const text = `Hi ${client.primary_contact ?? client.company_name}, ${finalText}`;
      window.open(`${waLink(client.contact_phone)}?text=${encodeURIComponent(text)}`, '_blank');
    }

    setReqMessage('');
    setReqWantsFile(false);
    setReqNotify(true);
    setRequestSaving(false);
    setShowRequestModal(false);
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

  async function handleToggleArchive() {
    if (!client) return;
    const nextArchived = !client.is_archived;
    setArchiving(true);

    const { error: updateError } = await supabase.from('clients').update({ is_archived: nextArchived }).eq('id', client.id);
    if (updateError) {
      setError(updateError.message);
      setArchiving(false);
      return;
    }

    if (user) {
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: nextArchived ? 'client_archived' : 'client_unarchived',
        entity_type: 'client',
        entity_id: client.id,
        detail: nextArchived ? `"${client.company_name}" আর্কাইভ করা হয়েছে` : `"${client.company_name}" আনআর্কাইভ করা হয়েছে`,
      });
    }

    setArchiving(false);
    setShowArchiveModal(false);
    setReloadKey((k) => k + 1);
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0 || !client) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;

    setUploading(true);
    for (const file of selected) {
      try {
        const result = await uploadFileToDrive(file, accessToken);
        const { data } = await supabase
          .from('client_files')
          .insert({
            client_id: client.id,
            name: file.name,
            file_type: guessFileType(file),
            size_bytes: file.size,
            drive_url: result.webViewLink,
            category: 'other',
            uploaded_by: 'team',
          })
          .select('id, name, file_type, size_bytes, drive_url, uploaded_by, created_at')
          .single();
        if (data) setFiles((prev) => [data as FileRow, ...prev]);
        if (user) {
          await supabase.from('activity_log').insert({
            actor_id: user.id,
            action: 'file_uploaded',
            entity_type: 'client',
            entity_id: client.id,
            detail: `"${file.name}" আপলোড করা হয়েছে`,
          });
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
      }
    }
    setUploading(false);
  }

  async function handleAddNote() {
    if (!client || !user || !noteDraft.trim()) return;
    setNoteSaving(true);
    const { data, error: insertError } = await supabase
      .from('client_notes')
      .insert({ client_id: client.id, author_id: user.id, body: noteDraft.trim() })
      .select('id, body, created_at, author_id, author:profiles!author_id(full_name)')
      .single();
    if (insertError) {
      setError(insertError.message);
      setNoteSaving(false);
      return;
    }
    if (data) setNotes((prev) => [data as unknown as NoteRow, ...prev]);
    setNoteDraft('');
    setNoteSaving(false);
  }

  async function handleSaveNoteEdit(noteId: string) {
    if (!editingNoteText.trim()) return;
    const { error: updateError } = await supabase.from('client_notes').update({ body: editingNoteText.trim(), updated_at: new Date().toISOString() }).eq('id', noteId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, body: editingNoteText.trim() } : n)));
    setEditingNoteId(null);
    setEditingNoteText('');
  }

  async function handleDeleteNote(noteId: string) {
    if (!window.confirm('এই নোটটা মুছে ফেলতে চান?')) return;
    const { error: deleteError } = await supabase.from('client_notes').delete().eq('id', noteId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
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
  const proj = currentProject(projects);
  const dealValue = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
  const lastActivityAt = activity[0]?.created_at ?? client.created_at;
  const clientSince = new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const hasSignedSow = sows.some((s) => proj && s.project_id === proj.id && s.status === 'signed');
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paymentDone = invoices.length > 0 && totalPaid >= totalInvoiced && totalInvoiced > 0;
  const deliveryApproved = proj?.final_delivery_status === 'approved';
  const completionDone = proj?.status === 'completed';

  const lcSteps = [
    { key: 'account', label: 'Account', done: true },
    { key: 'info', label: 'Information', done: !!requirements },
    { key: 'review', label: 'Agency Review', done: !!proj },
    { key: 'project', label: 'Project', done: !!proj },
    { key: 'sow', label: 'SOW', done: hasSignedSow },
    { key: 'payment', label: 'Payment', done: paymentDone },
    { key: 'delivery', label: 'Delivery', done: deliveryApproved },
    { key: 'completion', label: 'Completion', done: completionDone },
  ];
  let currentAssigned = false;
  const lcStepsFinal = lcSteps.map((s) => {
    const isCurrent = !s.done && !currentAssigned;
    if (isCurrent) currentAssigned = true;
    return { ...s, current: isCurrent };
  });

  type NextAction = { title: string; desc: string; ctaLabel: string; onCta: () => void };
  let nextAction: NextAction;
  if (!requirements) {
    nextAction = {
      title: 'Waiting for client information',
      desc: "This client hasn't submitted project requirements yet.",
      ctaLabel: 'Edit Client',
      onCta: () => {
        setEditForm(client);
        setShowEdit(true);
      },
    };
  } else if (!proj) {
    if (client.admin_request) {
      nextAction = { title: 'Waiting on client response', desc: `"${client.admin_request}"`, ctaLabel: 'Mark Resolved', onCta: handleResolveRequest };
    } else {
      nextAction = {
        title: 'Review client requirements',
        desc: 'Review the submitted project information and create the official project when ready.',
        ctaLabel: 'Create Project',
        onCta: () => router.push(`/clients/${client.id}/create-project`),
      };
    }
  } else if (!hasSignedSow) {
    nextAction = { title: 'Send the Statement of Work', desc: 'Project has been created — send or finalize the SOW for signature.', ctaLabel: 'View Project', onCta: () => router.push(`/projects/${proj.id}`) };
  } else if (invoices.length === 0) {
    nextAction = { title: 'Request payment', desc: 'SOW is signed — request the deposit or milestone payment.', ctaLabel: 'View Project', onCta: () => router.push(`/projects/${proj.id}`) };
  } else if (!paymentDone) {
    nextAction = { title: 'Awaiting payment', desc: 'Waiting for the client to complete payment.', ctaLabel: 'View Project', onCta: () => router.push(`/projects/${proj.id}`) };
  } else if (!deliveryApproved) {
    nextAction = { title: 'Deliver the project', desc: 'Payment received — prepare and send the final delivery.', ctaLabel: 'View Project', onCta: () => router.push(`/projects/${proj.id}`) };
  } else if (!completionDone) {
    nextAction = { title: 'Mark project complete', desc: 'Final delivery approved — close out the project.', ctaLabel: 'View Project', onCta: () => router.push(`/projects/${proj.id}`) };
  } else {
    nextAction = { title: 'All caught up', desc: 'This project has been completed.', ctaLabel: 'View Project', onCta: () => router.push(`/projects/${proj.id}`) };
  }

  const featureChips = requirements?.required_features ? requirements.required_features.split(/,\s*/).filter(Boolean) : [];
  const assetChips = requirements?.existing_assets ? requirements.existing_assets.split(/,\s*/).filter(Boolean) : [];

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
                    <span className="proj-title">{client.primary_contact ?? client.company_name}</span>
                    <div className="status-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`status-pill-btn ${meta.cls}`}
                        disabled={client.is_archived || statusSaving}
                        onClick={() => setOpenHeaderMenu((m) => (m === 'status' ? null : 'status'))}
                      >
                        <span>{meta.label}</span>
                        <Icon name="chevron-down" size={11} />
                      </button>
                      <div className={`status-menu${openHeaderMenu === 'status' ? ' open' : ''}`}>
                        {STATUS_ORDER.map((s) => (
                          <button type="button" key={s} className="status-menu-item" onClick={() => handleQuickStatusChange(s)}>
                            <span className="sw" style={{ background: STATUS_META[s].dot }}></span> {STATUS_META[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="ch-company">{client.company_name}</div>
                  <div className="proj-sub-row">
                    <span>Client since {clientSince}</span>
                    <span className="dividerdot"></span>
                    <span>
                      Manager: <b>{manager?.full_name ?? 'Unassigned'}</b>
                    </span>
                    <span className="dividerdot"></span>
                    <span>{source}</span>
                  </div>
                </div>
              </div>
              <div className="header-actions">
                {proj ? (
                  <Link className="btn btn-accent btn-sm" href={`/projects/${proj.id}`}>
                    <Icon name="folder" size={14} /> View Project
                  </Link>
                ) : (
                  <Link className="btn btn-accent btn-sm" href={`/clients/${client.id}/create-project`}>
                    <Icon name="folder-plus" size={14} /> Create Project
                  </Link>
                )}
                {client.contact_phone && (
                  <a className="btn btn-ghost btn-sm" href={waLink(client.contact_phone)} target="_blank" rel="noopener noreferrer">
                    <Icon name="message" size={14} /> Message
                  </a>
                )}
                <div className="more-menu-wrap" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="icon-btn" style={{ border: '1px solid var(--border)' }} onClick={() => setOpenHeaderMenu((m) => (m === 'more' ? null : 'more'))} aria-label="আরও অপশন">
                    <Icon name="more" />
                  </button>
                  <div className={`more-menu${openHeaderMenu === 'more' ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="more-menu-item"
                      onClick={() => {
                        setEditForm(client);
                        setShowEdit(true);
                        setOpenHeaderMenu(null);
                      }}
                    >
                      <Icon name="edit" size={13} /> Edit Client
                    </button>
                    {client.user_id && (
                      <button
                        type="button"
                        className="more-menu-item"
                        onClick={() => {
                          setShowRequestModal(true);
                          setOpenHeaderMenu(null);
                        }}
                      >
                        <Icon name="alert" size={13} /> Request Information
                      </button>
                    )}
                    <button
                      type="button"
                      className="more-menu-item danger"
                      onClick={() => {
                        setShowArchiveModal(true);
                        setOpenHeaderMenu(null);
                      }}
                    >
                      <Icon name="archive" size={13} /> {client.is_archived ? 'Unarchive Client' : 'Archive Client'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-strip">
              <div className="summary-item">
                <div className="summary-item-value">{meta.label}</div>
                <div className="summary-item-label">Client Status</div>
              </div>
              <div className="summary-item">
                <div className={`summary-item-value${proj ? '' : ' muted'}`}>{proj ? proj.name : 'Not Created'}</div>
                <div className="summary-item-label">Project</div>
              </div>
              <div className="summary-item">
                <div className={`summary-item-value tabular${dealValue > 0 ? '' : ' muted'}`}>{dealValue > 0 ? `৳${dealValue.toLocaleString('en-US')}` : 'Not Set'}</div>
                <div className="summary-item-label">Project Value</div>
              </div>
              <div className="summary-item">
                <div className={`summary-item-value${manager ? '' : ' muted'}`}>{manager?.full_name ?? 'Unassigned'}</div>
                <div className="summary-item-label">Manager</div>
              </div>
              <div className="summary-item">
                <div className="summary-item-value tabular">{relativeTimeBn(lastActivityAt)}</div>
                <div className="summary-item-label">Last Activity</div>
              </div>
            </div>

            <div className="lifecycle-card">
              <div className="lc-label">Client Lifecycle</div>
              <div className="lc-row">
                {lcStepsFinal.map((s) => (
                  <div className={`lc-step${s.done ? ' done' : ''}${s.current ? ' current' : ''}`} key={s.key}>
                    <div className="lc-line"></div>
                    <div className="lc-dot">{s.done ? '✓' : s.current ? '●' : '○'}</div>
                    <div className="lc-step-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="detail-two-col">
              <div className="detail-main-col">
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project</span>
                  </div>
                  {proj ? (
                    <div>
                      <div className="proj-name">{proj.name}</div>
                      <div className="proj-progress-row">
                        <div className="proj-track">
                          <div className="proj-fill" style={{ width: `${proj.progress ?? 0}%` }}></div>
                        </div>
                        <span className="proj-pct tabular">{proj.progress ?? 0}%</span>
                      </div>
                      <span className={`status-pill ${PROJECT_STATUS_META[proj.status]?.cls ?? 's-todo'}`}>{PROJECT_STATUS_META[proj.status]?.label ?? proj.status}</span>{' '}
                      <Link href={`/projects/${proj.id}`} className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}>
                        Open Project
                      </Link>
                    </div>
                  ) : (
                    <div className="project-empty-inline">
                      <div className="pe-icon">
                        <Icon name="folder" size={18} />
                      </div>
                      <div className="pe-title">No project created yet</div>
                      <p className="pe-desc">Once you review this client&apos;s requirements, create the official project to unlock SOW, payments and delivery.</p>
                      <Link href={`/clients/${client.id}/create-project`} className="btn btn-accent btn-sm">
                        <Icon name="folder-plus" size={13} /> Create Project
                      </Link>
                    </div>
                  )}
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">
                      Project Request{requirements && <span className="src-tag">Submitted by Client</span>}
                    </span>
                  </div>
                  {requirements ? (
                    <>
                      <div className="field-grid" style={{ marginBottom: 14 }}>
                        <div>
                          <div className="field-label">Project Name</div>
                          <div className="field-value">{requirements.project_name ?? '—'}</div>
                        </div>
                        <div>
                          <div className="field-label">Project Type</div>
                          <div className="field-value">{requirements.project_type ?? '—'}</div>
                        </div>
                        <div>
                          <div className="field-label">Expected Timeline</div>
                          <div className="field-value">{requirements.expected_timeline ?? '—'}</div>
                        </div>
                        <div>
                          <div className="field-label">Estimated Budget</div>
                          <div className="field-value tabular">{requirements.budget_range ?? '—'}</div>
                        </div>
                        <div>
                          <div className="field-label">Priority</div>
                          <div className="field-value" style={{ textTransform: 'capitalize' }}>
                            {requirements.priority ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div className="field-label">Target Audience</div>
                          <div className="field-value">{requirements.target_audience ?? '—'}</div>
                        </div>
                      </div>
                      {requirements.project_description && (
                        <>
                          <div className="field-label" style={{ marginBottom: 6 }}>
                            Description
                          </div>
                          <p className={`req-text${descExpanded ? '' : ' clamped'}`}>{requirements.project_description}</p>
                          <button type="button" className="show-more-btn" onClick={() => setDescExpanded((v) => !v)}>
                            {descExpanded ? 'Show Less' : 'Show More'}
                          </button>
                        </>
                      )}
                      {requirements.goals && (
                        <div className="req-block">
                          <div className="field-label">Goals</div>
                          <p className="req-text">{requirements.goals}</p>
                        </div>
                      )}
                      {featureChips.length > 0 && (
                        <div className="req-block">
                          <div className="field-label">Main Features</div>
                          <div className="feature-chips">
                            {featureChips.map((f) => (
                              <span className="feature-chip" key={f}>
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {assetChips.length > 0 && (
                        <div className="req-block">
                          <div className="field-label">Existing Assets</div>
                          <div className="feature-chips">
                            {assetChips.map((f) => (
                              <span className="feature-chip" key={f}>
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {requirements.competitors && (
                        <div className="req-block">
                          <div className="field-label">Competitors</div>
                          <p className="req-text">{requirements.competitors}</p>
                        </div>
                      )}
                      {requirements.reference_notes && (
                        <div className="req-block">
                          <div className="field-label">References</div>
                          <p className="req-text">{requirements.reference_notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="side-empty">এই ক্লায়েন্ট এখনো কোনো requirements জমা দেননি।</p>
                  )}
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Client Files</span>
                    <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Icon name="upload" size={12} /> {uploading ? 'আপলোড হচ্ছে…' : 'Upload File'}
                    </button>
                  </div>
                  {files.length === 0 ? (
                    <p className="side-empty">এখনো কোনো ফাইল শেয়ার করা হয়নি।</p>
                  ) : (
                    <div>
                      {files.map((f) => (
                        <div className="file-row" key={f.id}>
                          <div className="file-icon">
                            <Icon name="file" size={15} />
                          </div>
                          <div className="file-row-main">
                            <div className="file-row-name">{f.name}</div>
                            <div className="file-row-meta">
                              {formatBytes(f.size_bytes)} · {f.uploaded_by === 'client' ? 'Client' : 'Team'} · {formatBnDate(f.created_at)}
                            </div>
                          </div>
                          <div className="file-actions">
                            <a className="icon-btn" style={{ width: 28, height: 28 }} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer">
                              <Icon name="eye" size={13} />
                            </a>
                            <a className="icon-btn" style={{ width: 28, height: 28 }} href={f.drive_url} target="_blank" rel="noopener noreferrer">
                              <Icon name="download" size={13} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Client Overview</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setEditForm(client);
                        setShowEdit(true);
                      }}
                    >
                      <Icon name="edit" size={12} /> Edit Client
                    </button>
                  </div>
                  <div className="field-grid">
                    <div>
                      <div className="field-label">Full Name</div>
                      <div className="field-value">{client.primary_contact ?? '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Company</div>
                      <div className="field-value">{client.company_name}</div>
                    </div>
                    <div>
                      <div className="field-label">Designation</div>
                      <div className="field-value">{client.designation ?? '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Industry</div>
                      <div className="field-value">{client.industry ?? '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Company Size</div>
                      <div className="field-value">{client.company_size ?? '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Country</div>
                      <div className="field-value">{client.country ?? '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Preferred Contact</div>
                      <div className="field-value">{client.preferred_contact_method ?? '—'}</div>
                    </div>
                    <div>
                      <div className="field-label">Time Zone</div>
                      <div className="field-value">{client.timezone ?? '—'}</div>
                    </div>
                  </div>
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Activity</span>
                  </div>
                  {activity.length === 0 ? (
                    <p className="empty-inline">এখনো কোনো অ্যাক্টিভিটি নেই।</p>
                  ) : (
                    activity.slice(0, 8).map((a, i) => {
                      const actor = toOne(a.actor);
                      return (
                        <div className="timeline-item" key={a.id}>
                          <div className="timeline-dot-wrap">
                            <div className="timeline-dot">
                              <Icon name="check" size={12} />
                            </div>
                            {i < Math.min(activity.length, 8) - 1 && <div className="timeline-line"></div>}
                          </div>
                          <div>
                            <div className="timeline-text">{a.detail ?? a.action}</div>
                            <div className="timeline-time">
                              {actor?.full_name ?? 'Client'} · {relativeTimeBn(a.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Internal Notes</span>
                  </div>
                  {notes.map((n) => {
                    const author = toOne(n.author);
                    const isEditing = editingNoteId === n.id;
                    return (
                      <div className="note-item" key={n.id}>
                        {isEditing ? (
                          <div className="note-compose">
                            <textarea className="modal-textarea" value={editingNoteText} onChange={(e) => setEditingNoteText(e.target.value)} autoFocus />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="btn btn-accent btn-sm" onClick={() => handleSaveNoteEdit(n.id)}>
                                Save
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingNoteId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="note-text">{n.body}</p>
                            <div className="note-meta">
                              <span>
                                {author?.full_name ?? 'Team'} · {formatBnDate(n.created_at)}, {relativeTimeBn(n.created_at)}
                              </span>
                              <div className="note-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(n.id);
                                    setEditingNoteText(n.body);
                                  }}
                                  aria-label="নোট এডিট করুন"
                                >
                                  <Icon name="edit" size={11} />
                                </button>
                                <button type="button" onClick={() => handleDeleteNote(n.id)} aria-label="নোট মুছুন">
                                  <Icon name="trash" size={11} />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div className="note-compose">
                    <textarea className="modal-textarea" placeholder="একটা ইন্টারনাল নোট লিখুন…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                    <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={handleAddNote} disabled={noteSaving || !noteDraft.trim()}>
                      <Icon name="plus" size={12} /> {noteSaving ? 'সেভ হচ্ছে…' : 'Add Note'}
                    </button>
                  </div>
                </section>
              </div>

              <div className="detail-side-col">
                <section className="next-action-card">
                  <div className="na-label">Next Action</div>
                  <div className="na-title">{nextAction.title}</div>
                  <p className="na-desc">{nextAction.desc}</p>
                  <button type="button" className="btn btn-accent btn-block" onClick={nextAction.onCta}>
                    {nextAction.ctaLabel}
                  </button>
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Contact</span>
                  </div>
                  <div className="contact-name">{client.primary_contact ?? client.company_name}</div>
                  {client.contact_email && (
                    <div className="contact-row">
                      <Icon name="mail" size={13} /> {client.contact_email}
                    </div>
                  )}
                  {client.contact_phone && (
                    <div className="contact-row">
                      <Icon name="phone" size={13} /> {client.contact_phone}
                    </div>
                  )}
                  {client.website && (
                    <div className="contact-row">
                      <Icon name="link" size={13} /> {client.website}
                    </div>
                  )}
                  {client.preferred_contact_method && (
                    <div className="contact-row">
                      <Icon name="message" size={13} /> Prefers {client.preferred_contact_method}
                    </div>
                  )}
                  <div className="contact-actions">
                    {client.contact_email && (
                      <a className="btn btn-ghost btn-sm" href={`mailto:${client.contact_email}`}>
                        <Icon name="mail" size={12} /> Email
                      </a>
                    )}
                    {client.contact_phone && (
                      <>
                        <a className="btn btn-ghost btn-sm" href={waLink(client.contact_phone)} target="_blank" rel="noopener noreferrer">
                          <Icon name="message" size={12} /> Message
                        </a>
                        <a className="btn btn-ghost btn-sm" href={`tel:${client.contact_phone}`}>
                          <Icon name="phone" size={12} /> Call
                        </a>
                      </>
                    )}
                  </div>
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Client Manager</span>
                  </div>
                  {manager ? (
                    <div className="manager-row">
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: manager.avatar_color ?? 'var(--accent)' }}>
                        {manager.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="manager-name">{manager.full_name}</div>
                        <div className="manager-role">Account Manager</div>
                      </div>
                    </div>
                  ) : (
                    <p className="side-empty" style={{ marginBottom: 10 }}>
                      কোনো ম্যানেজার অ্যাসাইন করা নেই।
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-block btn-sm"
                    onClick={() => {
                      setEditForm(client);
                      setShowEdit(true);
                    }}
                  >
                    Change Manager
                  </button>
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Payment</span>
                  </div>
                  {invoices.length === 0 ? (
                    <div className="payment-none">Payment not configured yet</div>
                  ) : (
                    <div>
                      <span className={`payment-status-pill${paymentDone ? ' paid' : ''}`}>{paymentDone ? 'Fully Paid' : totalPaid > 0 ? 'Partially Paid' : 'Payment Pending'}</span>
                      <div className="payment-row">
                        <span>Paid</span>
                        <b className="tabular">৳{totalPaid.toLocaleString('en-US')}</b>
                      </div>
                      <div className="payment-bar">
                        <div className="payment-fill" style={{ width: `${totalInvoiced > 0 ? Math.min(100, Math.round((totalPaid / totalInvoiced) * 100)) : 0}%` }}></div>
                      </div>
                      <div className="payment-row">
                        <span>Total Invoiced</span>
                        <b className="tabular">৳{totalInvoiced.toLocaleString('en-US')}</b>
                      </div>
                    </div>
                  )}
                </section>

                <section className="dcard" style={{ marginTop: 16 }}>
                  <div className="dcard-head">
                    <span className="dcard-title">Quick Actions</span>
                  </div>
                  <div className="qa-grid">
                    {proj ? (
                      <Link href={`/projects/${proj.id}`} className="qa-btn">
                        <Icon name="folder" size={14} /> View Project
                      </Link>
                    ) : (
                      <Link href={`/clients/${client.id}/create-project`} className="qa-btn">
                        <Icon name="folder-plus" size={14} /> Create Project
                      </Link>
                    )}
                    {client.contact_phone ? (
                      <a className="qa-btn" href={waLink(client.contact_phone)} target="_blank" rel="noopener noreferrer">
                        <Icon name="message" size={14} /> Send Message
                      </a>
                    ) : (
                      <button type="button" className="qa-btn" disabled>
                        <Icon name="message" size={14} /> Send Message
                      </button>
                    )}
                    {client.user_id ? (
                      <button type="button" className="qa-btn" onClick={() => setShowRequestModal(true)}>
                        <Icon name="alert" size={14} /> Request Info
                      </button>
                    ) : (
                      <button type="button" className="qa-btn" disabled>
                        <Icon name="alert" size={14} /> Request Info
                      </button>
                    )}
                    <button type="button" className="qa-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Icon name="upload" size={14} /> Upload File
                    </button>
                  </div>
                </section>
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
                    <label className="modal-label">Country</label>
                    <input className="modal-input" type="text" value={editForm.country ?? ''} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Time Zone</label>
                    <input className="modal-input" type="text" value={editForm.timezone ?? ''} onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })} />
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Preferred Contact Method</label>
                  <input className="modal-input" type="text" value={editForm.preferred_contact_method ?? ''} onChange={(e) => setEditForm({ ...editForm, preferred_contact_method: e.target.value })} />
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

      {showRequestModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRequestModal(false);
          }}
        >
          <div className="modal-box modal-box-lg">
            <div className="modal-head">
              <span className="modal-title">Request Information</span>
              <button type="button" className="modal-close" onClick={() => setShowRequestModal(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Message</label>
                <textarea className="modal-textarea" placeholder="e.g. Please upload your latest brand guidelines." value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} autoFocus />
              </div>
              <div className="toggle-row">
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>📎 Also request a file</span>
                <button type="button" className={`toggle-switch${reqWantsFile ? ' on' : ''}`} onClick={() => setReqWantsFile((v) => !v)} aria-label="ফাইল অনুরোধ টগল">
                  <div className="toggle-knob"></div>
                </button>
              </div>
              <div className="toggle-row">
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>🔔 Notify Client via WhatsApp</span>
                <button
                  type="button"
                  className={`toggle-switch${reqNotify ? ' on' : ''}`}
                  onClick={() => setReqNotify((v) => !v)}
                  disabled={!client.contact_phone}
                  aria-label="WhatsApp নোটিফিকেশন টগল"
                >
                  <div className="toggle-knob"></div>
                </button>
              </div>
              {!client.contact_phone && <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', margin: 0 }}>এই ক্লায়েন্টের কোনো ফোন নম্বর সেভ করা নেই, তাই WhatsApp নোটিফিকেশন পাঠানো যাবে না।</p>}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRequestModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent btn-sm" onClick={handleSendRequest} disabled={requestSaving || !reqMessage.trim()}>
                {requestSaving ? 'পাঠানো হচ্ছে…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowArchiveModal(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <span className="modal-title">{client.is_archived ? 'Unarchive' : 'Archive'} {client.company_name}?</span>
              <button type="button" className="modal-close" onClick={() => setShowArchiveModal(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-warn-text">
                {client.is_archived
                  ? 'This client will reappear in active views with their real status restored.'
                  : 'This client will be removed from active views but their records will remain available and can be restored anytime.'}
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowArchiveModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={handleToggleArchive} disabled={archiving}>
                {archiving ? 'সেভ হচ্ছে…' : client.is_archived ? 'Unarchive Client' : 'Archive Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
