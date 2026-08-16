'use client';

// Screen 9 — Client Project Dashboard। Screen 5 (client/dashboard)-এর "no project
// yet" খালি-স্টেটের পরের ধাপ — এখানেই ক্লায়েন্ট তার নির্দিষ্ট প্রজেক্টের real progress,
// client-safe milestones (বিদ্যমান milestones টেবিল, admin /projects/[id]-এ যা
// তৈরি করে সেটাই read-only), SOW/Payment status আর recent files দেখে। Messages
// (Screen 18) ও Feedback (Screen 17) এখনো তৈরি হয়নি বলে সেগুলোর জন্য কোনো ভুয়া
// বাটন রাখা হয়নি — শুধু যা বাস্তবে কাজ করে (SOW, Payments, Files) তাই দেখানো হয়েছে।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient } from '@/lib/clientPortal';
import { formatBnDate } from '@/lib/format';
import '../../client-shared.css';
import './project-dashboard.css';

type ManagerBrief = { full_name: string; avatar_url: string | null } | null;
type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  start_date: string | null;
  due_date: string | null;
  description: string | null;
  client_id: string;
  final_delivery_status: string | null;
  project_manager: ManagerBrief | ManagerBrief[] | null;
};
type Milestone = { id: string; title: string; due_date: string | null; completed_at: string | null; progress: number | null };
type FileRow = { id: string; name: string; file_type: string | null; created_at: string };
type InvoiceBrief = { id: string; amount: number; currency: string; due_date: string | null; status: string };
type SowBrief = { id: string; status: string; version: number };

