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

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { driveThumbnailUrl } from '@/lib/driveUpload';
import { relativeTimeBn, formatBnDate } from '@/lib/format';
import '../../client-shared.css';
import './project-dashboard.css';

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
type ApprovalBrief = { id: string; item: string; status: string };

const PROJECT_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'b-active' },
  review: { label: 'In Review', cls: 'b-review' },
  on_hold: { label: 'On Hold', cls: 'b-hold' },
  planning: { label: 'Planning', cls: 'b-review' },
  completed: { label: 'Completed', cls: 'b-done' },
};
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

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

export default function ClientProjectDashboard() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceBrief[]>([]);
  const [sow, setSow] = useState<SowBrief | null>(null);
  const [messages, setMessages] = useState<MessageBrief[]>([]);
  const [updates, setUpdates] = useState<UpdateBrief[]>([]);
  const [approvals, setApprovals] = useState<ApprovalBrief[]>([]);

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
          supabase.from('client_approvals').select('id, item, status').eq('project_id', projectId),
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
            <div className="cp-brand" style={{ padding: '6px 10px 22px' }}>
              <div className="cp-brand-mark" aria-hidden="true"></div>
              <div className="cp-brand-text">FLOW 53</div>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
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
          <button type="button" className="profile-card" onClick={async () => { await supabase.auth.signOut(); router.push('/client'); }} title="Sign out">
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
            <span className="topbar-title">My Project</span>
          </header>

          <main className="content">
            <div className="breadcrumb">
              <Link href="/client/dashboard">Client Portal</Link> / My Project
            </div>

            <div className="ph-row block">
              <div>
                <div className="ph-title-row">
                  <h1 className="ph-title">{project.name}</h1>
                  <span className={`status-badge ${statusMeta.cls}`}>
                    <span className="dot"></span>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="ph-company">{client.company_name}</div>
                <div className="ph-meta-row">
                  {project.category && (
                    <>
                      <span>{project.category}</span>
                      <span className="ph-dot"></span>
                    </>
                  )}
                  {manager && (
                    <>
                      <span>Project Manager: {manager.full_name}</span>
                      <span className="ph-dot"></span>
                    </>
                  )}
                  {project.due_date && <span>Expected Delivery: {formatBnDate(project.due_date)}</span>}
                </div>
              </div>
            </div>

            <p className="welcome-sub">
              {isCompleted ? "Here's a summary of your completed project." : currentMilestone ? `Your project is currently in the ${currentMilestone.title} phase.` : `Here's the latest on your project, ${client.primary_contact ?? ''}.`}
            </p>

            {isCompleted ? (
              <>
                <section className="block completed-banner">
                  <div className="completed-title">Project Completed ✓</div>
                  <div className="completed-sub">{project.completed_at ? `Completed ${formatBnDate(project.completed_at)}` : 'This project has been marked complete.'}</div>
                </section>

                <section className="block content-2col">
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Final Files</span>
                      <Link href={`/client/project/${project.id}/files`} className="btn btn-ghost btn-sm">
                        View All Files
                      </Link>
                    </div>
                    {files.length === 0 ? (
                      <p className="empty-inline">No files shared yet.</p>
                    ) : (
                      files.map((f) => (
                        <div className="file-row" key={f.id}>
                          <div className="file-icon">
                            <Icon name="file" size={14} />
                          </div>
                          <div className="file-row-main">
                            <div className="file-row-name">{f.name}</div>
                            <div className="file-row-meta">
                              {formatBytes(f.size_bytes)} · {formatBnDate(f.created_at)}
                            </div>
                          </div>
                          <div className="file-actions">
                            <a className="icon-btn" style={{ width: 28, height: 28 }} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer">
                              <Icon name="eye" size={13} />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Final Payment</span>
                      <Link href={`/client/project/${project.id}/payments`} className="btn btn-ghost btn-sm">
                        View Payment
                      </Link>
                    </div>
                    {project.budget ? (
                      <>
                        <div className="detail-row">
                          <span>Project Value</span>
                          <span>৳{project.budget.toLocaleString('en-US')}</span>
                        </div>
                        <div className="detail-row">
                          <span>Paid</span>
                          <span>৳{totalPaid.toLocaleString('en-US')}</span>
                        </div>
                      </>
                    ) : (
                      <p className="empty-inline">Payment details will appear here once available.</p>
                    )}
                  </div>
                </section>

                <section className="block dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project Summary</span>
                  </div>
                  <div className="detail-row">
                    <span>Project Type</span>
                    <span>{project.category ?? '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Start Date</span>
                    <span>{formatBnDate(project.start_date) || '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span>Project Manager</span>
                    <span>{manager?.full_name ?? '—'}</span>
                  </div>
                </section>
              </>
            ) : (
              <>
                {/* ---- Progress ---- */}
                <section className="block progress-card">
                  <div className="progress-top-row">
                    <span className="progress-pct">{progressPct}% Complete</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                  </div>
                  <div className="progress-meta-grid">
                    <div>
                      <div className="pm-label">Current Phase</div>
                      <div className="pm-value">{currentMilestone?.title ?? (isCompleted ? 'Completed' : '—')}</div>
                    </div>
                    <div>
                      <div className="pm-label">Expected Delivery</div>
                      <div className="pm-value">{formatBnDate(project.due_date) || '—'}</div>
                    </div>
                  </div>
                </section>

                {/* ---- On Hold banner ---- */}
                {project.status === 'on_hold' && (
                  <section className="block action-card calm">
                    <div>
                      <div className="action-label">Project On Hold</div>
                      <div className="action-title">Project On Hold</div>
                      <div className="action-desc">{client.admin_request ? client.admin_request : "We're waiting before work can continue. Our team will reach out with more details."}</div>
                    </div>
                    {client.admin_request && (
                      <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, regarding: ${client.admin_request}`)}`} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                        Provide Information
                      </a>
                    )}
                  </section>
                )}

                {/* ---- Pending Action ---- */}
                <section className="block action-card">
                  {pendingAction ? (
                    <>
                      <div>
                        <div className="action-label">{pendingAction.label}</div>
                        <div className="action-title">{pendingAction.title}</div>
                        <div className="action-desc">{pendingAction.desc}</div>
                        {pendingAction.moreCount && <div className="action-more">+{pendingAction.moreCount} more action{pendingAction.moreCount > 1 ? 's' : ''}</div>}
                      </div>
                      <Link href={pendingAction.href} className="btn btn-accent">
                        {pendingAction.ctaLabel}
                      </Link>
                    </>
                  ) : (
                    <div>
                      <div className="action-label" style={{ color: 'var(--positive)' }}>
                        Nothing needed from you
                      </div>
                      <div className="action-title">Your project is progressing normally</div>
                      <div className="action-desc">We&apos;ll let you know when your input is required.</div>
                    </div>
                  )}
                </section>

                {/* ---- Current Phase / Project Details ---- */}
                <section className="block content-2col">
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Current Phase</span>
                    </div>
                    {currentMilestone ? (
                      <>
                        <div className="phase-name">{currentMilestone.title}</div>
                        {currentMilestone.description && <p className="phase-desc">{currentMilestone.description}</p>}
                        <div className="phase-progress-row">
                          <div className="phase-track">
                            <div className="phase-fill" style={{ width: `${currentMilestone.progress ?? 0}%` }}></div>
                          </div>
                          <span className="phase-pct">{currentMilestone.progress ?? 0}%</span>
                        </div>
                        {currentMilestone.due_date && <div className="empty-inline">Expected: {formatBnDate(currentMilestone.due_date)}</div>}
                      </>
                    ) : (
                      <p className="empty-inline">{milestones.length === 0 ? 'Your project phases will appear here once our team sets them up.' : 'All phases are complete — finishing up final details.'}</p>
                    )}
                  </div>
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Project Details</span>
                    </div>
                    <div className="detail-row">
                      <span>Project Type</span>
                      <span>{project.category ?? '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Start Date</span>
                      <span>{formatBnDate(project.start_date) || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Expected Delivery</span>
                      <span>{formatBnDate(project.due_date) || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span>Project Manager</span>
                      <span>{manager?.full_name ?? '—'}</span>
                    </div>
                  </div>
                </section>

                {/* ---- Milestones ---- */}
                <section className="block dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Project Milestones</span>
                  </div>
                  {milestones.length === 0 ? (
                    <p className="empty-inline">Your project milestones will appear here once our team sets them up.</p>
                  ) : (
                    <div className="ms-row">
                      {milestones.map((m) => {
                        const isDone = !!m.completed_at;
                        const isCurrent = !isDone && currentMilestone?.id === m.id;
                        return (
                          <div className={`ms-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`} key={m.id}>
                            <div className="ms-marker">
                              <div className="ms-dot">{isDone ? '✓' : isCurrent ? '●' : '○'}</div>
                              <div className="ms-line"></div>
                            </div>
                            <div className="ms-info">
                              <div className="ms-title">{m.title}</div>
                              <div className="ms-meta">{isDone ? `Completed${m.completed_at ? ` · ${formatBnDate(m.completed_at)}` : ''}` : isCurrent ? 'In Progress' : m.due_date ? formatBnDate(m.due_date) : 'Upcoming'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* ---- SOW / Payments ---- */}
                <section className="block content-2col">
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Statement of Work</span>
                    </div>
                    {!sow ? (
                      <p className="empty-inline">SOW is being prepared.</p>
                    ) : sow.status === 'signed' ? (
                      <>
                        <div className="status-badge b-done" style={{ marginBottom: 10 }}>
                          <span className="dot"></span>Signed ✓
                        </div>
                        <p className="empty-inline" style={{ marginBottom: 12 }}>
                          {sow.signed_at ? `Signed ${formatBnDate(sow.signed_at)}` : ''}
                        </p>
                        <Link href={`/client/project/${project.id}/sow`} className="btn btn-ghost btn-sm">
                          View SOW
                        </Link>
                      </>
                    ) : (
                      <>
                        <div className="status-badge b-hold" style={{ marginBottom: 10 }}>
                          <span className="dot"></span>Action Required
                        </div>
                        <p className="empty-inline" style={{ marginBottom: 12 }}>
                          Your Statement of Work is ready for review.
                        </p>
                        <Link href={`/client/project/${project.id}/sow`} className="btn btn-accent btn-sm">
                          Review SOW
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Payments</span>
                    </div>
                    {!project.budget ? (
                      <p className="empty-inline">Payment information will appear here once available.</p>
                    ) : (
                      <>
                        <div className="detail-row">
                          <span>Project Value</span>
                          <span>৳{project.budget.toLocaleString('en-US')}</span>
                        </div>
                        <div className="detail-row">
                          <span>Paid</span>
                          <span>৳{totalPaid.toLocaleString('en-US')}</span>
                        </div>
                        <div className="detail-row">
                          <span>Remaining</span>
                          <span>৳{Math.max(0, project.budget - totalPaid).toLocaleString('en-US')}</span>
                        </div>
                        <div className="payment-bar">
                          <div className="payment-fill" style={{ width: `${paymentPct}%` }}></div>
                        </div>
                        <div className="payment-caption">{paymentPct}% Paid</div>
                        {hasPendingPayment ? (
                          <Link href={`/client/project/${project.id}/payments`} className="btn btn-accent btn-sm">
                            View Payment
                          </Link>
                        ) : (
                          <div className="status-badge b-done">
                            <span className="dot"></span>Payments up to date ✓
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>

                {/* ---- Latest Update / Messages ---- */}
                <section className="block content-2col">
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Latest Update</span>
                      {updates.length > 0 && (
                        <Link href={`/client/project/${project.id}/updates`} className="btn btn-ghost btn-sm">
                          View All Updates
                        </Link>
                      )}
                    </div>
                    {!latestUpdate ? (
                      <p className="empty-inline">Your project updates will appear here as work progresses.</p>
                    ) : (
                      <>
                        <div className="update-title">{latestUpdate.title}</div>
                        <div className="update-meta">
                          {formatBnDate(latestUpdate.created_at)} · Posted by {toOne(latestUpdate.author)?.full_name ?? 'FLOW 53 Team'}
                        </div>
                        {latestUpdate.description && <p className="update-body">{latestUpdate.description}</p>}
                        {latestUpdate.attachment_url && (
                          <a className="update-attachment" href={latestUpdate.attachment_url} target="_blank" rel="noopener noreferrer">
                            <Icon name="paperclip" size={12} /> View Attachment
                          </a>
                        )}
                      </>
                    )}
                  </div>
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">
                        Messages{unreadFromTeam > 0 && <span className="unread-dot"></span>}
                      </span>
                      <Link href={`/client/project/${project.id}/messages`} className="btn btn-ghost btn-sm">
                        Open Messages
                      </Link>
                    </div>
                    {!latestMessage ? (
                      <p className="empty-inline">No messages yet.</p>
                    ) : (
                      <div className="msg-preview">
                        <div className="msg-sender">{latestMessage.sender === 'client' ? 'You' : manager?.full_name ?? 'FLOW 53 Team'}</div>
                        <div className="msg-text">{latestMessage.message}</div>
                        <div className="msg-time">{relativeTimeBn(latestMessage.created_at)}</div>
                      </div>
                    )}
                  </div>
                </section>

                {/* ---- Files / Manager ---- */}
                <section className="block content-2col">
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Recent Files</span>
                      <Link href={`/client/project/${project.id}/files`} className="btn btn-ghost btn-sm">
                        View All Files
                      </Link>
                    </div>
                    {files.length === 0 ? (
                      <p className="empty-inline">No files shared yet.</p>
                    ) : (
                      files.map((f) => (
                        <div className="file-row" key={f.id}>
                          <div className="file-icon">
                            <Icon name="file" size={14} />
                          </div>
                          <div className="file-row-main">
                            <div className="file-row-name">{f.name}</div>
                            <div className="file-row-meta">
                              {formatBytes(f.size_bytes)} · {formatBnDate(f.created_at)}
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
                      ))
                    )}
                  </div>
                  <div className="dcard">
                    <div className="dcard-head">
                      <span className="dcard-title">Your Project Manager</span>
                    </div>
                    {manager ? (
                      <>
                        <div className="manager-row">
                          <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
                            {manager.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="manager-name">{manager.full_name}</div>
                            <div className="manager-role">{manager.role ?? 'Project Manager'}</div>
                          </div>
                        </div>
                        <p className="manager-sub">Your main contact for this project.</p>
                        <Link href={`/client/project/${project.id}/messages`} className="btn btn-ghost btn-sm">
                          <Icon name="message" size={12} /> Message
                        </Link>
                      </>
                    ) : (
                      <p className="empty-inline">No project manager assigned yet.</p>
                    )}
                  </div>
                </section>

                {/* ---- Recent Activity ---- */}
                <section className="block dcard">
                  <div className="dcard-head">
                    <span className="dcard-title">Recent Activity</span>
                  </div>
                  {recentActivity.length === 0 ? (
                    <p className="empty-inline">No activity yet.</p>
                  ) : (
                    recentActivity.map((a, i) => (
                      <div className="timeline-item" key={a.key}>
                        <div className="timeline-dot-wrap">
                          <div className="timeline-dot">
                            <Icon name="check" size={10} />
                          </div>
                          {i < recentActivity.length - 1 && <div className="timeline-line"></div>}
                        </div>
                        <div>
                          <div className="timeline-text">{a.text}</div>
                          <div className="timeline-time">{relativeTimeBn(a.time)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
