'use client';

// A count over consecutive days as a line + soft area chart: 2px line with round joins, a ~10% area wash, an 8px+
// end dot with a 2px surface ring, hairline gridlines, selective x labels (first / middle / last), a crosshair that
// snaps to the nearest day with a tooltip, arrow-key support, and a Table view. Labels render as React text only.
import { useRef, useState, type KeyboardEvent } from 'react';
import './dash-charts.css';

export type TrendPoint = { date: string; label: string; sub: string; value: number };

const W = 560;
const H = 210;
const PAD = { l: 30, r: 14, t: 16, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

function niceStep(max: number): number {
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  for (const m of [1, 2, 5, 10]) {
    if (rough <= m * mag) return m * mag;
  }
  return 10 * mag;
}

export default function TrendChart({ points, noun = 'task' }: { points: TrendPoint[]; noun?: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [idx, setIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = points.length;
  const total = points.reduce((s, p) => s + p.value, 0);
  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const step = niceStep(maxValue * 1.2);
  const axisMax = Math.ceil((maxValue * 1.2) / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);

  const x = (i: number) => PAD.l + (n <= 1 ? PLOT_W / 2 : (i * PLOT_W) / (n - 1));
  const y = (v: number) => PAD.t + PLOT_H - (v / axisMax) * PLOT_H;
  const baseY = y(0);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${baseY} L${x(0).toFixed(1)} ${baseY} Z`;
  const best = points.reduce((b, p) => (p.value > b.value ? p : b), points[0]);
  const tip = idx !== null ? points[idx] : null;
  const labelIdx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);

  function nearest(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.round(((px - PAD.l) / PLOT_W) * (n - 1))));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight') setIdx((cur) => Math.min(n - 1, (cur ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setIdx((cur) => Math.max(0, (cur ?? n) - 1));
    else if (e.key === 'Escape') setIdx(null);
    else return;
    e.preventDefault();
  }

  return (
    <div className="tc">
      <div className="tc-toolbar">
        <span className="tc-caption">Marked done per day · last {n} days</span>
        <div className="tc-seg" role="group" aria-label="Trend view">
          <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
            Chart
          </button>
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="tc-chart">
          <svg
            ref={svgRef}
            className="tc-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${total} ${noun}${total === 1 ? '' : 's'} marked done over the last ${n} days. Use the left and right arrow keys to read each day.`}
            tabIndex={0}
            onPointerMove={(e) => setIdx(nearest(e.clientX))}
            onPointerLeave={() => setIdx(null)}
            onKeyDown={onKey}
            onBlur={() => setIdx(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'tc-base' : 'tc-grid'} />
                <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" className="tc-ytick">
                  {t}
                </text>
              </g>
            ))}

            <path d={area} className="tc-area" />
            <path d={line} className="tc-line" />

            {labelIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="tc-xtick">
                {points[i].label}
              </text>
            ))}

            {/* end dot (always) — 8px+ with a 2px ring in the surface colour */}
            <circle cx={x(n - 1)} cy={y(points[n - 1].value)} r={5} className="tc-dot" />

            {idx !== null && (
              <g>
                <line x1={x(idx)} x2={x(idx)} y1={PAD.t} y2={baseY} className="tc-cross" />
                <circle cx={x(idx)} cy={y(points[idx].value)} r={5} className="tc-dot" />
              </g>
            )}
          </svg>

          {tip && idx !== null && (
            <div
              className={`tc-tooltip${idx > n * 0.6 ? ' flip' : ''}`}
              role="status"
              style={{ left: `${(x(idx) / W) * 100}%`, top: `${(y(tip.value) / H) * 100}%` }}
            >
              <div className="tc-tooltip-value tabular">
                <span className="tc-tooltip-key" />
                {tip.value} {noun}
                {tip.value === 1 ? '' : 's'} done
              </div>
              <div className="tc-tooltip-name">{tip.sub}</div>
            </div>
          )}
        </div>
      ) : (
        <table className="tc-table">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Done</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.date}>
                <td>{p.sub}</td>
                <td className="num tabular">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="tc-foot">
        <span>
          <b className="tabular">{total}</b> {noun}
          {total === 1 ? '' : 's'} done in {n} days
        </span>
        {best && best.value > 0 && (
          <span>
            Best day: <b>{best.label}</b> ({best.value})
          </span>
        )}
      </div>
    </div>
  );
}
