'use client';

// Screen 13 — Payment Confirmation (client, dedicated route — ফেজ ১৫)। Screen 12
// শুধু রিকোয়েস্ট দেখায়; এই পাতা "I have made a payment" বনাম "the agency has
// verified it" আলাদা রাখে — সাবমিট করলেই invoices.status='processing' হয়ে যায়
// (submit_payment RPC-এ real duplicate-submission guard আছে), কিন্তু 'paid' শুধু
// অ্যাডমিন ভেরিফাই করলেই হয় (দেখুন /projects/[id]/payments-এর handleConfirm)।
//
// Amount Paid ইচ্ছাকৃতভাবে read-only — এই আর্কিটেকচারে partial-payment ট্র্যাকিং
// কোথাও নেই, তাই সেটা ফ্যাব্রিকেট করা হয়নি। Proof of Payment বিদ্যমান Drive
// পাইপলাইনেই যায় (এই কোডবেসের একমাত্র real ফাইল স্টোরেজ) — unguessable লিংক-ভিত্তিক
// অ্যাক্সেস, সত্যিকারের প্রাইভেট ACL না (SOW সিগনেচার/ডকুমেন্টের মতোই honest সীমাবদ্ধতা)।

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatDateTime, formatDateLong, todayISO } from '@/lib/format';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';
import '../../../../client-shared.css';
import './confirm.css';

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
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

