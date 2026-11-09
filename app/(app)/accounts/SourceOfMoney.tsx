'use client';

// Accounts > Overview: where the money came from. Every confirmed payment, shown as a table, in three views:
// each payment (who paid, for what, how, with which reference), grouped by client, or grouped by payment method.

import { useState } from 'react';
import { BASE, type Calc } from '@/lib/accountsCore';
import { formatMoney } from '@/lib/currency';
import { formatDateLong } from '@/lib/format';

type View = 'payments' | 'client' | 'method';
const SHOW = 12;
// a different light tint for each row (the same client or method always gets the same colour)
const TINTS = ['42, 120, 214', '235, 104, 52', '34, 160, 107', '130, 80, 220', '20, 160, 170', '220, 70, 140', '214, 160, 20'];
const tint = (i: number) => ({ background: `rgba(${TINTS[i % TINTS.length]}, 0.1)` });

type Group = { name: string; count: number; base: number };

function group(rows: Calc['received'], key: (r: Calc['received'][number]) => string): Group[] {
  const m = new Map<string, Group>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k) ?? { name: k, count: 0, base: 0 };
    g.count += 1;
    g.base += r.base;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.base - a.base);
}

export default function SourceOfMoney({ calc }: { calc: Calc }) {
  const [view, setView] = useState<View>('payments');
  const [all, setAll] = useState(false);
  const money = (n: number) => formatMoney(n, BASE);
  const rows = [...calc.received].sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((n, r) => n + r.base, 0);
  const shown = all ? rows : rows.slice(0, SHOW);
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '-');
  const clientIdx = new Map(group(rows, (r) => r.client).map((g, i) => [g.name, i]));
  const groups = view === 'client' ? group(rows, (r) => r.client) : view === 'method' ? group(rows, (r) => r.method) : [];

  return (
    <section className="ac-card" style={{ marginTop: 14 }}>
      <div className="ac-card-head">
        <h2>Source of money</h2>
        <span className="ac-count tabular">{rows.length} payment{rows.length === 1 ? '' : 's'}</span>
        <div className="ac-seg ac-right" role="tablist" aria-label="How to list the money received">
          <button type="button" className={view === 'payments' ? 'on' : ''} onClick={() => setView('payments')}>All payments</button>
          <button type="button" className={view === 'client' ? 'on' : ''} onClick={() => setView('client')}>By client</button>
          <button type="button" className={view === 'method' ? 'on' : ''} onClick={() => setView('method')}>By method</button>
        </div>
      </div>
      <div className="ac-scroll">
        {view === 'payments' ? (
          <table className="ac-table">
            <thead><tr><th>Date</th><th>From (client)</th><th>For (project)</th><th>Invoice</th><th>Paid by</th><th>Reference</th><th className="ac-r">Amount ({BASE})</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={tint(clientIdx.get(r.client) ?? 0)}>
                  <td className="ac-nowrap">{r.date ? formatDateLong(r.date) : '-'}</td>
                  <td className="ac-strong">{r.client}</td>
                  <td>{r.project}</td>
                  <td>{r.invoiceNo}</td>
                  <td>{r.method}</td>
                  <td className="ac-faint">{r.ref || '-'}</td>
                  <td className="ac-r tabular ac-strong">{money(r.base)}{r.currency !== BASE && <div className="ac-faint">{formatMoney(r.amount, r.currency)}</div>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="ac-empty-cell">No confirmed payments yet.</td></tr>}
              {rows.length > 0 && <tr><td colSpan={6} className="ac-strong">Total received</td><td className="ac-r tabular ac-strong">{money(total)}</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="ac-table">
            <thead><tr><th>{view === 'client' ? 'Client' : 'Payment method'}</th><th className="ac-r">Payments</th><th className="ac-r">Share</th><th className="ac-r">Amount ({BASE})</th></tr></thead>
            <tbody>
              {groups.map((g, i) => (
                <tr key={g.name} style={tint(i)}>
                  <td className="ac-strong">{g.name}</td>
                  <td className="ac-r tabular">{g.count}</td>
                  <td className="ac-r tabular">{pct(g.base)}</td>
                  <td className="ac-r tabular ac-strong">{money(g.base)}</td>
                </tr>
              ))}
              {groups.length === 0 && <tr><td colSpan={4} className="ac-empty-cell">No confirmed payments yet.</td></tr>}
              {groups.length > 0 && <tr><td className="ac-strong">Total</td><td className="ac-r tabular ac-strong">{rows.length}</td><td className="ac-r tabular ac-strong">100%</td><td className="ac-r tabular ac-strong">{money(total)}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {view === 'payments' && rows.length > SHOW && (
        <div className="ac-card-body" style={{ paddingTop: 0 }}>
          <button type="button" className="ac-link ac-linkbtn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${rows.length} payments`}</button>
        </div>
      )}
    </section>
  );
}
