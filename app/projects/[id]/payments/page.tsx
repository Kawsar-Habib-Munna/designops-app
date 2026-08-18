'use client';

// Screen 12 — Payment Request (admin)। বিদ্যমান invoices/payments টেবিল রিইউজ
// (ফেজ ১৪) — SOW-এর ঠিক same draft/sent প্যাটার্ন: draft ক্লায়েন্টের কাছে RLS-এই
// অদৃশ্য, request_number sow_number-এর মতো অটো-জেনারেটেড, sent_at/viewed_at real
// ট্র্যাকিং (mark_invoice_viewed RPC)। Payment amount কখনো signedSow.project_value-এর
// বিপরীতে চেক করা হয় বাকি (non-cancelled) ইনভয়েসগুলোর যোগফল দিয়ে — "amount
// differs from SOW schedule" ওয়ার্নিং ফ্যাব্রিকেটেড parsing না করে real ডেটা থেকে।
//
// Screen 13 (client-side transaction submission, submit_payment RPC ও admin-এর
// "Confirm Payment" রিভিউ) অপরিবর্তিত রাখা হয়েছে — এটা পরবর্তী স্ক্রিন, এখানে শুধু
// রিইউজ করা হলো যাতে পুরনো ফ্লো ভেঙে না যায়।

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import './payments.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDate, todayISO } from '@/lib/format';
import { uploadFileToDrive } from '@/lib/driveUpload';
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

const TYPE_OPTIONS = ['Initial Deposit', 'Milestone Payment', 'Final Payment', 'Additional Work', 'Custom'];
const DEFAULT_DESCRIPTION: Record<string, string> = {
  'Initial Deposit': 'Initial Project Deposit',
  'Milestone Payment': 'Milestone Payment',
  'Final Payment': 'Final Project Payment',
  'Additional Work': 'Additional Work Payment',
  Custom: '',
};
const METHOD_OPTIONS = ['Bank Transfer', 'bKash', 'Nagad', 'Other'];
const BANK_PLACEHOLDER = `Account Name: ...\nBank: ...\nAccount Number: ...\nReference: (this request's number)`;

