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
import { relativeTimeBn, formatBnDate } from '@/lib/format';
import { uploadFileToDrive, guessFileType, driveDownloadUrl } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import MediaPreviewModal, { type MediaPreviewItem } from '@/app/components/MediaPreviewModal';
import Avatar from '@/app/components/Avatar';
import PhoneInput from '@/app/components/PhoneInput';
import { formatMoney } from '@/lib/currency';
import { getProjectCurrencies } from '@/lib/projectCurrency';
import RichTextField from '@/app/components/RichTextField';
import RichText from '@/app/components/RichText';
import RequirementsEditModal from '@/app/components/RequirementsEditModal';
import { useAppShell } from '@/app/components/appShellContext';

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
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  link: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><path d="M8 12h8"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  eye: '<path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}


const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  lead: { label: 'Lead', cls: 's-todo', dot: 'var(--ink-faint)' },
  submitted: { label: 'Info Submitted', cls: 's-review', dot: 'var(--warning)' },
  discussion: { label: 'In Discussion', cls: 's-review', dot: 'var(--warning)' },
  active: { label: 'Active', cls: 's-progress', dot: 'var(--accent)' },
  retainer: { label: 'Retainer', cls: 's-progress', dot: 'var(--accent)' },
  completed: { label: 'Completed', cls: 's-done', dot: 'var(--positive)' },
};
const STATUS_ORDER = ['lead', 'submitted', 'discussion', 'active', 'retainer', 'completed'];

