'use client';

// Small chart kit for the accounts pages, drawn as plain SVG / HTML (no chart library). Every tab builds its visuals from these:
//  VizCard (the frame) · Columns (grouped or stacked) · RankColumns (one column per item) · Donut (shares of a whole) · MultiLine · SegBar (one whole split into parts)
// Colours are the categorical slots from the dataviz palette, set once as --viz-1..8 in accounts2.css (light and dark).

import { useState } from 'react';

export const SLOT = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-4)', 'var(--viz-5)', 'var(--viz-6)', 'var(--viz-7)'];
export const OTHER = 'var(--viz-other)';

const W = 520;
const H = 230;
const M = { l: 46, r: 14, t: 14, b: 30 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;

export function niceTicks(min: number, max: number) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1;
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const list: number[] = [];
  for (let v = start; ; v += step) {
    list.push(Math.round(v * 100) / 100);
    if (v >= hi - step * 0.001) break;
  }
  return { list, lo: list[0], hi: list[list.length - 1] };
}
export const compactNum = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}${+(a / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${sign}${+(a / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(a).toLocaleString('en-US')}`;
};
function colPath(x: number, y0: number, y1: number, w: number, round: boolean) {
  const top = Math.min(y0, y1);
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  if (!round) return `M${x},${y0} V${y1} H${x + w} V${y0} Z`;
  const r = Math.min(4, h, w / 2);
  return `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${y0} Z`;
}

export type Series = { name: string; color: string; values: number[] };
type Legend = { color: string; label: string };

export function VizCard({ title, sub, legend, children }: { title: string; sub?: string; legend?: Legend[]; children: React.ReactNode }) {
  return (
    <section className="ac-card ac-viz-card">
      <div className="ac-viz-head">
        <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
        {legend && legend.length > 1 && (
          <div className="ac-viz-legend">{legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}</div>
        )}
      </div>
      {children}
    </section>
  );
}
export const VizRow = ({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) => <div className={`ac-viz-row${cols === 2 ? ' ac-viz-row-2' : ''}`}>{children}</div>;

function Tip({ title, rows, x }: { title: string; rows: [string, string, string?][]; x: number }) {
  const left = Math.min(Math.max((x / W) * 100, 18), 82);
  return (
    <div className="ac-viz-tip" style={{ left: `${left}%` }} role="status">
      <b>{title}</b>
      {rows.map(([k, v, c]) => <span key={k}>{c && <i style={{ background: c }} />}{k}<em className="tabular">{v}</em></span>)}
    </div>
  );
}
function Axes({ t, y, labels, cx }: { t: { list: number[] }; y: (v: number) => number; labels: string[]; cx: (i: number) => number }) {
  return (
    <>
      {t.list.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'ac-viz-base' : 'ac-viz-grid'} />
          <text x={M.l - 8} y={y(v) + 4} textAnchor="end" className="ac-viz-tick">{compactNum(v)}</text>
        </g>
      ))}
      {labels.map((l, i) => <text key={i} x={cx(i)} y={H - 10} textAnchor="middle" className="ac-viz-tick">{l}</text>)}
    </>
  );
}

// ---------------------------------------------------------------- columns: grouped, or stacked with a 2px gap between parts
export function Columns({ labels, series, stacked = false, fmt, ariaLabel, tipTitles }: { labels: string[]; series: Series[]; stacked?: boolean; fmt: (n: number) => string; ariaLabel: string; tipTitles?: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const band = PW / Math.max(n, 1);
  const cx = (i: number) => M.l + band * i + band / 2;
  const max = Math.max(1, ...labels.map((_, i) => (stacked ? series.reduce((s, x) => s + (x.values[i] ?? 0), 0) : Math.max(...series.map((x) => x.values[i] ?? 0)))));
  const t = niceTicks(0, max);
  const y = (v: number) => M.t + PH - ((v - t.lo) / (t.hi - t.lo || 1)) * PH;
  const bw = stacked ? Math.min(30, band - 18) : Math.max(6, Math.min(20, (band - 12) / series.length - 2));
  return (
    <div className="ac-viz-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <Axes t={t} y={y} labels={labels} cx={cx} />
        {labels.map((_, i) => {
          if (stacked) {
            let cum = 0;
            const parts = series.map((s) => ({ s, v: s.values[i] ?? 0 })).filter((p) => p.v > 0);
            return (
              <g key={i}>
                {parts.map((p, k) => {
                  const y0 = y(cum);
                  cum += p.v;
                  const y1 = y(cum);
                  return <path key={p.s.name} d={colPath(cx(i) - bw / 2, k === 0 ? y0 : y0 - 2, y1, bw, k === parts.length - 1)} fill={p.s.color} />;
                })}
              </g>
            );
          }
          const total = series.length * bw + (series.length - 1) * 2;
          return (
            <g key={i}>
              {series.map((s, k) => <path key={s.name} d={colPath(cx(i) - total / 2 + k * (bw + 2), y(0), y(s.values[i] ?? 0), bw, true)} fill={s.color} />)}
            </g>
          );
        })}
        {labels.map((_, i) => <rect key={i} x={M.l + band * i} y={M.t} width={band} height={PH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} onMouseLeave={() => setHover(null)} />)}
      </svg>
      {hover !== null && (
        <Tip
          x={cx(hover)}
          title={tipTitles?.[hover] ?? labels[hover]}
          rows={[...series.filter((s) => (s.values[hover] ?? 0) !== 0 || series.length === 1).map((s): [string, string, string] => [s.name, fmt(s.values[hover] ?? 0), s.color]), ...(stacked && series.length > 1 ? [['Total', fmt(series.reduce((a, s) => a + (s.values[hover] ?? 0), 0))] as [string, string]] : [])]}
        />
      )}
    </div>
  );
}

// A smooth curve through the points (monotone cubic: it never dips below or rises above the data between points).
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const sl: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    sl.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const m: number[] = [sl[0]];
  for (let i = 1; i < n - 1; i++) m.push(sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2);
  m.push(sl[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (sl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / sl[i];
    const b = m[i + 1] / sl[i];
    const h = Math.hypot(a, b);
    if (h > 3) { m[i] = (3 * a * sl[i]) / h; m[i + 1] = (3 * b * sl[i]) / h; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const k = dx[i] / 3;
    d += ` C${pts[i][0] + k},${pts[i][1] + m[i] * k} ${pts[i + 1][0] - k},${pts[i + 1][1] - m[i + 1] * k} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

// ---------------------------------------------------------------- lines (one or more series)
export function MultiLine({ labels, series, fmt, ariaLabel }: { labels: string[]; series: Series[]; fmt: (n: number) => string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const band = PW / Math.max(n, 1);
  const cx = (i: number) => M.l + band * i + band / 2;
  const all = series.flatMap((s) => s.values);
  const t = niceTicks(Math.min(0, ...all), Math.max(1, ...all));
  const y = (v: number) => M.t + PH - ((v - t.lo) / (t.hi - t.lo || 1)) * PH;
  return (
    <div className="ac-viz-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        <Axes t={t} y={y} labels={labels} cx={cx} />
        {hover !== null && <line x1={cx(hover)} x2={cx(hover)} y1={M.t} y2={M.t + PH} className="ac-viz-grid" />}
        {series.map((s) => (
          <g key={s.name}>
            {series.length === 1 && n > 0 && <path d={`${smoothPath(s.values.map((v, i): [number, number] => [cx(i), y(v)]))} L${cx(n - 1)},${y(0)} L${cx(0)},${y(0)} Z`} fill={s.color} opacity="0.1" />}
            <path d={smoothPath(s.values.map((v, i): [number, number] => [cx(i), y(v)]))} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (i === n - 1 || hover === i ? <circle key={i} cx={cx(i)} cy={y(v)} r="4.5" fill={s.color} stroke="var(--viz-surface)" strokeWidth="2" /> : null))}
          </g>
        ))}
        {labels.map((_, i) => <rect key={i} x={M.l + band * i} y={M.t} width={band} height={PH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} onMouseLeave={() => setHover(null)} />)}
      </svg>
      {hover !== null && <Tip x={cx(hover)} title={labels[hover]} rows={series.map((s): [string, string, string] => [s.name, fmt(s.values[hover] ?? 0), s.color])} />}
    </div>
  );
}

// ---------------------------------------------------------------- donut: shares of a whole (top 6 named, the rest folded into Other)
export function Donut({ items, fmt, empty = 'Nothing to show yet.', center = 'Total' }: { items: { label: string; value: number }[]; fmt: (n: number) => string; empty?: string; center?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const clean = items.filter((i) => i.value > 0);
  if (clean.length === 0) return <p className="ac-empty" style={{ padding: '18px 0' }}>{empty}</p>;
  const list = clean.length > 7 ? [...clean.slice(0, 6), { label: 'Other', value: clean.slice(6).reduce((n, i) => n + i.value, 0) }] : clean;
  const total = list.reduce((n, i) => n + i.value, 0);
  const R = 62;
  const C = 80;
  const pt = (deg: number) => [C + R * Math.cos((deg * Math.PI) / 180), C + R * Math.sin((deg * Math.PI) / 180)];
  const starts = list.map((_, k) => -90 + list.slice(0, k).reduce((n, i) => n + (i.value / total) * 360, 0));
  const arcs = list.map((it, k) => {
    const sweep = (it.value / total) * 360;
    const gap = list.length > 1 ? Math.min(2.4, sweep / 3) : 0;
    const a0 = starts[k] + gap / 2;
    const a1 = starts[k] + sweep - gap / 2;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return { it, k, color: it.label === 'Other' && list.length > 6 && k === list.length - 1 ? OTHER : SLOT[k % SLOT.length], d: list.length === 1 ? '' : `M${x0},${y0} A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}` };
  });
  const cur = hover !== null ? list[hover] : null;
  return (
    <div className="ac-donut">
      <div className="ac-donut-ring">
        <svg viewBox="0 0 160 160" role="img" aria-label={list.map((i) => `${i.label} ${fmt(i.value)}`).join(', ')}>
          {list.length === 1 && <circle cx={C} cy={C} r={R} fill="none" stroke={arcs[0].color} strokeWidth="24" />}
          {arcs.map((x) => x.d && <path key={x.it.label} d={x.d} fill="none" stroke={x.color} strokeWidth={hover === x.k ? 28 : 24} onMouseEnter={() => setHover(x.k)} onMouseLeave={() => setHover(null)} />)}
        </svg>
        <div className="ac-donut-mid">
          <small>{cur ? cur.label : center}</small>
          <b className="tabular">{fmt(cur ? cur.value : total)}</b>
          {cur && <small>{Math.round((cur.value / total) * 100)}%</small>}
        </div>
      </div>
      <ul className="ac-donut-legend">
        {arcs.map((x) => (
          <li key={x.it.label} onMouseEnter={() => setHover(x.k)} onMouseLeave={() => setHover(null)} className={hover === x.k ? 'on' : ''}>
            <i style={{ background: x.color }} />
            <span title={x.it.label}>{x.it.label}</span>
            <em className="tabular">{Math.round((x.it.value / total) * 100)}%</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- one column per item, up or down from zero, each with its own colour
export function RankColumns({ items, fmt, tickFmt, ariaLabel }: { items: { label: string; value: number; color?: string; note?: string }[]; fmt: (n: number) => string; tickFmt?: (n: number) => string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (items.length === 0) return <p className="ac-empty" style={{ padding: '18px 0' }}>Nothing to show yet.</p>;
  const n = items.length;
  const band = PW / n;
  const cx = (i: number) => M.l + band * i + band / 2;
  const t = niceTicks(Math.min(0, ...items.map((i) => i.value)), Math.max(1, ...items.map((i) => i.value)));
  const y = (v: number) => M.t + PH - ((v - t.lo) / (t.hi - t.lo || 1)) * PH;
  const bw = Math.min(28, band - 16);
  const short = (s: string) => (s.length > 11 ? s.slice(0, 10) + '…' : s);
  return (
    <div className="ac-viz-plot">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {t.list.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'ac-viz-base' : 'ac-viz-grid'} />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" className="ac-viz-tick">{tickFmt ? tickFmt(v) : compactNum(v)}</text>
          </g>
        ))}
        {items.map((it, i) => (
          <g key={it.label}>
            <path d={colPathSigned(cx(i) - bw / 2, y(0), y(it.value), bw)} fill={it.color ?? SLOT[0]} />
            <text x={cx(i)} y={H - 10} textAnchor="middle" className="ac-viz-tick">{short(it.label)}</text>
          </g>
        ))}
        {items.map((it, i) => <rect key={it.label} x={M.l + band * i} y={M.t} width={band} height={PH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} onMouseLeave={() => setHover(null)} />)}
      </svg>
      {hover !== null && <Tip x={cx(hover)} title={items[hover].label} rows={[[items[hover].note ?? 'Value', fmt(items[hover].value), items[hover].color ?? SLOT[0]]]} />}
    </div>
  );
}
// a column with a 4px rounded data end, up or down from the zero line
function colPathSigned(x: number, y0: number, y1: number, w: number) {
  const h = Math.abs(y1 - y0);
  if (h < 0.5) return '';
  const r = Math.min(4, h, w / 2);
  if (y1 < y0) return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

// ---------------------------------------------------------------- one whole split into parts (28px, share printed inside when it fits)
export function SegBar({ parts, fmt }: { parts: { label: string; value: number; color: string }[]; fmt: (n: number) => string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total <= 0) return <p className="ac-empty" style={{ padding: '18px 0' }}>Nothing to split yet.</p>;
  return (
    <div>
      <div className="ac-seg-bar" role="img" aria-label={parts.map((p) => `${p.label} ${fmt(p.value)}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => {
          const share = (p.value / total) * 100;
          return <span key={p.label} style={{ width: `${share}%`, background: p.color }} title={`${p.label}: ${fmt(p.value)} (${Math.round(share)}%)`}>{share >= 12 ? `${Math.round(share)}%` : ''}</span>;
        })}
      </div>
      <ul className="ac-seg-legend">
        {parts.map((p) => <li key={p.label}><i style={{ background: p.color }} />{p.label}<b className="tabular">{fmt(p.value)}</b></li>)}
      </ul>
    </div>
  );
}
