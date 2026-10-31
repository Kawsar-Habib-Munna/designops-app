'use client';

// Screen 5 — Client Dashboard ("Overview")। v2: প্রজেক্ট তৈরির আগে পূর্বের
// onboarding-status ভিউই থাকে (অপরিবর্তিত), কিন্তু প্রজেক্ট তৈরি হয়ে গেলে এখন আর
// Screen 9 ("My Project")-এ রিডাইরেক্ট করে না — বরং এই একই রুটে একটা সংক্ষিপ্ত,
// কনসোলিডেটেড "Overview" ড্যাশবোর্ড দেখায় (Project Journey/Agreement & Payment/
// Upcoming/Messages/Files/Manager প্রিভিউ), আর "My Project" এখন সাইডবারে আলাদা
// রিয়েল নেভ আইটেম হিসেবে বিস্তারিত পেজে (Screen 9) নিয়ে যায় — দুটো ইচ্ছাকৃতভাবে
// আলাদা: Overview = at-a-glance সারাংশ, My Project = পূর্ণ বিস্তারিত।
//
// ডেটা লজিক পুরোপুরি Screen 9-এর query প্যাটার্ন রিইউজ করে (project/milestones/
// files/invoices/sow/messages/updates/approvals) — নতুন কোনো ডুপ্লিকেট সোর্স না।
// "Upcoming" শুধু real milestone due dates + real pending payment due dates থেকে
// — কোনো fabricated "feedback requested" আইটেম নেই (Screen 9-এর মতোই, schema-তে
// সেই ট্রিগারের কোনো real সোর্স নেই)।
//
// সব স্টেট real ডেটা থেকে ডেরাইভ করা:
// - Checklist প্রতিটা আইটেম আসল কলামের presence থেকে (files শুধু সত্যিই থাকলে ✓)
// - "Action Required" স্টেট real: clients.admin_request (এডমিন Screen 7 থেকে সেট করে)
// - Recent Activity বিদ্যমান activity_log টেবিল থেকে (entity_type='client')

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';
import { relativeTime, formatDate, formatDateLong, todayISO } from '@/lib/format';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import '../client-shared.css';
import ClientBottomNav from '@/app/components/ClientBottomNav';
import AvatarImage from '@/app/components/AvatarImage';
import './dashboard.css';
import './dashboard-v2.css';

const WHATSAPP_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20a%20client%20and%20I%27d%20like%20to%20get%20in%20touch%20about%20my%20project.';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  paperclip: '<path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.42 17.4a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78"/>',
  arrow: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  calendarcheck: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  chats: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

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
  created_at: string;
};

type ActivityRow = { id: string; action: string; detail: string | null; created_at: string };

type PendingFile = {
  key: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const NAV_ITEMS = [
  { icon: 'folder', label: 'My Project', tag: 'Awaiting' },
  { icon: 'message', label: 'Messages', tag: 'Unavailable' },
  { icon: 'file', label: 'Files', tag: 'Unavailable' },
  { icon: 'doc', label: 'SOW', tag: 'Unavailable' },
  { icon: 'card', label: 'Payments', tag: 'Unavailable' },
];

// ---- project-overview (has-project state) — data model reused from Screen 9 ----
type ManagerBrief = { full_name: string; avatar_url: string | null; role: string | null } | null;
type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  category: string | null;
  start_date: string | null;
  due_date: string | null;
  client_id: string;
  budget: number | null;
  final_delivery_status: string | null;
  created_at: string;
  project_manager: ManagerBrief | ManagerBrief[] | null;
};
type Milestone = { id: string; title: string; due_date: string | null; completed_at: string | null; position: number };
type ProjectFile = { id: string; name: string; file_type: string | null; size_bytes: number | null; drive_url: string; created_at: string };
type InvoiceBrief = { id: string; payment_type: string; amount: number; currency: string; due_date: string | null; status: string };
type SowBrief = { id: string; sow_number: string | null; status: string; version: number; currency: string | null; sent_at: string | null; signed_at: string | null };
type MessageBrief = { id: string; sender: string; message: string | null; created_at: string; read_at: string | null };
type UpdateBrief = { id: string; title: string; created_at: string };
type ApprovalBrief = { id: string; item: string; status: string; comment: string | null; created_at: string };

const APPROVAL_STATUS_LABEL: Record<string, string> = { awaiting: 'Awaiting Approval', approved: 'Approved ✓', changes_requested: 'Changes Requested' };
const APPROVAL_STATUS_BADGE: Record<string, string> = { awaiting: 'cp-badge-pending', approved: 'cp-badge-success', changes_requested: 'cp-badge-pending' };

const PROJECT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'b-active' },
  review: { label: 'In Review', cls: 'b-review' },
  on_hold: { label: 'On Hold', cls: 'b-action' },
  planning: { label: 'Planning', cls: 'b-review' },
  completed: { label: 'Completed', cls: 'b-done' },
};

