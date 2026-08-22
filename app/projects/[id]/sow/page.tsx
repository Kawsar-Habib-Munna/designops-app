'use client';

// Screen 10 — SOW (admin)। রিডিজাইন (v2, মকআপ অনুযায়ী সরলীকৃত): সংক্ষিপ্ত ফিল্ড
// সেট (Summary/Services/Milestones/Payment Schedule/Revision/Terms) + লাইভ
// ডকুমেন্ট প্রিভিউ (React state থেকেই রিয়েল-টাইমে রেন্ডার হয়, আলাদা কোনো sync
// লজিক লাগে না)। v1/v2/v3 ভার্সন ট্যাব প্যাটার্ন অক্ষত — sows টেবিলে
// (project_id, version) কম্বিনেশনে নতুন রো, পুরনো ভার্সন immutable।
// Services/Milestones structured input নেয় কিন্তু scope/timeline টেক্সট কলামেই
// ফরম্যাটেড বুলেট হিসেবে সেভ হয় (নতুন কোনো array/jsonb কলাম লাগেনি) — শুধু
// Start/Delivery Date real কলামে (sows.start_date/delivery_date, ফেজ ১৩)
// যাতে ফর্ম রিলোড করলে ঠিকভাবে দেখা যায়, টেক্সট পার্স করতে না হয়।
//
// v3: Agency sig-block আগে "sent হলেই Confirmed" — কোনো real signature action
// ছাড়াই। এখন real "Sign as Agency" মোডাল (client-এর সাইনিং ফ্লোর মতোই
// Type/Draw/Upload, canvas Pointer Events দিয়ে) যা sows.agency_* কলামে
// (ফেজ ১৮) সেভ করে — RPC না, direct .update() (admin-এর নিজস্ব রো, আগে থেকেই
// "team can update sows" RLS পলিসি আছে)।
//
// v4: Documents & Attachments (SOW-11) — নতুন sow_documents টেবিল (ফেজ ১৯,
// প্রতি SOW ভার্সনে একাধিক real Drive ফাইল)। "Attach MSA" toggle (single
// document_url) আগের মতোই থেকে যায় — এটা আলাদা, reference/contract ফাইলের
// জন্য মাল্টি-আপলোড লিস্ট।
//
// v5: Locked SOW banner (SOW-09) + "Jump to section" TOC (SOW-03) — preview
// মোডে সিগনেচার হয়ে গেলে কেন Edit বাটন নেই সেটা স্পষ্ট করে, আর anchor-link
// pill nav দিয়ে দ্রুত সেকশনে জাম্প করা যায়।
//
// v6: TOC pill-nav → real tabs (SOW-02) — এখন activeTab state দিয়ে একবারে
// একটা সেকশন দেখায় (আগে anchor-scroll সব সেকশন একসাথে দেখাত)। print/PDF-এর
// জন্য .sow-tab-hidden { display:block !important } — নাহলে "Download Signed
// PDF" শুধু বর্তমান ট্যাবই প্রিন্ট করত, বাকিটা বাদ পড়ে যেত। "All SOWs" লিঙ্ক
// (নতুন /sows পাতা, SOW-01) header-এ যোগ হলো।

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import './sow.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDateLong } from '@/lib/format';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';
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
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  eye: '<path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
};
type IconName = keyof typeof ICON_PATHS;
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects', active: true },
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
  draft: { label: 'Draft', cls: 'sp-draft' },
  sent: { label: 'Sent · Awaiting Signature', cls: 'sp-sent' },
  signed: { label: 'Signed ✓', cls: 'sp-signed' },
  superseded: { label: 'Superseded', cls: 'sp-draft' },
  cancelled: { label: 'Voided', cls: 'sp-declined' },
};
const CURRENCIES = ['BDT', 'USD', 'GBP'];
const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };
const DEFAULT_REVISION = 'Up to 2 rounds of revisions per deliverable included.';
const DEFAULT_TERMS = `Ownership: Upon full payment, all final deliverables become the property of the Client. FLOW 53 retains the right to display finished work in its portfolio unless confidentiality is requested in writing.

Confidentiality: Both parties agree to keep all non-public project information confidential.

Termination: Either party may terminate this SOW with 14 days written notice; the Client will be billed for work completed to date on a pro-rata basis.

Governing Law: This SOW is governed by the laws of Bangladesh.`;

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ProjectBrief = {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  budget: number | null;
  clients: { company_name: string; primary_contact: string | null } | { company_name: string; primary_contact: string | null }[] | null;
  project_manager: { full_name: string; role: string | null } | { full_name: string; role: string | null }[] | null;
};
type Sow = {
  id: string;
  project_id: string;
  version: number;
  sow_number: string | null;
  status: string;
  start_date: string | null;
  delivery_date: string | null;
  project_value: number | null;
  currency: string | null;
  scope: string | null;
  objectives: string | null;
  timeline: string | null;
  payment_terms: string | null;
  revision_policy: string | null;
  terms: string | null;
  document_url: string | null;
  notify_client: boolean;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signature_method: string | null;
  signature_image_url: string | null;
  agency_signed_at: string | null;
  agency_signer_name: string | null;
  agency_signature_method: string | null;
  agency_signature_image_url: string | null;
};
type MilestoneRow = { id: string; label: string; week: string };
type AgencySigMethod = 'typed' | 'drawn' | 'uploaded';
const MAX_AGENCY_SIGNATURE_BYTES = 5 * 1024 * 1024;
type SowDocument = { id: string; sow_id: string; file_name: string; file_url: string; file_size: number | null; file_type: string | null; uploaded_at: string };
function formatBytes(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? (parts.pop() as string).toUpperCase() : 'FILE';
}
type SowDetailTabKey = 'parties' | 'scope' | 'timeline' | 'payment' | 'terms' | 'signatures';

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
let rowSeq = 0;
function newRowId() {
  rowSeq += 1;
  return `r${rowSeq}`;
}
function parseServices(scope: string | null): string[] {
  if (!scope) return [];
  return scope
    .split('\n')
    .map((l) => l.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean);
}
function serializeServices(services: string[]): string {
  return services
    .filter((s) => s.trim())
    .map((s) => `• ${s.trim()}`)
    .join('\n');
}
function parseMilestones(timeline: string | null): MilestoneRow[] {
  if (!timeline) return [];
  return timeline
    .split('\n')
    .filter((l) => l.startsWith('•'))
    .map((l) => {
      const clean = l.replace(/^•\s*/, '');
      const [label, week] = clean.split(' — ');
      return { id: newRowId(), label: (label ?? '').trim(), week: (week ?? '').trim() };
    });
}
function serializeTimeline(milestones: MilestoneRow[]): string {
  return milestones
    .filter((m) => m.label.trim())
    .map((m) => `• ${m.label.trim()}${m.week.trim() ? ` — ${m.week.trim()}` : ''}`)
    .join('\n');
}
function formatDateLong(iso: string): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function AdminSowPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [versions, setVersions] = useState<Sow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<'overview' | 'editor' | 'preview'>('overview');
  const [activeTab, setActiveTab] = useState<SowDetailTabKey>('parties');

  // ---- editable form state ----
  const [summary, setSummary] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [projectValue, setProjectValue] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [paymentSchedule, setPaymentSchedule] = useState('');
  const [revisionPolicy, setRevisionPolicy] = useState(DEFAULT_REVISION);
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [attachMSA, setAttachMSA] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Agency Signature modal (Type/Draw/Upload — same real capture as client signing) ----
  const [showAgencySignModal, setShowAgencySignModal] = useState(false);
  const [agencyFullName, setAgencyFullName] = useState('');
  const [agencySigMethod, setAgencySigMethod] = useState<AgencySigMethod>('typed');
  const [agencyHasDrawn, setAgencyHasDrawn] = useState(false);
  const [agencyStrokeCount, setAgencyStrokeCount] = useState(0);
  const [agencyDrawing, setAgencyDrawing] = useState(false);
  const agencyStrokesRef = useRef<{ x: number; y: number }[][]>([]);
  const agencyCurrentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const agencyCanvasRef = useRef<HTMLCanvasElement>(null);
  const [agencyUploadedUrl, setAgencyUploadedUrl] = useState<string | null>(null);
  const [agencyUploading, setAgencyUploading] = useState(false);
  const [agencyUploadError, setAgencyUploadError] = useState<string | null>(null);
  const agencyFileInputRef = useRef<HTMLInputElement>(null);
  const [agencySigning, setAgencySigning] = useState(false);
  const [agencySignError, setAgencySignError] = useState<string | null>(null);

  // ---- Documents / Attachments (SOW-11) ----
  const [documents, setDocuments] = useState<SowDocument[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState(0);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  function loadFormFrom(sow: Sow) {
    setSummary(sow.objectives ?? '');
    setServices(parseServices(sow.scope));
    setStartDate(sow.start_date ?? '');
    setDeliveryDate(sow.delivery_date ?? '');
    setMilestones(parseMilestones(sow.timeline));
    setProjectValue(sow.project_value != null ? String(sow.project_value) : '');
    setCurrency(sow.currency ?? 'BDT');
    setPaymentSchedule(sow.payment_terms?.replace(/^Total project value:.*?\.\s*/, '') ?? '');
    setRevisionPolicy(sow.revision_policy ?? DEFAULT_REVISION);
    setTerms(sow.terms ?? DEFAULT_TERMS);
    setDocumentUrl(sow.document_url);
    setAttachMSA(!!sow.document_url);
    setNotify(sow.notify_client);
  }

  useEffect(() => {
    if (!user || !projectId) return;

    async function run() {
      const [projectRes, sowsRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name, description, client_id, budget, clients(company_name, primary_contact), project_manager:profiles!project_manager_id(full_name, role)').eq('id', projectId).maybeSingle(),
        supabase.from('sows').select('*').eq('project_id', projectId).order('version', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);

      if (projectRes.error) setError(projectRes.error.message);
      setProject((projectRes.data as unknown as ProjectBrief) ?? null);
      const rows = (sowsRes.data as Sow[]) ?? [];
      setVersions(rows);
      if (rows.length > 0) {
        setSelectedId(rows[0].id);
        loadFormFrom(rows[0]);
        setMode(rows[0].status === 'draft' ? 'editor' : 'preview');
      } else {
        setMode('overview');
      }
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user, projectId, reloadKey]);

  useEffect(() => {
    if (!selectedId) {
      const timer = setTimeout(() => setDocuments([]), 0);
      return () => clearTimeout(timer);
    }
    const sowId = selectedId;
    async function loadDocuments() {
      const { data } = await supabase.from('sow_documents').select('id, sow_id, file_name, file_url, file_size, file_type, uploaded_at').eq('sow_id', sowId).order('uploaded_at', { ascending: false });
      setDocuments((data as SowDocument[]) ?? []);
    }
    loadDocuments();
  }, [selectedId]);

  function selectVersion(sow: Sow) {
    setSelectedId(sow.id);
    loadFormFrom(sow);
    setMode(sow.status === 'draft' ? 'editor' : 'preview');
    setActiveTab('parties');
  }

  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const client = project ? toOne(project.clients) : null;
  const manager = project ? toOne(project.project_manager) : null;

  function addService() {
    setServices((prev) => [...prev, '']);
  }
  function updateService(i: number, value: string) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }
  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addMilestone() {
    setMilestones((prev) => [...prev, { id: newRowId(), label: '', week: '' }]);
  }
  function updateMilestone(id: string, patch: Partial<MilestoneRow>) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }
  function removeMilestone(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  function buildPaymentTerms(): string {
    const sym = CURRENCY_SYMBOL[currency] ?? currency;
    const value = projectValue ? Number(projectValue).toLocaleString('en-US') : '0';
    return `Total project value: ${sym}${value}. ${paymentSchedule.trim()}`.trim();
  }

  async function handleCreateFirst() {
    if (!user || !project) return;
    const { count } = await supabase.from('sows').select('id', { count: 'exact', head: true });
    const sowNumber = `SOW-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, '0')}`;

    const { data, error: createError } = await supabase
      .from('sows')
      .insert({
        project_id: projectId,
        version: 1,
        created_by: user.id,
        sow_number: sowNumber,
        objectives: project.description ?? '',
        project_value: project.budget,
        currency: 'BDT',
        revision_policy: DEFAULT_REVISION,
        terms: DEFAULT_TERMS,
      })
      .select('*')
      .single();
    if (createError) {
      setError(createError.message);
      return;
    }
    setVersions([data as Sow]);
    selectVersion(data as Sow);
    setMode('editor');
  }

  async function handleCreateNewVersion() {
    if (!user || !selected) return;
    const nextVersion = (versions[0]?.version ?? 0) + 1;
    const { data, error: createError } = await supabase
      .from('sows')
      .insert({
        project_id: projectId,
        version: nextVersion,
        created_by: user.id,
        sow_number: selected.sow_number,
        start_date: selected.start_date,
        delivery_date: selected.delivery_date,
        project_value: selected.project_value,
        currency: selected.currency,
        scope: selected.scope,
        objectives: selected.objectives,
        timeline: selected.timeline,
        payment_terms: selected.payment_terms,
        revision_policy: selected.revision_policy,
        terms: selected.terms,
        document_url: selected.document_url,
      })
      .select('*')
      .single();
    if (createError) {
      setError(createError.message);
      return;
    }

    if (selected.status === 'sent') {
      await supabase.from('sows').update({ status: 'superseded', superseded_by: (data as Sow).id }).eq('id', selected.id);
    }

    setVersions((prev) => [data as Sow, ...prev.map((v) => (v.id === selected.id && selected.status === 'sent' ? { ...v, status: 'superseded' } : v))]);
    selectVersion(data as Sow);
    setMode('editor');
  }

  async function handleSaveDraft() {
    if (!selected) return;
    setSaving(true);
    const { error: updateError } = await supabase
      .from('sows')
      .update({
        objectives: summary,
        scope: serializeServices(services),
        start_date: startDate || null,
        delivery_date: deliveryDate || null,
        timeline: serializeTimeline(milestones),
        project_value: projectValue ? Number(projectValue) : null,
        currency,
        payment_terms: buildPaymentTerms(),
        revision_policy: revisionPolicy,
        terms,
        document_url: attachMSA ? documentUrl : null,
      })
      .eq('id', selected.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setReloadKey((k) => k + 1);
  }

  async function handleConfirmSend() {
    if (!selected || !user) return;
    setSending(true);
    await handleSaveDraft();
    const { error: updateError } = await supabase
      .from('sows')
      .update({ status: 'sent', sent_at: new Date().toISOString(), notify_client: notify })
      .eq('id', selected.id);
    setSending(false);
    setShowSendConfirm(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (project?.client_id) {
      await supabase.from('activity_log').insert({ actor_id: user.id, action: 'sow_sent', entity_type: 'client', entity_id: project.client_id, detail: `SOW ${selected.sow_number ?? `v${selected.version}`} ক্লায়েন্টকে পাঠানো হয়েছে` });
    }
    setReloadKey((k) => k + 1);
  }

  async function handleConfirmVoid() {
    if (!selected || !user) return;
    setVoiding(true);
    const { error: updateError } = await supabase.from('sows').update({ status: 'cancelled' }).eq('id', selected.id);
    setVoiding(false);
    setShowVoidConfirm(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (project?.client_id) {
      await supabase.from('activity_log').insert({ actor_id: user.id, action: 'sow_cancelled', entity_type: 'client', entity_id: project.client_id, detail: `SOW ${selected.sow_number ?? `v${selected.version}`} void করা হয়েছে` });
    }
    setReloadKey((k) => k + 1);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
      setDocumentUrl(result.webViewLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    }
    setUploading(false);
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0 || !selected || !user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setDocUploading(true);
    setDocUploadProgress(0);
    try {
      for (const file of files) {
        const result = await uploadFileToDrive(file, accessToken, setDocUploadProgress);
        const { data } = await supabase
          .from('sow_documents')
          .insert({ sow_id: selected.id, file_name: file.name, file_url: result.webViewLink, file_size: file.size, file_type: file.type, uploaded_by: user.id })
          .select('id, sow_id, file_name, file_url, file_size, file_type, uploaded_at')
          .single();
        if (data) setDocuments((prev) => [data as SowDocument, ...prev]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    }
    setDocUploading(false);
  }

  async function handleDocRemove(docId: string) {
    const { error: deleteError } = await supabase.from('sow_documents').delete().eq('id', docId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  // ---- Agency signature: canvas drawing ----
  const redrawAgencyCanvas = useCallback((liveStroke?: { x: number; y: number }[]) => {
    const canvas = agencyCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#232128';
    const strokes = liveStroke ? [...agencyStrokesRef.current, liveStroke] : agencyStrokesRef.current;
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    if (!showAgencySignModal || agencySigMethod !== 'drawn') return;
    const canvas = agencyCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
    redrawAgencyCanvas();
  }, [showAgencySignModal, agencySigMethod, redrawAgencyCanvas]);

  function agencyCanvasPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = agencyCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function handleAgencyPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    agencyCanvasRef.current?.setPointerCapture(e.pointerId);
    agencyCurrentStrokeRef.current = [agencyCanvasPoint(e)];
    setAgencyDrawing(true);
  }
  function handleAgencyPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!agencyDrawing) return;
    e.preventDefault();
    agencyCurrentStrokeRef.current.push(agencyCanvasPoint(e));
    redrawAgencyCanvas(agencyCurrentStrokeRef.current);
  }
  function handleAgencyPointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!agencyDrawing) return;
    agencyCanvasRef.current?.releasePointerCapture(e.pointerId);
    if (agencyCurrentStrokeRef.current.length > 1) {
      agencyStrokesRef.current = [...agencyStrokesRef.current, agencyCurrentStrokeRef.current];
      setAgencyHasDrawn(true);
      setAgencyStrokeCount(agencyStrokesRef.current.length);
    }
    agencyCurrentStrokeRef.current = [];
    setAgencyDrawing(false);
    redrawAgencyCanvas();
  }
  function undoAgencyStroke() {
    agencyStrokesRef.current = agencyStrokesRef.current.slice(0, -1);
    setAgencyHasDrawn(agencyStrokesRef.current.length > 0);
    setAgencyStrokeCount(agencyStrokesRef.current.length);
    redrawAgencyCanvas();
  }
  function clearAgencyCanvas() {
    agencyStrokesRef.current = [];
    setAgencyHasDrawn(false);
    setAgencyStrokeCount(0);
    redrawAgencyCanvas();
  }

  async function handleAgencyUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAgencyUploadError(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setAgencyUploadError('Please upload a PNG or JPG image.');
      return;
    }
    if (file.size > MAX_AGENCY_SIGNATURE_BYTES) {
      setAgencyUploadError('Image is too large — please upload a file under 5MB.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setAgencyUploading(true);
    try {
      const result = await uploadFileToDrive(file, accessToken);
      setAgencyUploadedUrl(result.webViewLink);
    } catch {
      setAgencyUploadError('Upload failed — please try again.');
    }
    setAgencyUploading(false);
  }

  function openAgencySignModal() {
    setAgencyFullName(profile?.full_name ?? '');
    setAgencySigMethod('typed');
    agencyStrokesRef.current = [];
    setAgencyHasDrawn(false);
    setAgencyStrokeCount(0);
    setAgencyUploadedUrl(null);
    setAgencyUploadError(null);
    setAgencySignError(null);
    setShowAgencySignModal(true);
  }

  async function handleAgencySignSubmit() {
    if (!selected || !user || !agencyFullName.trim()) return;
    setAgencySigning(true);
    setAgencySignError(null);

    let signatureImageUrl: string | null = null;
    if (agencySigMethod === 'drawn') {
      const canvas = agencyCanvasRef.current;
      if (!canvas) {
        setAgencySigning(false);
        return;
      }
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (blob) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          try {
            const file = new File([blob], `agency-signature-${Date.now()}.png`, { type: 'image/png' });
            const result = await uploadFileToDrive(file, accessToken);
            signatureImageUrl = result.webViewLink;
          } catch {
            setAgencySigning(false);
            setAgencySignError('Could not save the drawn signature. Please try again.');
            return;
          }
        }
      }
    } else if (agencySigMethod === 'uploaded') {
      signatureImageUrl = agencyUploadedUrl;
    }

    const { error: updateError } = await supabase
      .from('sows')
      .update({
        agency_signed_by: user.id,
        agency_signed_at: new Date().toISOString(),
        agency_signer_name: agencyFullName.trim(),
        agency_signature_method: agencySigMethod,
        agency_signature_image_url: signatureImageUrl,
      })
      .eq('id', selected.id);

    setAgencySigning(false);
    if (updateError) {
      setAgencySignError(updateError.message);
      return;
    }
    if (project?.client_id) {
      await supabase.from('activity_log').insert({ actor_id: user.id, action: 'sow_agency_signed', entity_type: 'client', entity_id: project.client_id, detail: `${agencyFullName.trim()} SOW ${selected.sow_number ?? `v${selected.version}`}-এ agency-side সাইন করেছেন` });
    }
    setShowAgencySignModal(false);
    setReloadKey((k) => k + 1);
  }

  const agencyHasValidSignature = agencySigMethod === 'typed' ? agencyFullName.trim().length > 0 : agencySigMethod === 'drawn' ? agencyHasDrawn : !!agencyUploadedUrl;
  const canAgencySign = agencyFullName.trim().length > 0 && agencyHasValidSignature && !agencySigning;

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`projdetail-root sow-admin-root${dark ? ' dark' : ''}`}>
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

          <main className="content" style={mode === 'editor' ? { maxWidth: 1180 } : undefined}>
            {loading || !project ? (
              <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : (
              <>
                <div className="breadcrumb" style={mode === 'editor' ? { padding: '0 24px', maxWidth: 1180, margin: '0 auto 14px' } : undefined}>
                  <Link href="/clients">Clients</Link>
                  <span className="sep">/</span>
                  {client && <Link href={`/projects/${project.id}`}>{client.company_name}</Link>}
                  <span className="sep">/</span>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  <span className="sep">/</span>
                  <span className="current">SOW</span>
                </div>

                {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

                {/* ---- OVERVIEW (no SOW yet) ---- */}
                {mode === 'overview' && (
                  <>
                    <div className="page-header-row">
                      <div>
                        <h1 className="page-title">Statement of Work</h1>
                        <p className="page-sub">
                          {project.name} — {client?.company_name}
                        </p>
                      </div>
                      <div className="header-actions">
                        <Link href="/sows" className="btn btn-ghost btn-sm">
                          All SOWs
                        </Link>
                      </div>
                    </div>
                    <div className="dcard">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="dcard-title" style={{ marginBottom: 0 }}>
                          Current Status
                        </span>
                        <span className="status-pill sp-none">
                          <span className="dot" style={{ background: 'var(--ink-faint)' }}></span>No SOW Created
                        </span>
                      </div>
                      <div className="sow-empty">
                        <div className="sow-empty-icon">
                          <Icon name="file" />
                        </div>
                        <div className="sow-empty-title">No Statement of Work yet</div>
                        <p className="sow-empty-sub">Create a SOW to define scope, timeline, and payment terms — then send it to {client?.primary_contact ?? client?.company_name} for review and e-signature.</p>
                        <button className="btn btn-accent" onClick={handleCreateFirst}>
                          <Icon name="plus" size={14} /> Create SOW
                        </button>
                      </div>
                    </div>
                    <div className="dcard" style={{ opacity: 0.6 }}>
                      <span className="dcard-title">Version History</span>
                      <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>No previous versions — this will appear here once a SOW is created and sent.</p>
                    </div>
                  </>
                )}

                {/* ---- EDITOR (draft) ---- */}
                {mode === 'editor' && selected && (
                  <>
                    <div className="page-header-row" style={{ padding: '0 24px', maxWidth: 1180, margin: '0 auto 18px' }}>
                      <div>
                        <h1 className="page-title">{versions.length > 1 || selected.sent_at ? 'Edit Statement of Work' : 'Create Statement of Work'}</h1>
                        <p className="page-sub">
                          {project.name} — {client?.company_name} · {client?.primary_contact}
                        </p>
                      </div>
                      <div className="header-actions">
                        {versions.length > 0 && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setMode('overview')}>
                            All Versions
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="editor-split">
                      <div className="editor-form-col">
                        <div className="dcard">
                          <span className="dcard-title">Scope of Work</span>
                          <div className="field">
                            <label className="field-label">Project Summary</label>
                            <textarea className="field-textarea" value={summary} onChange={(e) => setSummary(e.target.value)} />
                          </div>
                          <div className="field">
                            <label className="field-label">Services Included</label>
                            {services.map((s, i) => (
                              <div className="deliverable-row" key={i}>
                                <input className="field-input" value={s} onChange={(e) => updateService(i, e.target.value)} placeholder="e.g. UX Research & Discovery" />
                                <span></span>
                                <button type="button" className="deliverable-remove" onClick={() => removeService(i)} aria-label="বাদ দিন">
                                  <Icon name="close" size={12} />
                                </button>
                              </div>
                            ))}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={addService}>
                              <Icon name="plus" size={12} /> Add Service
                            </button>
                          </div>
                        </div>

                        <div className="dcard">
                          <span className="dcard-title">Deliverables &amp; Timeline</span>
                          <div className="field-grid-2">
                            <div className="field">
                              <label className="field-label">Start Date</label>
                              <input type="date" className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="field">
                              <label className="field-label">Expected Delivery</label>
                              <input type="date" className="field-input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                            </div>
                          </div>
                          {milestones.map((m) => (
                            <div className="deliverable-row" key={m.id}>
                              <input className="field-input" value={m.label} onChange={(e) => updateMilestone(m.id, { label: e.target.value })} placeholder="e.g. Wireframes — all core screens" />
                              <input className="field-input" style={{ maxWidth: 120 }} value={m.week} onChange={(e) => updateMilestone(m.id, { week: e.target.value })} placeholder="Week" />
                              <button type="button" className="deliverable-remove" onClick={() => removeMilestone(m.id)} aria-label="বাদ দিন">
                                <Icon name="close" size={12} />
                              </button>
                            </div>
                          ))}
                          <button type="button" className="btn btn-ghost btn-sm" onClick={addMilestone}>
                            <Icon name="plus" size={12} /> Add Milestone
                          </button>
                        </div>

                        <div className="dcard">
                          <span className="dcard-title">Payment Terms</span>
                          <div className="field-grid-2">
                            <div className="field">
                              <label className="field-label">Project Value</label>
                              <input type="number" min="0" className="field-input" value={projectValue} onChange={(e) => setProjectValue(e.target.value)} />
                            </div>
                            <div className="field">
                              <label className="field-label">Currency</label>
                              <select className="field-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                                {CURRENCIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="field">
                            <label className="field-label">Payment Schedule</label>
                            <textarea className="field-textarea" style={{ minHeight: 70 }} value={paymentSchedule} onChange={(e) => setPaymentSchedule(e.target.value)} placeholder="e.g. 50% due upon signing. Remaining 50% due upon final delivery." />
                          </div>
                          <div className="field">
                            <label className="field-label">Revision Policy</label>
                            <input className="field-input" value={revisionPolicy} onChange={(e) => setRevisionPolicy(e.target.value)} />
                          </div>
                        </div>

                        <div className="dcard">
                          <span className="dcard-title">Terms &amp; Conditions</span>
                          <textarea className="field-textarea large" value={terms} onChange={(e) => setTerms(e.target.value)} />
                          <div className="toggle-row">
                            <span className="toggle-label">📎 Attach Master Service Agreement</span>
                            <button type="button" className={`toggle-switch${attachMSA ? ' on' : ''}`} onClick={() => setAttachMSA((v) => !v)} aria-label="MSA সংযুক্তি টগল">
                              <div className="toggle-knob"></div>
                            </button>
                          </div>
                          {attachMSA && (
                            <div className="sow-doc-row" style={{ marginTop: 10, paddingBottom: 0, borderBottom: 'none' }}>
                              <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                <Icon name="upload" size={13} /> {uploading ? `আপলোড হচ্ছে… ${uploadProgress}%` : documentUrl ? 'Replace Document' : 'Upload Document (PDF/DOC)'}
                              </button>
                              {documentUrl && (
                                <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="sow-doc-link">
                                  View uploaded document ↗
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="dcard">
                          <span className="dcard-title">Documents &amp; Attachments</span>
                          <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', margin: '0 0 12px' }}>Reference files, contracts, or other documents attached to this SOW version — visible to the client once sent.</p>
                          {documents.length > 0 && (
                            <div className="sow-doc-list">
                              {documents.map((d) => (
                                <div className="sow-doc-item" key={d.id}>
                                  <span className="sow-doc-ext">{fileExtension(d.file_name)}</span>
                                  <div className="sow-doc-item-meta">
                                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="sow-doc-item-name">
                                      {d.file_name}
                                    </a>
                                    <span className="sow-doc-item-size">{formatBytes(d.file_size)}</span>
                                  </div>
                                  <button type="button" className="deliverable-remove" onClick={() => handleDocRemove(d.id)} aria-label="সরান">
                                    <Icon name="close" size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <input ref={docFileInputRef} type="file" multiple hidden onChange={handleDocUpload} />
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => docFileInputRef.current?.click()} disabled={docUploading}>
                            <Icon name="upload" size={13} /> {docUploading ? `আপলোড হচ্ছে… ${docUploadProgress}%` : 'Upload Document(s)'}
                          </button>
                        </div>

                        <div className="dcard" style={{ marginBottom: 0 }}>
                          <div className="editor-foot-bar" style={{ marginTop: 0, position: 'static', borderTop: 'none', padding: 0 }}>
                            <button className="btn btn-ghost" onClick={handleSaveDraft} disabled={saving}>
                              {saving ? 'সেভ হচ্ছে…' : 'Save Draft'}
                            </button>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button className="btn btn-accent" onClick={() => setShowSendConfirm(true)} disabled={sending}>
                                <Icon name="send" /> Send for Signature
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ---- LIVE PREVIEW ---- */}
                      <div className="editor-preview-col">
                        <div className="preview-panel">
                          <div className="preview-panel-head">
                            <span className="preview-panel-title">
                              <span className="preview-live-dot"></span> Live Preview
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Client will see this</span>
                          </div>
                          <div className="preview-panel-body">
                            <div className="preview-letterhead">FLOW 53</div>
                            <div className="preview-letterhead-sub">Product Design Studio · Dhaka, Bangladesh</div>
                            <div className="preview-title">STATEMENT OF WORK</div>
                            <div className="preview-subtitle">
                              {project.name} — {client?.company_name}
                            </div>

                            <div className="preview-h2">1. Parties</div>
                            <p className="preview-p">
                              <b>Service Provider:</b> FLOW 53 Design Studio
                            </p>
                            <p className="preview-p">
                              <b>Client:</b> {client?.primary_contact}, {client?.company_name}
                            </p>

                            <div className="preview-h2">2. Scope of Work</div>
                            <p className="preview-p">{summary || '—'}</p>
                            <ul className="preview-list">
                              {services.filter((s) => s.trim()).length > 0 ? services.filter((s) => s.trim()).map((s, i) => <li key={i}>{s}</li>) : <li style={{ color: 'var(--ink-faint)' }}>No services added yet.</li>}
                            </ul>

                            <div className="preview-h2">3. Timeline</div>
                            <ul className="preview-list">
                              {milestones.filter((m) => m.label.trim()).length > 0 ? (
                                milestones.filter((m) => m.label.trim()).map((m) => (
                                  <li key={m.id}>
                                    {m.label}
                                    {m.week ? ` — ${m.week}` : ''}
                                  </li>
                                ))
                              ) : (
                                <li style={{ color: 'var(--ink-faint)' }}>No milestones added yet.</li>
                              )}
                            </ul>
                            {(startDate || deliveryDate) && (
                              <p className="preview-p">
                                {startDate && `Start: ${formatDateLong(startDate)}`}
                                {startDate && deliveryDate && ' · '}
                                {deliveryDate && `Expected Delivery: ${formatDateLong(deliveryDate)}`}
                              </p>
                            )}

                            <div className="preview-h2">4. Payment Terms</div>
                            <p className="preview-p">{buildPaymentTerms()}</p>
                            <p className="preview-p">{revisionPolicy}</p>

                            <div className="preview-h2">5. Terms &amp; Conditions</div>
                            <p className="preview-p">{terms.split('\n').filter(Boolean)[0] || '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ---- PREVIEW & SIGNATURE STATUS ---- */}
                {mode === 'preview' && selected && (
                  <>
                    <div className="page-header-row">
                      <div>
                        <h1 className="page-title">Statement of Work</h1>
                        <p className="page-sub">
                          {project.name} — {client?.company_name} · v{selected.version}
                        </p>
                      </div>
                      <div className="header-actions">
                        <Link href="/sows" className="btn btn-ghost btn-sm">
                          All SOWs
                        </Link>
                        <span className={`status-pill ${STATUS_META[selected.status]?.cls ?? 'sp-draft'}`}>
                          <span className="dot" style={{ background: 'currentColor' }}></span>
                          {STATUS_META[selected.status]?.label ?? selected.status}
                        </span>
                      </div>
                    </div>

                    <div className="sow-version-tabs">
                      {versions.map((v) => (
                        <button key={v.id} className={`sow-version-tab${v.id === selectedId ? ' active' : ''}`} onClick={() => selectVersion(v)}>
                          v{v.version} <span className={`status-pill ${STATUS_META[v.status]?.cls ?? 'sp-draft'}`}>{STATUS_META[v.status]?.label ?? v.status}</span>
                        </button>
                      ))}
                      {selected.status !== 'draft' && selected.status !== 'superseded' && selected.status !== 'cancelled' && (
                        <button className="btn btn-ghost btn-sm" onClick={handleCreateNewVersion}>
                          <Icon name="plus" size={12} /> New Version
                        </button>
                      )}
                    </div>

                    {selected.status === 'signed' && (
                      <div className="sow-locked-banner">
                        🔒 This SOW version is signed and locked — it can no longer be edited. To change scope, terms, or pricing, create a new version.
                      </div>
                    )}

                    <nav className="sow-toc" aria-label="Document sections" role="tablist">
                      <button type="button" role="tab" aria-selected={activeTab === 'parties'} className={`sow-toc-tab${activeTab === 'parties' ? ' active' : ''}`} onClick={() => setActiveTab('parties')}>
                        Parties
                      </button>
                      <button type="button" role="tab" aria-selected={activeTab === 'scope'} className={`sow-toc-tab${activeTab === 'scope' ? ' active' : ''}`} onClick={() => setActiveTab('scope')}>
                        Scope
                      </button>
                      <button type="button" role="tab" aria-selected={activeTab === 'timeline'} className={`sow-toc-tab${activeTab === 'timeline' ? ' active' : ''}`} onClick={() => setActiveTab('timeline')}>
                        Timeline
                      </button>
                      <button type="button" role="tab" aria-selected={activeTab === 'payment'} className={`sow-toc-tab${activeTab === 'payment' ? ' active' : ''}`} onClick={() => setActiveTab('payment')}>
                        Payment
                      </button>
                      <button type="button" role="tab" aria-selected={activeTab === 'terms'} className={`sow-toc-tab${activeTab === 'terms' ? ' active' : ''}`} onClick={() => setActiveTab('terms')}>
                        Terms
                      </button>
                      <button type="button" role="tab" aria-selected={activeTab === 'signatures'} className={`sow-toc-tab${activeTab === 'signatures' ? ' active' : ''}`} onClick={() => setActiveTab('signatures')}>
                        Signatures
                      </button>
                    </nav>

                    <div className="sow-preview-grid">
                      <div>
                        <div className="doc-card">
                          <div className="doc-letterhead">FLOW 53</div>
                          <div className="doc-letterhead-sub">Product Design Studio · Dhaka, Bangladesh</div>
                          <div className="doc-title">STATEMENT OF WORK</div>
                          <div className="doc-subtitle">
                            {project.name} — {client?.company_name}
                          </div>

                          <div className={`sow-tab-panel${activeTab === 'parties' ? '' : ' sow-tab-hidden'}`}>
                            <div className="doc-h2">1. Parties</div>
                            <p className="doc-field-line">
                              <b>Service Provider:</b> FLOW 53 Design Studio
                            </p>
                            <p className="doc-field-line">
                              <b>Client:</b> {client?.primary_contact}, {client?.company_name}
                            </p>
                          </div>

                          <div className={`sow-tab-panel${activeTab === 'scope' ? '' : ' sow-tab-hidden'}`}>
                            <div className="doc-h2">2. Scope of Work</div>
                            <p className="doc-p">{summary || '—'}</p>
                            <ul className="doc-list">
                              {services.filter((s) => s.trim()).map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>

                          <div className={`sow-tab-panel${activeTab === 'timeline' ? '' : ' sow-tab-hidden'}`}>
                            <div className="doc-h2">3. Timeline</div>
                            <ul className="doc-list">
                              {milestones
                                .filter((m) => m.label.trim())
                                .map((m) => (
                                  <li key={m.id}>
                                    {m.label}
                                    {m.week ? ` — ${m.week}` : ''}
                                  </li>
                                ))}
                            </ul>
                            {(startDate || deliveryDate) && (
                              <p className="doc-p">
                                {startDate && `Start: ${formatDateLong(startDate)}`}
                                {startDate && deliveryDate && ' · '}
                                {deliveryDate && `Expected Delivery: ${formatDateLong(deliveryDate)}`}
                              </p>
                            )}
                          </div>

                          <div className={`sow-tab-panel${activeTab === 'payment' ? '' : ' sow-tab-hidden'}`}>
                            <div className="doc-h2">4. Payment Terms</div>
                            <p className="doc-p">{buildPaymentTerms()}</p>
                            <p className="doc-p">{revisionPolicy}</p>
                          </div>

                          <div className={`sow-tab-panel${activeTab === 'terms' ? '' : ' sow-tab-hidden'}`}>
                            <div className="doc-h2">5. Terms &amp; Conditions</div>
                            <p className="doc-p" style={{ whiteSpace: 'pre-wrap' }}>
                              {terms}
                            </p>
                            {documentUrl && (
                              <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="sow-doc-link">
                                View attached document ↗
                              </a>
                            )}
                          </div>

                          <div className={`sow-tab-panel${activeTab === 'signatures' ? '' : ' sow-tab-hidden'}`}>
                            <div className="doc-h2">Agreement &amp; Signatures</div>
                            <div className="sig-block-grid">
                              <div className="sig-block">
                                <div className="sig-block-label">Client</div>
                                <div className="sig-block-name">{client?.primary_contact}</div>
                                <div className="sig-block-sub">{client?.company_name}</div>
                                {selected.status === 'signed' ? (
                                  <>
                                    {selected.signature_image_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img className="sig-block-image" src={driveThumbnailUrl(selected.signature_image_url)} alt={`${selected.signed_by_name} signature`} />
                                    ) : (
                                      <div className="sig-block-typed">{selected.signed_by_name}</div>
                                    )}
                                    <div className="sig-block-caption">{selected.signature_method === 'drawn' ? 'Drawn Signature' : selected.signature_method === 'uploaded' ? 'Uploaded Signature' : 'Typed Signature'}</div>
                                    <div className="sig-block-meta">Signed on {selected.signed_at ? formatBnDateLong(selected.signed_at) : ''}</div>
                                  </>
                                ) : (
                                  <div className="sig-block-pending">Awaiting Signature</div>
                                )}
                              </div>
                              <div className="sig-block">
                                <div className="sig-block-label">Agency</div>
                                <div className="sig-block-name">{selected.agency_signer_name ?? manager?.full_name ?? 'FLOW 53'}</div>
                                <div className="sig-block-sub">{manager?.role ?? 'Project Manager'} · FLOW 53</div>
                                {selected.agency_signed_at ? (
                                  <>
                                    {selected.agency_signature_image_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img className="sig-block-image" src={driveThumbnailUrl(selected.agency_signature_image_url)} alt={`${selected.agency_signer_name} signature`} />
                                    ) : (
                                      <div className="sig-block-typed">{selected.agency_signer_name}</div>
                                    )}
                                    <div className="sig-block-caption">{selected.agency_signature_method === 'drawn' ? 'Drawn Signature' : selected.agency_signature_method === 'uploaded' ? 'Uploaded Signature' : 'Typed Signature'}</div>
                                    <div className="sig-block-meta">Signed on {formatBnDateLong(selected.agency_signed_at)}</div>
                                  </>
                                ) : (
                                  <div className="sig-block-pending">Pending Agency Signature</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="sig-status-card">
                          <span className="dcard-title">Signature Status</span>
                          <div className="sig-track-item">
                            <div className="sig-dot-wrap">
                              <div className={`sig-dot${selected.sent_at ? '' : ' pending'}`}>
                                <Icon name={selected.sent_at ? 'check' : 'edit'} size={12} />
                              </div>
                              <div className="sig-line"></div>
                            </div>
                            <div>
                              <div className="sig-text" style={!selected.sent_at ? { color: 'var(--ink-faint)' } : undefined}>
                                Sent to client
                              </div>
                              <div className="sig-time">{selected.sent_at ? formatBnDateLong(selected.sent_at) : '—'}</div>
                            </div>
                          </div>
                          <div className="sig-track-item">
                            <div className="sig-dot-wrap">
                              <div className={`sig-dot${selected.viewed_at ? '' : ' pending'}`}>
                                <Icon name={selected.viewed_at ? 'eye' : 'edit'} size={12} />
                              </div>
                              <div className="sig-line"></div>
                            </div>
                            <div>
                              <div className="sig-text" style={!selected.viewed_at ? { color: 'var(--ink-faint)' } : undefined}>
                                Viewed by {client?.primary_contact}
                              </div>
                              <div className="sig-time">{selected.viewed_at ? formatBnDateLong(selected.viewed_at) : '—'}</div>
                            </div>
                          </div>
                          <div className="sig-track-item">
                            <div className="sig-dot-wrap">
                              <div className={`sig-dot${selected.signed_at ? '' : ' pending'}`}>
                                <Icon name={selected.signed_at ? 'check' : 'edit'} size={11} />
                              </div>
                            </div>
                            <div>
                              <div className="sig-text" style={!selected.signed_at ? { color: 'var(--ink-faint)' } : undefined}>
                                {selected.signed_at ? `Signed by ${selected.signed_by_name}` : 'Awaiting signature'}
                              </div>
                              <div className="sig-time">{selected.signed_at ? formatBnDateLong(selected.signed_at) : '—'}</div>
                            </div>
                          </div>
                          {selected.status === 'signed' && (
                            <div className="sig-status-meta">
                              <div className="sig-meta-row">
                                <span>Signature Method</span>
                                <span style={{ textTransform: 'capitalize' }}>{selected.signature_method ?? 'Typed'}</span>
                              </div>
                              <div className="sig-meta-row">
                                <span>SOW Version</span>
                                <span>v{selected.version}.0</span>
                              </div>
                              <div className="sig-meta-row">
                                <span>Status</span>
                                <span style={{ color: 'var(--positive)' }}>Signed</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {documents.length > 0 && (
                          <div className="dcard" style={{ marginTop: 14 }}>
                            <span className="dcard-title">Documents</span>
                            <div className="sow-doc-list">
                              {documents.map((d) => (
                                <div className="sow-doc-item" key={d.id}>
                                  <span className="sow-doc-ext">{fileExtension(d.file_name)}</span>
                                  <div className="sow-doc-item-meta">
                                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="sow-doc-item-name">
                                      {d.file_name}
                                    </a>
                                    <span className="sow-doc-item-size">{formatBytes(d.file_size)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="dcard" style={{ marginTop: 14 }}>
                          <span className="dcard-title">Actions</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {!selected.agency_signed_at && selected.status !== 'cancelled' && selected.status !== 'superseded' && (
                              <button className="btn btn-accent btn-block btn-sm" onClick={openAgencySignModal}>
                                <Icon name="edit" size={12} /> Sign as Agency
                              </button>
                            )}
                            {selected.status === 'sent' && (
                              <button className="btn btn-ghost btn-block btn-sm" onClick={() => setShowSendConfirm(true)}>
                                <Icon name="send" size={12} /> Resend to Client
                              </button>
                            )}
                            {selected.status === 'signed' && (
                              <button className="btn btn-ghost btn-block btn-sm" onClick={() => window.print()}>
                                <Icon name="download" size={12} /> Download Signed PDF
                              </button>
                            )}
                            {documentUrl && (
                              <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-block btn-sm">
                                <Icon name="download" size={12} /> View Attached Document
                              </a>
                            )}
                            {selected.status === 'sent' && (
                              <button
                                className="btn btn-ghost btn-block btn-sm"
                                onClick={() => {
                                  setMode('editor');
                                }}
                              >
                                <Icon name="edit" size={12} /> Edit SOW
                              </button>
                            )}
                            {(selected.status === 'sent' || selected.status === 'draft') && (
                              <button className="btn btn-danger-ghost btn-block btn-sm" onClick={() => setShowVoidConfirm(true)}>
                                <Icon name="close" size={12} /> Void SOW
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {showSendConfirm && selected && project && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSendConfirm(false); }}>
          <div className="modal-box">
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700 }}>Send Statement of Work?</h3>
            <div className="sow-confirm-grid">
              <div>
                <span className="field-label">Client</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{client?.primary_contact ?? client?.company_name}</p>
              </div>
              <div>
                <span className="field-label">Project</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{project.name}</p>
              </div>
              <div>
                <span className="field-label">Version</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>v{selected.version}</p>
              </div>
            </div>
            <label className="sow-notify-row" style={{ margin: '16px 0' }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify Client
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSendConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent btn-sm" disabled={sending} onClick={handleConfirmSend}>
                {sending ? 'পাঠানো হচ্ছে…' : 'Send SOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoidConfirm && selected && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowVoidConfirm(false); }}>
          <div className="modal-box">
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>Void this SOW?</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>{client?.primary_contact ?? client?.company_name} will no longer be able to sign v{selected.version}.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowVoidConfirm(false)}>
                Keep SOW
              </button>
              <button type="button" className="btn btn-ghost btn-sm sow-danger-btn" disabled={voiding} onClick={handleConfirmVoid}>
                {voiding ? 'ভয়েড হচ্ছে…' : 'Void SOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAgencySignModal && selected && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !agencySigning) setShowAgencySignModal(false);
          }}
        >
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Sign as Agency</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--ink-soft)' }}>
              Countersign {selected.sow_number ?? `v${selected.version}`} on behalf of FLOW 53.
            </p>

            <div className="field">
              <label className="field-label">Full Name</label>
              <input className="field-input" value={agencyFullName} onChange={(e) => setAgencyFullName(e.target.value)} placeholder="Your full name" />
            </div>

            <div className="agsig-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={agencySigMethod === 'typed'} className={`agsig-tab${agencySigMethod === 'typed' ? ' active' : ''}`} onClick={() => setAgencySigMethod('typed')}>
                Type
              </button>
              <button type="button" role="tab" aria-selected={agencySigMethod === 'drawn'} className={`agsig-tab${agencySigMethod === 'drawn' ? ' active' : ''}`} onClick={() => setAgencySigMethod('drawn')}>
                Draw
              </button>
              <button type="button" role="tab" aria-selected={agencySigMethod === 'uploaded'} className={`agsig-tab${agencySigMethod === 'uploaded' ? ' active' : ''}`} onClick={() => setAgencySigMethod('uploaded')}>
                Upload
              </button>
            </div>

            {agencySigMethod === 'typed' && (
              <div className="agsig-interface">
                <div className="agsig-typed-preview">{agencyFullName.trim() || 'Your Signature'}</div>
                <div className="agsig-caption">Typed Signature — a visual representation only.</div>
              </div>
            )}

            {agencySigMethod === 'drawn' && (
              <div className="agsig-interface">
                <canvas
                  ref={agencyCanvasRef}
                  className="agsig-canvas"
                  onPointerDown={handleAgencyPointerDown}
                  onPointerMove={handleAgencyPointerMove}
                  onPointerUp={handleAgencyPointerUp}
                  onPointerLeave={handleAgencyPointerUp}
                  aria-label="Signature drawing area"
                />
                <div className="agsig-canvas-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={undoAgencyStroke} disabled={agencyStrokeCount === 0}>
                    Undo
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={clearAgencyCanvas} disabled={agencyStrokeCount === 0}>
                    Clear
                  </button>
                </div>
              </div>
            )}

            {agencySigMethod === 'uploaded' && (
              <div className="agsig-interface">
                {agencyUploadError && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12 }}>{agencyUploadError}</div>}
                {agencyUploadedUrl ? (
                  <div className="agsig-upload-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={driveThumbnailUrl(agencyUploadedUrl)} alt="Uploaded signature" />
                    <div className="agsig-canvas-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => agencyFileInputRef.current?.click()}>
                        Replace
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAgencyUploadedUrl(null)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => agencyFileInputRef.current?.click()} disabled={agencyUploading}>
                    {agencyUploading ? 'আপলোড হচ্ছে…' : 'Upload Signature'}
                  </button>
                )}
                <input ref={agencyFileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleAgencyUploadFile} />
                <div className="agsig-caption">PNG or JPG, up to 5MB.</div>
              </div>
            )}

            {agencySignError && <div style={{ margin: '10px 0 0', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12 }}>{agencySignError}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={agencySigning} onClick={() => setShowAgencySignModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-accent btn-sm" disabled={!canAgencySign} onClick={handleAgencySignSubmit}>
                {agencySigning ? 'সাইন হচ্ছে…' : 'Sign & Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
