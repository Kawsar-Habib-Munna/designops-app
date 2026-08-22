'use client';

// Screen 12 — Payments (client)। v3: এখন একটা কনসোলিডেটেড payments hub —
// Payment Schedule (timeline, বিদ্যমান SOW-signed project value থেকে), Payment
// Summary counts, ফিল্টারযোগ্য Payment History টেবিল (real CSV export সহ),
// আর একটা "View Payment Request" বাটন যেটা বর্তমান actionable (pending/
// processing) রিকোয়েস্টে নিয়ে যায় — Screen 14 (Payment History)-এর ডেটা
// এখানেই দেখানো হচ্ছে যেহেতু ইউজার এক্সপ্লিসিটলি এই কনসোলিডেটেড ভিউ চেয়েছেন,
// কোনো নতুন টেবিল/মডেল লাগেনি, বিদ্যমান invoices/payments-ই একমাত্র সোর্স।
//
// "Continue to Payment"/সাবমিশন এখনো dedicated Screen 13 (./confirm) রুটেই হয়
// (submit_payment RPC, proof আপলোড, correction/resubmit ফ্লো) — এই পাতা শুধু
// দেখায়/লিংক করে, কোনো ডুপ্লিকেট ফর্ম না। internal_note কলাম এখানে কখনো select
// করা হয় না — client-safe কলাম লিস্টই একমাত্র সুরক্ষা।

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './payments.css';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H8"/><circle cx="16" cy="14" r="1.5"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ProjectBrief = { id: string; name: string; client_id: string; budget: number | null };
type SowBrief = { id: string; sow_number: string | null; version: number; status: string; project_value: number | null; currency: string | null };
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
  sow_id: string | null;
  created_at: string;
};
type Payment = { id: string; invoice_id: string; payment_method: string | null; transaction_id: string | null; payment_date: string | null; confirmed_at: string | null; status: string; receipt_number: string | null };

