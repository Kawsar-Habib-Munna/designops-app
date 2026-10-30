// A payment statement for a whole project, in the same document style as the receipt (receipt-document.css, `rd-*` classes):
// letterhead, the amounts at a glance, who it is for, and one row per payment. It is only the source for the PDF / image
// export on the client Payments page. No client hooks, table layouts only, so html2canvas renders it faithfully.
import type { Ref } from 'react';
import './receipt-document.css';

export type StatementRow = { ref: string | null; description: string; dateText: string; amountText: string; status: string };

export type StatementData = {
  generatedText: string;
  clientName: string;
  company?: string | null;
  projectName: string;
  currencyLabel: string;
  totalText: string;
  paidText: string;
  outstandingText: string;
  rows: StatementRow[];
};

export default function PaymentStatement({ data, docRef }: { data: StatementData; docRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="receipt-document theme-light rd-fixed" ref={docRef}>
      <div className="rd-card">
        <div className="rd-letterhead-row">
          <div className="rd-letterhead-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/New%20Logo.png" alt="FLOW 53 - Innovate-Design-Elevate" className="rd-logo" />
          </div>
          <div className="rd-letterhead-right">
            <div className="rd-doctype">PAYMENT STATEMENT</div>
            <div className="rd-ref">Generated {data.generatedText}</div>
          </div>
        </div>
        <hr className="rd-hr" />

        <div className="rd-hero">
          <div className="rd-hero-main">
            <div className="rd-eyebrow">Total paid</div>
            <div className="rd-hero-amount">{data.paidText}</div>
            <div className="rd-hero-status">
              <span className="rd-hero-sub">of {data.totalText} project value</span>
            </div>
          </div>
          <div className="rd-hero-meta">
            <div className="rd-eyebrow">Outstanding</div>
            <div className="rd-kv-value">{data.outstandingText}</div>
            <div className="rd-eyebrow rd-eyebrow-gap">Payments</div>
            <div className="rd-kv-value">{data.rows.length}</div>
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
            <tr>
              <th>Currency</th>
              <td>{data.currencyLabel}</td>
            </tr>
          </tbody>
        </table>

        <div className="rd-section-head">
          <span className="rd-section-num">02</span>
          <span className="rd-section-title">Payments</span>
        </div>
        <table className="rd-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Date</th>
              <th>Status</th>
              <th className="rd-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i}>
                <td className="rd-desc">
                  {r.description}
                  {r.ref && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', marginTop: 2 }}>{r.ref}</div>}
                </td>
                <td>{r.dateText}</td>
                <td>{r.status}</td>
                <td className="rd-num rd-strong">{r.amountText}</td>
              </tr>
            ))}
            <tr className="rd-total-row">
              <td colSpan={3}>Total paid</td>
              <td className="rd-num">{data.paidText}</td>
            </tr>
          </tbody>
        </table>

        <div className="rd-footer">
          <span>FLOW 53 Design Studio</span>
          <span>Thank you for your business</span>
        </div>
      </div>
    </div>
  );
}
