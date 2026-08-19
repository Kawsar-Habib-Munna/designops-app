'use client';

// Screen 12 — Payment Request (client)। বিদ্যমান invoices/payments টেবিল রিইউজ
// (ফেজ ১৪)। সবচেয়ে জরুরি ইনভয়েস (pending/processing, না থাকলে সাম্প্রতিকতম)
// হিরো কার্ডে বড় করে দেখায় — বাকিগুলো নিচে কমপ্যাক্ট হিস্ট্রি হিসেবে (Screen 14
// এখানে বানানো হয়নি, শুধু ডেটা লুকানো হচ্ছে না)।
//
// "Continue to Payment"/"I Have Made the Payment" এখন dedicated Screen 13
// (./confirm) রুটে নিয়ে যায় — সেখানেই আসল submit_payment RPC কল হয়, proof
// আপলোড, correction/resubmit ফ্লো ইত্যাদি। internal_note কলাম এখানে কখনো
// select করা হয় না — client-safe কলাম লিস্টই একমাত্র সুরক্ষা।
//
// v2: Screen 9/10-এর ঠিক একই sidebar/topbar app-shell (আগে এই পাতা bare
// "back link + centered content" লেআউটে ছিল, প্রজেক্ট সেকশনের বাকি পাতাগুলোর
// সাথে বিচ্ছিন্ন লাগত)।

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
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ProjectBrief = { id: string; name: string; client_id: string; budget: number | null };
type SowBrief = { id: string; sow_number: string | null; version: number; status: string; project_value: number | null };
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
  client_instructions: string | null;
  sow_id: string | null;
  document_url: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
};
type Payment = { id: string; invoice_id: string; payment_method: string | null; transaction_id: string | null; payment_date: string | null; notes: string | null; confirmed_at: string | null; status: string; correction_reason: string | null };

const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

