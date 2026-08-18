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

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatDateTime, formatBnDateLong, todayISO } from '@/lib/format';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';
import '../../../../client-shared.css';
import './confirm.css';

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
          .select('id, request_number, payment_type, description, amount, currency, due_date, payment_method, status, sow_id')
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
      detail: `${senderName.trim() || client.primary_contact} পেমেন্ট কনফার্মেশন জমা দিয়েছেন — ${invoice.currency} ${invoice.amount.toLocaleString('en-US')}`,
    });

    setSubmitting(false);
    setReloadKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="client-portal client-confirm-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
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
        <div className="cf-shell">
          <Link href={`/client/project/${project.id}/payments`} className="cf-back">
            ← Payments
          </Link>
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
                <p>{latestPayment?.confirmed_at ? formatBnDateLong(latestPayment.confirmed_at) : '—'}</p>
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
      </div>
    );
  }

  // ---- cancelled ----
  if (invoice.status === 'cancelled') {
    return (
      <div className="client-portal client-confirm-root">
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
      </div>
    );
  }

  // ---- awaiting verification (just submitted / processing) ----
  if (invoice.status === 'processing') {
    return (
      <div className="client-portal client-confirm-root">
        <div className="cf-shell">
          <Link href={`/client/project/${project.id}/payments`} className="cf-back">
            ← Payments
          </Link>
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
      </div>
    );
  }

  // ---- pending: submission form (fresh, correction, or unable-to-verify resubmit) ----
  const needsCorrection = latestPayment?.status === 'correction_requested';
  const unableToVerify = latestPayment?.status === 'unable_to_verify';

  return (
    <div className="client-portal client-confirm-root">
      <div className="cf-shell">
        <Link href={`/client/project/${project.id}/payments`} className="cf-back">
          ← Payments
        </Link>
        <div className="cf-breadcrumb">My Project / Payments / Confirm Payment</div>
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
              <p>{invoice.due_date ? formatBnDateLong(invoice.due_date) : '—'}</p>
            </div>
            <div>
              <span className="cf-summary-label">Payment Method</span>
              <p>{invoice.payment_method ?? '—'}</p>
            </div>
          </div>
        </div>

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
                {uploadingProof ? 'আপলোড হচ্ছে…' : 'Upload receipt or payment confirmation'}
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
    </div>
  );
}