const PROJECT_STATUS_LABEL: Record<string, string> = { active: 'Active', review: 'In Review', completed: 'Completed', on_hold: 'On Hold' };

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function ClientProjectDashboard() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceBrief[]>([]);
  const [sow, setSow] = useState<SowBrief | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const client = await fetchOwnClient();
        if (!client) {
          router.replace('/client/sign-in');
          return;
        }

        const [projectRes, milestonesRes, filesRes, invoicesRes, sowRes] = await Promise.all([
          supabase
            .from('projects')
            .select('id, name, status, progress, start_date, due_date, description, client_id, final_delivery_status, project_manager:profiles!project_manager_id(full_name, avatar_url)')
            .eq('id', projectId)
            .maybeSingle(),
          supabase.from('milestones').select('id, title, due_date, completed_at, progress').eq('project_id', projectId).order('position'),
          supabase.from('client_files').select('id, name, file_type, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('invoices').select('id, amount, currency, due_date, status').eq('project_id', projectId).order('due_date'),
          supabase.from('sows').select('id, status, version').eq('project_id', projectId).order('version', { ascending: false }).limit(1),
        ]);

        if (!projectRes.data || (projectRes.data as ProjectDetail).client_id !== client.id) {
          router.replace('/client/dashboard');
          return;
        }

        setProject(projectRes.data as unknown as ProjectDetail);
        setMilestones((milestonesRes.data as Milestone[]) ?? []);
        setFiles((filesRes.data as FileRow[]) ?? []);
        setInvoices((invoicesRes.data as InvoiceBrief[]) ?? []);
        setSow((sowRes.data?.[0] as SowBrief) ?? null);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId]);

  if (loading || !project) {
    return (
      <div className="client-portal client-projectdash-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  const manager = toOne(project.project_manager);
  const pendingInvoice = invoices.find((i) => i.status === 'pending') ?? null;

  let pendingAction: { text: string; href: string; cta: string } | null = null;
  if (sow && sow.status === 'sent') {
    pendingAction = { text: 'Your Statement of Work is ready for review and signature.', href: `/client/project/${project.id}/sow`, cta: 'Review & Sign SOW' };
  } else if (pendingInvoice) {
    pendingAction = { text: `Payment of ${pendingInvoice.currency} ${pendingInvoice.amount.toLocaleString('en-US')} is due${pendingInvoice.due_date ? ` on ${formatBnDate(pendingInvoice.due_date)}` : ''}.`, href: `/client/project/${project.id}/payments`, cta: 'View Payment' };
  }

  return (
    <div className="client-portal client-projectdash-root">
      <div className="pd-shell">
        <div className="pd-top">
          <Link href="/client/dashboard" className="pd-back">
            ← Dashboard
          </Link>
        </div>

        <div className="pd-header">
          <div>
            <h1 className="pd-title">{project.name}</h1>
            <div className="pd-sub-row">
              <span className="cp-badge cp-badge-pending">{PROJECT_STATUS_LABEL[project.status] ?? project.status}</span>
              {manager && <span className="pd-manager">Contact: {manager.full_name}</span>}
            </div>
          </div>
          <div className="pd-progress-ring">
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="23" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle
                cx="28"
                cy="28"
                r="23"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="144.5"
                strokeDashoffset={144.5 - (144.5 * (project.progress ?? 0)) / 100}
                transform="rotate(-90 28 28)"
              />
              <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">
                {project.progress ?? 0}%
              </text>
            </svg>
          </div>
        </div>

        {pendingAction && (
          <div className="pd-action-banner">
            <div>
              <div className="pd-action-label">Action Needed</div>
              <div className="pd-action-text">{pendingAction.text}</div>
            </div>
            <Link href={pendingAction.href} className="cp-btn cp-btn-primary">
              {pendingAction.cta}
            </Link>
          </div>
        )}

        <div className="pd-stat-grid">
          <div>
            <div className="pd-stat-label">Start Date</div>
            <div className="pd-stat-value">{formatBnDate(project.start_date) || '—'}</div>
          </div>
          <div>
            <div className="pd-stat-label">Expected Delivery</div>
            <div className="pd-stat-value">{formatBnDate(project.due_date) || '—'}</div>
          </div>
          <div>
            <div className="pd-stat-label">SOW Status</div>
            <div className="pd-stat-value">{sow ? (sow.status === 'signed' ? 'Signed ✓' : sow.status === 'sent' ? 'Awaiting Signature' : 'Draft') : 'Not yet created'}</div>
          </div>
        </div>

        {project.description && <p className="pd-description">{project.description}</p>}

        <div className="pd-action-row">
          <Link href={`/client/project/${project.id}/sow`} className="pd-action-card">
            <span className="pd-action-card-title">Statement of Work</span>
            <span className="pd-action-card-sub">{sow ? `v${sow.version} · ${sow.status}` : 'Not yet available'}</span>
          </Link>
          <Link href={`/client/project/${project.id}/payments`} className="pd-action-card">
            <span className="pd-action-card-title">Payments</span>
            <span className="pd-action-card-sub">{invoices.length > 0 ? `${invoices.length} invoice${invoices.length > 1 ? 's' : ''}` : 'No invoices yet'}</span>
          </Link>
          <Link href={`/client/project/${project.id}/progress`} className="pd-action-card">
            <span className="pd-action-card-title">Progress</span>
            <span className="pd-action-card-sub">{milestones.length > 0 ? `${milestones.length} milestones` : 'Not yet set'}</span>
          </Link>
          <Link href={`/client/project/${project.id}/files`} className="pd-action-card">
            <span className="pd-action-card-title">Files</span>
            <span className="pd-action-card-sub">{files.length > 0 ? `${files.length} recent` : 'None yet'}</span>
          </Link>
          <Link href={`/client/project/${project.id}/feedback`} className="pd-action-card">
            <span className="pd-action-card-title">Feedback</span>
            <span className="pd-action-card-sub">Share your thoughts</span>
          </Link>
          <Link href={`/client/project/${project.id}/messages`} className="pd-action-card">
            <span className="pd-action-card-title">Messages</span>
            <span className="pd-action-card-sub">Talk to your team</span>
          </Link>
          <Link href={`/client/project/${project.id}/approvals`} className="pd-action-card">
            <span className="pd-action-card-title">Approvals</span>
            <span className="pd-action-card-sub">Review deliverables</span>
          </Link>
          <Link href={`/client/project/${project.id}/change-requests`} className="pd-action-card">
            <span className="pd-action-card-title">Change Requests</span>
            <span className="pd-action-card-sub">Request an update</span>
          </Link>
          <Link href={`/client/project/${project.id}/updates`} className="pd-action-card">
            <span className="pd-action-card-title">Updates</span>
            <span className="pd-action-card-sub">Project announcements</span>
          </Link>
          {project.final_delivery_status && (
            <Link href={`/client/project/${project.id}/final-delivery`} className="pd-action-card">
              <span className="pd-action-card-title">Final Delivery</span>
              <span className="pd-action-card-sub">{project.final_delivery_status === 'approved' ? 'Approved ✓' : 'Review needed'}</span>
            </Link>
          )}
        </div>

        <div className="cp-dash-card">
          <div className="pd-section-title">Project Progress</div>
          {milestones.length === 0 ? (
            <p className="pd-empty">Your project milestones will appear here once our team sets them up.</p>
          ) : (
            <div className="pd-milestone-list">
              {milestones.map((m) => {
                const status = m.completed_at ? 'done' : (m.progress ?? 0) > 0 ? 'active' : 'pending';
                return (
                  <div className="pd-milestone" key={m.id}>
                    <span className={`pd-milestone-dot pd-milestone-${status}`}>{status === 'done' ? '✓' : status === 'active' ? '●' : '○'}</span>
                    <span className="pd-milestone-title">{m.title}</span>
                    {m.completed_at && <span className="pd-milestone-date">{formatBnDate(m.completed_at)}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cp-dash-card">
          <div className="pd-section-title">Recent Files</div>
          {files.length === 0 ? (
            <p className="pd-empty">No files have been shared yet.</p>
          ) : (
            <div className="pd-file-list">
              {files.map((f) => (
                <div className="pd-file-row" key={f.id}>
                  <span className="pd-file-name">{f.name}</span>
                  <span className="pd-file-date">{formatBnDate(f.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