function humanizeType(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
            <Link href="/client/dashboard">Client Portal</Link> / <Link href={`/client/project/${project.id}`}>{project.name}</Link> / Payments
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
            .select('id, request_number, payment_type, description, amount, currency, percentage, due_date, payment_method, status, client_instructions, sow_id, document_url, sent_at, viewed_at, created_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false }),
          supabase.from('payments').select('id, invoice_id, payment_method, transaction_id, payment_date, notes, confirmed_at, status, correction_reason').eq('project_id', projectId).order('created_at', { ascending: false }),
          supabase.from('sows').select('id, sow_number, version, status, project_value').eq('project_id', projectId),
        ]);
        const invoiceRows = (invoicesRes.data as Invoice[]) ?? [];
        setInvoices(invoiceRows);
        setPayments((paymentsRes.data as Payment[]) ?? []);
        setSows((sowsRes.data as SowBrief[]) ?? []);

        const actionable = invoiceRows.find((i) => i.status === 'pending' || i.status === 'processing');
        if (actionable && actionable.status === 'pending' && !actionable.viewed_at) {
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
            <div className="pm-state-title">Unable to load payment request</div>
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
            <div className="pm-state-title">No payment request currently available</div>
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

  const primary = invoices.find((i) => i.status === 'pending' || i.status === 'processing') ?? invoices.find((i) => i.status !== 'cancelled') ?? invoices[0];
  const history = invoices.filter((i) => i.id !== primary.id);
  const linkedSow = primary.sow_id ? (sows.find((s) => s.id === primary.sow_id) ?? null) : (sows.find((s) => s.status === 'signed') ?? null);
  const submission = payments.find((p) => p.invoice_id === primary.id);

  const totalValue = linkedSow?.project_value ?? project.budget ?? null;
  const paidSum = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const alreadyPaid = primary.status === 'paid' ? paidSum - primary.amount : paidSum;
  const currentPayment = primary.status === 'cancelled' || primary.status === 'failed' ? 0 : primary.amount;
  const remainingAfter = totalValue != null ? Math.max(0, totalValue - alreadyPaid - currentPayment) : null;

  const isOverdue = primary.status === 'pending' && !!primary.due_date && primary.due_date < todayISO();

  return (
    <div className="client-portal client-payments-root">
      <PaymentsShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="pm-doc-wrap">
        <div className="pm-breadcrumb">My Project / Payments / Payment Request</div>
        <h1 className="pm-title">Payment Required</h1>
        <p className="pm-page-sub">Review the payment details and complete the required payment.</p>

        {/* ---- hero ---- */}
        <div className={`pm-hero${isOverdue ? ' overdue' : ''}`}>
          <div className="pm-hero-top">
            {primary.request_number && <span className="pm-hero-ref">{primary.request_number}</span>}
            <span className={`cp-badge ${primary.status === 'paid' ? 'cp-badge-success' : isOverdue ? 'pm-badge-overdue' : primary.status === 'cancelled' ? 'pm-badge-neutral' : 'cp-badge-pending'}`}>
              {primary.status === 'paid' ? 'Payment Complete ✓' : primary.status === 'processing' ? 'Under Review' : primary.status === 'cancelled' ? 'Cancelled' : primary.status === 'failed' ? 'Failed' : isOverdue ? 'Overdue' : 'Pending Payment'}
            </span>
          </div>

          <div className="pm-hero-amount tabular">
            {primary.currency} {primary.amount.toLocaleString('en-US')}
          </div>
          <div className="pm-hero-desc">{primary.description || humanizeType(primary.payment_type)}</div>
          {primary.due_date && (
            <div className="pm-hero-due">{isOverdue ? `This payment was due on ${formatBnDateLong(primary.due_date)}.` : `Due ${formatBnDateLong(primary.due_date)}`}</div>
          )}

          {primary.status === 'processing' && (
            <div className="pm-hero-note">
              <div className="pm-hero-note-title">Payment Under Review</div>
              <p>Your payment confirmation has been received and is being verified.</p>
              {submission && (
                <div className="pm-submitted-note">
                  Submitted: {submission.payment_method} · {submission.transaction_id} · {submission.payment_date ? formatBnDateLong(submission.payment_date) : ''}
                </div>
              )}
              <Link href={`/client/project/${project.id}/payments/confirm`} className="cp-btn cp-btn-secondary cp-btn-sm" style={{ marginTop: 10 }}>
                View Payment Details
              </Link>
            </div>
          )}

          {primary.status === 'cancelled' && <div className="pm-hero-note">This payment request is no longer active.</div>}

          {primary.status === 'paid' && submission && (
            <Link href={`/client/project/${project.id}/payments/${submission.id}/receipt`} className="cp-btn cp-btn-primary" style={{ marginTop: 12 }}>
              View Receipt
            </Link>
          )}

          {primary.status === 'pending' && submission?.status === 'correction_requested' && (
            <div className="pm-hero-note pm-hero-note-warning">
              <div className="pm-hero-note-title">Action Required</div>
              <p>{submission.correction_reason || 'Please review your payment details and resubmit.'}</p>
            </div>
          )}
          {primary.status === 'pending' && submission?.status === 'unable_to_verify' && (
            <div className="pm-hero-note pm-hero-note-warning">
              <div className="pm-hero-note-title">Unable to Verify</div>
              <p>We couldn&apos;t verify the payment using the information you provided. Please check the details and resubmit.</p>
            </div>
          )}

          {primary.status === 'pending' && (
            <Link href={`/client/project/${project.id}/payments/confirm`} className="cp-btn cp-btn-primary cp-btn-block" style={{ marginTop: 14 }}>
              {submission?.status === 'correction_requested' || submission?.status === 'unable_to_verify' ? 'Update Payment Details' : primary.payment_method === 'Bank Transfer' ? 'I Have Made the Payment' : 'Continue to Payment'}
            </Link>
          )}
        </div>

        {/* ---- breakdown ---- */}
        {totalValue != null && (
          <div className="cp-dash-card pm-summary-grid">
            <div>
              <div className="pm-summary-label">Project Value</div>
              <div className="pm-summary-value tabular">
                {primary.currency} {totalValue.toLocaleString('en-US')}
              </div>
            </div>
            <div>
              <div className="pm-summary-label">Already Paid</div>
              <div className="pm-summary-value tabular" style={{ color: 'var(--positive)' }}>
                {primary.currency} {alreadyPaid.toLocaleString('en-US')}
              </div>
            </div>
            <div>
              <div className="pm-summary-label">Current Payment</div>
              <div className="pm-summary-value tabular">
                {primary.currency} {currentPayment.toLocaleString('en-US')}
              </div>
            </div>
            <div>
              <div className="pm-summary-label">Remaining After</div>
              <div className="pm-summary-value tabular" style={{ color: remainingAfter && remainingAfter > 0 ? 'var(--accent)' : 'var(--ink)' }}>
                {remainingAfter != null ? `${primary.currency} ${remainingAfter.toLocaleString('en-US')}` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* ---- how to pay ---- */}
        {(primary.status === 'pending' || isOverdue) && (
          <div className="cp-dash-card">
            <div className="pm-block-title">How to Pay</div>
            {primary.payment_method && <p className="pm-method-line">{primary.payment_method}</p>}
            {primary.client_instructions ? (
              <p className="pm-instructions" style={{ whiteSpace: 'pre-wrap' }}>
                {primary.client_instructions}
              </p>
            ) : (
              <p className="pm-instructions">Our team will share payment details with you separately, or contact your project manager for instructions.</p>
            )}
            <p className="pm-instructions-note">After you have sent the payment, tap the button above and enter your transaction reference so our team can verify it.</p>
          </div>
        )}

        {/* ---- related SOW ---- */}
        {linkedSow && (
          <div className="cp-dash-card pm-sow-card">
            <div className="pm-block-title">Related Agreement</div>
            <div className="pm-sow-row">
              <div>
                <div className="pm-sow-number">{linkedSow.sow_number ?? `v${linkedSow.version}`}</div>
                <div className="pm-sow-sub">
                  v{linkedSow.version}.0 · {linkedSow.status === 'signed' ? 'Signed ✓' : humanizeType(linkedSow.status)}
                </div>
              </div>
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">
                View Signed SOW
              </Link>
            </div>
          </div>
        )}

        {/* ---- history ---- */}
        {history.length > 0 && (
          <div className="pm-history">
            <div className="pm-block-title">Other Payment Requests</div>
            <div className="pm-invoice-list">
              {history.map((inv) => (
                <div className="cp-dash-card pm-invoice-card" key={inv.id}>
                  <div className="pm-invoice-top">
                    <div>
                      <div className="pm-invoice-type">{inv.request_number ?? humanizeType(inv.payment_type)}</div>
                      <div className="pm-invoice-amount tabular">
                        {inv.currency} {inv.amount.toLocaleString('en-US')}
                      </div>
                    </div>
                    <span className={`cp-badge ${inv.status === 'paid' ? 'cp-badge-success' : inv.status === 'cancelled' ? 'pm-badge-neutral' : 'cp-badge-pending'}`}>
                      {inv.status === 'paid' ? 'Paid ✓' : inv.status === 'processing' ? 'Under Review' : inv.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                    </span>
                  </div>
                  {inv.due_date && <p className="pm-invoice-due">Due {formatBnDateLong(inv.due_date)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="pm-support-line">
          Questions about this payment?{' '}
          <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I have a question about my payment for ${project.name}${primary.request_number ? ` (${primary.request_number})` : ''}.`)}`} target="_blank" rel="noopener noreferrer">
            Message your project manager
          </a>
        </p>
        </div>
      </PaymentsShell>
    </div>
  );
}
