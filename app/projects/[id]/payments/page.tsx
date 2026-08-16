'use client';

// Screen 12/13 (admin half) — Payment Request + Confirm Payment। কোনো পেমেন্ট
// গেটওয়ে নেই বলে ম্যানুয়াল ফ্লো: এডমিন invoice তৈরি করে → ক্লায়েন্ট নিজের
// transaction id/method জমা দেয় (submit_payment RPC, Screen 13 ক্লায়েন্ট-সাইড) →
// invoice.status 'processing' হয়ে যায় → এডমিন এখানে সেই সাবমিশন দেখে ব্যাংক/
// মোবাইল-ওয়ালেট স্টেটমেন্টের সাথে মিলিয়ে "Confirm Payment" চাপে → 'paid'।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import './payments.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDate } from '@/lib/format';
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
  pending: { label: 'Pending', cls: 's-todo' },
  processing: { label: 'Processing', cls: 's-review' },
  paid: { label: 'Paid ✓', cls: 's-done' },
  failed: { label: 'Failed', cls: 's-todo' },
  cancelled: { label: 'Cancelled', cls: 's-todo' },
  refunded: { label: 'Refunded', cls: 's-review' },
};
const PAYMENT_TYPE_OPTIONS = ['Deposit', 'Milestone', 'Final Payment', 'Additional Payment'];

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ProjectBrief = { id: string; name: string; client_id: string | null; clients: { company_name: string } | { company_name: string }[] | null };
type Invoice = { id: string; payment_type: string; amount: number; currency: string; description: string | null; due_date: string | null; payment_method: string | null; status: string; notify_client: boolean; created_at: string };
type Payment = { id: string; invoice_id: string; amount: number | null; payment_method: string | null; transaction_id: string | null; payment_date: string | null; notes: string | null; submitted_by: string; confirmed_at: string | null };

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState('Deposit');
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState('BDT');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newMethod, setNewMethod] = useState('');
  const [newNotify, setNewNotify] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) return;

    async function run() {
      const [projectRes, invoicesRes, paymentsRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name, client_id, clients(company_name)').eq('id', projectId).maybeSingle(),
        supabase.from('invoices').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);

      if (projectRes.error) setError(projectRes.error.message);
      setProject((projectRes.data as unknown as ProjectBrief) ?? null);
      setInvoices((invoicesRes.data as Invoice[]) ?? []);
      setPayments((paymentsRes.data as Payment[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user, projectId, reloadKey]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newAmount || !project?.client_id) return;
    setCreating(true);
    const { error: createError } = await supabase.from('invoices').insert({
      project_id: projectId,
      client_id: project.client_id,
      payment_type: newType.toLowerCase().replace(' ', '_'),
      amount: Number(newAmount),
      currency: newCurrency,
      description: newDescription.trim() || null,
      due_date: newDueDate || null,
      payment_method: newMethod.trim() || null,
      notify_client: newNotify,
      created_by: user!.id,
    });
    setCreating(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    await supabase.from('activity_log').insert({ actor_id: user!.id, action: 'payment_requested', entity_type: 'client', entity_id: project.client_id, detail: `${newType} — ${newCurrency} ${Number(newAmount).toLocaleString('en-US')} পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে` });
    setNewType('Deposit');
    setNewAmount('');
    setNewCurrency('BDT');
    setNewDescription('');
    setNewDueDate('');
    setNewMethod('');
    setNewNotify(true);
    setShowCreate(false);
    setReloadKey((k) => k + 1);
  }

  async function handleConfirm(invoiceId: string) {
    const payment = payments.find((p) => p.invoice_id === invoiceId && !p.confirmed_at);
    setConfirmingId(invoiceId);
    if (payment) {
      await supabase.from('payments').update({ confirmed_by: user!.id, confirmed_at: new Date().toISOString() }).eq('id', payment.id);
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

  const client = project ? toOne(project.clients) : null;

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
                  <Link href="/projects">Projects</Link>
                  <span className="sep">/</span>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  <span className="sep">/</span>
                  <span className="current">Payments</span>
                </div>

                {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

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
                  <div className="header-actions">
                    <button className="btn btn-accent btn-sm" onClick={() => setShowCreate(true)}>
                      <Icon name="plus" size={14} /> Create Payment Request
                    </button>
                  </div>
                </div>

                {invoices.length === 0 ? (
                  <div className="summary-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>এখনো কোনো পেমেন্ট রিকোয়েস্ট তৈরি হয়নি।</p>
                  </div>
                ) : (
                  <div className="invoice-list">
                    {invoices.map((inv) => {
                      const meta = STATUS_META[inv.status] ?? { label: inv.status, cls: 's-todo' };
                      const submission = payments.find((p) => p.invoice_id === inv.id);
                      return (
                        <div className="invoice-card" key={inv.id}>
                          <div className="invoice-card-top">
                            <div>
                              <div className="invoice-type">{inv.payment_type.replace('_', ' ')}</div>
                              <div className="invoice-amount tabular">
                                {inv.currency} {inv.amount.toLocaleString('en-US')}
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

                          {inv.status === 'processing' && (
                            <button className="btn btn-accent btn-sm" onClick={() => handleConfirm(inv.id)} disabled={confirmingId === inv.id}>
                              {confirmingId === inv.id ? 'কনফার্ম হচ্ছে…' : 'Confirm Payment'}
                            </button>
                          )}
                        </div>
                      );
                    })}
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
            <div className="modal-title" style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-soft)' }}>
              Create Payment Request
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ padding: 18 }}>
                <label className="field-label">Payment Type</label>
                <select className="field-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
                  {PAYMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>

                <div className="field-row">
                  <div>
                    <label className="field-label">Amount</label>
                    <input className="field-input" type="number" min="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} required autoFocus />
                  </div>
                  <div>
                    <label className="field-label">Currency</label>
                    <select className="field-input" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
                      <option value="BDT">BDT</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <label className="field-label">Description</label>
                <input className="field-input" type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="ঐচ্ছিক" />

                <div className="field-row">
                  <div>
                    <label className="field-label">Due Date</label>
                    <input className="field-input" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Payment Method</label>
                    <input className="field-input" type="text" value={newMethod} onChange={(e) => setNewMethod(e.target.value)} placeholder="যেমন: Bank Transfer" />
                  </div>
                </div>

                <label className="notify-row" style={{ marginTop: 4 }}>
                  <input type="checkbox" checked={newNotify} onChange={(e) => setNewNotify(e.target.checked)} /> Notify Client
                </label>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>
                  বাতিল
                </button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !newAmount}>
                  {creating ? 'তৈরি হচ্ছে…' : 'Create Payment Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