// সাইডবার/টপবার শেল — বাকি client-portal প্রজেক্ট পেজগুলোর (SowShell/SignShell/
// PaymentsShell) মতোই, যাতে পেমেন্ট কনফার্ম করার সময়েও পুরো পোর্টাল নেভিগেশন
// হাতের নাগালে থাকে — আগে এই পেজটা পুরোপুরি sidebar-less, standalone ফর্ম ছিল।
function ConfirmShell({
  project,
  client,
  mobileNavOpen,
  setMobileNavOpen,
  onSignOut,
  children,
}: {
  project: ProjectBrief;
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
          <div className="cp-brand cp-brand-sidebar">
            <div className="cp-brand-mark" aria-hidden="true"></div>
            <div>
              <div className="cp-brand-text">FLOW 53</div>
              <div className="cp-brand-tagline">Innovate · Design · Elevate</div>
            </div>
            <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
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
          <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <span className="topbar-title">Confirm Payment</span>
        </header>

        <header className="page-topbar">
          <div className="breadcrumb">
            <Link href="/client/dashboard">Client Portal</Link> / <Link href={`/client/project/${project.id}`}>{project.name}</Link> /{' '}
            <Link href={`/client/project/${project.id}/payments`}>Payments</Link> / Confirm Payment
          </div>
          <a
            className="page-help-link"
            href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I need help confirming my payment for ${project.name}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="help" size={13} /> Need help?
          </a>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}

type ProjectBrief = { id: string; name: string; client_id: string };
type SowBrief = { id: string; sow_number: string | null; version: number; status: string };
type Invoice = {
  id: string;
  request_number: string | null;
  payment_type: string;
  description: string | null;
  amount: number;
  currency: string;
  due_date: string | null;
  payment_method: string | null;
  status: string;
  sow_id: string | null;
  client_instructions: string | null;
};
type Payment = {
  id: string;
  transaction_id: string | null;
  payment_date: string | null;
  payment_method: string | null;
  sender_name: string | null;
  proof_url: string | null;
  notes: string | null;
  status: string;
  correction_reason: string | null;
  confirmed_at: string | null;
  receipt_number: string | null;
  amount: number | null;
  created_at: string;
};

const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';
const MAX_PROOF_BYTES = 8 * 1024 * 1024;

function humanizeType(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ConfirmPaymentPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [linkedSow, setLinkedSow] = useState<SowBrief | null>(null);
  const [latestPayment, setLatestPayment] = useState<Payment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [transactionId, setTransactionId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const { data: projectData } = await supabase.from('projects').select('id, name, client_id').eq('id', projectId).maybeSingle();
        if (!projectData || (projectData as ProjectBrief).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(projectData as ProjectBrief);
        setClient(own);
        setSenderName(own.primary_contact ?? '');

        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, request_number, payment_type, description, amount, currency, due_date, payment_method, status, sow_id, client_instructions')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        const invoiceRows = (invoicesData as Invoice[]) ?? [];
        const primary = invoiceRows.find((i) => i.status === 'pending' || i.status === 'processing' || i.status === 'paid') ?? null;

        if (!primary) {
          router.replace(`/client/project/${projectId}/payments`);
          return;
        }
        setInvoice(primary);

        const [paymentsRes, sowRes] = await Promise.all([
          supabase
            .from('payments')
            .select('id, transaction_id, payment_date, payment_method, sender_name, proof_url, notes, status, correction_reason, confirmed_at, receipt_number, amount, created_at')
            .eq('invoice_id', primary.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          primary.sow_id ? supabase.from('sows').select('id, sow_number, version, status').eq('id', primary.sow_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        setLatestPayment((paymentsRes.data as Payment) ?? null);
        setLinkedSow((sowRes.data as SowBrief) ?? null);

        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }
    load();
  }, [router, projectId, reloadKey]);

  async function handleUploadProof(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
      setUploadError('Please upload a JPG, PNG or PDF file.');
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setUploadError('File is too large — please upload a file under 8MB.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploadingProof(true);
    try {
      const result = await uploadFileToDrive(file, accessToken);
      setProofUrl(result.webViewLink);
      setProofName(result.name ?? file.name);
    } catch {
      setUploadError('Upload failed — please try again.');
    }
    setUploadingProof(false);
  }

  async function handleSubmit() {
    if (!invoice || !client) return;
    if (!agreed) {
      setFormError('Please confirm that the information above is accurate.');
      return;
    }
    if (!transactionId.trim()) {
      setFormError('Please enter your transaction / reference ID.');
      return;
    }
    if (!paymentDate) {
      setFormError('Please select the payment date.');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const { error } = await supabase.rpc('submit_payment', {
      p_invoice_id: invoice.id,
      p_amount: invoice.amount,
      p_method: invoice.payment_method ?? 'Other',
      p_transaction_id: transactionId.trim(),
      p_payment_date: paymentDate,
      p_notes: note.trim() || null,
      p_proof_url: proofUrl,
      p_sender_name: senderName.trim() || null,
    });

    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }

    await supabase.from('activity_log').insert({
      actor_id: null,
      action: 'payment_confirmation_submitted',
      entity_type: 'client',
      entity_id: client.id,
      detail: `${senderName.trim() || client.primary_contact} submitted a payment confirmation — ${invoice.currency} ${invoice.amount.toLocaleString('en-US')}`,
    });

    setSubmitting(false);
    setReloadKey((k) => k + 1);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  if (loading) {
    return (
      <div className="client-portal client-confirm-root">
        <div className="cp-loading-shell">Loading…</div>
      </div>
    );
  }

  if (loadError || !project || !client || !invoice) {
    return (
      <div className="client-portal client-confirm-root">
        <div className="cf-shell">
          <div className="cf-state-card">
            <div className="cf-state-title">Payment unavailable</div>
            <p className="cf-state-sub">This request may not exist or you may not have access to it.</p>
            <div className="cf-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}/payments`} className="cp-btn cp-btn-secondary">
                Back to Payments
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sym = invoice.currency;

  // ---- paid state ----
  if (invoice.status === 'paid') {
    return (
      <div className="client-portal client-confirm-root">
        <ConfirmShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="cf-shell">
          <div className="cf-success-card">
            <div className="cf-success-icon">✓</div>
            <h1 className="cf-success-title">Payment Confirmed ✓</h1>
            <div className="cf-success-grid">
              <div>
                <span className="cf-success-label">Amount</span>
                <p>
                  {sym} {invoice.amount.toLocaleString('en-US')}
                </p>
              </div>
              <div>
                <span className="cf-success-label">Paid</span>
                <p>{latestPayment?.confirmed_at ? formatDateLong(latestPayment.confirmed_at) : '—'}</p>
              </div>
              <div>
                <span className="cf-success-label">Payment Method</span>
                <p>{latestPayment?.payment_method ?? invoice.payment_method ?? '—'}</p>
              </div>
              <div>
                <span className="cf-success-label">Transaction</span>
                <p>{latestPayment?.transaction_id ?? '—'}</p>
              </div>
            </div>
            <div className="cf-state-actions">
              {latestPayment && (
                <Link href={`/client/project/${project.id}/payments/${latestPayment.id}/receipt`} className="cp-btn cp-btn-primary">
                  View Receipt
                </Link>
              )}
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-secondary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
        </ConfirmShell>
      </div>
    );
  }

  // ---- cancelled ----
  if (invoice.status === 'cancelled') {
    return (
      <div className="client-portal client-confirm-root">
        <ConfirmShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="cf-shell">
          <div className="cf-state-card">
            <div className="cf-state-title">Payment Request Cancelled</div>
            <p className="cf-state-sub">This payment request is no longer active.</p>
            <div className="cf-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
        </ConfirmShell>
      </div>
    );
  }

  // ---- awaiting verification (just submitted / processing) ----
  if (invoice.status === 'processing') {
    return (
      <div className="client-portal client-confirm-root">
        <ConfirmShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="cf-shell">
          <div className="cf-success-card">
            <div className="cf-success-icon">✓</div>
            <h1 className="cf-success-title">Payment confirmation submitted</h1>
            <p className="cf-success-sub">We&apos;ve received your payment details. Our team will verify the payment shortly.</p>
            <div className="cf-success-grid">
              <div>
                <span className="cf-success-label">Amount</span>
                <p>
                  {sym} {invoice.amount.toLocaleString('en-US')}
                </p>
              </div>
              <div>
                <span className="cf-success-label">Payment Request</span>
                <p>{invoice.request_number ?? '—'}</p>
              </div>
              <div>
                <span className="cf-success-label">Transaction Reference</span>
                <p>{latestPayment?.transaction_id ?? '—'}</p>
              </div>
              <div>
                <span className="cf-success-label">Submitted</span>
                <p>{latestPayment?.created_at ? formatDateTime(latestPayment.created_at) : '—'}</p>
              </div>
            </div>
            <span className="cp-badge cp-badge-pending cf-success-badge">Awaiting Verification</span>
            <div className="cf-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">
                Back to Project
              </Link>
              <Link href={`/client/project/${project.id}/payments`} className="cp-btn cp-btn-secondary">
                View Payment Details
              </Link>
            </div>
          </div>
        </div>
        </ConfirmShell>
      </div>
    );
  }

  // ---- pending: submission form (fresh, correction, or unable-to-verify resubmit) ----
  const needsCorrection = latestPayment?.status === 'correction_requested';
  const unableToVerify = latestPayment?.status === 'unable_to_verify';

  return (
    <div className="client-portal client-confirm-root">
      <ConfirmShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
      <div className="cf-shell">
        <h1 className="cf-title">Confirm Your Payment</h1>
        <p className="cf-sub">Submit your payment details so our team can verify the transaction.</p>

        {needsCorrection && (
          <div className="cf-banner cf-banner-warning">
            <div className="cf-banner-title">Action Required</div>
            <p>{latestPayment?.correction_reason || 'Please review your payment details and resubmit.'}</p>
          </div>
        )}
        {unableToVerify && !needsCorrection && (
          <div className="cf-banner cf-banner-warning">
            <div className="cf-banner-title">Unable to Verify</div>
            <p>We couldn&apos;t verify the payment using the information you provided. Please check the details and resubmit.</p>
          </div>
        )}

        {/* ---- summary ---- */}
        <div className="cf-summary-card">
          <div className="cf-summary-top">
            <span className="cf-summary-ref">{invoice.request_number ?? '—'}</span>
            <span className="cp-badge cp-badge-pending">Pending Payment</span>
          </div>
          <div className="cf-summary-grid">
            <div>
              <span className="cf-summary-label">Amount Due</span>
              <p className="cf-summary-amount tabular">
                {sym} {invoice.amount.toLocaleString('en-US')}
              </p>
            </div>
            <div>
              <span className="cf-summary-label">Payment For</span>
              <p>{invoice.description || humanizeType(invoice.payment_type)}</p>
            </div>
            <div>
              <span className="cf-summary-label">Project</span>
              <p>{project.name}</p>
            </div>
            <div>
              <span className="cf-summary-label">Due Date</span>
              <p>{invoice.due_date ? formatDateLong(invoice.due_date) : '—'}</p>
            </div>
            <div>
              <span className="cf-summary-label">Payment Method</span>
              <p>{invoice.payment_method ?? '—'}</p>
            </div>
          </div>
        </div>

        {invoice.client_instructions && (
          <div className="cf-sow-card">
            <span className="cf-sow-label">How to Pay</span>
            <p className="cf-instructions" style={{ whiteSpace: 'pre-wrap' }}>
              {invoice.client_instructions}
            </p>
          </div>
        )}

        {linkedSow && (
          <div className="cf-sow-card">
            <span className="cf-sow-label">Related Agreement</span>
            <div className="cf-sow-row">
              <div>
                <div className="cf-sow-number">{linkedSow.sow_number ?? `v${linkedSow.version}`}</div>
                <div className="cf-sow-sub">
                  v{linkedSow.version}.0 · {linkedSow.status === 'signed' ? 'Signed ✓' : humanizeType(linkedSow.status)}
                </div>
              </div>
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">
                View Signed SOW
              </Link>
            </div>
          </div>
        )}

        {/* ---- form ---- */}
        <div className="cf-form-card">
          <div className="cf-form-title">Payment Details</div>

          <div className="cp-field">
            <label className="cp-label">Amount Paid</label>
            <input className="cp-input" type="text" value={`${sym} ${invoice.amount.toLocaleString('en-US')}`} disabled />
            <div className="cp-hint">This request is for a fixed amount and cannot be edited here.</div>
          </div>

          <div className="cp-field-row">
            <div className="cp-field">
              <label className="cp-label">Payment Date</label>
              <input className="cp-input" type="date" max={todayISO()} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="cp-field">
              <label className="cp-label">Transaction / Reference ID</label>
              <input className="cp-input" type="text" placeholder="e.g. TRX-829104" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
            </div>
          </div>

          <div className="cp-field">
            <label className="cp-label">
              Account / Sender Name <span className="cp-label-optional">(optional)</span>
            </label>
            <input className="cp-input" type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
          </div>

          <div className="cp-field">
            <label className="cp-label">
              Proof of Payment <span className="cp-label-optional">(optional)</span>
            </label>
            <p className="cf-upload-hint">Upload a screenshot, PDF receipt or bank confirmation.</p>
            <input ref={fileInputRef} type="file" hidden accept="image/png,image/jpeg,application/pdf" onChange={handleUploadProof} />
            {uploadError && <div className="cp-error-text">{uploadError}</div>}
            {proofUrl ? (
              <div className="cf-proof-row">
                {proofUrl.toLowerCase().includes('.pdf') || proofName?.toLowerCase().endsWith('.pdf') ? (
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="cf-proof-link">
                    📄 {proofName ?? 'View file'} ↗
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={driveThumbnailUrl(proofUrl)} alt="Proof of payment" className="cf-proof-thumb" />
                )}
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={() => { setProofUrl(null); setProofName(null); }}>
                  Remove
                </button>
              </div>
            ) : (
              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingProof}>
                {uploadingProof && <span className="cp-spinner" />}
                {uploadingProof ? 'Uploading…' : 'Upload receipt or payment confirmation'}
              </button>
            )}
          </div>

          <div className="cp-field">
            <label className="cp-label">
              Payment Note <span className="cp-label-optional">(optional)</span>
            </label>
            <textarea className="cp-input" rows={3} placeholder="Add any information that may help us verify your payment." value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <label className={`cf-check-row${agreed ? ' agreed' : ''}`}>
            <span className={`cf-check${agreed ? ' checked' : ''}`} onClick={() => setAgreed((v) => !v)}>
              {agreed ? '✓' : ''}
            </span>
            <span className="cf-check-label">I confirm that the payment information above is accurate.</span>
          </label>

          {formError && <div className="cp-alert cp-alert-error">{formError}</div>}

          <button type="button" className="cp-btn cp-btn-primary cp-btn-block" disabled={submitting} onClick={handleSubmit}>
            {submitting && <span className="cp-spinner" />}
            {submitting ? 'Submitting…' : 'Submit Payment Confirmation'}
          </button>
        </div>

        <p className="cf-support-line">
          Need help?{' '}
          <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I need help confirming my payment for ${project.name}${invoice.request_number ? ` (${invoice.request_number})` : ''}.`)}`} target="_blank" rel="noopener noreferrer">
            Contact your project manager
          </a>
        </p>
      </div>
      </ConfirmShell>
    </div>
  );
}
