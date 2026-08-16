'use client';

// Screen 15 — Payment Receipt (client)। কোনো PDF-জেনারেশন লাইব্রেরি নেই বলে
// "Download"/"Print" browser-এর নিজস্ব print-to-PDF ডায়ালগ দিয়ে হয় (window.print()
// + প্রিন্ট-স্পেসিফিক CSS) — এটাই বাস্তব, কাজ করা সমাধান, ভুয়া PDF-জেনারেশন
// বাটনের বদলে।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong } from '@/lib/format';
import '../../../../../client-shared.css';
import './receipt.css';

type Payment = {
  id: string;
  invoice_id: string;
  amount: number | null;
  payment_method: string | null;
  transaction_id: string | null;
  payment_date: string | null;
  receipt_number: string | null;
  confirmed_at: string | null;
};
type Invoice = { payment_type: string; currency: string; description: string | null; status: string };

export default function ClientReceiptPage() {
  const params = useParams();
  const projectId = params.id as string;
  const paymentId = params.paymentId as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [projectName, setProjectName] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setClient(own.client);
        setProjectName(own.project.name);

        const { data: paymentData } = await supabase.from('payments').select('id, invoice_id, amount, payment_method, transaction_id, payment_date, receipt_number, confirmed_at').eq('id', paymentId).maybeSingle();
        if (!paymentData) {
          router.replace(`/client/project/${projectId}/payments`);
          return;
        }
        setPayment(paymentData as Payment);

        const { data: invoiceData } = await supabase.from('invoices').select('payment_type, currency, description, status').eq('id', (paymentData as Payment).invoice_id).maybeSingle();
        setInvoice((invoiceData as Invoice) ?? null);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId, paymentId]);

  if (loading || !client || !payment) {
    return (
      <div className="client-portal">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (!payment.confirmed_at || invoice?.status !== 'paid') {
    return (
      <div className="client-portal">
        <div className="cp-page-shell">
          <Link href={`/client/project/${projectId}/payments`} className="cp-page-back">
            ← Payments
          </Link>
          <div className="cp-dash-card">
            <p className="cp-page-empty">এই পেমেন্টটা এখনো কনফার্ম হয়নি, তাই রসিদ প্রস্তুত না।</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="client-portal receipt-root">
      <div className="cp-page-shell receipt-shell">
        <div className="receipt-no-print">
          <Link href={`/client/project/${projectId}/payments`} className="cp-page-back">
            ← Payments
          </Link>
          <button className="cp-btn cp-btn-primary" onClick={() => window.print()}>
            Download / Print Receipt
          </button>
        </div>

        <div className="receipt-doc">
          <div className="receipt-doc-head">
            <div className="receipt-brand">FLOW 53</div>
            <div className="receipt-doc-title">Payment Receipt</div>
          </div>

          <div className="receipt-meta-row">
            <div>
              <div className="receipt-meta-label">Receipt Number</div>
              <div className="receipt-meta-value">{payment.receipt_number ?? '—'}</div>
            </div>
            <div>
              <div className="receipt-meta-label">Date</div>
              <div className="receipt-meta-value">{formatBnDateLong(payment.payment_date)}</div>
            </div>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-field-grid">
            <div>
              <div className="receipt-meta-label">Client</div>
              <div className="receipt-meta-value">{client.primary_contact ?? '—'}</div>
            </div>
            <div>
              <div className="receipt-meta-label">Company</div>
              <div className="receipt-meta-value">{client.company_name}</div>
            </div>
            <div>
              <div className="receipt-meta-label">Project</div>
              <div className="receipt-meta-value">{projectName}</div>
            </div>
            <div>
              <div className="receipt-meta-label">Status</div>
              <div className="receipt-meta-value">Paid ✓</div>
            </div>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-amount-row">
            <div>
              <div className="receipt-meta-label">Description</div>
              <div className="receipt-meta-value">{invoice?.description || (invoice?.payment_type ? invoice.payment_type.replace('_', ' ') : 'Payment')}</div>
            </div>
            <div className="receipt-amount">
              {invoice?.currency ?? ''} {payment.amount?.toLocaleString('en-US') ?? '—'}
            </div>
          </div>

          <div className="receipt-field-grid">
            <div>
              <div className="receipt-meta-label">Payment Method</div>
              <div className="receipt-meta-value">{payment.payment_method ?? '—'}</div>
            </div>
            <div>
              <div className="receipt-meta-label">Transaction ID</div>
              <div className="receipt-meta-value">{payment.transaction_id ?? '—'}</div>
            </div>
          </div>

          <div className="receipt-footer">Thank you for your business — FLOW 53</div>
        </div>
      </div>
    </div>
  );
}
