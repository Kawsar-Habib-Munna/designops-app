'use client';

// A preview of an accounts report as an A4 sheet in the receipt style, with Download PDF.
// Every tab (profit & loss, expenses, receivables, payroll, distribution) builds a StatementDoc and opens this.

import { useRef, useState } from 'react';
import '@/app/components/receipt-document.css';
import '@/app/components/receipt-preview-modal.css';
import { renderReceiptPdf } from '@/lib/receiptPdf';
import { AGENCY_INFO } from '@/lib/agencyInfo';

export type StatementSection = {
  heading: string;
  columns: { label: string; right?: boolean }[];
  rows: string[][];
  total?: string[]; // a bold last row
  empty?: string; // shown when there are no rows
};
export type StatementDoc = {
  title: string; // e.g. Profit and loss
  period: string; // e.g. Nov 2026
  note?: string; // small line under the header
  summary?: [string, string][]; // label / value pairs shown in a boxed table
  sections: StatementSection[];
  filename: string; // without .pdf
};

export default function StatementPreview({ doc, onClose }: { doc: StatementDoc | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!doc) return null;

  async function download() {
    if (!ref.current || !doc) return;
    setBusy(true);
    setErr(null);
    try {
      const { blob } = await renderReceiptPdf(ref.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.filename}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr('Could not create the PDF. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div role="dialog" aria-modal="true" className="ac-noprint" style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(16,16,20,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: 'min(834px, 100%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 }}>
          {err && <span style={{ marginRight: 'auto', color: '#c0392b', fontSize: 13 }}>{err}</span>}
          <button type="button" className="ac-primary" disabled={busy} onClick={() => void download()}>{busy ? 'Creating…' : 'Download PDF'}</button>
          <button type="button" className="ac-btn" onClick={onClose}>Close</button>
        </div>
        <div className="rpm-sheet">
          <div className="receipt-document theme-light rd-fixed" ref={ref}>
            <div className="rd-card rd3">
              <div className="rd3-head">
                <div className="rd3-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/New%20Logo.png" alt="FLOW 53" className="rd-logo rd3-logo" />
                </div>
                <div className="rd3-ref">
                  <div className="rd3-ref-label">{doc.title}</div>
                  <div className="rd3-ref-date">{AGENCY_INFO.name}</div>
                  <div className="rd3-ref-number">{doc.period}</div>
                </div>
              </div>
              <hr className="rd3-rule" />
              {doc.note && <div className="rd3-cap" style={{ textTransform: 'none', letterSpacing: 0 }}>{doc.note}</div>}

              {doc.summary && doc.summary.length > 0 && (
                <>
                  <div className="rd3-cap rd3-cap-items">Summary</div>
                  <table className="rd3-kv">
                    <tbody>{doc.summary.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
                  </table>
                </>
              )}

              {doc.sections.map((s) => (
                <div key={s.heading}>
                  <div className="rd3-cap rd3-cap-items">{s.heading}</div>
                  <table className="rd3-items">
                    <thead>
                      <tr>{s.columns.map((c) => <th key={c.label} className={c.right ? 'rd3-r' : undefined}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.rows.map((r, i) => (
                        <tr key={i}>{r.map((v, j) => <td key={j} className={s.columns[j]?.right ? 'rd3-r' : undefined}>{v}</td>)}</tr>
                      ))}
                      {s.rows.length === 0 && <tr><td colSpan={s.columns.length}>{s.empty ?? 'Nothing to show.'}</td></tr>}
                      {s.total && <tr>{s.total.map((v, j) => <td key={j} className={`rd3-strong${s.columns[j]?.right ? ' rd3-r' : ''}`}>{v}</td>)}</tr>}
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="rd3-cap rd3-cap-items">Notes</div>
              <ul className="rd3-notes">
                <li>This is a computer-generated report from the {AGENCY_INFO.name} accounts, so no signature is needed.</li>
                <li>Generated on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
