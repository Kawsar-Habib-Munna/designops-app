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

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './payments.css';

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

export default function ClientPaymentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sows, setSows] = useState<SowBrief[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [router, projectId, reloadKey]);

  if (loading) {
    return (
      <div className="client-portal client-payments-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-payments-root">
        <div className="pm-shell">
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
        <div className="pm-shell">
          <Link href={`/client/project/${project.id}`} className="pm-back">
            ← {project.name}
          </Link>
          <div className="pm-state-card">
            <div className="pm-state-title">No payment request currently available</div>
            <p className="pm-state-sub">Payment requests will appear here when action is required.</p>
            <div className="pm-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
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
      <div className="pm-shell">
        <Link href={`/client/project/${project.id}`} className="pm-back">
          ← {project.name}
        </Link>
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
    </div>
  );
}