function slugify(label: string) {
  return label.toLowerCase().replace(/\s+/g, '_');
}
function humanizeType(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ClientBrief = { company_name: string; primary_contact: string | null };
type ProjectBrief = { id: string; name: string; client_id: string | null; budget: number | null; clients: ClientBrief | ClientBrief[] | null };
type SowBrief = { id: string; status: string; sow_number: string | null; version: number; project_value: number | null; currency: string | null };
type MilestoneRow = { id: string; title: string };
type Invoice = {
  id: string;
  request_number: string | null;
  payment_type: string;
  description: string | null;
  amount: number;
  currency: string;
  percentage: number | null;
  due_date: string | null;
  payment_method: string | null;
  status: string;
  notify_client: boolean;
  sow_id: string | null;
  milestone_id: string | null;
  client_instructions: string | null;
  internal_note: string | null;
  document_url: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};
type Payment = { id: string; invoice_id: string; amount: number | null; payment_method: string | null; transaction_id: string | null; payment_date: string | null; notes: string | null; submitted_by: string; confirmed_at: string | null };

function statusMeta(inv: Invoice): { label: string; cls: string } {
  if (inv.status === 'draft') return { label: 'Draft', cls: 's-todo' };
  if (inv.status === 'cancelled') return { label: 'Cancelled', cls: 's-todo' };
  if (inv.status === 'failed') return { label: 'Failed', cls: 's-danger' };
  if (inv.status === 'refunded') return { label: 'Refunded', cls: 's-review' };
  if (inv.status === 'paid') return { label: 'Paid ✓', cls: 's-done' };
  if (inv.status === 'processing') return { label: 'Under Review', cls: 's-review' };
  if (inv.due_date && inv.due_date < todayISO()) return { label: 'Overdue', cls: 's-overdue' };
  if (inv.viewed_at) return { label: 'Viewed', cls: 's-review' };
  if (inv.sent_at) return { label: 'Sent · Pending Payment', cls: 's-review' };
  return { label: 'Pending Payment', cls: 's-review' };
}

export default function AdminPaymentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [signedSow, setSignedSow] = useState<SowBrief | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fType, setFType] = useState('Initial Deposit');
  const [fAmount, setFAmount] = useState('');
  const [fDescription, setFDescription] = useState(DEFAULT_DESCRIPTION['Initial Deposit']);
  const [fDueDate, setFDueDate] = useState('');
  const [fMethod, setFMethod] = useState('Bank Transfer');
  const [fMilestoneId, setFMilestoneId] = useState('');
  const [fClientInstructions, setFClientInstructions] = useState('');
  const [fInternalNote, setFInternalNote] = useState('');
  const [fNotify, setFNotify] = useState(true);
  const [fDocumentUrl, setFDocumentUrl] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'send' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user || !projectId) return;

    async function run() {
      const [projectRes, sowRes, milestonesRes, invoicesRes, paymentsRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name, client_id, budget, clients(company_name, primary_contact)').eq('id', projectId).maybeSingle(),
        supabase.from('sows').select('id, status, sow_number, version, project_value, currency').eq('project_id', projectId).order('version', { ascending: false }),
        supabase.from('milestones').select('id, title').eq('project_id', projectId).order('position'),
        supabase.from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);

      if (projectRes.error) setError(projectRes.error.message);
      setProject((projectRes.data as unknown as ProjectBrief) ?? null);
      setSignedSow(((sowRes.data as SowBrief[]) ?? []).find((s) => s.status === 'signed') ?? null);
      setMilestones((milestonesRes.data as MilestoneRow[]) ?? []);
      setInvoices((invoicesRes.data as Invoice[]) ?? []);
      setPayments((paymentsRes.data as Payment[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user, projectId, reloadKey]);

  const client = project ? toOne(project.clients) : null;
  const currency = signedSow?.currency ?? 'BDT';
  const projectValue = signedSow?.project_value ?? project?.budget ?? null;
  const committedElsewhere = invoices.filter((i) => i.id !== editingId && !['draft', 'cancelled', 'failed'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0);
  const remainingBalance = projectValue != null ? projectValue - committedElsewhere : null;
  const amountNum = Number(fAmount) || 0;
  const percentage = projectValue && projectValue > 0 ? Math.round((amountNum / projectValue) * 1000) / 10 : null;
  const exceedsRemaining = remainingBalance != null && amountNum > remainingBalance + 0.01;

  function openEditor(existing: Invoice | null) {
    setFormError(null);
    setEditingId(existing?.id ?? null);
    const typeLabel = existing ? (TYPE_OPTIONS.find((o) => slugify(o) === existing.payment_type) ?? 'Custom') : 'Initial Deposit';
    setFType(typeLabel);
    setFAmount(existing ? String(existing.amount) : '');
    setFDescription(existing?.description ?? DEFAULT_DESCRIPTION[typeLabel] ?? '');
    setFDueDate(existing?.due_date ?? '');
    setFMethod(existing?.payment_method ?? 'Bank Transfer');
    setFMilestoneId(existing?.milestone_id ?? '');
    setFClientInstructions(existing?.client_instructions ?? '');
    setFInternalNote(existing?.internal_note ?? '');
    setFNotify(existing?.notify_client ?? true);
    setFDocumentUrl(existing?.document_url ?? null);
    setMode('editor');
  }

  function handleTypeChange(label: string) {
    setFType(label);
    if (!fDescription || Object.values(DEFAULT_DESCRIPTION).includes(fDescription)) {
      setFDescription(DEFAULT_DESCRIPTION[label] ?? '');
    }
  }

  async function handleUploadDoc(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploadingDoc(true);
    try {
      const result = await uploadFileToDrive(file, accessToken);
      setFDocumentUrl(result.webViewLink);
    } catch {
      // silently fail — আপলোড বাটন আবার দেখা যাবে
    }
    setUploadingDoc(false);
  }

  async function handleSave(sendNow: boolean) {
    if (!amountNum || amountNum <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (sendNow && !fDueDate) {
      setFormError('Please choose a due date.');
      return;
    }
    if (!project?.client_id) return;

    setSaving(sendNow ? 'send' : 'draft');
    setFormError(null);

    let requestNumber: string | null = editingId ? (invoices.find((i) => i.id === editingId)?.request_number ?? null) : null;
    if (sendNow && !requestNumber) {
      const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true });
      requestNumber = `PAY-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`;
    }

    const payload: Record<string, unknown> = {
      project_id: projectId,
      client_id: project.client_id,
      payment_type: slugify(fType),
      description: fDescription.trim() || null,
      amount: amountNum,
      currency,
      percentage,
      due_date: fDueDate || null,
      payment_method: fMethod,
      sow_id: signedSow?.id ?? null,
      milestone_id: fMilestoneId || null,
      client_instructions: fClientInstructions.trim() || null,
      internal_note: fInternalNote.trim() || null,
      document_url: fDocumentUrl,
      notify_client: fNotify,
      status: sendNow ? 'pending' : 'draft',
    };
    if (sendNow) payload.sent_at = new Date().toISOString();
    if (requestNumber) payload.request_number = requestNumber;

    const { error: saveError } = editingId ? await supabase.from('invoices').update(payload).eq('id', editingId) : await supabase.from('invoices').insert({ ...payload, created_by: user!.id });

    setSaving(null);
    if (saveError) {
      setFormError(saveError.message);
      return;
    }

    await supabase.from('activity_log').insert({
      actor_id: user!.id,
      action: sendNow ? 'payment_requested' : 'payment_draft_saved',
      entity_type: 'client',
      entity_id: project.client_id,
      detail: sendNow ? `${fType} — ${currency} ${amountNum.toLocaleString('en-US')} পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে` : `${fType} পেমেন্ট রিকোয়েস্ট ড্রাফট সেভ করা হয়েছে`,
    });

    setMode('list');
    setReloadKey((k) => k + 1);
  }

  async function handleCancelRequest() {
    if (!cancelTargetId || !project?.client_id) return;
    setCancelling(true);
    const { error: cancelError } = await supabase.from('invoices').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', cancelTargetId);
    setCancelling(false);
    if (cancelError) return;
    await supabase.from('activity_log').insert({ actor_id: user!.id, action: 'payment_cancelled', entity_type: 'client', entity_id: project.client_id, detail: 'পেমেন্ট রিকোয়েস্ট বাতিল করা হয়েছে' });
    setCancelTargetId(null);
    setReloadKey((k) => k + 1);
  }

  async function handleConfirm(invoiceId: string) {
    const payment = payments.find((p) => p.invoice_id === invoiceId && !p.confirmed_at);
    setConfirmingId(invoiceId);
    if (payment) {
      const receiptNumber = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${payment.id.slice(0, 6).toUpperCase()}`;
      await supabase.from('payments').update({ confirmed_by: user!.id, confirmed_at: new Date().toISOString(), receipt_number: receiptNumber }).eq('id', payment.id);
    }
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
    if (project?.client_id) {
      await supabase.from('activity_log').insert({ actor_id: user!.id, action: 'payment_received', entity_type: 'client', entity_id: project.client_id, detail: 'পেমেন্ট কনফার্ম করা হয়েছে' });
    }
    setConfirmingId(null);
    setReloadKey((k) => k + 1);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`projdetail-root payments-admin-root${dark ? ' dark' : ''}`}>
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
            {loading || !project ? (
              <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : (
              <>
                <div className="breadcrumb">
                  <Link href="/clients">Clients</Link>
                  <span className="sep">/</span>
                  {client && <Link href={`/projects/${project.id}`}>{client.company_name}</Link>}
                  <span className="sep">/</span>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  <span className="sep">/</span>
                  <span className="current">{mode === 'editor' ? 'Payment Request' : 'Payments'}</span>
                </div>

                {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

                {mode === 'list' ? (
                  <>
                    <div className="proj-header">
                      <div>
                        <span className="proj-title">Payments</span>
                        <div className="proj-sub-row">
                          {client && (
                            <>
                              <span>{client.company_name}</span>
                              <span className="dividerdot"></span>
                            </>
                          )}
                          <span>{project.name}</span>
                        </div>
                      </div>
                      {signedSow && (
                        <div className="header-actions">
                          <button className="btn btn-accent btn-sm" onClick={() => openEditor(null)}>
                            <Icon name="plus" size={14} /> Create Payment Request
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="pay-context-card">
                      <div className="pay-context-item">
                        <span className="pay-context-label">Client</span>
                        <span className="pay-context-value">{client?.primary_contact ?? client?.company_name ?? '—'}</span>
                      </div>
                      <div className="pay-context-item">
                        <span className="pay-context-label">Project Value</span>
                        <span className="pay-context-value tabular">{projectValue != null ? `${currency} ${projectValue.toLocaleString('en-US')}` : '—'}</span>
                      </div>
                      <div className="pay-context-item">
                        <span className="pay-context-label">SOW</span>
                        <span className={`status-pill ${signedSow ? 's-done' : 's-todo'}`}>{signedSow ? 'Signed ✓' : 'Not Signed'}</span>
                      </div>
                    </div>

                    {!signedSow && (
                      <div className="summary-card pay-gate-card">
                        <div className="pay-gate-title">SOW signature required</div>
                        <p className="pay-gate-sub">The client must sign the Statement of Work before a payment request can be sent.</p>
                        <Link href={`/projects/${project.id}/sow`} className="btn btn-accent btn-sm">
                          View SOW
                        </Link>
                      </div>
                    )}

                    {invoices.length === 0 ? (
                      <div className="summary-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>এখনো কোনো পেমেন্ট রিকোয়েস্ট তৈরি হয়নি।</p>
                      </div>
                    ) : (
                      <div className="invoice-list">
                        {invoices.map((inv) => {
                          const meta = statusMeta(inv);
                          const submission = payments.find((p) => p.invoice_id === inv.id);
                          const canCancel = !['paid', 'cancelled', 'failed', 'refunded'].includes(inv.status);
                          return (
                            <div className="invoice-card" key={inv.id}>
                              <div className="invoice-card-top">
                                <div>
                                  <div className="invoice-type">
                                    {inv.request_number && <span className="pay-req-number">{inv.request_number}</span>}
                                    {humanizeType(inv.payment_type)}
                                  </div>
                                  <div className="invoice-amount tabular">
                                    {inv.currency} {inv.amount.toLocaleString('en-US')}
                                    {inv.percentage != null && <span className="pay-pct"> · {inv.percentage}%</span>}
                                  </div>
                                </div>
                                <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                              </div>
                              {inv.description && <p className="invoice-desc">{inv.description}</p>}
                              <div className="invoice-meta-row">
                                {inv.due_date && <span>Due {formatBnDate(inv.due_date)}</span>}
                                {inv.payment_method && <span>{inv.payment_method}</span>}
                              </div>

                              {submission && (
                                <div className="invoice-submission">
                                  <div className="invoice-submission-title">Client submitted:</div>
                                  <div className="invoice-submission-grid">
                                    <span>Method: {submission.payment_method ?? '—'}</span>
                                    <span>Transaction ID: {submission.transaction_id ?? '—'}</span>
                                    <span>Date: {formatBnDate(submission.payment_date)}</span>
                                  </div>
                                  {submission.notes && <p className="invoice-submission-notes">{submission.notes}</p>}
                                </div>
                              )}

                              <div className="pay-card-actions">
                                {inv.status === 'draft' && (
                                  <button className="btn btn-ghost btn-sm" onClick={() => openEditor(inv)}>
                                    Edit Draft
                                  </button>
                                )}
                                {inv.status === 'processing' && (
                                  <button className="btn btn-accent btn-sm" onClick={() => handleConfirm(inv.id)} disabled={confirmingId === inv.id}>
                                    {confirmingId === inv.id ? 'কনফার্ম হচ্ছে…' : 'Confirm Payment'}
                                  </button>
                                )}
                                {inv.status === 'paid' && submission && (
                                  <Link href={`/projects/${project.id}/payments/${submission.id}/receipt`} className="btn btn-ghost btn-sm">
                                    View Receipt
                                  </Link>
                                )}
                                {canCancel && (
                                  <button className="btn btn-danger-ghost btn-sm" onClick={() => setCancelTargetId(inv.id)}>
                                    Cancel Request
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="proj-header">
                      <div>
                        <span className="proj-title">{editingId ? 'Edit Payment Request' : 'Create Payment Request'}</span>
                        <div className="proj-sub-row">
                          <span>Request the next project payment from this client.</span>
                        </div>
                      </div>
                      <div className="header-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setMode('list')} disabled={saving !== null}>
                          Cancel
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleSave(false)} disabled={saving !== null}>
                          {saving === 'draft' ? 'সেভ হচ্ছে…' : 'Save Draft'}
                        </button>
                        <button className="btn btn-accent btn-sm" onClick={() => handleSave(true)} disabled={saving !== null}>
                          {saving === 'send' ? 'পাঠানো হচ্ছে…' : 'Send Payment Request'}
                        </button>
                      </div>
                    </div>

                    <div className="pay-context-card">
                      <div className="pay-context-item">
                        <span className="pay-context-label">Client</span>
                        <span className="pay-context-value">
                          {client?.primary_contact ?? client?.company_name} · {client?.company_name}
                        </span>
                      </div>
                      <div className="pay-context-item">
                        <span className="pay-context-label">Project Value</span>
                        <span className="pay-context-value tabular">{projectValue != null ? `${currency} ${projectValue.toLocaleString('en-US')}` : '—'}</span>
                      </div>
                      <div className="pay-context-item">
                        <span className="pay-context-label">SOW</span>
                        <span className="status-pill s-done">Signed ✓</span>
                      </div>
                    </div>

                    {formError && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{formError}</div>}

                    <div className="pay-editor-grid">
                      <div className="pay-form-col">
                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Payment Details
                          </div>
                          <label className="field-label">Payment Type</label>
                          <select className="field-input" value={fType} onChange={(e) => handleTypeChange(e.target.value)}>
                            {TYPE_OPTIONS.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>

                          <div className="field-row">
                            <div>
                              <label className="field-label">Amount ({currency})</label>
                              <input className="field-input" type="number" min="0" step="0.01" value={fAmount} onChange={(e) => setFAmount(e.target.value)} required />
                            </div>
                            <div>
                              <label className="field-label">Percentage of Project Value</label>
                              <input className="field-input" type="text" value={percentage != null ? `${percentage}%` : '—'} disabled />
                            </div>
                          </div>

                          <label className="field-label">Payment For</label>
                          <input className="field-input" type="text" value={fDescription} onChange={(e) => setFDescription(e.target.value)} placeholder="e.g. 50% Initial Deposit" />

                          {exceedsRemaining && <div className="pay-warning-box">This amount differs from the agreed SOW payment schedule — it exceeds the remaining project balance.</div>}
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Payment Schedule Context
                          </div>
                          <div className="pay-breakdown-row">
                            <span>Project Value</span>
                            <span className="tabular">{projectValue != null ? `${currency} ${projectValue.toLocaleString('en-US')}` : '—'}</span>
                          </div>
                          <div className="pay-breakdown-row">
                            <span>Already Requested / Paid</span>
                            <span className="tabular">
                              {currency} {committedElsewhere.toLocaleString('en-US')}
                            </span>
                          </div>
                          <div className="pay-breakdown-row">
                            <span>This Request</span>
                            <span className="tabular">
                              {currency} {amountNum.toLocaleString('en-US')}
                            </span>
                          </div>
                          <div className="pay-breakdown-row pay-breakdown-total">
                            <span>Remaining After This Request</span>
                            <span className="tabular">{remainingBalance != null ? `${currency} ${Math.max(0, remainingBalance - amountNum).toLocaleString('en-US')}` : '—'}</span>
                          </div>
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Due Date
                          </div>
                          <input className="field-input" type="date" min={todayISO()} value={fDueDate} onChange={(e) => setFDueDate(e.target.value)} style={{ marginBottom: 4 }} />
                          <p className="pay-hint">The client will see this deadline in their portal.</p>
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Payment Method
                          </div>
                          <select className="field-input" value={fMethod} onChange={(e) => setFMethod(e.target.value)}>
                            {METHOD_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <label className="field-label">Client Instructions</label>
                          <textarea className="field-input" rows={4} value={fClientInstructions} onChange={(e) => setFClientInstructions(e.target.value)} placeholder={fMethod === 'Bank Transfer' ? BANK_PLACEHOLDER : `How should ${client?.primary_contact ?? 'the client'} send this payment?`} style={{ resize: 'vertical' }} />
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Related Milestone (optional)
                          </div>
                          <select className="field-input" value={fMilestoneId} onChange={(e) => setFMilestoneId(e.target.value)} style={{ marginBottom: 0 }}>
                            <option value="">No milestone</option>
                            {milestones.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Invoice / Attachment (optional)
                          </div>
                          <input ref={docInputRef} type="file" hidden onChange={handleUploadDoc} />
                          {fDocumentUrl ? (
                            <div className="pay-doc-row">
                              <a href={fDocumentUrl} target="_blank" rel="noopener noreferrer" className="pay-doc-link">
                                📄 View attached document ↗
                              </a>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFDocumentUrl(null)}>
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => docInputRef.current?.click()} disabled={uploadingDoc}>
                              <Icon name="upload" size={13} /> {uploadingDoc ? 'আপলোড হচ্ছে…' : 'Attach Document'}
                            </button>
                          )}
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 10 }}>
                            Notification
                          </div>
                          <label className="notify-row">
                            <input type="checkbox" checked={fNotify} onChange={(e) => setFNotify(e.target.checked)} /> Notify Client
                          </label>
                          <p className="pay-hint">Send the client a notification when this payment request is sent.</p>
                        </div>

                        <div className="summary-card">
                          <div className="dcard-title" style={{ marginBottom: 14 }}>
                            Internal Note (optional)
                          </div>
                          <textarea className="field-input" rows={3} value={fInternalNote} onChange={(e) => setFInternalNote(e.target.value)} placeholder="Visible to team only — never shown to the client." style={{ resize: 'vertical', marginBottom: 0 }} />
                        </div>
                      </div>

                      <aside className="pay-summary-col">
                        <div className="summary-card pay-summary-sticky">
                          <div className="dcard-title" style={{ marginBottom: 12 }}>
                            Request Summary
                          </div>
                          <div className="pay-sum-row">
                            <span>Client</span>
                            <span>{client?.primary_contact ?? client?.company_name ?? '—'}</span>
                          </div>
                          <div className="pay-sum-row">
                            <span>Project</span>
                            <span>{project.name}</span>
                          </div>
                          <div className="pay-sum-row">
                            <span>Payment Type</span>
                            <span>{fType}</span>
                          </div>
                          <div className="pay-sum-row">
                            <span>Amount</span>
                            <span className="tabular">
                              {currency} {amountNum.toLocaleString('en-US')}
                            </span>
                          </div>
                          <div className="pay-sum-row">
                            <span>Due</span>
                            <span>{fDueDate ? formatBnDate(fDueDate) : '—'}</span>
                          </div>
                          <div className="pay-sum-row">
                            <span>Method</span>
                            <span>{fMethod}</span>
                          </div>
                          <div className="pay-sum-row">
                            <span>SOW</span>
                            <span>Signed ✓</span>
                          </div>
                          <div className="pay-sum-row">
                            <span>Notify Client</span>
                            <span>{fNotify ? 'ON' : 'OFF'}</span>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {cancelTargetId && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelTargetId(null);
          }}
        >
          <div className="modal-box">
            <div className="modal-title" style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              Cancel payment request?
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0 }}>This request will no longer be payable by the client.</p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCancelTargetId(null)} disabled={cancelling}>
                Keep Request
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={handleCancelRequest} disabled={cancelling}>
                {cancelling ? 'বাতিল হচ্ছে…' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
