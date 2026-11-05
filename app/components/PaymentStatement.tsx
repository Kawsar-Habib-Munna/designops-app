// A payment statement for a whole project, in the same document style as the receipt (receipt-document.css, `rd3-*` classes):
// logo and title, who it is billed to and by, one row per payment and the totals. It is only the source for the PDF / image
// export on the client Payments page. No client hooks, table layouts only, so html2canvas renders it faithfully.
import type { Ref } from 'react';
import './receipt-document.css';
import { AGENCY_INFO } from '@/lib/agencyInfo';

export type StatementRow = { ref: string | null; description: string; dateText: string; amountText: string; status: string; method?: string | null; transactionId?: string | null };

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
      <div className="rd-card rd3">
        <div className="rd3-head">
          <div className="rd3-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/New%20Logo.png" alt="FLOW 53 - Innovate-Design-Elevate" className="rd-logo rd3-logo" />
          </div>
          <div className="rd3-ref">
            <div className="rd3-ref-label">Payment statement</div>
            <div className="rd3-ref-date">{data.generatedText}</div>
            <div className="rd3-ref-number">{data.projectName}</div>
          </div>
        </div>
        <hr className="rd3-rule" />

        <table className="rd3-pair">
          <tbody>
            <tr>
              <td>
                <div className="rd3-cap">Billed to</div>
                <table className="rd3-kv">
                  <tbody>
                    <tr><th>Name</th><td>{data.clientName}</td></tr>
                    {data.company && data.company !== data.clientName && <tr><th>Company</th><td>{data.company}</td></tr>}
                    <tr><th>Project</th><td>{data.projectName}</td></tr>
                    <tr><th>Currency</th><td>{data.currencyLabel}</td></tr>
                  </tbody>
                </table>
              </td>
              <td>
                <div className="rd3-cap">Billed by</div>
                <table className="rd3-kv">
                  <tbody>
                    <tr><th>Name</th><td>{AGENCY_INFO.name}</td></tr>
                    <tr><th>Address</th><td>{AGENCY_INFO.address}</td></tr>
                    <tr><th>Email</th><td>{AGENCY_INFO.email}</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rd3-cap rd3-cap-items">Payments</div>
        <table className="rd3-items">
          <thead>
            <tr>
              <th className="rd3-n">#</th>
              <th>Description</th>
              <th>Date</th>
              <th>Method</th>
              <th>Transaction ID</th>
              <th>Status</th>
              <th className="rd3-r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i}>
                <td className="rd3-n">{i + 1}</td>
                <td className="rd3-desc">
                  {r.description}
                  {r.ref && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', marginTop: 2 }}>{r.ref}</div>}
                </td>
                <td>{r.dateText}</td>
                <td>{r.method || '—'}</td>
                <td className="rd3-txn">{r.transactionId || '—'}</td>
                <td>{r.status}</td>
                <td className="rd3-r rd3-strong">{r.amountText}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="rd3-totals">
          <tbody>
            <tr>
              <td className="rd3-totals-spacer"></td>
              <td>
                <table className="rd3-totals-inner">
                  <tbody>
                    <tr className="rd3-sub">
                      <th>Project value</th>
                      <td>{data.totalText}</td>
                    </tr>
                    <tr className="rd3-sub">
                      <th>Outstanding</th>
                      <td>{data.outstandingText}</td>
                    </tr>
                    <tr className="rd3-grand">
                      <th>Total paid</th>
                      <td>{data.paidText}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="rd3-paid">{data.rows.length} payment{data.rows.length === 1 ? '' : 's'} in this statement</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rd3-thanks">
          <div className="rd3-thanks-title">Thank you for your business!</div>
          <div className="rd3-thanks-sub">Questions about this statement? Contact FLOW 53 Design and quote the project name.</div>
        </div>
      </div>
    </div>
  );
}