// progress ring: a grey track with a coloured arc, drawn from the top
function Ring({ pct, size, stroke, color }: { pct: number; size: number; stroke: number; color: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dx-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
function humanizeType(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type PendingAction = { key: string; label: string; title: string; desc: string; ctaLabel: string; href: string; moreCount?: number };

function resolvePendingAction(project: ProjectDetail, sow: SowBrief | null, invoices: InvoiceBrief[], approvals: ApprovalBrief[]): PendingAction | null {
  if (sow && sow.status === 'sent') {
    return { key: 'sow', label: 'Action Required', title: 'Review & Sign Your SOW', desc: 'Your project agreement is ready for review.', ctaLabel: 'Review & Sign', href: `/client/project/${project.id}/sow` };
  }
  const pendingInvoices = invoices.filter((i) => i.status === 'pending');
  if (pendingInvoices.length > 0) {
    const inv = pendingInvoices[0];
    return {
      key: 'payment',
      label: 'Payment Required',
      title: 'Your initial project payment is ready.',
      desc: `${inv.currency} ${inv.amount.toLocaleString('en-US')}${inv.due_date ? ` due ${formatDate(inv.due_date)}` : ''}`,
      ctaLabel: 'View Payment',
      href: `/client/project/${project.id}/payments`,
      moreCount: pendingInvoices.length > 1 ? pendingInvoices.length - 1 : undefined,
    };
  }
  const awaitingApprovals = approvals.filter((a) => a.status === 'awaiting');
  if (awaitingApprovals.length > 0) {
    return {
      key: 'approval',
      label: 'Approval Required',
      title: 'Review & Approve',
      desc: `Please review and approve "${awaitingApprovals[0].item}".`,
      ctaLabel: 'Review & Approve',
      href: `/client/project/${project.id}/approvals`,
      moreCount: awaitingApprovals.length > 1 ? awaitingApprovals.length - 1 : undefined,
    };
  }
  if (project.final_delivery_status === 'ready') {
    return { key: 'delivery', label: 'Final Review Required', title: 'Final Review Required', desc: 'Your final project files are ready for review.', ctaLabel: 'Review Final Delivery', href: `/client/project/${project.id}/final-delivery` };
  }
  return null;
}

export default function ClientDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [filesCount, setFilesCount] = useState(0);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // ---- has-project overview state ----
  const [hasProject, setHasProject] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [invoices, setInvoices] = useState<InvoiceBrief[]>([]);
  const [sow, setSow] = useState<SowBrief | null>(null);
  const [messages, setMessages] = useState<MessageBrief[]>([]);
  const [updates, setUpdates] = useState<UpdateBrief[]>([]);
  const [approvals, setApprovals] = useState<ApprovalBrief[]>([]);
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);
  const [respondingApprovalId, setRespondingApprovalId] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [nowIso, setNowIso] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }

        const { data: req } = await supabase
          .from('client_requirements')
          .select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes, created_at')
          .eq('client_id', own.id)
          .maybeSingle();

        if (!req) {
          router.replace('/client/onboarding');
          return;
        }

        setClient(own);
        setRequirements(req as Requirements);
        setNowIso(new Date().toISOString());

        const { data: projectRows } = await supabase.from('projects').select('id').eq('client_id', own.id).order('created_at', { ascending: false }).limit(1);
        if (projectRows && projectRows.length > 0) {
          const projectId = projectRows[0].id;
          const [projectRes, milestonesRes, filesRes, invoicesRes, sowRes, messagesRes, updatesRes, approvalsRes] = await Promise.all([
            supabase
              .from('projects')
              .select('id, name, status, progress, category, start_date, due_date, client_id, budget, final_delivery_status, created_at, project_manager:profiles!project_manager_id(full_name, avatar_url, role)')
              .eq('id', projectId)
              .maybeSingle(),
            supabase.from('milestones').select('id, title, due_date, completed_at, position').eq('project_id', projectId).order('position'),
            supabase.from('client_files').select('id, name, file_type, size_bytes, drive_url, created_at').eq('client_id', own.id).order('created_at', { ascending: false }).limit(4),
            supabase.from('invoices').select('id, payment_type, amount, currency, due_date, status').eq('project_id', projectId).order('due_date'),
            supabase.from('sows').select('id, sow_number, status, version, currency, sent_at, signed_at').eq('project_id', projectId).order('version', { ascending: false }).limit(1),
            supabase.from('client_messages').select('id, sender, message, created_at, read_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
            supabase.from('project_updates').select('id, title, created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(4),
            supabase.from('client_approvals').select('id, item, status, comment, created_at').eq('project_id', projectId),
          ]);

          if (projectRes.data) {
            setHasProject(true);
            setProject(projectRes.data as unknown as ProjectDetail);
            setMilestones((milestonesRes.data as Milestone[]) ?? []);
            setProjectFiles((filesRes.data as ProjectFile[]) ?? []);
            setInvoices((invoicesRes.data as InvoiceBrief[]) ?? []);
            const sowRow = (sowRes.data?.[0] as SowBrief) ?? null;
            setSow(sowRow && sowRow.status === 'draft' ? null : sowRow);
            setMessages((messagesRes.data as MessageBrief[]) ?? []);
            setUpdates((updatesRes.data as UpdateBrief[]) ?? []);
            setApprovals((approvalsRes.data as ApprovalBrief[]) ?? []);
            setLoading(false);
            return;
          }
        }

        const [filesRes, activityRes] = await Promise.all([
          supabase.from('client_files').select('id', { count: 'exact', head: true }).eq('client_id', own.id),
          supabase.from('activity_log').select('id, action, detail, created_at').eq('entity_type', 'client').eq('entity_id', own.id).order('created_at', { ascending: false }).limit(8),
        ]);

        setFilesCount(filesRes.count ?? 0);
        setActivity((activityRes.data as ActivityRow[]) ?? []);
        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router, reloadKey]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  async function handleApproveItem(id: string) {
    await supabase.from('client_approvals').update({ status: 'approved', responded_at: new Date().toISOString() }).eq('id', id);
    setReloadKey((k) => k + 1);
  }

  async function handleRequestApprovalChanges(e: FormEvent, id: string) {
    e.preventDefault();
    setSubmittingApproval(true);
    await supabase.from('client_approvals').update({ status: 'changes_requested', comment: approvalComment.trim() || null, responded_at: new Date().toISOString() }).eq('id', id);
    setSubmittingApproval(false);
    setRespondingApprovalId(null);
    setApprovalComment('');
    setReloadKey((k) => k + 1);
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0 || !client) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      router.replace('/client/sign-in');
      return;
    }

    for (const file of selected) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setFiles((prev) => [...prev, { key, file, progress: 0, status: 'uploading' }]);

      uploadFileToDrive(file, accessToken, (pct) => {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, progress: pct } : f)));
      })
        .then(async (result) => {
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'done', progress: 100 } : f)));
          await supabase.from('client_files').insert({
            client_id: client.id,
            name: file.name,
            file_type: guessFileType(file),
            size_bytes: file.size,
            drive_url: result.webViewLink,
            category: 'other',
            uploaded_by: 'client',
          });
          setSavedCount((n) => n + 1);
          setFilesCount((n) => n + 1);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Upload failed.';
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error', error: message } : f)));
        });
    }
  }

  if (loading || (!client && !loadError)) {
    return (
      <div className="client-portal client-dashboard-root">
        <div className="cp-loading-shell">Loading…</div>
      </div>
    );
  }

  if (loadError || !client || !requirements) {
    return (
      <div className="client-portal client-dashboard-root">
        <div className="state-view">
          <div className="state-icon err">
            <Icon name="alert" size={20} />
          </div>
          <div className="state-title">We couldn&apos;t load your dashboard</div>
          <div className="state-sub">Please try again in a moment.</div>
          <div className="state-actions">
            <button
              type="button"
              className="cp-btn cp-btn-primary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <Icon name="refresh" size={13} /> Try Again
            </button>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-secondary">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (hasProject && project) {
    const manager = toOne(project.project_manager);
    const statusMeta = PROJECT_STATUS_LABEL[project.status] ?? { label: project.status, cls: 'b-review' };
    const isCompleted = project.status === 'completed';
    const progressPct = isCompleted ? 100 : (project.progress ?? 0);
    const currentMilestone = milestones.find((m) => !m.completed_at) ?? null;
    const pendingAction = !isCompleted ? resolvePendingAction(project, sow, invoices, approvals) : null;
    const unreadFromTeam = messages.filter((m) => m.sender === 'team' && !m.read_at).length;
    const latestMessage = messages[0] ?? null;

    const currency = sow?.currency ?? 'BDT';
    const sym = CURRENCY_SYMBOL[currency] ?? currency;
    const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
    const remaining = project.budget != null ? Math.max(0, project.budget - totalPaid) : null;
    const paymentPct = project.budget && project.budget > 0 ? Math.min(100, Math.round((totalPaid / project.budget) * 100)) : 0;

    const now = nowIso ? new Date(nowIso) : null;
    const hour = now ? now.getHours() : 9;
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const dateLabel = now ? now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const phasePct = milestones.length > 0 ? Math.round((milestones.filter((m) => m.completed_at).length / milestones.length) * 100) : progressPct;
    const sowDone = sow?.status === 'signed';
    const sowSteps = sowDone ? 3 : sow ? 2 : 0;
    const nextInvoice = invoices.find((i) => i.status === 'pending') ?? null;
    const daysLeft = project.due_date && now ? Math.ceil((new Date(project.due_date).getTime() - now.getTime()) / 86400000) : null;
    const firstName = (client.primary_contact ?? client.company_name).split(' ')[0];

    type UpcomingItem = { key: string; sortKey: string; day: string; month: string; title: string; sub: string; icon: string };
    const upcomingItems: UpcomingItem[] = [];
    const today = todayISO();
    milestones
      .filter((m) => !m.completed_at && m.due_date && m.due_date >= today)
      .forEach((m) => {
        const d = new Date(m.due_date!);
        upcomingItems.push({ key: `ms-${m.id}`, sortKey: m.due_date!, day: String(d.getDate()).padStart(2, '0'), month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), title: m.title, sub: 'Project milestone', icon: 'calendar' });
      });
    invoices
      .filter((i) => i.status === 'pending' && i.due_date)
      .forEach((i) => {
        const d = new Date(i.due_date!);
        upcomingItems.push({ key: `inv-${i.id}`, sortKey: i.due_date!, day: String(d.getDate()).padStart(2, '0'), month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), title: humanizeType(i.payment_type), sub: `${i.currency} ${i.amount.toLocaleString('en-US')} due`, icon: 'card' });
      });
    upcomingItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const upcomingTop = upcomingItems.slice(0, 4);

    return (
      <div className="client-portal client-dashboard-root">
        <div className="shell">
          <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
          <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
            <div>
              <div className="cp-brand cp-brand-sidebar">
                <span className="cp-brand-art">
                  <img src="/sidebar-logo.webp" alt="FLOW 53 - Innovate-Design-Elevate" className="cp-brand-logo-combined" />
                </span>
                <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                  <Icon name="close" size={16} />
                </button>
              </div>
              <nav className="nav-group">
                <Link href="/client/dashboard" className="nav-item active">
                  <Icon name="grid" /> Overview
                </Link>
                <Link href={`/client/project/${project.id}`} className="nav-item">
                  <Icon name="folder" /> My Project
                </Link>
                <Link href={`/client/project/${project.id}/messages`} className="nav-item">
                  <Icon name="message" /> Messages
                  {unreadFromTeam > 0 && <span className="nav-tag nav-tag-accent">{unreadFromTeam}</span>}
                </Link>
                <Link href={`/client/project/${project.id}/files`} className="nav-item">
                  <Icon name="file" /> Files
                </Link>
                <Link href={`/client/project/${project.id}/sow`} className="nav-item">
                  <Icon name="doc" /> SOW
                </Link>
                <Link href={`/client/project/${project.id}/payments`} className="nav-item">
                  <Icon name="card" /> Payments
                </Link>
              </nav>
            </div>
          </aside>

          <div className="main">
            <header className="topbar">
              <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
                <Icon name="menu" />
              </button>
              <span className="topbar-title">Overview</span>
                          <button type="button" className="topbar-avatar" aria-label="Sign out" onClick={() => { if (window.confirm('Sign out of your account?')) (handleSignOut)(); }}>
                {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
              </button>
</header>

            <header className="page-topbar">
              <div className="breadcrumb">Client Portal / Overview</div>
              <a className="page-help-link" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Icon name="help" size={13} /> Need help?
              </a>
            <button type="button" className="profile-card topbar-profile" onClick={handleSignOut} title="Sign out">
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
              </div>
              <div className="profile-meta">
                <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
                <div className="profile-role">{client.company_name}</div>
              </div>
            </button>
</header>

            <main className="content">
              <div className="dx">
                {/* ---- hero: greeting, project, overall progress ---- */}
                <section className="dx-hero">
                  <div className="dx-hero-text">
                    {dateLabel && <div className="dx-eyebrow">{dateLabel}</div>}
                    <h1 className="dx-title">
                      {greeting}, {firstName}
                    </h1>
                    <p className="dx-sub">Here&apos;s where your project stands today.</p>
                    <div className="dx-hero-project">
                      <span className="dx-hero-project-name">{project.name}</span>
                      <span className={`status-badge ${statusMeta.cls}`}>
                        <span className="dot"></span>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="dx-hero-actions">
                      <Link href={`/client/project/${project.id}`} className="btn btn-accent">
                        View project
                      </Link>
                      <Link href={`/client/project/${project.id}/messages`} className="btn btn-ghost">
                        <Icon name="message" size={13} /> Message team
                      </Link>
                    </div>
                  </div>
                  <div className="dx-hero-progress">
                    <div className="dx-hero-ring">
                      <Ring pct={progressPct} size={132} stroke={11} color="var(--accent)" />
                      <div className="dx-ring-center">
                        <strong>{progressPct}%</strong>
                        <span>complete</span>
                      </div>
                    </div>
                    <ul className="dx-hero-stats">
                      <li>
                        <span className="dx-hero-stat-label">Phases done</span>
                        <strong>{milestones.length > 0 ? `${milestones.filter((m) => m.completed_at).length} of ${milestones.length}` : '—'}</strong>
                      </li>
                      <li>
                        <span className="dx-hero-stat-label">Time left</span>
                        <strong>{isCompleted ? 'Delivered' : daysLeft == null ? '—' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</strong>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* ---- updates ---- */}
                <section className="dx-card">
                  <div className="dx-card-head">
                    <h2 className="dx-card-title">Recent updates</h2>
                    {updates.length > 0 && (
                      <Link href={`/client/project/${project.id}/updates`} className="dx-link">View all</Link>
                    )}
                  </div>
                  {updates.length === 0 ? (
                    <p className="dx-empty">Your project updates will appear here as work progresses.</p>
                  ) : (
                    <ul className="dx-list">
                      {updates.map((u) => (
                        <li className="dx-row" key={u.id}>
                          <span className="dx-row-icon"><Icon name="check" size={12} /></span>
                          <span className="dx-row-body">
                            <span className="dx-row-title">{u.title}</span>
                            <span className="dx-row-sub">{relativeTime(u.created_at)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* ---- the one thing that needs the client ---- */}
                {!isCompleted && pendingAction && (
                  <section className="dx-action">
                    <div className="dx-action-icon">
                      <Icon name={pendingAction.key === 'payment' ? 'card' : pendingAction.key === 'approval' ? 'check' : 'doc'} size={20} />
                    </div>
                    <div className="dx-action-body">
                      <span className="dx-action-label">{pendingAction.label}</span>
                      <div className="dx-action-title">{pendingAction.title}</div>
                      <p className="dx-action-desc">
                        {pendingAction.desc}
                        {pendingAction.key === 'sow' && sow?.sow_number ? ` · ${sow.sow_number} v${sow.version}.0` : ''}
                      </p>
                    </div>
                    <div className="dx-action-cta">
                      {pendingAction.key === 'approval' ? (
                        <button type="button" className="btn btn-accent" onClick={() => setApprovalsModalOpen(true)}>
                          {pendingAction.ctaLabel}
                        </button>
                      ) : (
                        <Link href={pendingAction.href} className="btn btn-accent">
                          {pendingAction.ctaLabel}
                        </Link>
                      )}
                      {pendingAction.moreCount && <span className="dx-action-more">+{pendingAction.moreCount} more</span>}
                    </div>
                  </section>
                )}

                {/* ---- key numbers ---- */}
                <section className="dx-kpis">
                  <Link href={`/client/project/${project.id}`} className="dx-kpi">
                    <span className="dx-kpi-top">
                      <span className="dx-kpi-icon dx-tone-accent"><Icon name="flag" size={20} /></span>
                      <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                      <span className="dx-kpi-mini" aria-hidden="true">
                      <Ring pct={phasePct} size={46} stroke={5} color="var(--accent)" />
                      <span className="dx-kpi-mini-num">{phasePct}%</span>
                    </span>
                    </span>
                    <span className="dx-kpi-label">Current phase</span>
                    <strong className="dx-kpi-value dx-kpi-text">{currentMilestone?.title ?? (isCompleted ? 'Completed' : 'Getting started')}</strong>
                    <span className="dx-kpi-sub">{milestones.length > 0 ? `${milestones.filter((m) => m.completed_at).length} of ${milestones.length} phases done` : 'Phases coming soon'}</span>
                  </Link>
                  <Link href={`/client/project/${project.id}`} className="dx-kpi">
                    <span className="dx-kpi-top">
                      <span className="dx-kpi-icon dx-tone-blue"><Icon name="calendarcheck" size={20} /></span>
                      <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                    </span>
                    <span className="dx-kpi-label">Expected delivery</span>
                    <strong className="dx-kpi-value">{formatDate(project.due_date) || '—'}</strong>
                    <span className={`dx-kpi-sub${daysLeft != null && daysLeft < 0 && !isCompleted ? ' dx-warn' : ''}`}>
                      {isCompleted ? 'Delivered' : daysLeft == null ? 'Date to be confirmed' : daysLeft < 0 ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                    </span>
                  </Link>
                  <Link href={`/client/project/${project.id}/payments`} className="dx-kpi">
                    <span className="dx-kpi-top">
                      <span className="dx-kpi-icon dx-tone-green"><Icon name="wallet" size={20} /></span>
                      <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                      <span className="dx-kpi-mini" aria-hidden="true">
                      <Ring pct={paymentPct} size={46} stroke={5} color="var(--positive)" />
                      <span className="dx-kpi-mini-num">{paymentPct}%</span>
                    </span>
                    </span>
                    <span className="dx-kpi-label">Paid so far</span>
                    <strong className="dx-kpi-value">{project.budget != null ? `${sym}${totalPaid.toLocaleString('en-US')}` : '—'}</strong>
                    <span className="dx-kpi-sub">{project.budget != null ? `${paymentPct}% of ${sym}${project.budget.toLocaleString('en-US')}` : 'Details coming soon'}</span>
                  </Link>
                  <Link href={`/client/project/${project.id}/messages`} className="dx-kpi">
                    <span className="dx-kpi-top">
                      <span className="dx-kpi-icon dx-tone-amber"><Icon name="chats" size={20} /></span>
                      <span className="dx-kpi-go" aria-hidden="true"><Icon name="arrow" size={14} /></span>
                    </span>
                    <span className="dx-kpi-label">Messages</span>
                    <strong className="dx-kpi-value">{unreadFromTeam > 0 ? `${unreadFromTeam} new` : 'All read'}</strong>
                    <span className="dx-kpi-sub">{latestMessage ? `Last ${relativeTime(latestMessage.created_at)}` : 'No messages yet'}</span>
                  </Link>
                </section>

                {/* ---- upcoming ---- */}
                <section className="dx-card">
                  <div className="dx-card-head">
                    <h2 className="dx-card-title">Coming up</h2>
                  </div>
                  {upcomingTop.length === 0 ? (
                    <p className="dx-empty">Nothing scheduled right now.</p>
                  ) : (
                    <div className="dx-table-wrap">
                      <table className="dx-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>What</th>
                            <th className="dx-col-type">Type</th>
                            <th className="dx-col-due">Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingTop.map((u) => {
                            const diff = Math.round((new Date(u.sortKey).getTime() - new Date(today).getTime()) / 86400000);
                            return (
                              <tr className={diff <= 3 ? 'soon' : ''} key={u.key}>
                                <td className="dx-td-date">
                                  <strong>{Number(u.day)} {u.month.charAt(0) + u.month.slice(1).toLowerCase()}</strong>
                                  <span className="dx-td-weekday">{new Date(u.sortKey).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}</span>
                                </td>
                                <td className="dx-td-title">
                                  {u.title}
                                  <span className="dx-td-sub">{u.sub}</span>
                                </td>
                                <td className="dx-col-type">
                                  <span className="dx-td-type"><Icon name={u.icon} size={12} /> {u.icon === 'card' ? 'Payment' : 'Milestone'}</span>
                                </td>
                                <td className="dx-col-due">
                                  <span className="dx-up-when">{diff <= 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `In ${diff} days`}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <div className="dx-cols">
                  <div className="dx-col">
                    {/* ---- journey ---- */}
                    <section className="dx-card">
                      <div className="dx-card-head">
                        <h2 className="dx-card-title">Project journey</h2>
                        <Link href={`/client/project/${project.id}`} className="dx-link">Details</Link>
                      </div>
                      {milestones.length === 0 ? (
                        <p className="dx-empty">Your project phases will appear here once our team sets them up.</p>
                      ) : (
                        <ol className="dx-journey">
                          {milestones.map((m) => {
                            const isDone = !!m.completed_at;
                            const isCurrent = !isDone && currentMilestone?.id === m.id;
                            return (
                              <li className={`dx-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`} key={m.id}>
                                <span className="dx-step-dot">{isDone ? <Icon name="check" size={11} /> : null}</span>
                                <span className="dx-step-text">
                                  <span className="dx-step-label">{m.title}</span>
                                  <span className="dx-step-sub">{isDone ? `Done ${formatDate(m.completed_at)}` : isCurrent ? 'In progress' : m.due_date ? `Due ${formatDate(m.due_date)}` : 'Upcoming'}</span>
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </section>

                    {/* ---- agreement & payment ---- */}
                    {/* ---- agreement & payment: two focused cards ---- */}
                    <div className="dx-ap2">
                      <section className="dx-card dx-sow">
                        <div className="dx-sow-banner">
                          <div className="dx-sow-banner-text">
                            <h2 className="dx-card-title">Statement of Work</h2>
                          </div>
                          <span className={`dx-sow-state ${sowDone ? 'ok' : sow ? 'wait' : 'idle'}`}>
                            <span className="dx-sow-state-dot" />
                            {sowDone ? 'Signed' : sow ? 'Needs signature' : 'In preparation'}
                          </span>
                        </div>
                        <div className="dx-sow-about">
                          <p className="dx-sow-intro">The agreement that sets out what we will deliver, when, and for how much.</p>
                          <dl className="dx-sow-facts">
                            <div>
                              <dt>SOW number</dt>
                              <dd>{sow?.sow_number ?? '—'}</dd>
                            </div>
                            <div>
                              <dt>Version</dt>
                              <dd>{sow ? `v${sow.version}.0` : '—'}</dd>
                            </div>
                          </dl>
                        </div>
                        <ol className="dx-sow-timeline">
                          <li className={sowSteps > 0 ? 'done' : 'current'}>
                            <span className="dx-sow-dot">{sowSteps > 0 ? <Icon name="check" size={10} /> : null}</span>
                            <span className="dx-sow-step">
                              <strong>Prepared by FLOW 53</strong>
                              <span>{sow ? 'Ready for your review' : 'Our team is writing it'}</span>
                            </span>
                          </li>
                          <li className={sowSteps > 1 ? 'done' : ''}>
                            <span className="dx-sow-dot">{sowSteps > 1 ? <Icon name="check" size={10} /> : null}</span>
                            <span className="dx-sow-step">
                              <strong>Sent to you</strong>
                              <span>{sow?.sent_at ? formatDate(sow.sent_at) : 'Not sent yet'}</span>
                            </span>
                          </li>
                          <li className={sowDone ? 'done' : sowSteps === 2 ? 'current' : ''}>
                            <span className="dx-sow-dot">{sowDone ? <Icon name="check" size={10} /> : null}</span>
                            <span className="dx-sow-step">
                              <strong>Signed by you</strong>
                              <span>{sowDone ? (sow?.signed_at ? formatDate(sow.signed_at) : 'Complete') : sow ? 'Waiting for your signature' : 'After you review it'}</span>
                            </span>
                          </li>
                        </ol>
                        <Link href={`/client/project/${project.id}/sow`} className={`btn btn-sm ${sow && !sowDone ? 'btn-accent' : 'btn-ghost'}`}>
                          {sow && !sowDone ? 'Review & sign' : 'View SOW'}
                        </Link>
                      </section>

                      <section className="dx-card dx-doc">
                        <div className="dx-doc-head">
                          <span className="dx-kpi-icon dx-tone-green"><Icon name="wallet" size={20} /></span>
                          <div>
                            <h2 className="dx-card-title">Payments</h2>
                            <div className="dx-ap-sub">{project.budget != null ? `Project value ${sym}${project.budget.toLocaleString('en-US')}` : 'Details coming soon'}</div>
                          </div>
                        </div>
                        {project.budget != null ? (
                          <>
                            <div className="dx-pay2">
                              <div className="dx-pay-ring">
                                <Ring pct={paymentPct} size={96} stroke={10} color="var(--positive)" />
                                <div className="dx-ring-center dx-ring-small">
                                  <strong>{paymentPct}%</strong>
                                  <span>paid</span>
                                </div>
                              </div>
                              <div className="dx-pay-legend">
                                <div><span className="dx-swatch dx-swatch-green" />Paid<strong>{sym}{totalPaid.toLocaleString('en-US')}</strong></div>
                                <div><span className="dx-swatch dx-swatch-grey" />Remaining<strong>{sym}{(remaining ?? 0).toLocaleString('en-US')}</strong></div>
                              </div>
                            </div>
                            {nextInvoice && (
                              <div className="dx-next-pay">
                                <span className="dx-next-pay-label">Next payment</span>
                                <strong>{nextInvoice.currency === currency ? sym : `${nextInvoice.currency} `}{nextInvoice.amount.toLocaleString('en-US')}</strong>
                                <span>{nextInvoice.due_date ? `due ${formatDate(nextInvoice.due_date)}` : humanizeType(nextInvoice.payment_type)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="dx-empty">Payment details will appear here once available.</p>
                        )}
                        <Link href={`/client/project/${project.id}/payments`} className={`btn btn-sm ${nextInvoice ? 'btn-accent' : 'btn-ghost'}`}>
                          {nextInvoice ? 'View & pay' : 'View payments'}
                        </Link>
                      </section>
                    </div>
                  </div>

                  <div className="dx-col">
                    {/* ---- messages ---- */}
                    <section className="dx-card">
                      <div className="dx-card-head">
                        <h2 className="dx-card-title">
                          Messages {unreadFromTeam > 0 && <span className="dx-chip">{unreadFromTeam} new</span>}
                        </h2>
                        <Link href={`/client/project/${project.id}/messages`} className="dx-link">Open</Link>
                      </div>
                      {latestMessage ? (
                        <div className="dx-msg">
                          <div className="avatar dx-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                            {latestMessage.sender !== 'client' && manager?.avatar_url ? (
                              <AvatarImage src={manager.avatar_url} name={manager.full_name} />
                            ) : (
                              (latestMessage.sender === 'client' ? (client.primary_contact ?? client.company_name) : (manager?.full_name ?? 'F')).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="dx-msg-body">
                            <div className="dx-msg-top">
                              <span className="dx-msg-sender">{latestMessage.sender === 'client' ? 'You' : (manager?.full_name ?? 'FLOW 53 Team')}</span>
                              <span className="dx-row-sub">{relativeTime(latestMessage.created_at)}</span>
                            </div>
                            <div className="dx-msg-text">{latestMessage.message}</div>
                          </div>
                        </div>
                      ) : (
                        <p className="dx-empty">No messages yet. Say hello to your team.</p>
                      )}
                    </section>

                    {/* ---- files ---- */}
                    <section className="dx-card">
                      <div className="dx-card-head">
                        <h2 className="dx-card-title">Recent files</h2>
                        {projectFiles.length > 0 && (
                          <Link href={`/client/project/${project.id}/files`} className="dx-link">View all</Link>
                        )}
                      </div>
                      {projectFiles.length === 0 ? (
                        <p className="dx-empty">No files shared yet.</p>
                      ) : (
                        <ul className="dx-list">
                          {projectFiles.map((f) => (
                            <li className="dx-row" key={f.id}>
                              <span className={`dx-row-icon${f.file_type === 'pdf' ? ' pdf' : f.file_type === 'image' ? ' image' : ''}`}><Icon name="file" size={13} /></span>
                              <span className="dx-row-body">
                                <span className="dx-row-title">{f.name}</span>
                                <span className="dx-row-sub">{(f.file_type ?? 'file').toUpperCase()} · {formatBytes(f.size_bytes ?? 0)} · {formatDate(f.created_at)}</span>
                              </span>
                              <a href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="dx-icon-btn" aria-label={`Open ${f.name}`}>
                                <Icon name="download" size={14} />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {/* ---- manager ---- */}
                    <section className="dx-card">
                      <div className="dx-card-head">
                        <h2 className="dx-card-title">Your project manager</h2>
                      </div>
                      {manager ? (
                        <div className="dx-manager">
                          <div className="avatar dx-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
                            {manager.avatar_url ? (
                              <AvatarImage src={manager.avatar_url} name={manager.full_name} />
                            ) : (
                              manager.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="dx-manager-body">
                            <div className="dx-row-title">{manager.full_name}</div>
                            <div className="dx-row-sub">{manager.role ?? 'Project Manager'}</div>
                          </div>
                          <Link href={`/client/project/${project.id}/messages`} className="btn btn-accent btn-sm">
                            <Icon name="send" size={12} /> Message
                          </Link>
                        </div>
                      ) : (
                        <p className="dx-empty">No project manager assigned yet.</p>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <ClientBottomNav projectId={project.id} active="overview" unread={unreadFromTeam} />

        {approvalsModalOpen && (
          <div className="cp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setApprovalsModalOpen(false); setRespondingApprovalId(null); } }}>
            <div className="cp-modal-box">
              <div className="cp-modal-head">
                <span className="cp-modal-title">Approvals</span>
                <button type="button" className="cp-modal-close" aria-label="Close" onClick={() => { setApprovalsModalOpen(false); setRespondingApprovalId(null); }}>
                  <Icon name="close" size={16} />
                </button>
              </div>

              {approvals.length === 0 ? (
                <div className="cp-dash-card">
                  <p className="cp-page-empty">No approval requests.</p>
                </div>
              ) : (
                <div className="cp-item-list">
                  {approvals.map((a) => (
                    <div className="cp-dash-card" key={a.id}>
                      <div className="cp-item-top">
                        <div>
                          <span className="cp-item-title">{a.item}</span>
                          <div className="cp-item-meta">{relativeTime(a.created_at)}</div>
                        </div>
                        <span className={`cp-badge ${APPROVAL_STATUS_BADGE[a.status] ?? 'cp-badge-pending'}`}>{APPROVAL_STATUS_LABEL[a.status] ?? a.status}</span>
                      </div>
                      {a.comment && <p className="cp-item-desc">{a.comment}</p>}

                      {a.status === 'awaiting' &&
                        (respondingApprovalId === a.id ? (
                          <form onSubmit={(e) => handleRequestApprovalChanges(e, a.id)} style={{ marginTop: 10 }}>
                            <div className="cp-field">
                              <label className="cp-label">What needs to change?</label>
                              <textarea className="cp-input" value={approvalComment} onChange={(e) => setApprovalComment(e.target.value)} required autoFocus />
                            </div>
                            <div className="cp-item-actions">
                              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setRespondingApprovalId(null)}>
                                Cancel
                              </button>
                              <button type="submit" className="cp-btn cp-btn-primary" disabled={submittingApproval}>
                                {submittingApproval ? 'Sending…' : 'Submit'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="cp-item-actions">
                            <button className="cp-btn cp-btn-primary" onClick={() => handleApproveItem(a.id)}>
                              Approve
                            </button>
                            <button className="cp-btn cp-btn-secondary" onClick={() => setRespondingApprovalId(a.id)}>
                              Request Changes
                            </button>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const hasActionRequired = !!client.admin_request;
  const checklist = [
    { label: 'Account created', done: true },
    { label: 'Personal information', done: !!client.primary_contact },
    { label: 'Company information', done: !!client.company_name },
    { label: 'Project requirements', done: true },
    { label: 'Files received', done: filesCount > 0 },
  ];

  return (
    <div className="client-portal client-dashboard-root">
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <div>
            <div className="cp-brand cp-brand-sidebar">
              <span className="cp-brand-art">
                <img src="/sidebar-logo.webp" alt="FLOW 53 - Innovate-Design-Elevate" className="cp-brand-logo-combined" />
              </span>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="nav-group">
              <span className="nav-item active">
                <Icon name="grid" /> Overview
              </span>
              {NAV_ITEMS.map((item) => (
                <span className="nav-item disabled" key={item.label} title="Available once your project is created">
                  <Icon name={item.icon} /> {item.label} <span className="nav-tag">{item.tag}</span>
                </span>
              ))}
            </nav>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">Client Portal</span>
                      <button type="button" className="topbar-avatar" aria-label="Sign out" onClick={() => { if (window.confirm('Sign out of your account?')) (handleSignOut)(); }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </button>
</header>

          <header className="page-topbar">
            <div className="breadcrumb">Client Portal</div>
            <a className="page-help-link" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="help" size={13} /> Need help?
            </a>
          <button type="button" className="profile-card topbar-profile" onClick={handleSignOut} title="Sign out">
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </div>
            <div className="profile-meta">
              <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
              <div className="profile-role">{client.company_name}</div>
            </div>
          </button>
</header>

          <main className="content">
            <h1 className="welcome-title">Welcome, {client.primary_contact ?? client.company_name} 👋</h1>
            <p className="welcome-sub">
              {hasActionRequired
                ? "We need a bit more information from you before we can move forward with your project."
                : 'Thanks for sharing your project details. Our team is reviewing your information and will create your project shortly.'}
            </p>

            <section className="block">
              <div className="status-card">
                <div className="status-top">
                  <span className="status-title">{hasActionRequired ? 'We need a little more information' : 'Your information has been received'}</span>
                  <span className={`status-badge ${hasActionRequired ? 'b-action' : 'b-review'}`}>
                    <span className="dot"></span>
                    {hasActionRequired ? 'Action Required' : 'Under Review'}
                  </span>
                </div>
                <p className="status-desc">
                  {hasActionRequired
                    ? 'Our team needs some additional information before your project can be created.'
                    : "Our team has received your information, project requirements and uploaded files. We're currently reviewing everything before creating your official project."}
                </p>
                <div className="checklist-row">
                  {checklist.map((c) => (
                    <span className="checklist-item" key={c.label} style={{ opacity: c.done ? 1 : 0.5 }}>
                      <span className="checklist-check">{c.done ? <Icon name="check" size={10} /> : ''}</span>
                      {c.label}
                    </span>
                  ))}
                </div>

                {hasActionRequired && (
                  <div className="admin-request-box show">
                    <div className="admin-request-label">Message from FLOW 53</div>
                    <div className="admin-request-text">&quot;{client.admin_request}&quot;</div>
                  </div>
                )}

                {hasActionRequired && (
                  <div className="status-action-row show">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                      Provide Information
                    </a>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                      Send a Message
                    </a>
                  </div>
                )}
              </div>
            </section>

            <section className="block">
              <div className="lifecycle-card">
                <div className="lc-label">Your Progress</div>
                <div className="lc-row">
                  <div className="lc-step done">
                    <div className="lc-line"></div>
                    <div className="lc-dot">✓</div>
                    <div className="lc-step-label">Account</div>
                  </div>
                  <div className="lc-step done">
                    <div className="lc-line"></div>
                    <div className="lc-dot">✓</div>
                    <div className="lc-step-label">Information</div>
                  </div>
                  <div className="lc-step done">
                    <div className="lc-line"></div>
                    <div className="lc-dot">✓</div>
                    <div className="lc-step-label">Requirements</div>
                  </div>
                  <div className="lc-step current">
                    <div className="lc-line"></div>
                    <div className="lc-dot">●</div>
                    <div className="lc-step-label">Agency Review</div>
                  </div>
                  <div className="lc-step">
                    <div className="lc-dot">○</div>
                    <div className="lc-step-label">Project Creation</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="block">
              <div className="project-empty-card">
                <span className={`pe-badge${hasActionRequired ? ' pe-badge-action' : ''}`}>
                  <span className="dot"></span>
                  {hasActionRequired ? 'Action Required' : 'Waiting for Agency Review'}
                </span>
                <div className="pe-icon-wrap">
                  <Icon name="grid" size={26} />
                </div>
                <div className="pe-title">Your project is being prepared</div>
                <p className="pe-desc">Our team is reviewing your requirements. Once your project is created, it will automatically appear here.</p>

                <div className="whats-next">
                  <div className="whats-next-title">What&apos;s next?</div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">1</span>Our team reviews your requirements.
                  </div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">2</span>We create your official project.
                  </div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">3</span>Your project dashboard becomes available.
                  </div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">4</span>You can review the SOW and next project steps.
                  </div>
                </div>

                <div className="pe-actions">
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                    Send a Message
                  </a>
                  <button type="button" className="btn btn-ghost" onClick={() => setUploadOpen((v) => !v)}>
                    Upload Additional Files
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setReviewOpen((v) => !v)}>
                    Review Submitted Information
                  </button>
                </div>
              </div>
            </section>

            {uploadOpen && (
              <section className="block">
                <div className="summary-card">
                  <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => fileInputRef.current?.click()}>
                    + Choose Files
                  </button>
                  {files.length > 0 && (
                    <div className="ob-file-list" style={{ marginTop: 14 }}>
                      {files.map((f) => (
                        <div className="ob-file-row" key={f.key}>
                          <div className="ob-file-info">
                            <span className="ob-file-name">{f.file.name}</span>
                            <span className="ob-file-meta">{formatBytes(f.file.size)}</span>
                          </div>
                          {f.status === 'uploading' && (
                            <div className="ob-file-progress">
                              <div className="ob-file-progress-bar" style={{ width: `${f.progress}%` }} />
                            </div>
                          )}
                          {f.status === 'done' && <span className="cp-badge cp-badge-success">Uploaded</span>}
                          {f.status === 'error' && (
                            <span className="cp-badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                              {f.error ?? 'Failed'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {savedCount > 0 && (
                    <p className="cp-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                      {savedCount} file(s) shared with your project.
                    </p>
                  )}
                </div>
              </section>
            )}

            {reviewOpen && (
              <section className="block">
                <div className="summary-card">
                  {[
                    ['Project Description', requirements.project_description],
                    ['Goals', requirements.goals],
                    ['Target Audience', requirements.target_audience],
                    ['Required Features', requirements.required_features],
                    ['Timeline', requirements.expected_timeline],
                    ['Budget', requirements.budget_range],
                    ['References', requirements.reference_notes],
                  ].map(([label, value]) => (
                    <div className="summary-row" key={label} style={{ alignItems: 'flex-start' }}>
                      <span>{label}</span>
                      <span style={{ textAlign: 'right', fontWeight: 500, maxWidth: '65%' }}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="block content-2col">
              <div>
                <div className="section-title">Submitted Information</div>
                <div className="summary-card">
                  <div className="summary-row">
                    <span>Client</span>
                    <span>{client.primary_contact ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span>Company</span>
                    <span>{client.company_name}</span>
                  </div>
                  <div className="summary-row">
                    <span>Requested Project</span>
                    <span>{requirements.project_name ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span>Project Type</span>
                    <span>{requirements.project_type ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span>Submitted</span>
                    <span>{formatDateLong(requirements.created_at)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Files</span>
                    <span>{filesCount} file{filesCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="section-title">Recent Activity</div>
                <div className="activity-card">
                  {activity.length === 0 ? (
                    <p className="empty-inline">No activity yet.</p>
                  ) : (
                    activity.map((a, i) => (
                      <div className="timeline-item" key={a.id}>
                        <div className="timeline-dot-wrap">
                          <div className="timeline-dot">
                            <Icon name="check" size={9} />
                          </div>
                          {i < activity.length - 1 && <div className="timeline-line"></div>}
                        </div>
                        <div>
                          <div className="timeline-text">{a.detail ?? a.action}</div>
                          <div className="timeline-time">{relativeTime(a.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="block">
              <div className="support-card">
                <div>
                  <div className="support-title">Need help?</div>
                  <div className="support-desc">If you&apos;d like to add more information or have a question while your project is being reviewed, contact our team.</div>
                </div>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  Contact Support
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
      <ClientBottomNav projectId={null} active="overview" />
    </div>
  );
}
