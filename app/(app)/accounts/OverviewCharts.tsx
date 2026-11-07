'use client';

// Accounts > Overview: three small charts drawn as plain SVG (no chart library).
//  1. Income against expenses, month by month (grouped columns)
//  2. Profit or loss, month by month (columns up or down from zero)
//  3. Total money over time (line: everything received minus everything spent, at each month end)
// Colours: categorical slot 1 (blue) and slot 2 (orange) for income and expenses, blue and red for profit and loss.
// Each month has a hover tooltip; the "Last 6 months" table right below is the table view of the same numbers.

import { useState } from 'react';
import { formatMoney } from '@/lib/currency';
import { BASE, monthLabel, type Calc } from '@/lib/accountsCore';
import { smoothPath } from './viz';

const W = 520;
const H = 230;
const M = { l: 46, r: 14, t: 14, b: 30 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;

// clean axis ticks that include zero
function ticks(min: number, max: number) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1;
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; ; v += step) {
    out.push(Math.round(v * 100) / 100);
    if (v >= hi - step * 0.001) break;
  }
  return { list: out, lo: out[0], hi: out[out.length - 1] };
}
const compact = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}${+(a / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${sign}${+(a / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(a).toLocaleString('en-US')}`;
};
// a column with a 4px rounded data end and a square baseline end
function colPath(x: number, y0: number, y1: number, w: number) {
  const top = Math.min(y0, y1);
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  const r = Math.min(4, h, w / 2);
  const up = y1 < y0; // data end is the top
  if (up) return `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y0} Z`;
  return `M${x},${y0} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + w - r} Q${x + w},${top + h} ${x + w},${top + h - r} V${y0} Z`;
}

type Tip = { i: number; x: number };

function Frame({ title, sub, legend, children }: { title: string; sub: string; legend?: { color: string; label: string }[]; children: React.ReactNode }) {
  return (
    <section className="ac-card ac-viz-card">
      <div className="ac-viz-head">
        <div><h2>{title}</h2><p>{sub}</p></div>
        {legend && (
          <div className="ac-viz-legend">
            {legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export default function OverviewCharts({ calc }: { calc: Calc }) {
  const [tip, setTip] = useState<{ chart: 'a' | 'b' | 'c'; t: Tip } | null>(null);
  const months = calc.trend;
  const n = months.length;
  const money = (v: number) => formatMoney(v, BASE);
  const band = PW / Math.max(n, 1);
  const cx = (i: number) => M.l + band * i + band / 2;

  // the running total at each month end: all the money received minus all the expenses up to then
  const running = months.map((m) => calc.received.filter((r) => r.month <= m.month).reduce((s, r) => s + r.base, 0) - calc.exp.filter((e) => e.expense_date.slice(0, 7) <= m.month).reduce((s, e) => s + e.base, 0));

  const tA = ticks(0, Math.max(...months.map((m) => Math.max(m.income, m.expenses)), 1));
  const tB = ticks(Math.min(...months.map((m) => m.profit), 0), Math.max(...months.map((m) => m.profit), 1));
  const tC = ticks(Math.min(...running, 0), Math.max(...running, 1));
  const yA = (v: number) => M.t + PH - ((v - tA.lo) / (tA.hi - tA.lo || 1)) * PH;
  const yB = (v: number) => M.t + PH - ((v - tB.lo) / (tB.hi - tB.lo || 1)) * PH;
  const yC = (v: number) => M.t + PH - ((v - tC.lo) / (tC.hi - tC.lo || 1)) * PH;

  const axes = (t: { list: number[] }, y: (v: number) => number) => (
    <>
      {t.list.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'ac-viz-base' : 'ac-viz-grid'} />
          <text x={M.l - 8} y={y(v) + 4} textAnchor="end" className="ac-viz-tick">{compact(v)}</text>
        </g>
      ))}
      {months.map((m, i) => <text key={m.month} x={cx(i)} y={H - 10} textAnchor="middle" className="ac-viz-tick">{monthLabel(m.month).split(' ')[0]}</text>)}
    </>
  );
  const hits = (chart: 'a' | 'b' | 'c') =>
    months.map((m, i) => (
      <rect key={m.month} x={M.l + band * i} y={M.t} width={band} height={PH} fill="transparent" onMouseEnter={() => setTip({ chart, t: { i, x: cx(i) } })} onMouseMove={() => setTip({ chart, t: { i, x: cx(i) } })} onMouseLeave={() => setTip(null)} />
    ));
  const tooltip = (chart: 'a' | 'b' | 'c', rows: (i: number) => [string, string, string?][]) => {
    if (!tip || tip.chart !== chart) return null;
    const i = tip.t.i;
    const left = Math.min(Math.max((tip.t.x / W) * 100, 18), 82);
    return (
      <div className="ac-viz-tip" style={{ left: `${left}%` }} role="status">
        <b>{monthLabel(months[i].month)}</b>
        {rows(i).map(([k, v, c]) => <span key={k}>{c && <i style={{ background: c }} />}{k}<em className="tabular">{v}</em></span>)}
      </div>
    );
  };

  const barW = 20;
  const last = n - 1;
  const linePath = smoothPath(running.map((v, i): [number, number] => [cx(i), yC(v)]));

  return (
    <div className="ac-viz-row">
      <Frame title="Income and expenses" sub="Money in against money out, last 6 months" legend={[{ color: 'var(--viz-1)', label: 'Income' }, { color: 'var(--viz-2)', label: 'Expenses' }]}>
        <div className="ac-viz-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Income and expenses for the last 6 months. The table below has the same numbers.">
            {axes(tA, yA)}
            {months.map((m, i) => (
              <g key={m.month}>
                <path d={colPath(cx(i) - barW - 1, yA(0), yA(m.income), barW)} fill="var(--viz-1)" />
                <path d={colPath(cx(i) + 1, yA(0), yA(m.expenses), barW)} fill="var(--viz-2)" />
              </g>
            ))}
            {hits('a')}
          </svg>
          {tooltip('a', (i) => [['Income', money(months[i].income), 'var(--viz-1)'], ['Expenses', money(months[i].expenses), 'var(--viz-2)'], ['Profit', money(months[i].profit)]])}
        </div>
      </Frame>

      <Frame title="Profit or loss" sub="What was left each month" legend={[{ color: 'var(--viz-1)', label: 'Profit' }, { color: 'var(--viz-neg)', label: 'Loss' }]}>
        <div className="ac-viz-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Profit or loss for the last 6 months. The table below has the same numbers.">
            {axes(tB, yB)}
            {months.map((m, i) => <path key={m.month} d={colPath(cx(i) - barW / 2, yB(0), yB(m.profit), barW)} fill={m.profit < 0 ? 'var(--viz-neg)' : 'var(--viz-1)'} />)}
            {hits('b')}
          </svg>
          {tooltip('b', (i) => [[months[i].profit < 0 ? 'Loss' : 'Profit', money(Math.abs(months[i].profit)), months[i].profit < 0 ? 'var(--viz-neg)' : 'var(--viz-1)']])}
        </div>
      </Frame>

      <Frame title="Total money over time" sub="Everything received minus everything spent, at each month end">
        <div className="ac-viz-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Total money at the end of each of the last 6 months. The current total is the last point.">
            {axes(tC, yC)}
            {n > 0 && <path d={`${linePath} L${cx(last)},${yC(0)} L${cx(0)},${yC(0)} Z`} fill="var(--viz-1)" opacity="0.1" />}
            {n > 0 && <path d={linePath} fill="none" stroke="var(--viz-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {tip?.chart === 'c' && <line x1={tip.t.x} x2={tip.t.x} y1={M.t} y2={M.t + PH} className="ac-viz-grid" />}
            {running.map((v, i) => (tip?.chart === 'c' && tip.t.i === i) || i === last ? <circle key={i} cx={cx(i)} cy={yC(v)} r="4.5" fill="var(--viz-1)" stroke="var(--viz-surface)" strokeWidth="2" /> : null)}
            {n > 0 && <text x={Math.min(cx(last), W - M.r)} y={yC(running[last]) - 10} textAnchor="end" className="ac-viz-value">{money(running[last])}</text>}
            {hits('c')}
          </svg>
          {tooltip('c', (i) => [['Total money', money(running[i]), 'var(--viz-1)']])}
        </div>
      </Frame>
    </div>
  );
}
