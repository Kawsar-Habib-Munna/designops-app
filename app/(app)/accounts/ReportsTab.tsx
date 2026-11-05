'use client';

// Profit & loss for a month, a quarter or a year, compared with the period before; print it or download it as CSV.
import { useState } from 'react';
import { formatMoney } from '@/lib/currency';
import { BASE, periodReport, type Calc, type PeriodType } from '@/lib/accountsCore';

export default function ReportsTab({ calc, today }: { calc: Calc; today: string }) {
  const [type, setType] = useState<PeriodType>('month');
  const [offset, setOffset] = useState(0);
  const r = periodReport(calc, type, offset, today);
  const money = (n: number) => formatMoney(n, BASE);
  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? '0%' : 'new';
    const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
    return `${p > 0 ? '+' : ''}${p}%`;
  };

  function csv() {
    const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows: (string | number)[][] = [
      ['Profit and loss', r.cur.label, `${r.cur.start} to ${r.cur.end}`, `Amounts in ${BASE}`],
      [],
      ['Income', r.cur.income],
      ...r.byClient.map((c) => ['  ' + c.name, c.amount]),
      [],
      ['Expenses', r.cur.expenses],
      ...r.byCategory.map((c) => ['  ' + c.category, c.amount]),
      [],
      ['Net profit', r.cur.profit],
      ['Margin', r.margin != null ? `${r.margin}%` : ''],
    ];
    const blob = new Blob(['﻿' + rows.map((x) => x.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-and-loss-${r.cur.label.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="ac-card ac-report">
      <div className="ac-card-head ac-noprint">
        <h2>Profit &amp; loss</h2>
        <div className="ac-seg" role="tablist">
          {(['month', 'quarter', 'year'] as PeriodType[]).map((t) => (
            <button key={t} type="button" className={type === t ? 'on' : ''} onClick={() => { setType(t); setOffset(0); }}>{t === 'month' ? 'Month' : t === 'quarter' ? 'Quarter' : 'Year'}</button>
          ))}
        </div>
        <div className="ac-right ac-inline">
          <button type="button" className="ac-ico ac-ico-plain" aria-label="Previous period" onClick={() => setOffset(offset - 1)}>‹</button>
          <button type="button" className="ac-ico ac-ico-plain" aria-label="Next period" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>›</button>
          <button type="button" className="ac-btn" onClick={csv}>CSV</button>
          <button type="button" className="ac-btn" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="ac-card-body">
        <div className="ac-report-head">
          <div><div className="ac-report-label">Profit and loss</div><div className="ac-report-period">{r.cur.label}</div></div>
          <div className="ac-report-note">{r.cur.start} to {r.cur.end} · amounts in {BASE}</div>
        </div>

        <div className="ac-pl">
          <div className="ac-pl-line ac-pl-main"><span>Income</span><b className="tabular">{money(r.cur.income)}</b><em className="tabular">{delta(r.cur.income, r.prev.income)}</em></div>
          {r.byClient.map((c) => (<div className="ac-pl-line ac-pl-sub" key={c.name}><span>{c.name}</span><b className="tabular">{money(c.amount)}</b><em /></div>))}
          {r.byClient.length === 0 && <div className="ac-pl-line ac-pl-sub"><span>No income in this period</span><b /><em /></div>}

          <div className="ac-pl-line ac-pl-main"><span>Expenses</span><b className="tabular">{money(r.cur.expenses)}</b><em className="tabular">{delta(r.cur.expenses, r.prev.expenses)}</em></div>
          {r.byCategory.map((c) => (<div className="ac-pl-line ac-pl-sub" key={c.category}><span>{c.category}</span><b className="tabular">{money(c.amount)}</b><em className="tabular">{r.cur.expenses > 0 ? `${Math.round((c.amount / r.cur.expenses) * 100)}%` : ''}</em></div>))}
          {r.byCategory.length === 0 && <div className="ac-pl-line ac-pl-sub"><span>No expenses in this period</span><b /><em /></div>}

          <div className="ac-pl-line ac-pl-total"><span>Net profit</span><b className={`tabular${r.cur.profit < 0 ? ' red' : ''}`}>{money(r.cur.profit)}</b><em className="tabular">{delta(r.cur.profit, r.prev.profit)}</em></div>
          <div className="ac-pl-line ac-pl-sub"><span>Profit margin</span><b className="tabular">{r.margin != null ? `${r.margin}%` : '-'}</b><em /></div>
        </div>
        <p className="ac-note">The small figure on the right compares with the period before ({r.prev.label}).</p>
      </div>
    </section>
  );
}
