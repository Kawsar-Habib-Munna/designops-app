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
import { formatDateLong } from '@/lib/format';
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
        <div className="cp-loading-shell">Loading…</div>
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
            <p className="cp-page-empty">This payment hasn&apos;t been confirmed yet, so the receipt isn&apos;t ready.</p>
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
          <div className="receipt-top">
            <div className="receipt-title">RECEIPT</div>
            <div className="receipt-brand-block">
              <div className="receipt-brand-mark" aria-hidden="true"></div>
              <div className="receipt-brand-name">Flow 53</div>
            </div>
          </div>

          <div className="receipt-parties">
            <div className="receipt-label">Billed To</div>
            <div className="receipt-party-name">{client.primary_contact ?? client.company_name}</div>
            {client.primary_contact && <div className="receipt-party-sub">{client.company_name}</div>}
          </div>

          <div className="receipt-info-strip">
            <div>
              <div className="receipt-label">Receipt No</div>
              <div className="receipt-value">{payment.receipt_number ?? '—'}</div>
            </div>
            <div>
              <div className="receipt-label">Date</div>
              <div className="receipt-value">{formatDateLong(payment.payment_date)}</div>
            </div>
            <div>
              <div className="receipt-label">Project</div>
              <div className="receipt-value">{projectName}</div>
            </div>
          </div>

          <table className="receipt-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="receipt-item-desc">{invoice?.description || (invoice?.payment_type ? invoice.payment_type.replace('_', ' ') : 'Payment')}</td>
                <td className="tabular">
                  {invoice?.currency ?? ''} {payment.amount?.toLocaleString('en-US') ?? '—'}
                </td>
                <td className="tabular">1</td>
                <td className="tabular">
                  {invoice?.currency ?? ''} {payment.amount?.toLocaleString('en-US') ?? '—'}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="receipt-totals">
            <div className="receipt-totals-box">
              <div className="receipt-total-final">
                <span>Total Paid</span>
                <span>
                  {invoice?.currency ?? ''} {payment.amount?.toLocaleString('en-US') ?? '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="receipt-bottom-grid">
            <div>
              <div className="receipt-label">Payment Method</div>
              <div className="receipt-value">{payment.payment_method ?? '—'}</div>
            </div>
            <div>
              <div className="receipt-label">Transaction ID</div>
              <div className="receipt-value">{payment.transaction_id ?? '—'}</div>
            </div>
            <div>
              <div className="receipt-label">Status</div>
              <div className="receipt-value receipt-status-paid">Paid ✓</div>
            </div>
          </div>

          <div className="receipt-footer">
            Thank you for your business — FLOW 53. Questions about this payment?{' '}
            <a href="https://wa.me/8801804409235" target="_blank" rel="noopener noreferrer">
              Contact us on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
