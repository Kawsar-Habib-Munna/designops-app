'use client';

// Screen 15 — Payment Receipt (admin)। ক্লায়েন্ট-সাইড রসিদের মতোই লেআউট, টিম RLS
// দিয়ে যেকোনো কনফার্ম করা পেমেন্টের রসিদ দেখা/প্রিন্ট/রিসেন্ড করা যায়।

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../../../project.css';
import './admin-receipt.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDateLong } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';

type Payment = { id: string; invoice_id: string; amount: number | null; payment_method: string | null; transaction_id: string | null; payment_date: string | null; receipt_number: string | null; confirmed_at: string | null };
type Invoice = { payment_type: string; currency: string; description: string | null; status: string; client_id: string; project_id: string };
type ClientBrief = { primary_contact: string | null; company_name: string };
type ProjectBrief = { name: string };

export default function AdminReceiptPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  const { user, loading: sessionLoading } = useSession();

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<ClientBrief | null>(null);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (!user || !paymentId) return;

    async function run() {
      const { data: paymentData } = await supabase.from('payments').select('id, invoice_id, amount, payment_method, transaction_id, payment_date, receipt_number, confirmed_at').eq('id', paymentId).maybeSingle();
      if (!paymentData) {
        setLoading(false);
        return;
      }
      setPayment(paymentData as Payment);

      const { data: invoiceData } = await supabase.from('invoices').select('payment_type, currency, description, status, client_id, project_id').eq('id', (paymentData as Payment).invoice_id).maybeSingle();
      setInvoice((invoiceData as Invoice) ?? null);

      if (invoiceData) {
        const [clientRes, projectRes] = await Promise.all([
          supabase.from('clients').select('primary_contact, company_name').eq('id', (invoiceData as Invoice).client_id).maybeSingle(),
          supabase.from('projects').select('name').eq('id', (invoiceData as Invoice).project_id).maybeSingle(),
        ]);
        setClient((clientRes.data as ClientBrief) ?? null);
        setProjectName((projectRes.data as ProjectBrief)?.name ?? '');
      }
      setLoading(false);
    }

    run();
  }, [user, paymentId]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className="projdetail-root admin-receipt-root">
      <div className="admin-receipt-shell">
        {loading ? (
          <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
        ) : !payment || !invoice || payment.confirmed_at === null ? (
          <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-soft)' }}>এই পেমেন্টের রসিদ পাওয়া যায়নি বা এখনো কনফার্ম হয়নি।</p>
        ) : (
          <>
            <div className="admin-receipt-no-print">
              <Link href={`/projects/${invoice.project_id}/payments`} className="btn btn-ghost btn-sm">
                ← Payments
              </Link>
              <button className="btn btn-accent btn-sm" onClick={() => window.print()}>
                Print / Download
              </button>
            </div>

            <div className="admin-receipt-doc">
              <div className="admin-receipt-doc-head">
                <div className="admin-receipt-brand">FLOW 53</div>
                <div className="admin-receipt-doc-title">Payment Receipt</div>
              </div>

              <div className="admin-receipt-meta-row">
                <div>
                  <div className="admin-receipt-meta-label">Receipt Number</div>
                  <div className="admin-receipt-meta-value">{payment.receipt_number ?? '—'}</div>
                </div>
                <div>
                  <div className="admin-receipt-meta-label">Date</div>
                  <div className="admin-receipt-meta-value">{formatBnDateLong(payment.payment_date)}</div>
                </div>
              </div>

              <div className="admin-receipt-divider"></div>

              <div className="admin-receipt-field-grid">
                <div>
                  <div className="admin-receipt-meta-label">Client</div>
                  <div className="admin-receipt-meta-value">{client?.primary_contact ?? '—'}</div>
                </div>
                <div>
                  <div className="admin-receipt-meta-label">Company</div>
                  <div className="admin-receipt-meta-value">{client?.company_name ?? '—'}</div>
                </div>
                <div>
                  <div className="admin-receipt-meta-label">Project</div>
                  <div className="admin-receipt-meta-value">{projectName}</div>
                </div>
                <div>
                  <div className="admin-receipt-meta-label">Status</div>
                  <div className="admin-receipt-meta-value">Paid ✓</div>
                </div>
              </div>

              <div className="admin-receipt-divider"></div>

              <div className="admin-receipt-amount-row">
                <div>
                  <div className="admin-receipt-meta-label">Description</div>
                  <div className="admin-receipt-meta-value">{invoice.description || invoice.payment_type.replace('_', ' ')}</div>
                </div>
                <div className="admin-receipt-amount">
                  {invoice.currency} {payment.amount?.toLocaleString('en-US') ?? '—'}
                </div>
              </div>

              <div className="admin-receipt-field-grid">
                <div>
                  <div className="admin-receipt-meta-label">Payment Method</div>
                  <div className="admin-receipt-meta-value">{payment.payment_method ?? '—'}</div>
                </div>
                <div>
                  <div className="admin-receipt-meta-label">Transaction ID</div>
                  <div className="admin-receipt-meta-value">{payment.transaction_id ?? '—'}</div>
                </div>
              </div>

              <div className="admin-receipt-footer">Thank you for your business — FLOW 53</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
