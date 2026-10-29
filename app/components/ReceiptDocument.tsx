// The payment receipt as a document, in the same visual language as the SOW (SowDocument): letterhead, hairline, numbered
// sections, bordered tables, a confirmation block and a footer. One component renders it for the client's receipt page,
// the admin receipt page and the admin PDF preview, so all three always match. No client hooks, so it is safe in both.
// Layout avoids container queries and colour-mix() so html2canvas (the PDF export) renders it faithfully.
import type { Ref } from 'react';
import { formatMoney } from '@/lib/currency';
import './receipt-document.css';

export type ReceiptDocData = {
  receiptNumber: string | null;
  requestNumber?: string | null;
  dateText: string; // already formatted by the caller (payment date)
  confirmedText?: string | null; // already formatted (when the team confirmed it)
  clientName: string;
  company?: string | null;
  projectName: string;
  description: string;
  currency: string;
  amount: number | null;
  method: string | null;
  transactionId: string | null;
  senderName?: string | null;
  notes?: string | null;
};

export default function ReceiptDocument({ data, theme = 'light', docRef }: { data: ReceiptDocData; theme?: 'light' | 'dark'; docRef?: Ref<HTMLDivElement> }) {
  // the currency symbol (৳, $, £ …) instead of the code; codes without a symbol keep their letters
  const money = data.amount != null ? formatMoney(data.amount, data.currency) : '—';
  const ref = data.receiptNumber ?? 'Receipt';

  return (
    <div className={`receipt-document theme-${theme}`} ref={docRef}>
      <div className="rd-card">
        <div className="rd-letterhead-row">
          <div className="rd-letterhead-left">
            <span className="rd-brand-cell">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/flow53-logo.svg" alt="" className="rd-brand-mark" />
            </span>
            <span className="rd-brand-text">
              <span className="rd-letterhead">FLOW 53</span>
              <span className="rd-letterhead-sub">Innovate-Design-Elevate</span>
            </span>
          </div>
          <div className="rd-letterhead-right">
            <div className="rd-doctype">PAYMENT RECEIPT</div>
            <div className="rd-ref">{ref}</div>
          </div>
        </div>
        <hr className="rd-hr" />

        <div className="rd-hero">
          <div className="rd-hero-main rd-hero-main-bar">
            <div className="rd-eyebrow">Amount paid</div>
            <div className="rd-hero-amount">{money}</div>
            <div className="rd-hero-status">
              <span className="rd-paid-text">Paid in full</span>
              <span className="rd-hero-dot">·</span>
              <span className="rd-hero-sub">{data.dateText}</span>
            </div>
          </div>
          <div className="rd-hero-meta">
            <div className="rd-eyebrow">Receipt no.</div>
            <div className="rd-kv-value">{data.receiptNumber ?? '—'}</div>
            {data.requestNumber && (
              <>
                <div className="rd-eyebrow rd-eyebrow-gap">Payment request</div>
                <div className="rd-kv-value">{data.requestNumber}</div>
              </>
            )}
          </div>
        </div>

        <div className="rd-section-head">
          <span className="rd-section-num">01</span>
          <span className="rd-section-title">Billed to</span>
        </div>
        <table className="rd-table rd-kv-table">
          <tbody>
            <tr>
              <th>Client</th>
              <td>{data.clientName}</td>
            </tr>
            {data.company && (
              <tr>
                <th>Company</th>
                <td>{data.company}</td>
              </tr>
            )}
            <tr>
              <th>Project</th>
              <td>{data.projectName}</td>
            </tr>
          </tbody>
        </table>

        <div className="rd-section-head">
          <span className="rd-section-num">02</span>
          <span className="rd-section-title">Payment summary</span>
        </div>
        <table className="rd-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="rd-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="rd-desc">{data.description}</td>
              <td className="rd-num rd-strong">{money}</td>
            </tr>
            <tr className="rd-total-row">
              <td>Total paid</td>
              <td className="rd-num">{money}</td>
            </tr>
          </tbody>
        </table>

        <div className="rd-section-head">
          <span className="rd-section-num">03</span>
          <span className="rd-section-title">Payment details</span>
        </div>
        <table className="rd-table rd-kv-table">
          <tbody>
            <tr>
              <th>Method</th>
              <td>{data.method ?? '—'}</td>
            </tr>
            <tr>
              <th>Transaction ID</th>
              <td>{data.transactionId ?? '—'}</td>
            </tr>
            {data.senderName && (
              <tr>
                <th>Paid by</th>
                <td>{data.senderName}</td>
              </tr>
            )}
            <tr>
              <th>Payment date</th>
              <td>{data.dateText}</td>
            </tr>
          </tbody>
        </table>

        {data.notes && (
          <>
            <div className="rd-section-head">
              <span className="rd-section-num">04</span>
              <span className="rd-section-title">Note</span>
            </div>
            <p className="rd-note">{data.notes}</p>
          </>
        )}

        <div className="rd-confirm">
          <div>
            <div className="rd-eyebrow">Confirmed by</div>
            <div className="rd-confirm-name">FLOW 53 Design Studio</div>
            <div className="rd-confirm-sub">{data.confirmedText ? `Payment verified on ${data.confirmedText}` : 'Payment verified'}</div>
          </div>
          <span className="rd-stamp">
            <span className="rd-stamp-box">PAID</span>
          </span>
        </div>

        <div className="rd-footer">
          <span>{ref}</span>
          <span>Thank you for your business</span>
        </div>
      </div>
    </div>
  );
}
