'use client';

// Team Workload as a ranked horizontal bar chart (open tasks per person). One measure across people = magnitude
// comparison, so: bars, a single hue (the dashboard accent), thin marks with a rounded tip anchored at the baseline,
// the value at the bar tip, hairline gridlines, a "full load" marker, a hover/focus tooltip, and a Table view so every
// number is reachable without hovering. Names are rendered as React text (never HTML), so they cannot inject markup.
import { useState } from 'react';
import './workload-chart.css';

export type WorkloadDatum = { name: string; count: number };

// Same threshold the project page already uses: 5 open tasks = a person at full load.
const FULL_LOAD = 5;
const MAX_ROWS = 8;

// a clean tick step so the axis shows at most ~5 round numbers (1, 2, 5, 10, 20, 50 ...)
function niceStep(max: number): number {
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  for (const m of [1, 2, 5, 10]) {
    if (rough <= m * mag) return m * mag;
  }
  return 10 * mag;
}

export default function WorkloadChart({ data }: { data: WorkloadDatum[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<{ index: number; x: number; y: number; flip: boolean } | null>(null);

  const rows = data.slice(0, MAX_ROWS);
  const hidden = data.length - rows.length;
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const busiest = data[0];

  // axis: always shows the full-load marker; headroom so the value label at the longest bar's tip has room
  const maxValue = Math.max(...data.map((d) => d.count), FULL_LOAD);
  const step = niceStep(maxValue * 1.15);
  const axisMax = Math.ceil((maxValue * 1.15) / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);
  const pct = (v: number) => `${(v / axisMax) * 100}%`;

  const tip = hover ? rows[hover.index] : null;
  const over = tip ? tip.count - FULL_LOAD : 0;

  function showAt(index: number, el: HTMLElement, clientX?: number, clientY?: number) {
    const box = el.closest('.wl-chart')?.getBoundingClientRect();
    if (!box) return;
    const rect = el.getBoundingClientRect();
    const x = (clientX ?? rect.left + rect.width / 2) - box.left;
    const y = (clientY ?? rect.top + rect.height / 2) - box.top;
    setHover({ index, x, y, flip: x > box.width * 0.6 });
  }

  return (
    <div className="wl">
      <div className="wl-toolbar">
        <span className="wl-caption">Open tasks per person</span>
        <div className="wl-seg" role="group" aria-label="Workload view">
          <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
            Chart
          </button>
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="wl-chart" onPointerLeave={() => setHover(null)}>
          <div className="wl-plot" role="list" aria-label={`Open tasks per person; ${FULL_LOAD} tasks is a full load`}>
            {/* hairline gridlines + the full-load marker, drawn behind the rows in the plot column */}
            <div className="wl-grid" aria-hidden="true">
              {ticks.map((t) => (
                <span key={t} className="wl-gridline" style={{ left: pct(t) }} />
              ))}
              <span className="wl-cap" style={{ left: pct(FULL_LOAD) }}>
                <span className="wl-cap-label">Full load · {FULL_LOAD}</span>
              </span>
            </div>

            {rows.map((d, i) => (
              <div
                className={`wl-row${hover?.index === i ? ' is-hover' : ''}`}
                key={d.name}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.name}: ${d.count} open ${d.count === 1 ? 'task' : 'tasks'}`}
                onPointerMove={(e) => showAt(i, e.currentTarget, e.clientX, e.clientY)}
                onFocus={(e) => showAt(i, e.currentTarget)}
                onBlur={() => setHover(null)}
              >
                <span className="wl-name" title={d.name}>
                  {d.name}
                </span>
                <span className="wl-track">
                  <span className="wl-bar" style={{ width: pct(d.count) }} />
                  <span className="wl-val tabular" style={{ left: `calc(${pct(d.count)} + 8px)` }}>
                    {d.count}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* tick labels sit under the plot column */}
          <div className="wl-axis" aria-hidden="true">
            <span />
            <span className="wl-axis-track">
              {ticks.map((t) => (
                <span key={t} className="wl-tick tabular" style={{ left: pct(t) }}>
                  {t}
                </span>
              ))}
            </span>
          </div>

          {tip && hover && (
            <div className={`wl-tooltip${hover.flip ? ' flip' : ''}`} role="status" style={{ left: hover.x, top: hover.y }}>
              <div className="wl-tooltip-value tabular">
                <span className="wl-tooltip-key" />
                {tip.count} open {tip.count === 1 ? 'task' : 'tasks'}
              </div>
              <div className="wl-tooltip-name">{tip.name}</div>
              {over > 0 && (
                <div className="wl-tooltip-note">
                  {over} over full load ({FULL_LOAD})
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <table className="wl-table">
          <thead>
            <tr>
              <th>Person</th>
              <th className="num">Open tasks</th>
              <th className="num">vs full load</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const diff = d.count - FULL_LOAD;
              return (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td className="num tabular">{d.count}</td>
                  <td className="num tabular">{diff === 0 ? 'at full load' : diff > 0 ? `+${diff} over` : `${-diff} spare`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="wl-foot">
        <span>
          <b className="tabular">{total}</b> open {total === 1 ? 'task' : 'tasks'} across <b className="tabular">{data.length}</b>{' '}
          {data.length === 1 ? 'person' : 'people'}
        </span>
        {busiest && view === 'chart' && hidden > 0 && <span>+{hidden} more in Table view</span>}
        {busiest && (view === 'table' || hidden <= 0) && (
          <span>
            Most loaded: <b>{busiest.name}</b>
          </span>
        )}
      </div>
    </div>
  );
}
