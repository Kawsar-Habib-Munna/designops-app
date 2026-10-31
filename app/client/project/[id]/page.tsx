'use client';

// Screen 9 — Client Project Dashboard। রিডিজাইন: Screen 5-এর ঠিক একই sidebar
// app-shell (mobile drawer সহ), এখন "My Project"/Messages/Files/SOW/Payments
// real লিংক (আগে disabled ছিল যেহেতু প্রজেক্ট ছিল না)।
//
// Real-data সিদ্ধান্তসমূহ (client-facing, তাই internal অপারেশন কখনো leak করা যাবে না):
// - client_visible=false হলে RLS-ই projects row ফেরত দেয় না (Screen 8-এর ফেজ ১০
//   পলিসি) — তাই hidden প্রজেক্ট আপনাআপনি "not found → dashboard" পথে পড়ে,
//   এখানে আলাদা কোনো visibility-চেক কোড লাগেনি।
// - Progress সরাসরি projects.progress (admin/Screen-16-এ যা সেট হয়) — নতুন কোনো
//   দ্বিতীয় progress ইঞ্জিন বানানো হয়নি।
// - Current Phase = প্রথম অসম্পূর্ণ milestone (বিদ্যমান milestones টেবিল রিইউজ,
//   internal task/assignee/estimate কিছুই টানা হয়নি)।
// - Pending Action resolver একটাই কেন্দ্রীভূত ফাংশন (resolvePendingAction),
//   priority অনুযায়ী: SOW sent → পেমেন্ট pending → approval awaiting →
//   final delivery ready → কিছু না। "Feedback requested"/"change-request
//   response" বাদ দেওয়া হয়েছে যেহেতু schema-তে "team requested feedback from
//   client" এমন কোনো real trigger নেই (client_feedback client নিজেই লেখে) —
//   fake state না বসিয়ে বাদ দেওয়া হলো।
// - On Hold অবস্থায় reason হিসেবে clients.admin_request রিইউজ করা হয়েছে
//   (Screen 5/7-এর একই real চ্যানেল) — কোনো fake "reason" টেক্সট বসানো হয়নি।
// - Recent Activity internal activity_log থেকে না টেনে client-facing
//   টেবিলগুলো (project_updates/milestones/sows) থেকে মার্জ করে বানানো হয়েছে,
//   তাই "Rahim moved task #231" জাতীয় internal অপারেশন কখনো leak হতে পারে না।
// - Files/Messages/Approvals সবই বিদ্যমান RLS দিয়ে client-নিজের ডেটাতেই
//   স্কোপড (hidden_from_client ফাইল, অন্য ক্লায়েন্টের মেসেজ ইত্যাদি কখনো আসে না)।
// - এই পেজ শুধু preview/summary দেখায়, SOW/Payments/Files/Messages/Feedback/
//   Approvals/Updates-এর পূর্ণ UI আগে থেকেই বিদ্যমান নিজস্ব রুটে আছে (Screens
//   10/12/17/18/19/20/22, এই সেশনের আগের অংশে তৈরি) — এখানে শুধু লিংক করা হলো।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { driveThumbnailUrl } from '@/lib/driveUpload';
import { relativeTime, formatDate } from '@/lib/format';
import { formatMoney } from '@/lib/currency';
import { getProjectCurrency } from '@/lib/projectCurrency';
import RichText from '@/app/components/RichText';
import '../../client-shared.css';
import ClientBottomNav from '@/app/components/ClientBottomNav';
import AvatarImage from '@/app/components/AvatarImage';
import './project-dashboard.css';
import './project-v2.css';

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
  eye: '<path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  paperclip: '<path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.42 17.4a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  calendarcheck: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  chats: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
  arrow: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ManagerBrief = { full_name: string; avatar_url: string | null; role: string | null } | null;
type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  category: string | null;
  start_date: string | null;
  due_date: string | null;
  description: string | null;
  client_id: string;
  budget: number | null;
  final_delivery_status: string | null;
  created_at: string;
  completed_at: string | null;
  project_manager: ManagerBrief | ManagerBrief[] | null;
};
type Milestone = { id: string; title: string; description: string | null; due_date: string | null; completed_at: string | null; progress: number | null; position: number };
type FileRow = { id: string; name: string; file_type: string | null; size_bytes: number | null; drive_url: string; created_at: string };
type InvoiceBrief = { id: string; amount: number; currency: string; due_date: string | null; status: string };
type SowBrief = { id: string; status: string; version: number; sent_at: string | null; signed_at: string | null };
type MessageBrief = { id: string; sender: string; message: string | null; created_at: string; read_at: string | null };
type UpdateBrief = { id: string; title: string; description: string | null; attachment_url: string | null; created_at: string; author: { full_name: string } | { full_name: string }[] | null };
type ApprovalBrief = { id: string; item: string; status: string; comment: string | null; created_at: string };

