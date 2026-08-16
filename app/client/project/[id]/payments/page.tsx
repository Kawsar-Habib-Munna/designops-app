'use client';

// Screen 12/13 (client half) — Payment Required + Payment Confirmation। কোনো
// পেমেন্ট গেটওয়ে নেই বলে ক্লায়েন্ট নিজের ব্যাংক/মোবাইল-ওয়ালেট ট্রানজ্যাকশনের
// রেফারেন্স জমা দেয় (submit_payment RPC — client_id/project_id ownership নিজে
// যাচাই করে, তাই সরাসরি payments-এ insert পলিসি না দিয়েও নিরাপদ) — এডমিন সেটা
// যাচাই করে "Confirm Payment" চাপলে status 'Paid' হয় (দেখুন /projects/[id]/payments)।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDate, todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './payments.css';

type ProjectBrief = { id: string; name: string; client_id: string };
type Invoice = { id: string; payment_type: string; amount: number; currency: string; description: string | null; due_date: string | null; payment_method: string | null; status: string };
type Payment = { id: string; invoice_id: string; payment_method: string | null; transaction_id: string | null; payment_date: string | null; notes: string | null };

const STATUS_LABEL: Record<string, string> = { pending: 'Payment Required', processing: 'Awaiting Confirmation', paid: 'Paid', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded' };
const STATUS_BADGE: Record<string, string> = { pending: 'cp-badge-pending', processing: 'cp-badge-pending', paid: 'cp-badge-success' };
const METHOD_OPTIONS = ['Bank Transfer', 'bKash', 'Nagad', 'Card', 'Other'];

export default function ClientPaymentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [method, setMethod] = useState('Bank Transfer');
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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

        const [invoicesRes, paymentsRes] = await Promise.all([
          supabase.from('invoices').select('id, payment_type, amount, currency, description, due_date, payment_method, status').eq('project_id', projectId).order('created_at', { ascending: false }),
          supabase.from('payments').select('id, invoice_id, payment_method, transaction_id, payment_date, notes').eq('project_id', projectId).order('created_at', { ascending: false }),
        ]);
        setInvoices((invoicesRes.data as Invoice[]) ?? []);
        setPayments((paymentsRes.data as Payment[]) ?? []);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId, reloadKey]);

  async function handleSubmitPayment(e: FormEvent, invoiceId: string) {
    e.preventDefault();
    if (!transactionId.trim()) {
      setSubmitError('Transaction ID আবশ্যক।');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    const invoice = invoices.find((i) => i.id === invoiceId);
    const { error } = await supabase.rpc('submit_payment', {
      p_invoice_id: invoiceId,
      p_amount: invoice?.amount ?? null,
      p_method: method,
      p_transaction_id: transactionId.trim(),
      p_payment_date: paymentDate,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setOpenInvoiceId(null);
    setTransactionId('');
    setNotes('');
    setReloadKey((k) => k + 1);
  }

  if (loading || !project || !client) {
    return (
      <div className="client-portal client-payments-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  const totalValue = invoices.reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const remaining = totalValue - totalPaid;
  const currency = invoices[0]?.currency ?? 'BDT';

  return (
    <div className="client-portal client-payments-root">
      <div className="pm-shell">
        <Link href={`/client/project/${project.id}`} className="pm-back">
          ← {project.name}
        </Link>
        <h1 className="pm-title">Payments</h1>

        {invoices.length === 0 ? (
          <div className="cp-dash-card pm-empty">
            <p>এখনো কোনো পেমেন্ট রিকোয়েস্ট পাঠানো হয়নি।</p>
          </div>
        ) : (
          <>
            <div className="cp-dash-card pm-summary-grid">
              <div>
                <div className="pm-summary-label">Total Project Value</div>
                <div className="pm-summary-value tabular">
                  {currency} {totalValue.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="pm-summary-label">Total Paid</div>
                <div className="pm-summary-value tabular" style={{ color: 'var(--positive)' }}>
                  {currency} {totalPaid.toLocaleString('en-US')}
                </div>
              </div>
              <div>
                <div className="pm-summary-label">Remaining</div>
                <div className="pm-summary-value tabular" style={{ color: remaining > 0 ? 'var(--accent)' : 'var(--ink)' }}>
                  {currency} {remaining.toLocaleString('en-US')}
                </div>
              </div>
            </div>

            <div className="pm-invoice-list">
              {invoices.map((inv) => {
                const submission = payments.find((p) => p.invoice_id === inv.id);
                return (
                  <div className="cp-dash-card pm-invoice-card" key={inv.id}>
                    <div className="pm-invoice-top">
                      <div>
                        <div className="pm-invoice-type">{inv.payment_type.replace('_', ' ')}</div>
                        <div className="pm-invoice-amount tabular">
                          {inv.currency} {inv.amount.toLocaleString('en-US')}
                        </div>
                      </div>
                      <span className={`cp-badge ${STATUS_BADGE[inv.status] ?? 'cp-badge-pending'}`}>{STATUS_LABEL[inv.status] ?? inv.status}</span>
                    </div>
                    {inv.description && <p className="pm-invoice-desc">{inv.description}</p>}
                    {inv.due_date && <p className="pm-invoice-due">Due {formatBnDate(inv.due_date)}</p>}

                    {inv.status === 'processing' && submission && (
                      <div className="pm-submitted-note">
                        Submitted: {submission.payment_method} · {submission.transaction_id} · {formatBnDate(submission.payment_date)}
                      </div>
                    )}

                    {inv.status === 'pending' &&
                      (openInvoiceId === inv.id ? (
                        <form className="pm-confirm-form" onSubmit={(e) => handleSubmitPayment(e, inv.id)}>
                          {submitError && <div className="cp-alert cp-alert-error">{submitError}</div>}
                          <div className="cp-field">
                            <label className="cp-label">Payment Method</label>
                            <select className="cp-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                              {METHOD_OPTIONS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="cp-field">
                            <label className="cp-label">Transaction ID</label>
                            <input className="cp-input" type="text" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required />
                          </div>
                          <div className="cp-field">
                            <label className="cp-label">Payment Date</label>
                            <input className="cp-input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                          </div>
                          <div className="cp-field">
                            <label className="cp-label">Notes (optional)</label>
                            <textarea className="cp-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                          </div>
                          <div className="pm-confirm-actions">
                            <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setOpenInvoiceId(null)}>
                              Cancel
                            </button>
                            <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
                              {submitting && <span className="cp-spinner" />}
                              {submitting ? 'জমা হচ্ছে…' : 'Confirm Payment'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button className="cp-btn cp-btn-primary" onClick={() => setOpenInvoiceId(inv.id)}>
                          Confirm Payment
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
