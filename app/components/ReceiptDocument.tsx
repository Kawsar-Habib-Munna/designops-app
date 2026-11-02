// The payment receipt as a printed receipt: the brand and the receipt number on a heavy rule, two boxed tables of labelled
// lines, an items table with a total, and a thank-you footer. No icons. One component renders it for the client's receipt
// page, the admin receipt page and the admin PDF preview, so all three always match. No client hooks, so it is safe in both.
// Layout avoids container queries and colour-mix() so html2canvas (the PDF export) renders it faithfully.
import type { Ref } from 'react';
import { formatMoney } from '@/lib/currency';
import { shortReceiptNo } from '@/lib/receiptNumber';
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
  const ref = shortReceiptNo(data.receiptNumber) ?? 'Receipt';

  return (
    <div className={`receipt-document theme-${theme}${docRef ? ' rd-fixed' : ''}`} ref={docRef}>
      <div className="rd-card rd3">
        <div className="rd3-head">
          <div className="rd3-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/New%20Logo.png" alt="FLOW 53 - Innovate-Design-Elevate" className="rd-logo rd3-logo" />
          </div>
          <div className="rd3-ref">
            <div className="rd3-ref-label">Receipt</div>
            <div className="rd3-ref-date">{data.dateText}</div>
            <div className="rd3-ref-number">{ref === 'Receipt' ? '—' : ref}</div>
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
                    {data.requestNumber && <tr><th>Request</th><td>{data.requestNumber}</td></tr>}
                  </tbody>
                </table>
              </td>
              <td>
                <div className="rd3-cap">Payment details</div>
                <table className="rd3-kv">
                  <tbody>
                    <tr><th>Method</th><td>{data.method ?? '—'}</td></tr>
                    <tr><th>Transaction ID</th><td>{data.transactionId ?? '—'}</td></tr>
                    {data.senderName && <tr><th>Paid by</th><td>{data.senderName}</td></tr>}
                    <tr><th>Status</th><td>Paid in full</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rd3-cap rd3-cap-items">Payment summary</div>
        <table className="rd3-items">
          <thead>
            <tr>
              <th className="rd3-n">#</th>
              <th>Description</th>
              <th>Payment date</th>
              <th className="rd3-r">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="rd3-n">1</td>
              <td className="rd3-desc">{data.description}</td>
              <td>{data.dateText}</td>
              <td className="rd3-r rd3-strong">{money}</td>
            </tr>
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
                      <th>Subtotal</th>
                      <td>{money}</td>
                    </tr>
                    <tr className="rd3-grand">
                      <th>Total paid</th>
                      <td>{money}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="rd3-paid">Paid in full{data.confirmedText ? ` · verified ${data.confirmedText}` : ''}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rd3-cap rd3-cap-items">Notes</div>
        <ul className="rd3-notes">
          {data.notes && <li>{data.notes}</li>}
          <li>This receipt confirms that the payment above was received and verified by FLOW 53 Design{data.confirmedText ? ` on ${data.confirmedText}` : ''}.</li>
          <li>Please keep it for your records. It is a computer-generated receipt, so no signature is needed.</li>
          <li>If any detail looks wrong, contact us within 7 days and quote {ref}.</li>
        </ul>

        <div className="rd3-thanks">
          <div className="rd3-thanks-title">Thank you for your business!</div>
          <div className="rd3-thanks-sub">Questions about this payment? Contact FLOW 53 Design and quote {ref}.</div>
        </div>
      </div>
    </div>
  );
}