const APPROVAL_STATUS_LABEL: Record<string, string> = { awaiting: 'Awaiting Approval', approved: 'Approved ✓', changes_requested: 'Changes Requested' };
const APPROVAL_STATUS_BADGE: Record<string, string> = { awaiting: 'cp-badge-pending', approved: 'cp-badge-success', changes_requested: 'cp-badge-pending' };

const PROJECT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'b-active' },
  review: { label: 'In Review', cls: 'b-review' },
  on_hold: { label: 'On Hold', cls: 'b-hold' },
  planning: { label: 'Planning', cls: 'b-review' },
  completed: { label: 'Completed', cls: 'b-done' },
};
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

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
function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PendingAction = { key: string; label: string; title: string; desc: string; ctaLabel: string; href: string; moreCount?: number };

function resolvePendingAction(project: ProjectDetail, sow: SowBrief | null, invoices: InvoiceBrief[], approvals: ApprovalBrief[]): PendingAction | null {
  if (sow && sow.status === 'sent') {
    return { key: 'sow', label: 'Action Required', title: 'Review & Sign Your SOW', desc: 'Please review the Statement of Work before the project moves to the next step.', ctaLabel: 'Review SOW', href: `/client/project/${project.id}/sow` };
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

export default function ClientProjectDashboard() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [currency, setCurrency] = useState('BDT');
  useEffect(() => {
    if (projectId) getProjectCurrency(projectId).then(setCurrency);
  }, [projectId]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceBrief[]>([]);
  const [sow, setSow] = useState<SowBrief | null>(null);
  const [messages, setMessages] = useState<MessageBrief[]>([]);
  const [updates, setUpdates] = useState<UpdateBrief[]>([]);
  const [approvals, setApprovals] = useState<ApprovalBrief[]>([]);
  const [approvalsModalOpen, setApprovalsModalOpen] = useState(false);
  const [respondingApprovalId, setRespondingApprovalId] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }

        const [projectRes, milestonesRes, filesRes, invoicesRes, sowRes, messagesRes, updatesRes, approvalsRes] = await Promise.all([
          supabase
            .from('projects')
            .select('id, name, status, progress, category, start_date, due_date, description, client_id, budget, final_delivery_status, created_at, completed_at, project_manager:profiles!project_manager_id(full_name, avatar_url, role)')
            .eq('id', projectId)
            .maybeSingle(),
          supabase.from('milestones').select('id, title, description, due_date, completed_at, progress, position').eq('project_id', projectId).order('position'),
          supabase.from('client_files').select('id, name, file_type, size_bytes, drive_url, created_at').eq('client_id', own.id).order('created_at', { ascending: false }).limit(4),
          supabase.from('invoices').select('id, amount, currency, due_date, status').eq('project_id', projectId).order('due_date'),
          supabase.from('sows').select('id, status, version, sent_at, signed_at').eq('project_id', projectId).order('version', { ascending: false }).limit(1),
          supabase.from('client_messages').select('id, sender, message, created_at, read_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
          supabase.from('project_updates').select('id, title, description, attachment_url, created_at, author:profiles!author_id(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
          supabase.from('client_approvals').select('id, item, status, comment, created_at').eq('project_id', projectId),
        ]);

        if (!projectRes.data || (projectRes.data as unknown as ProjectDetail).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }

        setClient(own);
        setProject(projectRes.data as unknown as ProjectDetail);
        setMilestones((milestonesRes.data as Milestone[]) ?? []);
        setFiles((filesRes.data as FileRow[]) ?? []);
        setInvoices((invoicesRes.data as InvoiceBrief[]) ?? []);
        const sowRow = (sowRes.data?.[0] as SowBrief) ?? null;
        setSow(sowRow && sowRow.status === 'draft' ? null : sowRow);
        setMessages((messagesRes.data as MessageBrief[]) ?? []);
        setUpdates((updatesRes.data as unknown as UpdateBrief[]) ?? []);
        setApprovals((approvalsRes.data as ApprovalBrief[]) ?? []);
        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    load();
  }, [router, projectId]);

  async function handleApproveItem(id: string) {
    await supabase.from('client_approvals').update({ status: 'approved', responded_at: new Date().toISOString() }).eq('id', id);
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'approved' } : a)));
  }

  async function handleRequestApprovalChanges(e: FormEvent, id: string) {
    e.preventDefault();
    setSubmittingApproval(true);
    const trimmed = approvalComment.trim() || null;
    await supabase.from('client_approvals').update({ status: 'changes_requested', comment: trimmed, responded_at: new Date().toISOString() }).eq('id', id);
    setSubmittingApproval(false);
    setRespondingApprovalId(null);
    setApprovalComment('');
    setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'changes_requested', comment: trimmed } : a)));
  }

  if (loading) {
    return (
      <div className="client-portal client-projectdash-root">
        <div className="shell">
          <aside className="sidebar">
            <div style={{ height: 30 }} />
          </aside>
          <div className="main">
            <main className="content">
              <div className="skel" style={{ height: 90, marginBottom: 18 }} />
              <div className="skel" style={{ height: 140, marginBottom: 18 }} />
              <div className="skel" style={{ height: 90, marginBottom: 18 }} />
              <div className="skel" style={{ height: 120, marginBottom: 18 }} />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-projectdash-root">
        <div className="state-view">
          <div className="state-icon">
            <Icon name="alert" size={20} />
          </div>
          <div className="state-title">We couldn&apos;t load your project</div>
          <div className="state-sub">Please try again in a moment.</div>
          <div className="state-actions">
            <button type="button" className="btn btn-accent" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={13} /> Try Again
            </button>
            <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent("Hi FLOW53, I'm having trouble loading my project dashboard.")}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  const manager = toOne(project.project_manager);
  const statusMeta = PROJECT_STATUS_LABEL[project.status] ?? { label: project.status, cls: 'b-review' };
  const isCompleted = project.status === 'completed';
  const progressPct = isCompleted ? 100 : project.progress ?? 0;

  const currentMilestone = milestones.find((m) => !m.completed_at) ?? null;
  const pendingAction = !isCompleted ? resolvePendingAction(project, sow, invoices, approvals) : null;
  const unreadFromTeam = messages.filter((m) => m.sender === 'team' && !m.read_at).length;
  const latestUpdate = updates[0] ?? null;
  const latestMessage = messages[0] ?? null;

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const hasPendingPayment = invoices.some((i) => i.status === 'pending');
  const paymentPct = project.budget && project.budget > 0 ? Math.min(100, Math.round((totalPaid / project.budget) * 100)) : 0;

  const sowDone = sow?.status === 'signed';
  const daysLeft = project.due_date ? Math.ceil((new Date(project.due_date).getTime() - nowMs) / 86400000) : null;
  const phasePct = milestones.length > 0 ? Math.round((milestones.filter((m) => m.completed_at).length / milestones.length) * 100) : progressPct;

  type ActivityItem = { key: string; text: string; time: string };
  const activityItems: ActivityItem[] = [];
  activityItems.push({ key: 'created', text: `${project.name} project created`, time: project.created_at });
  milestones.forEach((m) => {
    if (m.completed_at) activityItems.push({ key: `ms-${m.id}`, text: `${m.title} completed`, time: m.completed_at });
  });
  if (sow?.sent_at) activityItems.push({ key: 'sow-sent', text: 'SOW sent for review', time: sow.sent_at });
  if (sow?.signed_at) activityItems.push({ key: 'sow-signed', text: 'SOW signed', time: sow.signed_at });
  updates.forEach((u) => activityItems.push({ key: `update-${u.id}`, text: `Update posted: ${u.title}`, time: u.created_at }));
  activityItems.sort((a, b) => (a.time < b.time ? 1 : -1));
  const recentActivity = activityItems.slice(0, 6);

  return (
    <div className="client-portal client-projectdash-root">
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
              <Link href="/client/dashboard" className="nav-item">
                <Icon name="grid" /> Overview
              </Link>
              <Link href={`/client/project/${project.id}`} className="nav-item active">
                <Icon name="folder" /> My Project
              </Link>
              <Link href={`/client/project/${project.id}/messages`} className="nav-item">
                <Icon name="message" /> Messages
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
            <span className="topbar-title">My Project</span>
                      <button type="button" className="topbar-avatar" aria-label="Sign out" onClick={() => { if (window.confirm('Sign out of your account?')) (async () => { await supabase.auth.signOut(); router.push('/client'); })(); }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </button>
</header>

          <header className="page-topbar">
            <div className="breadcrumb">
              <Link href="/client/dashboard">Client Portal</Link> / My Project
            </div>
            <a
              className="page-help-link"
              href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I need help with my project ${project.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="help" size={13} /> Need help?
            </a>
          <button type="button" className="profile-card topbar-profile" onClick={async () => { await supabase.auth.signOut(); router.push('/client'); }} title="Sign out">
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
              {/* ---- hero: project, status, overall progress ---- */}
              <section className="dx-hero">
                <div className="dx-hero-text">
                  <div className="dx-eyebrow">My project</div>
                  <h1 className="dx-title">{project.name}</h1>
                  <p className="dx-sub">
                    {isCompleted
                      ? "Here's a summary of your completed project."
                      : currentMilestone
                        ? `Your project is currently in the ${currentMilestone.title} phase.`
                        : `Here's the latest on your project, ${client.primary_contact?.split(' ')[0] ?? client.company_name}.`}
                  </p>
                  <div className="dx-hero-project">
                    <span className={`status-badge ${statusMeta.cls}`}>
                      <span className="dot"></span>
                      {statusMeta.label}
                    </span>
                    {project.category && <span className="dx-hero-chip">{project.category}</span>}
                    {isCompleted && project.completed_at && <span className="dx-hero-chip">Completed {formatDate(project.completed_at)}</span>}
                  </div>
                  <div className="dx-hero-actions">
                    <Link href={`/client/project/${project.id}/messages`} className="btn btn-accent">
                      <Icon name="message" size={13} /> Message team
                    </Link>
                    <Link href={`/client/project/${project.id}/files`} className="btn btn-ghost">
                      <Icon name="file" size={13} /> Files
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

              {/* ---- status banner: completed / on hold / action needed / all good ---- */}
              {isCompleted ? (
                <section className="dx-action ok">
                  <div className="dx-action-icon">
                    <Icon name="check" size={20} />
                  </div>
                  <div className="dx-action-body">
                    <span className="dx-action-label">Project completed</span>
                    <div className="dx-action-title">Everything has been delivered</div>
                    <p className="dx-action-desc">{project.completed_at ? `Completed ${formatDate(project.completed_at)}.` : 'This project has been marked complete.'} Your final files are below.</p>
                  </div>
                </section>
              ) : project.status === 'on_hold' ? (
                <section className="dx-action">
                  <div className="dx-action-icon">
                    <Icon name="alert" size={20} />
                  </div>
                  <div className="dx-action-body">
                    <span className="dx-action-label">Project on hold</span>
                    <div className="dx-action-title">We&apos;re waiting before work can continue</div>
                    <p className="dx-action-desc">{client.admin_request ? client.admin_request : 'Our team will reach out with more details.'}</p>
                  </div>
                  {client.admin_request && (
                    <div className="dx-action-cta">
                      <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, regarding: ${client.admin_request}`)}`} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                        Provide information
                      </a>
                    </div>
                  )}
                </section>
              ) : pendingAction ? (
                <section className="dx-action">
                  <div className="dx-action-icon">
                    <Icon name={pendingAction.key === 'payment' ? 'card' : pendingAction.key === 'approval' ? 'check' : 'doc'} size={20} />
                  </div>
                  <div className="dx-action-body">
                    <span className="dx-action-label">{pendingAction.label}</span>
                    <div className="dx-action-title">{pendingAction.title}</div>
                    <p className="dx-action-desc">{pendingAction.desc}</p>
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
              ) : (
                <section className="dx-clear">
                  <span className="dx-clear-icon">
                    <Icon name="check" size={22} />
                  </span>
                  <div className="dx-clear-body">
                    <div className="dx-clear-title-row">
                      <div className="dx-clear-title">You&apos;re all caught up</div>
                      <span className="dx-clear-pill">
                        <span className="dx-clear-dot" />
                        On track
                      </span>
                    </div>
                    <p className="dx-clear-desc">Nothing is needed from you right now. We&apos;ll let you know as soon as your input is required.</p>
                  </div>
                </section>
              )}

            {/* ---- latest update ---- */}
            <section className="dx-card">
              <div className="dx-card-head">
                <h2 className="dx-card-title">Latest update</h2>
                {updates.length > 0 && (
                  <Link href={`/client/project/${project.id}/updates`} className="dx-link">View all</Link>
                )}
              </div>
              {!latestUpdate ? (
                <p className="dx-empty">Your project updates will appear here as work progresses.</p>
              ) : (
                <div className="dx-update">
                  <div className="dx-update-title">{latestUpdate.title}</div>
                  <div className="dx-row-sub">{formatDate(latestUpdate.created_at)} · Posted by {toOne(latestUpdate.author)?.full_name ?? 'FLOW 53 Team'}</div>
                  {latestUpdate.description && <RichText text={latestUpdate.description} className="dx-update-body" />}
                  {latestUpdate.attachment_url && (
                    <a className="dx-update-file" href={latestUpdate.attachment_url} target="_blank" rel="noopener noreferrer">
                      <Icon name="paperclip" size={13} /> View attachment
                    </a>
                  )}
                </div>
              )}
            </section>

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
                <div className="dx-kpi">
                  <span className="dx-kpi-top">
                    <span className="dx-kpi-icon dx-tone-blue"><Icon name="calendarcheck" size={20} /></span>
                  </span>
                  <span className="dx-kpi-label">Expected delivery</span>
                  <strong className="dx-kpi-value">{formatDate(project.due_date) || '—'}</strong>
                  <span className={`dx-kpi-sub${daysLeft != null && daysLeft < 0 && !isCompleted ? ' dx-warn' : ''}`}>
                    {isCompleted ? 'Delivered' : daysLeft == null ? 'Date to be confirmed' : daysLeft < 0 ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                  </span>
                </div>
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
                  <strong className="dx-kpi-value">{project.budget ? formatMoney(totalPaid, currency) : '—'}</strong>
                  <span className="dx-kpi-sub">{project.budget ? `${paymentPct}% of ${formatMoney(project.budget, currency)}` : 'Details coming soon'}</span>
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

              {/* ---- project details ---- */}
              <section className="dx-card">
                <div className="dx-card-head">
                  <h2 className="dx-card-title">Project details</h2>
                </div>
                <dl className="dx-details">
                  <div><dt>Client</dt><dd>{client.company_name}</dd></div>
                  <div><dt>Project type</dt><dd>{project.category ?? '—'}</dd></div>
                  <div><dt>Start date</dt><dd>{formatDate(project.start_date) || '—'}</dd></div>
                  <div><dt>Expected delivery</dt><dd>{formatDate(project.due_date) || '—'}</dd></div>
                  <div><dt>Project manager</dt><dd>{manager?.full_name ?? '—'}</dd></div>
                </dl>
              </section>

              {/* ---- milestones ---- */}
              <section className="dx-card">
                <div className="dx-card-head">
                  <h2 className="dx-card-title">Project milestones</h2>
                </div>
                {milestones.length === 0 ? (
                  <p className="dx-empty">Your project milestones will appear here once our team sets them up.</p>
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

              <div className="dx-cols">
                <div className="dx-col">
                  {/* ---- current phase ---- */}
                  {!isCompleted && (
                    <section className="dx-card">
                      <div className="dx-card-head">
                        <h2 className="dx-card-title">Current phase</h2>
                      </div>
                      {currentMilestone ? (
                        <div className="dx-phase">
                          <div className="dx-phase-ring">
                            <Ring pct={currentMilestone.progress ?? 0} size={84} stroke={9} color="var(--accent)" />
                            <div className="dx-ring-center dx-ring-small">
                              <strong>{currentMilestone.progress ?? 0}%</strong>
                            </div>
                          </div>
                          <div className="dx-phase-body">
                            <div className="dx-phase-name">{currentMilestone.title}</div>
                            {currentMilestone.description && <p className="dx-phase-desc">{currentMilestone.description}</p>}
                            {currentMilestone.due_date && <div className="dx-row-sub">Expected {formatDate(currentMilestone.due_date)}</div>}
                          </div>
                        </div>
                      ) : (
                        <p className="dx-empty">{milestones.length === 0 ? 'Your project phases will appear here once our team sets them up.' : 'All phases are complete — finishing up final details.'}</p>
                      )}
                    </section>
                  )}

                  {/* ---- recent activity ---- */}
                  <section className="dx-card">
                    <div className="dx-card-head">
                      <h2 className="dx-card-title">Recent activity</h2>
                    </div>
                    {recentActivity.length === 0 ? (
                      <p className="dx-empty">No activity yet.</p>
                    ) : (
                      <ul className="dx-list">
                        {recentActivity.map((a) => (
                          <li className="dx-row" key={a.key}>
                            <span className="dx-row-icon"><Icon name="check" size={12} /></span>
                            <span className="dx-row-body">
                              <span className="dx-row-title dx-wrap">{a.text}</span>
                              <span className="dx-row-sub">{relativeTime(a.time)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>

                <div className="dx-col">
                  {/* ---- statement of work ---- */}
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
                          <dt>Version</dt>
                          <dd>{sow ? `v${sow.version}.0` : '—'}</dd>
                        </div>
                        <div>
                          <dt>{sowDone ? 'Signed on' : 'Sent on'}</dt>
                          <dd>{sowDone ? (formatDate(sow?.signed_at ?? null) || '—') : (formatDate(sow?.sent_at ?? null) || '—')}</dd>
                        </div>
                      </dl>
                    </div>
                    <Link href={`/client/project/${project.id}/sow`} className={`btn btn-sm ${sow && !sowDone ? 'btn-accent' : 'btn-ghost'}`}>
                      {sow && !sowDone ? 'Review & sign' : 'View SOW'}
                    </Link>
                  </section>

                  {/* ---- payments ---- */}
                  <section className="dx-card dx-doc">
                    <div className="dx-doc-head">
                      <span className="dx-kpi-icon dx-tone-green"><Icon name="wallet" size={20} /></span>
                      <div>
                        <h2 className="dx-card-title">Payments</h2>
                        <div className="dx-ap-sub">{project.budget ? `Project value ${formatMoney(project.budget, currency)}` : 'Details coming soon'}</div>
                      </div>
                    </div>
                    {project.budget ? (
                      <div className="dx-pay2">
                        <div className="dx-pay-ring">
                          <Ring pct={paymentPct} size={96} stroke={10} color="var(--positive)" />
                          <div className="dx-ring-center dx-ring-small">
                            <strong>{paymentPct}%</strong>
                            <span>paid</span>
                          </div>
                        </div>
                        <div className="dx-pay-legend">
                          <div><span className="dx-swatch dx-swatch-green" />Paid<strong>{formatMoney(totalPaid, currency)}</strong></div>
                          <div><span className="dx-swatch dx-swatch-grey" />Remaining<strong>{formatMoney(Math.max(0, project.budget - totalPaid), currency)}</strong></div>
                        </div>
                      </div>
                    ) : (
                      <p className="dx-empty">Payment information will appear here once available.</p>
                    )}
                    <Link href={`/client/project/${project.id}/payments`} className={`btn btn-sm ${hasPendingPayment ? 'btn-accent' : 'btn-ghost'}`}>
                      {hasPendingPayment ? 'View & pay' : 'View payments'}
                    </Link>
                  </section>

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
                      <h2 className="dx-card-title">{isCompleted ? 'Final files' : 'Recent files'}</h2>
                      {files.length > 0 && (
                        <Link href={`/client/project/${project.id}/files`} className="dx-link">View all</Link>
                      )}
                    </div>
                    {files.length === 0 ? (
                      <p className="dx-empty">No files shared yet.</p>
                    ) : (
                      <ul className="dx-list">
                        {files.map((f) => (
                          <li className="dx-row" key={f.id}>
                            <span className={`dx-row-icon${f.file_type === 'pdf' ? ' pdf' : ''}`}><Icon name="file" size={13} /></span>
                            <span className="dx-row-body">
                              <span className="dx-row-title">{f.name}</span>
                              <span className="dx-row-sub">{formatBytes(f.size_bytes)}{f.size_bytes ? ' · ' : ''}{formatDate(f.created_at)}</span>
                            </span>
                            <a href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="dx-icon-btn" aria-label={`Open ${f.name}`}>
                              <Icon name="eye" size={14} />
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
      <ClientBottomNav projectId={project.id} active="project" unread={unreadFromTeam} />

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
