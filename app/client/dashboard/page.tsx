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

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';
import { relativeTimeBn, formatBnDate, formatBnDateLong, todayISO } from '@/lib/format';
import '../client-shared.css';
import './dashboard.css';

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
type ApprovalBrief = { id: string; item: string; status: string };

const PROJECT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'b-active' },
  review: { label: 'In Review', cls: 'b-review' },
  on_hold: { label: 'On Hold', cls: 'b-action' },
  planning: { label: 'Planning', cls: 'b-review' },
  completed: { label: 'Completed', cls: 'b-done' },
};
const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };

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
      desc: `${inv.currency} ${inv.amount.toLocaleString('en-US')}${inv.due_date ? ` due ${formatBnDate(inv.due_date)}` : ''}`,
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
            supabase.from('client_approvals').select('id, item, status').eq('project_id', projectId),
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
          const message = err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।';
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error', error: message } : f)));
        });
    }
  }

  if (loading || (!client && !loadError)) {
    return (
      <div className="client-portal client-dashboard-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
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
              <div className="cp-brand" style={{ padding: '6px 10px 22px' }}>
                <div className="cp-brand-mark" aria-hidden="true"></div>
                <div className="cp-brand-text">FLOW 53</div>
                <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
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
            <button type="button" className="profile-card" onClick={handleSignOut} title="Sign out">
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
              </div>
              <div className="profile-meta">
                <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
                <div className="profile-role">{client.company_name}</div>
              </div>
              <Icon name="logout" />
            </button>
          </aside>

          <div className="main">
            <header className="topbar">
              <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
                <Icon name="menu" />
              </button>
              <span className="topbar-title">Overview</span>
            </header>

            <main className="content">
              <div className="breadcrumb">Client Portal / Overview</div>

              <div className="ov-header-row">
                <div>
                  <h1 className="ov-greeting-title">
                    {greeting}, {firstName} 👋
                  </h1>
                  <p className="ov-greeting-sub">Here&apos;s what&apos;s happening with your project today.</p>
                </div>
                {dateLabel && (
                  <div className="ov-date-chip">
                    <Icon name="calendar" size={13} /> {dateLabel}
                  </div>
                )}
              </div>

              {!isCompleted && pendingAction && (
                <div className="ov-action-banner block">
                  <div className="ov-action-icon">
                    <Icon name={pendingAction.key === 'payment' ? 'card' : pendingAction.key === 'approval' ? 'check' : 'doc'} size={20} />
                  </div>
                  <div className="ov-action-body">
                    <span className="ov-action-label">{pendingAction.label}</span>
                    <div className="ov-action-title">{pendingAction.title}</div>
                    <p className="ov-action-desc">{pendingAction.desc}</p>
                    {pendingAction.key === 'sow' && sow?.sow_number && (
                      <div className="ov-action-meta">
                        {sow.sow_number} <span className="ov-dot" /> v{sow.version}.0
                      </div>
                    )}
                  </div>
                  <div className="ov-action-actions">
                    <Link href={pendingAction.href} className="btn btn-accent">
                      {pendingAction.ctaLabel}
                    </Link>
                    {pendingAction.moreCount && <span className="ov-more-link">+{pendingAction.moreCount} more action{pendingAction.moreCount > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              )}

              <div className="ov-grid block">
                {/* ---- Project Snapshot ---- */}
                <div className="ov-card">
                  <div className="ov-card-head">
                    <div className="ov-card-title">Project Snapshot</div>
                    <span className={`status-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
                  </div>
                  <div className="ov-snapshot-name">{project.name}</div>
                  <div className="ov-progress-row">
                    <span className="ov-progress-pct">{progressPct}% Complete</span>
                  </div>
                  <div className="ov-progress-track">
                    <div className="ov-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="ov-mini-stats">
                    <div>
                      <Icon name="check" size={12} />
                      <span className="ov-mini-label">Current Phase</span>
                      <span className="ov-mini-value">{currentMilestone?.title ?? (isCompleted ? 'Completed' : '—')}</span>
                    </div>
                    <div>
                      <Icon name="calendar" size={12} />
                      <span className="ov-mini-label">Expected Delivery</span>
                      <span className="ov-mini-value">{formatBnDate(project.due_date) || '—'}</span>
                    </div>
                    <div>
                      <Icon name="user" size={12} />
                      <span className="ov-mini-label">Project Manager</span>
                      <span className="ov-mini-value">{manager?.full_name ?? '—'}</span>
                    </div>
                  </div>
                  <Link href={`/client/project/${project.id}`} className="ov-link">
                    View Project →
                  </Link>
                </div>

                {/* ---- Project Journey ---- */}
                <div className="ov-card">
                  <div className="ov-card-title">Project Journey</div>
                  {milestones.length === 0 ? (
                    <p className="empty-inline">Your project phases will appear here once our team sets them up.</p>
                  ) : (
                    <div className="ov-journey-row">
                      {milestones.map((m) => {
                        const isDone = !!m.completed_at;
                        const isCurrent = !isDone && currentMilestone?.id === m.id;
                        return (
                          <div className={`ov-journey-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`} key={m.id}>
                            <div className="ov-journey-line" />
                            <div className="ov-journey-dot">{isDone ? '✓' : ''}</div>
                            <div className="ov-journey-label">{m.title}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ---- Upcoming ---- */}
                <div className="ov-card">
                  <div className="ov-card-head">
                    <div className="ov-card-title">Upcoming</div>
                  </div>
                  {upcomingTop.length === 0 ? (
                    <p className="empty-inline">Nothing scheduled right now.</p>
                  ) : (
                    <div className="ov-upcoming-list">
                      {upcomingTop.map((u) => (
                        <div className="ov-upcoming-item" key={u.key}>
                          <div className="ov-upcoming-date">
                            <span className="ov-upcoming-day">{u.day}</span>
                            <span className="ov-upcoming-month">{u.month}</span>
                          </div>
                          <div className="ov-upcoming-body">
                            <div className="ov-upcoming-title">{u.title}</div>
                            <div className="ov-upcoming-sub">{u.sub}</div>
                          </div>
                          <Icon name={u.icon} size={13} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="ov-grid ov-grid-payments block">
                {/* ---- Agreement & Payment ---- */}
                <div className="ov-card ov-card-wide">
                  <div className="ov-card-title">Agreement &amp; Payment</div>
                  <div className="ov-ap-grid">
                    <div className="ov-ap-col">
                      <div className="ov-ap-icon">
                        <Icon name="doc" size={16} />
                      </div>
                      <div className="ov-ap-title">Statement of Work</div>
                      <div className="ov-ap-sub">
                        {sow?.sow_number ?? '—'}
                        {sow ? ` · v${sow.version}.0` : ''}
                      </div>
                      {sow?.status === 'signed' ? (
                        <span className="ov-pill ov-pill-positive">
                          Signed <Icon name="check" size={9} />
                        </span>
                      ) : sow ? (
                        <span className="ov-pill ov-pill-warning">Awaiting Signature</span>
                      ) : (
                        <span className="ov-pill">Being Prepared</span>
                      )}
                      {sow?.signed_at && <div className="ov-ap-meta">Signed on {formatBnDate(sow.signed_at)}</div>}
                      <Link href={`/client/project/${project.id}/sow`} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                        View SOW
                      </Link>
                    </div>
                    <div className="ov-ap-divider" />
                    <div className="ov-ap-col">
                      <div className="ov-ap-icon">
                        <Icon name="card" size={16} />
                      </div>
                      <div className="ov-ap-title">Payment Summary</div>
                      {project.budget != null ? (
                        <>
                          <div className="ov-ap-stats">
                            <div>
                              <span>Project Value</span>
                              <strong>
                                {sym}
                                {project.budget.toLocaleString('en-US')}
                              </strong>
                            </div>
                            <div>
                              <span>Paid</span>
                              <strong style={{ color: 'var(--positive)' }}>
                                {sym}
                                {totalPaid.toLocaleString('en-US')}
                              </strong>
                            </div>
                            <div>
                              <span>Remaining</span>
                              <strong style={{ color: remaining && remaining > 0 ? 'var(--warning)' : 'var(--ink)' }}>
                                {sym}
                                {(remaining ?? 0).toLocaleString('en-US')}
                              </strong>
                            </div>
                          </div>
                          <div className="ov-progress-track" style={{ marginTop: 10 }}>
                            <div className="ov-progress-fill" style={{ width: `${paymentPct}%` }} />
                          </div>
                          <div className="ov-ap-meta">{paymentPct}% Paid</div>
                        </>
                      ) : (
                        <p className="empty-inline">Payment details will appear here once available.</p>
                      )}
                      <Link href={`/client/project/${project.id}/payments`} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
                        View Payments
                      </Link>
                    </div>
                  </div>
                </div>

                {/* ---- Messages ---- */}
                <div className="ov-card">
                  <div className="ov-card-head">
                    <div className="ov-card-title">
                      Messages {unreadFromTeam > 0 && <span className="ov-unread-chip">{unreadFromTeam} unread</span>}
                    </div>
                    <Link href={`/client/project/${project.id}/messages`} className="ov-link">
                      Open Messages →
                    </Link>
                  </div>
                  {latestMessage ? (
                    <div className="ov-msg-preview">
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                        {(latestMessage.sender === 'client' ? (client.primary_contact ?? client.company_name) : (manager?.full_name ?? 'F')).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="ov-msg-sender">{latestMessage.sender === 'client' ? 'You' : (manager?.full_name ?? 'FLOW 53 Team')}</div>
                        <div className="ov-msg-text">{latestMessage.message}</div>
                        <div className="ov-msg-time">{relativeTimeBn(latestMessage.created_at)}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="empty-inline">No messages yet.</p>
                  )}
                </div>
              </div>

              <div className="ov-grid block">
                {/* ---- Recent Updates ---- */}
                <div className="ov-card">
                  <div className="ov-card-head">
                    <div className="ov-card-title">Recent Updates</div>
                    {updates.length > 0 && (
                      <Link href={`/client/project/${project.id}/updates`} className="ov-link">
                        View All →
                      </Link>
                    )}
                  </div>
                  {updates.length === 0 ? (
                    <p className="empty-inline">Your project updates will appear here as work progresses.</p>
                  ) : (
                    <div className="ov-update-list">
                      {updates.map((u) => (
                        <div className="ov-update-row" key={u.id}>
                          <div className="ov-update-icon">
                            <Icon name="check" size={12} />
                          </div>
                          <div>
                            <div className="ov-update-title">{u.title}</div>
                            <div className="ov-update-time">{relativeTimeBn(u.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ---- Recent Files ---- */}
                <div className="ov-card">
                  <div className="ov-card-head">
                    <div className="ov-card-title">Recent Files</div>
                    {projectFiles.length > 0 && (
                      <Link href={`/client/project/${project.id}/files`} className="ov-link">
                        View All Files →
                      </Link>
                    )}
                  </div>
                  {projectFiles.length === 0 ? (
                    <p className="empty-inline">No files shared yet.</p>
                  ) : (
                    <div className="ov-file-list">
                      {projectFiles.map((f) => (
                        <div className="ov-file-row" key={f.id}>
                          <div className={`ov-file-icon${f.file_type === 'pdf' ? ' pdf' : f.file_type === 'image' ? ' image' : ''}`}>
                            <Icon name="file" size={13} />
                          </div>
                          <div className="ov-file-info">
                            <span className="ov-file-name">{f.name}</span>
                            <span className="ov-file-meta">
                              {(f.file_type ?? 'file').toUpperCase()} · {formatBytes(f.size_bytes ?? 0)} · {formatBnDate(f.created_at)}
                            </span>
                          </div>
                          <a href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ width: 28, height: 28 }}>
                            <Icon name="download" size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ---- Your Project Manager ---- */}
                <div className="ov-card">
                  <div className="ov-card-title">Your Project Manager</div>
                  {manager ? (
                    <>
                      <div className="ov-manager-row">
                        <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
                          {manager.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="ov-manager-name">{manager.full_name}</div>
                          <div className="ov-manager-role">{manager.role ?? 'Project Manager'}</div>
                        </div>
                      </div>
                      <p className="ov-manager-sub">Need help or have a question about your project?</p>
                      <Link href={`/client/project/${project.id}/messages`} className="btn btn-accent btn-sm">
                        <Icon name="send" size={12} /> Send Message
                      </Link>
                    </>
                  ) : (
                    <p className="empty-inline">No project manager assigned yet.</p>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
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
            <div className="cp-brand" style={{ padding: '6px 10px 22px' }}>
              <div className="cp-brand-mark" aria-hidden="true"></div>
              <div className="cp-brand-text">FLOW 53</div>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
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
          <button type="button" className="profile-card" onClick={handleSignOut} title="Sign out">
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </div>
            <div className="profile-meta">
              <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
              <div className="profile-role">{client.company_name}</div>
            </div>
            <Icon name="logout" />
          </button>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">Client Portal</span>
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
                    <span>{formatBnDateLong(requirements.created_at)}</span>
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
                          <div className="timeline-time">{relativeTimeBn(a.created_at)}</div>
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
    </div>
  );
}