const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'চলছে', cls: 's-progress' },
  review: { label: 'রিভিউ', cls: 's-review' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
  on_hold: { label: 'হোল্ডে', cls: 's-todo' },
  draft: { label: 'Draft', cls: 's-todo' },
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
// a file entry can be a pasted web link (Figma, a Google Doc, a website …) instead of an uploaded file; those open in a new tab
function isDriveUrl(url: string): boolean {
  return /drive\.google\.com\/(file\/d\/|open\?id=|uc\?)|googleusercontent\.com/.test(url);
}
function isLinkFile(f: { file_type: string | null; drive_url: string }): boolean {
  return f.file_type === 'link' || !isDriveUrl(f.drive_url);
}
function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
}
const ACTIVITY_PAGE_SIZE = 5;

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
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [manager, setManager] = useState<ManagerOption | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const { dark } = useAppShell();
  const [showReqEdit, setShowReqEdit] = useState(false);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectCurrencies, setProjectCurrencies] = useState<Record<string, string>>({});
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<MediaPreviewItem | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, { done: number; total: number }>>({});
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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [descExpanded, setDescExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  useEffect(() => {
    if (!user || !clientId) return;

    async function loadAll() {
      const [clientRes, requirementsRes, filesRes, projectsRes, activityRes, managersRes, notesRes, profileRes] = await Promise.all([
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
        // the signed-in user's own profile for the sidebar card — this page never loaded it, so the card
        // fell back to showing the email address as both the name and the role
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, bio, behance_url, linkedin_url, facebook_url, instagram_url').eq('id', user!.id).single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

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
      getProjectCurrencies(projectRows.map((p) => p.id)).then(setProjectCurrencies);
      setActivity((activityRes.data as unknown as ActivityRow[]) ?? []);
      setManagers((managersRes.data as ManagerOption[]) ?? []);
      setNotes((notesRes.data as unknown as NoteRow[]) ?? []);

      const projectIds = projectRows.map((p) => p.id);
      const [sowsRes, invoicesRes, tasksRes] = await Promise.all([
        projectIds.length > 0 ? supabase.from('sows').select('id, project_id, status').in('project_id', projectIds) : Promise.resolve({ data: [] }),
        supabase.from('invoices').select('id, amount, currency, status').eq('client_id', clientId),
        projectIds.length > 0 ? supabase.from('tasks').select('project_id, status').in('project_id', projectIds) : Promise.resolve({ data: [] }),
      ]);
      setSows((sowsRes.data as SowRow[]) ?? []);
      setInvoices((invoicesRes.data as InvoiceRow[]) ?? []);

      // The saved projects.progress number is not kept up to date, so progress is worked out from the project's tasks
      // (finished tasks out of all tasks), the same way the dashboard does it. A project with no tasks stays at 0%.
      const taskStats = new Map<string, { done: number; total: number }>();
      for (const t of (tasksRes.data as { project_id: string | null; status: string }[]) ?? []) {
        if (!t.project_id) continue;
        const stat = taskStats.get(t.project_id) ?? { done: 0, total: 0 };
        stat.total += 1;
        if (t.status === 'done') stat.done += 1;
        taskStats.set(t.project_id, stat);
      }
      setTaskCounts(Object.fromEntries(taskStats));
      setProjects(projectRows.map((p) => {
        const stat = taskStats.get(p.id);
        return { ...p, progress: stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : p.status === 'completed' ? 100 : 0 };
      }));

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
        company_name: editForm.company_name.trim() || editForm.primary_contact?.trim() || 'Unnamed Client',
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

  // Archive শুধু ভিজিবিলিটি টগল করে (কিছুই হারায় না); এটা আসল, স্থায়ী delete —
  // ডাটাবেসে on delete cascade থাকায় client-এর files/invoices/payments/
  // messages/feedback/approvals/change requests/notes/meetings/attachments সব
  // একসাথে মুছে যাবে (প্রজেক্ট শুধু client_id null হয়ে টিকে থাকে, কারণ
  // projects.client_id-এর FK on delete set null, cascade না)। তাই company
  // নামটা হুবহু টাইপ করানো হচ্ছে confirm করতে — শুধু "আছেন কিনা" জিজ্ঞেস করা
  // যথেষ্ট না এত বড় blast radius-এর জন্য।
  async function handleDeleteClient() {
    if (!client) return;
    if (deleteConfirmText.trim() !== client.company_name) {
      setDeleteError('Type the exact company name to confirm.');
      return;
    }
    setDeleting(true);
    setDeleteError(null);

    const { error: deleteErr } = await supabase.from('clients').delete().eq('id', client.id);
    if (deleteErr) {
      setDeleteError(deleteErr.message);
      setDeleting(false);
      return;
    }

    if (user) {
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'client_deleted',
        entity_type: 'client',
        entity_id: client.id,
        detail: `"${client.company_name}" স্থায়ীভাবে মুছে ফেলা হয়েছে`,
      });
    }

    router.push('/clients');
  }

  // click a file: an uploaded file opens in the viewer; a web link opens in a new tab
  function openFileRow(f: FileRow) {
    if (isLinkFile(f)) {
      window.open(withProtocol(f.drive_url), '_blank', 'noopener,noreferrer');
    } else {
      setPreviewItem({ name: f.name, url: f.drive_url, fileType: f.file_type });
    }
  }

  async function handleAddLink() {
    if (!client || !linkUrl.trim()) return;
    setLinkSaving(true);
    setError(null);
    const url = withProtocol(linkUrl);
    let fallbackName = url;
    try {
      fallbackName = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // keep the address as the name
    }
    const { data, error: insertError } = await supabase
      .from('client_files')
      .insert({ client_id: client.id, name: linkName.trim() || fallbackName, file_type: 'link', size_bytes: null, drive_url: url, category: 'other', uploaded_by: 'team' })
      .select('id, name, file_type, size_bytes, drive_url, uploaded_by, created_at')
      .single();
    setLinkSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'The link could not be saved.');
      return;
    }
    setFiles((prev) => [data as FileRow, ...prev]);
    setLinkName('');
    setLinkUrl('');
    setShowLinkModal(false);
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0 || !client) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError('Please sign in again to upload files.');
      return;
    }

    setUploading(true);
    setError(null);
    for (const file of selected) {
      try {
        const result = await uploadFileToDrive(file, accessToken);
        const { data, error: insertError } = await supabase
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
        if (insertError || !data) throw new Error(insertError?.message ?? 'The file was uploaded but could not be saved.');
        setFiles((prev) => [data as FileRow, ...prev]);
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
      <p style={{ padding: 40, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
    );
  }

  if (notFound || !client) {
    return (
      <div style={{ padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>এই ক্লায়েন্ট পাওয়া যায়নি।</p>
              <Link href="/clients" className="btn btn-ghost btn-sm">
                Clients-এ ফিরে যান
              </Link>
            </div>
    );
  }

  const meta = client.is_archived
    ? { label: 'আর্কাইভড', cls: 's-archived' }
    : client.admin_request
      ? { label: 'Info Needed', cls: 's-action' }
      : (STATUS_META[client.status] ?? { label: client.status, cls: 's-todo' });
  const proj = currentProject(projects);
  const dealValue = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
  // one currency when every priced project uses the same one; null = mixed, so no misleading single total
  const pricedCurrencies = new Set(projects.filter((p) => (p.budget ?? 0) > 0).map((p) => projectCurrencies[p.id] ?? 'BDT'));
  const dealCurrency = pricedCurrencies.size <= 1 ? ([...pricedCurrencies][0] ?? 'BDT') : null;
  const clientSince = new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const hasSignedSow = sows.some((s) => proj && s.project_id === proj.id && s.status === 'signed');
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const paymentDone = invoices.length > 0 && totalPaid >= totalInvoiced && totalInvoiced > 0;
  // the five summary cards: what matters most about this client
  const activeProjects = projects.filter((p) => p.status !== 'completed');
  const invoiceCurrencySet = new Set(invoices.map((i) => i.currency));
  const invoiceCurrency = invoiceCurrencySet.size === 1 ? Array.from(invoiceCurrencySet)[0] : null;
  const openInvoices = invoices.filter((i) => !['paid', 'cancelled', 'failed', 'refunded', 'draft'].includes(i.status));
  const outstanding = openInvoices.reduce((sum, i) => sum + i.amount, 0);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const moneyText = (n: number) => (invoiceCurrency ? formatMoney(n, invoiceCurrency) : invoices.length === 0 ? '—' : 'Mixed currencies');
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

  const lcDoneCount = lcStepsFinal.filter((s) => s.done).length;
  const lcCurrent = lcStepsFinal.find((s) => s.current) ?? null;

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
    <>
      <main className="content">
            <div className="cd-topbar">
              <div className="cd-topbar-text">
                <h1 className="cd-topbar-title">Client details</h1>
                <p className="cd-topbar-sub">Everything about {client.company_name} in one place</p>
              </div>
              <Link href="/clients" className="cd-back">
                <span className="cd-back-icon"><Icon name="chevron-left" size={14} /></span>
                Back to clients
              </Link>
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="proj-header">
              <div className="proj-title-row" style={{ alignItems: 'flex-start' }}>
                <div className="proj-icon">{client.company_name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="proj-title-row">
                    <span className="proj-title">{client.primary_contact ?? client.company_name}</span>
                  </div>
                  <div className="ch-sub">
                    <span className="ch-company"><Icon name="building" size={14} />{client.company_name}</span>
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
                    <button
                      type="button"
                      className="more-menu-item danger"
                      onClick={() => {
                        setDeleteConfirmText('');
                        setDeleteError(null);
                        setShowDeleteModal(true);
                        setOpenHeaderMenu(null);
                      }}
                    >
                      <Icon name="trash" size={13} /> Delete Client
                    </button>
                  </div>
                </div>
              </div>
              <div className="ch-meta">
                <div className="ch-meta-item">
                  <span className="ch-meta-icon"><Icon name="calendar" size={15} /></span>
                  <div><span className="ch-meta-cap">Client since</span><b>{clientSince}</b></div>
                </div>
                <div className="ch-meta-item">
                  <span className="ch-meta-icon"><Icon name="users" size={15} /></span>
                  <div><span className="ch-meta-cap">Account manager</span><b className="ch-meta-person">{manager && <Avatar person={manager} size={24} fontSize={9} />}{manager?.full_name ?? 'Unassigned'}</b></div>
                </div>
                <div className="ch-meta-item">
                  <span className="ch-meta-icon"><Icon name="mail" size={15} /></span>
                  <div><span className="ch-meta-cap">Email</span><b>{client.contact_email ?? '—'}</b></div>
                </div>
                <div className="ch-meta-item">
                  <span className="ch-meta-icon"><Icon name="phone" size={15} /></span>
                  <div><span className="ch-meta-cap">Phone</span><b>{client.contact_phone ?? '—'}</b></div>
                </div>
              </div>
            </div>

            <div className="summary-strip">
              <div className="summary-item tone-project">
                <div className="si-top">
                  <div className="si-icon">
                    <Icon name="folder" size={16} />
                  </div>
                  {proj && (
                    <Link className="si-menu" href={`/projects/${proj.id}`} aria-label="Open project">
                      <Icon name="more-horizontal" size={15} />
                    </Link>
                  )}
                </div>
                <div className={`si-value tabular${projects.length === 0 ? ' muted' : ''}`}>{activeProjects.length}</div>
                <div className="si-label">Active Projects</div>
                <div className="si-foot"><i />{projects.length === 0 ? 'No project yet' : `${projects.length} in total`}</div>
                <div className="si-deco" aria-hidden="true">
                  <Icon name="folder" size={70} />
                </div>
              </div>
              <div className="summary-item tone-value">
                <div className="si-top">
                  <div className="si-icon">
                    <Icon name="wallet" size={16} />
                  </div>
                </div>
                <div className={`si-value tabular${dealValue <= 0 ? ' muted' : ''}`}>{dealValue > 0 ? (dealCurrency ? formatMoney(dealValue, dealCurrency) : 'Mixed currencies') : 'Not set'}</div>
                <div className="si-label">Project Value</div>
                <div className="si-foot"><i />{dealValue > 0 ? 'Across all projects' : 'Set it in the project'}</div>
                <div className="si-deco" aria-hidden="true">
                  <Icon name="wallet" size={70} />
                </div>
              </div>
              <div className="summary-item tone-paid">
                <div className="si-top">
                  <div className="si-icon">
                    <Icon name="check" size={16} />
                  </div>
                </div>
                <div className={`si-value tabular${invoices.length === 0 ? ' muted' : ''}`}>{invoices.length === 0 ? '—' : moneyText(totalPaid)}</div>
                <div className="si-label">Payments Collected</div>
                <div className="si-foot"><i />{invoices.length === 0 ? 'No payment requests yet' : `${paidCount} of ${invoices.length} requests paid`}</div>
                <div className="si-deco" aria-hidden="true">
                  <Icon name="check" size={70} />
                </div>
              </div>
              <div className="summary-item tone-due">
                <div className="si-top">
                  <div className="si-icon">
                    <Icon name="alert" size={16} />
                  </div>
                </div>
                <div className={`si-value tabular${invoices.length === 0 || outstanding === 0 ? ' muted' : ''}`}>{invoices.length === 0 ? '—' : moneyText(outstanding)}</div>
                <div className="si-label">Outstanding</div>
                <div className="si-foot"><i />{invoices.length === 0 ? 'Nothing requested' : outstanding > 0 ? `${openInvoices.length} awaiting payment` : 'All clear'}</div>
                <div className="si-deco" aria-hidden="true">
                  <Icon name="alert" size={70} />
                </div>
              </div>
              <div className="summary-item tone-progress">
                <div className="si-top">
                  <div className="si-icon">
                    <Icon name="layers" size={16} />
                  </div>
                </div>
                <div className={`si-value tabular${!proj ? ' muted' : ''}`}>{proj ? `${Math.round(proj.progress ?? 0)}%` : '—'}</div>
                <div className="si-label">Project Progress</div>
                <div className="si-foot"><i />{proj ? proj.name : 'No project yet'}</div>
                <div className="si-deco" aria-hidden="true">
                  <Icon name="layers" size={70} />
                </div>
              </div>
            </div>

            <div className="lifecycle-card">
              <div className="lc-head">
                <div>
                  <div className="lc-label">Client Lifecycle</div>
                  <div className="lc-sub">
                    {lcCurrent ? (
                      <>
                        Now: <b>{lcCurrent.label}</b>
                      </>
                    ) : (
                      'Every step is complete'
                    )}
                  </div>
                </div>
                <div className="lc-progress">
                  <div className="lc-progress-text">
                    <b className="tabular">{Math.round((lcDoneCount / Math.max(lcStepsFinal.length, 1)) * 100)}%</b>
                    <span className="tabular">{lcDoneCount} of {lcStepsFinal.length} steps done</span>
                  </div>
                  <div className="lc-track" aria-hidden="true">
                    <div className="lc-fill" style={{ width: `${(lcDoneCount / Math.max(lcStepsFinal.length, 1)) * 100}%` }}></div>
                  </div>
                </div>
              </div>
              <ol className="lc-row">
                {lcStepsFinal.map((s, i) => (
                  <li className={`lc-step${s.done ? ' done' : ''}${s.current ? ' current' : ''}`} key={s.key} aria-current={s.current ? 'step' : undefined}>
                    <span className="lc-dot">
                      {s.done ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="lc-step-label">{s.label}</span>
                    <span className="lc-state">
                      {s.done && (
                        <span className="lc-state-check" aria-hidden="true">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        </span>
                      )}
                      {s.done ? 'Done' : s.current ? 'In progress' : 'Upcoming'}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

              <section className="dcard ov-card">
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
                <table className="ov-table">
                  <tbody>
                    <tr>
                      <th scope="row"><span className="ov-th"><Icon name="user" size={15} />Designation</span></th>
                      <td>{client.designation ?? '—'}</td>
                      <th scope="row"><span className="ov-th"><Icon name="layers" size={15} />Industry</span></th>
                      <td>{client.industry ?? '—'}</td>
                    </tr>
                    <tr>
                      <th scope="row"><span className="ov-th"><Icon name="building" size={15} />Company size</span></th>
                      <td>{client.company_size ?? '—'}</td>
                      <th scope="row"><span className="ov-th"><Icon name="globe" size={15} />Website</span></th>
                      <td>{client.website ? <a href={/^https?:\/\//i.test(client.website) ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="field-link">{client.website}</a> : '—'}</td>
                    </tr>
                    <tr>
                      <th scope="row"><span className="ov-th"><Icon name="pin" size={15} />Country</span></th>
                      <td>{client.country ?? '—'}</td>
                      <th scope="row"><span className="ov-th"><Icon name="clock" size={15} />Time zone</span></th>
                      <td>{client.timezone ?? '—'}</td>
                    </tr>
                    <tr>
                      <th scope="row"><span className="ov-th"><Icon name="message" size={15} />Preferred contact</span></th>
                      <td>{client.preferred_contact_method ?? '—'}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </section>

                <section className="dcard ov-card">
                  <div className="dcard-head">
                    <span className="dcard-title">
                      Project Request{requirements && <span className="src-tag">Submitted by Client</span>}
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReqEdit(true)}>
                      <Icon name="edit" size={12} /> {requirements ? 'Edit' : 'Add details'}
                    </button>
                  </div>
                  {showReqEdit && (
                    <RequirementsEditModal clientId={client.id} initial={requirements} dark={dark} onClose={() => setShowReqEdit(false)} onSaved={(next) => setRequirements(next)} />
                  )}
                  {requirements ? (
                    <table className="ov-table req-table">
                      <tbody>
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="folder" size={15} />Project name</span></th>
                          <td>{requirements.project_name ?? '—'}</td>
                          <th scope="row"><span className="ov-th"><Icon name="layers" size={15} />Project type</span></th>
                          <td>{requirements.project_type ?? '—'}</td>
                        </tr>
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="calendar" size={15} />Expected timeline</span></th>
                          <td>{requirements.expected_timeline ?? '—'}</td>
                          <th scope="row"><span className="ov-th"><Icon name="wallet" size={15} />Estimated budget</span></th>
                          <td><span className="tabular">{requirements.budget_range ?? '—'}</span></td>
                        </tr>
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="alert" size={15} />Priority</span></th>
                          <td><span style={{ textTransform: 'capitalize' }}>{requirements.priority ?? '—'}</span></td>
                          <th scope="row"><span className="ov-th"><Icon name="users" size={15} />Target audience</span></th>
                          <td>{requirements.target_audience ?? '—'}</td>
                        </tr>
                        {requirements.project_description && (
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="file" size={15} />Description</span></th>
                          <td colSpan={3}><p className={`req-text${descExpanded ? '' : ' clamped'}`}>{requirements.project_description}</p>
                            <button type="button" className="show-more-btn" onClick={() => setDescExpanded((v) => !v)}>
                              {descExpanded ? 'Show Less' : 'Show More'}
                            </button></td>
                        </tr>
                        )}
                        {requirements.goals && (
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="check" size={15} />Goals</span></th>
                          <td colSpan={3}><p className="req-text">{requirements.goals}</p></td>
                        </tr>
                        )}
                        {featureChips.length > 0 && (
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="checklist" size={15} />Main features</span></th>
                          <td colSpan={3}><div className="feature-chips">
                              {featureChips.map((f) => (
                                <span className="feature-chip" key={f}>
                                  {f}
                                </span>
                              ))}
                            </div></td>
                        </tr>
                        )}
                        {assetChips.length > 0 && (
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="upload" size={15} />Existing assets</span></th>
                          <td colSpan={3}><div className="feature-chips">
                              {assetChips.map((f) => (
                                <span className="feature-chip" key={f}>
                                  {f}
                                </span>
                              ))}
                            </div></td>
                        </tr>
                        )}
                        {requirements.competitors && (
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="bar" size={15} />Competitors</span></th>
                          <td colSpan={3}><p className="req-text">{requirements.competitors}</p></td>
                        </tr>
                        )}
                        {requirements.reference_notes && (
                        <tr>
                          <th scope="row"><span className="ov-th"><Icon name="link" size={15} />References</span></th>
                          <td colSpan={3}><p className="req-text">{requirements.reference_notes}</p></td>
                        </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <p className="side-empty">The client has not submitted any requirements yet. You can add them yourself with “Add details”.</p>
                  )}
                </section>

            <div className="detail-two-col">
              <div className="detail-main-col">
                {/* Project and Project Request: side by side at the top of the left column */}
                <div className="detail-pair">
                  <section className="dcard proj-card">
                    <div className="dcard-head">
                      <span className="dcard-title">Project</span>
                      {proj && (
                        <span className={`proj-state ${PROJECT_STATUS_META[proj.status]?.cls ?? 's-todo'}`}>
                          <i />
                          {PROJECT_STATUS_META[proj.status]?.label ?? proj.status}
                        </span>
                      )}
                    </div>
                    {proj ? (
                      <div className="proj-body">
                        <div className="proj-name">{proj.name}</div>

                        <div className="proj-progress">
                          <div className="pgb-top">
                            <span>Progress</span>
                            <span className="pgb-count tabular">{taskCounts[proj.id] ? `${taskCounts[proj.id].done} of ${taskCounts[proj.id].total} tasks done` : 'No tasks yet'}</span>
                          </div>
                          <div className="pgb">
                            <div className="pgb-fill" style={{ width: `${Math.min(100, Math.max(0, proj.progress ?? 0))}%` }}>
                              <span className={`pgb-badge${(proj.progress ?? 0) < 12 ? ' edge-l' : (proj.progress ?? 0) > 88 ? ' edge-r' : ''}`}>{Math.round(proj.progress ?? 0)}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="proj-actions">
                          {proj.status === 'draft' && (
                            <Link href={`/clients/${client.id}/create-project?draft=${proj.id}`} className="btn btn-accent btn-sm">
                              <Icon name="edit" size={12} /> Continue draft
                            </Link>
                          )}
                          <Link href={`/projects/${proj.id}`} className="btn btn-ghost btn-sm">
                            Open Project
                          </Link>
                        </div>
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

                  <section className="dcard files-card">
                  <div className="dcard-head">
                  <span className="dcard-title">Client Files</span>
                  <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
                  <div className="files-head-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowLinkModal(true)}>
                      <Icon name="link" size={12} /> Add link
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Icon name="upload" size={12} /> {uploading ? 'আপলোড হচ্ছে…' : 'Upload File'}
                    </button>
                  </div>
                  </div>
                  {files.length === 0 ? (
                  <p className="side-empty">এখনো কোনো ফাইল শেয়ার করা হয়নি।</p>
                  ) : (
                  <div className="file-list">
                    {files.map((f) => (
                      <div
                        className="file-row clickable"
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openFileRow(f)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFileRow(f); } }}
                      >
                        <div className="file-icon">
                          <Icon name={isLinkFile(f) ? 'link' : 'file'} size={15} />
                        </div>
                        <div className="file-row-main">
                          <div className="file-row-name">{f.name}</div>
                          <div className="file-row-meta">
                            {[formatBytes(f.size_bytes), f.uploaded_by === 'client' ? 'Client' : 'Team', new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div className="file-actions" onClick={(e) => e.stopPropagation()}>
                          {isLinkFile(f) ? (
                            <a className="icon-btn" style={{ width: 28, height: 28 }} href={withProtocol(f.drive_url)} target="_blank" rel="noopener noreferrer" aria-label="Open link" title="Open link">
                              <Icon name="link" size={13} />
                            </a>
                          ) : (
                            <>
                              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} aria-label="View file" title="View" onClick={() => setPreviewItem({ name: f.name, url: f.drive_url, fileType: f.file_type })}>
                                <Icon name="eye" size={13} />
                              </button>
                              <a className="icon-btn" style={{ width: 28, height: 28 }} href={driveDownloadUrl(f.drive_url)} aria-label="Download file" title="Download">
                                <Icon name="download" size={13} />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                  </section>
    
                </div>
                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Activity</span>
                  </div>
                  {activity.length === 0 ? (
                    <p className="empty-inline">এখনো কোনো অ্যাক্টিভিটি নেই।</p>
                  ) : (
                    (() => {
                      const totalPages = Math.max(1, Math.ceil(activity.length / ACTIVITY_PAGE_SIZE));
                      const page = Math.min(activityPage, totalPages);
                      const from = (page - 1) * ACTIVITY_PAGE_SIZE;
                      const shown = activity.slice(from, from + ACTIVITY_PAGE_SIZE);
                      return (
                        <>
                          {shown.map((a, i) => {
                            const actor = toOne(a.actor);
                            return (
                              <div className="timeline-item" key={a.id}>
                                <div className="timeline-dot-wrap">
                                  <div className="timeline-dot">
                                    <Icon name="check" size={12} />
                                  </div>
                                  {i < shown.length - 1 && <div className="timeline-line"></div>}
                                </div>
                                <div>
                                  <div className="timeline-text">{a.detail ?? a.action}</div>
                                  <div className="timeline-time">
                                    {actor?.full_name ?? 'Client'} · {relativeTimeBn(a.created_at)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {totalPages > 1 && (
                            <div className="act-pager">
                              <span className="act-pager-info tabular">
                                {from + 1}–{Math.min(from + ACTIVITY_PAGE_SIZE, activity.length)} of {activity.length}
                              </span>
                              <div className="act-pager-btns">
                                <button type="button" className="act-pager-btn" disabled={page === 1} onClick={() => setActivityPage(page - 1)} aria-label="Previous activities">
                                  <Icon name="chevron-left" size={14} />
                                </button>
                                <span className="act-pager-page tabular">{page} / {totalPages}</span>
                                <button type="button" className="act-pager-btn next" disabled={page === totalPages} onClick={() => setActivityPage(page + 1)} aria-label="Next activities">
                                  <Icon name="chevron-left" size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
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

                <section className="dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Reach out</span>
                  </div>
                  <div className="reach-grid">
                    {client.contact_email ? (
                      <a className="reach-btn" href={`mailto:${client.contact_email}`}>
                        <Icon name="mail" size={15} /> Email
                      </a>
                    ) : (
                      <span className="reach-btn disabled"><Icon name="mail" size={15} /> Email</span>
                    )}
                    {client.contact_phone ? (
                      <a className="reach-btn" href={waLink(client.contact_phone)} target="_blank" rel="noopener noreferrer">
                        <Icon name="message" size={15} /> Message
                      </a>
                    ) : (
                      <span className="reach-btn disabled"><Icon name="message" size={15} /> Message</span>
                    )}
                    {client.contact_phone ? (
                      <a className="reach-btn" href={`tel:${client.contact_phone}`}>
                        <Icon name="phone" size={15} /> Call
                      </a>
                    ) : (
                      <span className="reach-btn disabled"><Icon name="phone" size={15} /> Call</span>
                    )}
                    {client.user_id ? (
                      <button type="button" className="reach-btn" onClick={() => setShowRequestModal(true)}>
                        <Icon name="alert" size={15} /> Request info
                      </button>
                    ) : (
                      <span className="reach-btn disabled"><Icon name="alert" size={15} /> Request info</span>
                    )}
                  </div>
                </section>

                <section className="dcard">
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
                            <RichTextField value={editingNoteText} onChange={setEditingNoteText} textareaClassName="modal-textarea" autoFocus />
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
                            <RichText text={n.body} className="note-text" />
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
                    <RichTextField value={noteDraft} onChange={setNoteDraft} textareaClassName="modal-textarea" placeholder="একটা ইন্টারনাল নোট লিখুন…" />
                    <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={handleAddNote} disabled={noteSaving || !noteDraft.trim()}>
                      <Icon name="plus" size={12} /> {noteSaving ? 'সেভ হচ্ছে…' : 'Add Note'}
                    </button>
                  </div>
                </section>

              </div>
            </div>
          </main>
      <MediaPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      {showLinkModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowLinkModal(false); }}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-icon"><Icon name="link" size={15} /></div>
              <div className="modal-title">Add a link</div>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowLinkModal(false)}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Link</label>
                <input className="modal-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" autoFocus />
              </div>
              <div className="modal-field">
                <label className="modal-label">Name (optional)</label>
                <input className="modal-input" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="e.g. Brand guidelines" />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowLinkModal(false)}>Cancel</button>
              <button type="button" className="btn btn-accent btn-sm" onClick={handleAddLink} disabled={linkSaving || !linkUrl.trim()}>
                {linkSaving ? 'Saving…' : 'Add link'}
              </button>
            </div>
          </div>
        </div>
      )}
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
                  <input className="modal-input" type="text" value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} />
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
                    <PhoneInput inputClassName="modal-input" value={editForm.contact_phone ?? ''} onChange={(v) => setEditForm({ ...editForm, contact_phone: v })} />
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
                  <RichTextField value={editForm.notes ?? ''} onChange={(v) => setEditForm({ ...editForm, notes: v })} textareaClassName="modal-textarea" />
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>
                  বাতিল
                </button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={saving}>
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
                <textarea value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} className="modal-textarea" placeholder="e.g. Please upload your latest brand guidelines." autoFocus />
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
      {showDeleteModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <span className="modal-title">Delete {client.company_name}?</span>
              <button type="button" className="modal-close" onClick={() => setShowDeleteModal(false)} aria-label="বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-warn-text">
                This permanently deletes this client and cannot be undone. Their files, invoices, payments, messages, feedback, approvals, change requests and notes will all be
                deleted with them. Any of their projects will remain but become unassigned.
              </p>
              <label className="field-label" htmlFor="deleteConfirm" style={{ marginTop: 12, display: 'block' }}>
                Type <strong>{client.company_name}</strong> to confirm
              </label>
              <input
                id="deleteConfirm"
                type="text"
                className="modal-input"
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError(null);
                }}
                autoComplete="off"
              />
              {deleteError && (
                <p className="modal-warn-text" style={{ color: 'var(--danger)', marginTop: 8 }}>
                  {deleteError}
                </p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={handleDeleteClient} disabled={deleting || deleteConfirmText.trim() !== client.company_name}>
                {deleting ? 'মুছে ফেলা হচ্ছে…' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