const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';
const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'overdue', label: 'Overdue' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function humanizeType(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type ScheduleKey = Exclude<TabKey, 'all'> | 'other';
function scheduleStatus(inv: Invoice, today: string): { key: ScheduleKey; label: string } {
  if (inv.status === 'paid') return { key: 'paid', label: 'Paid' };
  if (inv.status === 'processing') return { key: 'pending', label: 'Pending' };
  if (inv.status === 'cancelled') return { key: 'other', label: 'Cancelled' };
  if (inv.status === 'failed') return { key: 'other', label: 'Failed' };
  if (inv.due_date && inv.due_date < today) return { key: 'overdue', label: 'Overdue' };
  return { key: 'upcoming', label: 'Upcoming' };
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- shared sidebar/topbar shell (identical structure to Screen 9/10) ----
function PaymentsShell({
  project,
  client,
  mobileNavOpen,
  setMobileNavOpen,
  onSignOut,
  children,
}: {
  project: { id: string; name: string };
  client: ClientRecord;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
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
            <Link href={`/client/project/${project.id}`} className="nav-item">
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
            <Link href={`/client/project/${project.id}/payments`} className="nav-item active">
              <Icon name="card" /> Payments
            </Link>
          </nav>
        </div>
        <button type="button" className="profile-card" onClick={onSignOut} title="Sign out">
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
          <span className="topbar-title">Payments</span>
        </header>

        <main className="content">
          <div className="breadcrumb">
            <Link href="/client/dashboard">Client Portal</Link> / Payments
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ClientPaymentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sows, setSows] = useState<SowBrief[]>([]);
  const [filterTab, setFilterTab] = useState<TabKey>('all');

  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const { data: projectData } = await supabase.from('projects').select('id, name, client_id, budget').eq('id', projectId).maybeSingle();
        if (!projectData || (projectData as ProjectBrief).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(projectData as ProjectBrief);
        setClient(own);

        const [invoicesRes, paymentsRes, sowsRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('id, request_number, payment_type, description, amount, currency, percentage, due_date, payment_method, status, sow_id, created_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true }),
          supabase.from('payments').select('id, invoice_id, payment_method, transaction_id, payment_date, confirmed_at, status, receipt_number').eq('project_id', projectId).order('created_at', { ascending: false }),
          supabase.from('sows').select('id, sow_number, version, status, project_value, currency').eq('project_id', projectId),
        ]);
        const invoiceRows = (invoicesRes.data as Invoice[]) ?? [];
        setInvoices(invoiceRows);
        setPayments((paymentsRes.data as Payment[]) ?? []);
        setSows((sowsRes.data as SowBrief[]) ?? []);

        const actionable = invoiceRows.find((i) => i.status === 'pending' || i.status === 'processing');
        if (actionable && actionable.status === 'pending') {
          await supabase.rpc('mark_invoice_viewed', { p_invoice_id: actionable.id });
        }

        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    load();
  }, [router, projectId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  if (loading) {
    return (
      <div className="client-portal client-payments-root">
        <div className="shell">
          <aside className="sidebar">
            <div style={{ height: 30 }} />
          </aside>
          <div className="main">
            <main className="content">
              <div className="skel" style={{ height: 60, marginBottom: 18 }} />
              <div className="skel" style={{ height: 320, marginBottom: 18 }} />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-payments-root">
        <div className="pm-bare-shell">
          <div className="pm-state-card">
            <div className="pm-state-title">Unable to load payments</div>
            <p className="pm-state-sub">Please try again.</p>
            <div className="pm-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}`} className="cp-btn cp-btn-secondary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="client-portal client-payments-root">
        <PaymentsShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
          <div className="pm-state-card">
            <div className="pm-state-title">No payments yet</div>
            <p className="pm-state-sub">Payment requests will appear here when action is required.</p>
            <div className="pm-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">
                Back to Project
              </Link>
            </div>
          </div>
        </PaymentsShell>
      </div>
    );
  }

  const today = todayISO();
  const signedSow = sows.find((s) => s.status === 'signed') ?? null;
  const currency = signedSow?.currency ?? invoices[0]?.currency ?? 'BDT';
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  const totalValue = signedSow?.project_value ?? project.budget ?? null;
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const outstanding = totalValue != null ? Math.max(0, totalValue - totalPaid) : null;
  const paymentPct = totalValue && totalValue > 0 ? Math.min(100, Math.round((totalPaid / totalValue) * 100)) : 0;

  const actionable = invoices.find((i) => i.status === 'pending' || i.status === 'processing');

  const counts = { paid: 0, pending: 0, upcoming: 0, overdue: 0 };
  invoices.forEach((inv) => {
    const key = scheduleStatus(inv, today).key;
    if (key !== 'other') counts[key] += 1;
  });

  const filteredInvoices = filterTab === 'all' ? invoices : invoices.filter((inv) => scheduleStatus(inv, today).key === filterTab);
  const tableRows = [...filteredInvoices].reverse();

  function handleExport() {
    if (!project) return;
    const rows: string[][] = [['Payment', 'Description', 'Amount', 'Currency', 'Date', 'Method', 'Status', 'Receipt']];
    invoices.forEach((inv) => {
      const pay = payments.find((p) => p.invoice_id === inv.id);
      const status = scheduleStatus(inv, today);
      rows.push([inv.request_number ?? '', inv.description || humanizeType(inv.payment_type), inv.amount.toFixed(2), inv.currency, pay?.payment_date ?? inv.due_date ?? '', pay?.payment_method ?? inv.payment_method ?? '', status.label, pay?.receipt_number ?? '']);
    });
    downloadCsv(`payments-${project.name.replace(/\s+/g, '-').toLowerCase()}.csv`, rows);
  }

  return (
    <div className="client-portal client-payments-root">
      <PaymentsShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="pm-top-row">
          <div>
            <h1 className="pm-title">Payments</h1>
            <p className="pm-page-sub">Track your project payments, balances and receipts.</p>
          </div>
          <div className="pm-top-actions">
            {actionable && (
              <Link href={`/client/project/${project.id}/payments/confirm`} className="cp-btn cp-btn-primary cp-btn-sm">
                <Icon name="doc" size={13} /> View Payment Request
              </Link>
            )}
            <a
              href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I have a question about my payments for ${project.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pm-help-link"
            >
              <Icon name="help" size={13} /> Need help? Contact your project manager
            </a>
          </div>
        </div>

        {/* ---- stat strip ---- */}
        <div className="pm-stat-strip">
          <div className="pm-stat">
            <div className="pm-stat-icon">
              <Icon name="card" size={16} />
            </div>
            <div>
              <div className="pm-stat-label">Project Value</div>
              <div className="pm-stat-value tabular">{totalValue != null ? `${sym}${totalValue.toLocaleString('en-US')}` : '—'}</div>
            </div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-icon positive">
              <Icon name="wallet" size={16} />
            </div>
            <div>
              <div className="pm-stat-label">Total Paid</div>
              <div className="pm-stat-value tabular" style={{ color: 'var(--positive)' }}>
                {sym}
                {totalPaid.toLocaleString('en-US')}
              </div>
            </div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-icon warning">
              <Icon name="clock" size={16} />
            </div>
            <div>
              <div className="pm-stat-label">Outstanding</div>
              <div className="pm-stat-value tabular" style={{ color: outstanding && outstanding > 0 ? 'var(--warning)' : 'var(--ink)' }}>
                {outstanding != null ? `${sym}${outstanding.toLocaleString('en-US')}` : '—'}
              </div>
            </div>
          </div>
          <div className="pm-progress-block">
            <div className="pm-progress-top">
              <span className="pm-progress-label">Payment Progress</span>
              <span className="pm-progress-pct">{paymentPct}% Paid</span>
            </div>
            <div className="pm-progress-track">
              <div className="pm-progress-fill" style={{ width: `${paymentPct}%` }} />
            </div>
            {outstanding != null && (
              <div className="pm-progress-caption">
                {sym}
                {totalPaid.toLocaleString('en-US')} paid · {sym}
                {outstanding.toLocaleString('en-US')} remaining
              </div>
            )}
          </div>
        </div>

        <div className="pm-main-grid">
          {/* ---- Payment Schedule ---- */}
          <div className="pm-card">
            <div className="pm-card-head">
              <div>
                <div className="pm-card-title">Payment Schedule</div>
                {signedSow && (
                  <div className="pm-card-sub">
                    Based on signed {signedSow.sow_number ?? `v${signedSow.version}`} · v{signedSow.version}.0
                  </div>
                )}
              </div>
              {signedSow && (
                <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">
                  View Signed SOW
                </Link>
              )}
            </div>

            <div className="pm-schedule-list">
              {invoices.map((inv, i) => {
                const status = scheduleStatus(inv, today);
                const pay = payments.find((p) => p.invoice_id === inv.id);
                return (
                  <div className="pm-schedule-item" key={inv.id}>
                    <div className="pm-schedule-marker">
                      <div className={`pm-schedule-dot ${status.key}`}>{status.key === 'paid' ? '✓' : status.key === 'pending' ? '⏱' : ''}</div>
                      {i < invoices.length - 1 && <div className="pm-schedule-line" />}
                    </div>
                    <div className="pm-schedule-body">
                      <div className="pm-schedule-top">
                        <div>
                          <div className="pm-schedule-name">{inv.description || humanizeType(inv.payment_type)}</div>
                          <div className="pm-schedule-pct">{inv.percentage != null ? `${inv.percentage}% of project value` : humanizeType(inv.payment_type)}</div>
                        </div>
                        <div className="pm-schedule-right">
                          <span className="pm-schedule-amount tabular">
                            {inv.currency} {inv.amount.toLocaleString('en-US')}
                          </span>
                          <span className={`pm-status-pill ${status.key}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="pm-schedule-meta">
                        {status.key === 'paid' && pay?.payment_date ? `Paid on ${formatBnDateLong(pay.payment_date)}` : inv.due_date ? `Due ${formatBnDateLong(inv.due_date)}` : 'Due before project completion'}
                        {pay?.receipt_number && (
                          <Link href={`/client/project/${project.id}/payments/${pay.id}/receipt`} className="pm-receipt-link">
                            Receipt: {pay.receipt_number}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Payment Summary counts ---- */}
          <div className="pm-card">
            <div className="pm-card-title">Payment Summary</div>
            <div className="pm-count-row">
              <div className="pm-count-icon positive">
                <Icon name="check" size={13} />
              </div>
              <span>Paid</span>
              <strong>{counts.paid}</strong>
            </div>
            <div className="pm-count-row">
              <div className="pm-count-icon warning">
                <Icon name="clock" size={13} />
              </div>
              <span>Pending</span>
              <strong>{counts.pending}</strong>
            </div>
            <div className="pm-count-row">
              <div className="pm-count-icon accent">
                <Icon name="clock" size={13} />
              </div>
              <span>Upcoming</span>
              <strong>{counts.upcoming}</strong>
            </div>
            <div className="pm-count-row">
              <div className="pm-count-icon danger">
                <Icon name="alert" size={13} />
              </div>
              <span>Overdue</span>
              <strong>{counts.overdue}</strong>
            </div>
            <p className="pm-currency-note">
              All amounts are in {currency} ({sym})
            </p>
          </div>
        </div>

        {/* ---- Payment History table ---- */}
        <div className="pm-card pm-history-card">
          <div className="pm-card-head">
            <div>
              <div className="pm-card-title">Payment History</div>
              <div className="pm-card-sub">A record of all payment requests and transactions.</div>
            </div>
            <div className="pm-history-actions">
              <div className="pm-tabs">
                {TABS.map((t) => (
                  <button key={t.key} type="button" className={`pm-tab${filterTab === t.key ? ' active' : ''}`} onClick={() => setFilterTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={handleExport}>
                <Icon name="download" size={13} /> Export
              </button>
            </div>
          </div>

          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Receipt</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="pm-table-empty">
                      No payments in this category.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((inv) => {
                    const status = scheduleStatus(inv, today);
                    const pay = payments.find((p) => p.invoice_id === inv.id);
                    return (
                      <tr key={inv.id}>
                        <td>
                          <div className="pm-table-payment">
                            <div className={`pm-table-icon ${status.key}`}>
                              <Icon name={status.key === 'paid' ? 'check' : 'clock'} size={13} />
                            </div>
                            <div>
                              <div className="pm-table-type">{humanizeType(inv.payment_type)}</div>
                              {inv.request_number && <div className="pm-table-ref">{inv.request_number}</div>}
                            </div>
                          </div>
                        </td>
                        <td>{inv.description || '—'}</td>
                        <td className="tabular">
                          {inv.currency} {inv.amount.toLocaleString('en-US')}
                        </td>
                        <td>{status.key === 'paid' && pay?.payment_date ? formatBnDateLong(pay.payment_date) : inv.due_date ? formatBnDateLong(inv.due_date) : '—'}</td>
                        <td>{pay?.payment_method ?? inv.payment_method ?? '—'}</td>
                        <td>
                          <span className={`pm-status-pill ${status.key}`}>{status.label}</span>
                        </td>
                        <td>{pay?.receipt_number ?? '—'}</td>
                        <td>
                          {status.key === 'paid' && pay ? (
                            <Link href={`/client/project/${project.id}/payments/${pay.id}/receipt`} className="pm-table-action">
                              View Receipt
                            </Link>
                          ) : inv.status === 'pending' || inv.status === 'processing' ? (
                            <Link href={`/client/project/${project.id}/payments/confirm`} className="pm-table-action">
                              View Payment
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- trust banner ---- */}
        <div className="pm-trust-banner">
          <div className="pm-trust-icon">
            <Icon name="shield" size={18} />
          </div>
          <div className="pm-trust-body">
            <div className="pm-trust-title">Secure &amp; Transparent</div>
            <p className="pm-trust-desc">Your payment information is only ever visible to you and your project team. Receipts are available once payments are confirmed.</p>
          </div>
          <div className="pm-trust-lock">
            <Icon name="lock" size={13} /> We never store your card or bank details.
          </div>
        </div>
      </PaymentsShell>
    </div>
  );
}
