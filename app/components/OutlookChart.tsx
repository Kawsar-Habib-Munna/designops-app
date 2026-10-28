'use client';

// Workload Outlook (Team page): how many open, assigned tasks fall due in each of the next weeks, plus a first
// "Overdue" column. One measure over an ordered axis = a column chart: single hue (the dashboard accent), thin columns
// with a rounded cap anchored to the baseline, the value on each cap, hairline gridlines, a hover/focus tooltip and a
// Table view. The Overdue column uses the danger colour and says "Overdue" in its label, so colour is never alone.
import { useState } from 'react';
import './outlook-chart.css';

export type OutlookBucket = {
  key: string;
  label: string; // "Overdue", "This week", "Next week", "24 Nov" ...
  range: string; // the dates behind the label, e.g. "17–23 Nov"
  tasks: number;
  hours: number; // sum of the tasks' estimated hours (often 0 when nobody estimated)
  overdue?: boolean;
};

const PLOT_HEIGHT = 190;

// a clean tick step so the y axis shows a handful of round numbers (1, 2, 5, 10, 20 ...)
function niceStep(max: number): number {
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  for (const m of [1, 2, 5, 10]) {
    if (rough <= m * mag) return m * mag;
  }
  return 10 * mag;
}

export default function OutlookChart({
  buckets,
  undated,
  caption = 'Tasks due per week · open, assigned tasks',
  periodLabel = 'Week',
  showHours = true,
  noun = 'task',
}: {
  buckets: OutlookBucket[];
  undated: number;
  caption?: string;
  periodLabel?: string;
  // the estimated-hours detail (tooltip + table column); off when the caller does not compute hours
  showHours?: boolean;
  noun?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<{ index: number; x: number; y: number; flip: boolean } | null>(null);

  const total = buckets.reduce((sum, b) => sum + b.tasks, 0);
  const maxValue = Math.max(...buckets.map((b) => b.tasks), 1);
  const step = niceStep(maxValue * 1.2);
  const axisMax = Math.ceil((maxValue * 1.2) / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);
  const peak = buckets.reduce((best, b) => (b.tasks > best.tasks ? b : best), buckets[0]);
  const tip = hover ? buckets[hover.index] : null;

  // the tooltip sits just above the plot, centred on the hovered column (kept inside the card), so it never covers a bar
  function showAt(index: number, el: HTMLElement) {
    const box = el.closest('.oc-chart')?.getBoundingClientRect();
    if (!box) return;
    const rect = el.getBoundingClientRect();
    const half = 95;
    const x = Math.min(Math.max(rect.left + rect.width / 2 - box.left, half), Math.max(box.width - half, half));
    setHover({ index, x, y: 0, flip: false });
  }

  return (
    <div className="oc">
      <div className="oc-toolbar">
        <span className="oc-caption">{caption}</span>
        <div className="oc-seg" role="group" aria-label="Outlook view">
          <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
            Chart
          </button>
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="oc-chart" onPointerLeave={() => setHover(null)}>
          <div className="oc-frame">
            {/* y axis: round-number ticks + hairline gridlines */}
            <div className="oc-yaxis" aria-hidden="true" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((t) => (
                <span key={t} className="oc-ytick tabular" style={{ bottom: `${(t / axisMax) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="oc-plot" role="list" aria-label={`${noun}s due per period`}>
              <div className="oc-grid" aria-hidden="true" style={{ height: PLOT_HEIGHT }}>
                {ticks.map((t) => (
                  <span key={t} className="oc-gridline" style={{ bottom: `${(t / axisMax) * 100}%` }} />
                ))}
              </div>
              <div className="oc-cols" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
                {buckets.map((b, i) => (
                  <div
                    key={b.key}
                    className={`oc-col${hover?.index === i ? ' is-hover' : ''}${b.overdue ? ' is-overdue' : ''}`}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${b.label} (${b.range}): ${b.tasks} ${b.tasks === 1 ? noun : `${noun}s`} due`}
                    onPointerMove={(e) => showAt(i, e.currentTarget)}
                    onFocus={(e) => showAt(i, e.currentTarget)}
                    onBlur={() => setHover(null)}
                  >
                    <div className="oc-slot" style={{ height: PLOT_HEIGHT }}>
                      <span className="oc-bar" style={{ height: `${(b.tasks / axisMax) * 100}%` }}>
                        <span className="oc-val tabular">{b.tasks}</span>
                      </span>
                    </div>
                    <span className="oc-xlabel">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {tip && hover && (
            <div className={`oc-tooltip${hover.flip ? ' flip' : ''}`} role="status" style={{ left: hover.x, top: hover.y }}>
              <div className="oc-tooltip-value tabular">
                <span className={`oc-tooltip-key${tip.overdue ? ' danger' : ''}`} />
                {tip.tasks} {tip.tasks === 1 ? noun : `${noun}s`} {tip.overdue ? 'overdue' : 'due'}
              </div>
              <div className="oc-tooltip-name">
                {tip.label} · {tip.range}
              </div>
              {showHours && <div className="oc-tooltip-detail tabular">Est. {tip.hours}h of work</div>}
            </div>
          )}
        </div>
      ) : (
        <table className="oc-table">
          <thead>
            <tr>
              <th>{periodLabel}</th>
              <th>Dates</th>
              <th className="num">{noun[0].toUpperCase() + noun.slice(1)}s</th>
              {showHours && <th className="num">Est. hours</th>}
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td>{b.range}</td>
                <td className="num tabular">{b.tasks}</td>
                {showHours && <td className="num tabular">{b.hours}h</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="oc-foot">
        <span>
          <b className="tabular">{total}</b> {total === 1 ? noun : `${noun}s`} in view
          {peak && peak.tasks > 0 && !peak.overdue && (
            <>
              {' '}
              · busiest: <b>{peak.label}</b> ({peak.tasks})
            </>
          )}
        </span>
        {undated > 0 && (
          <span>
            {undated} {undated === 1 ? `${noun} has` : `${noun}s have`} no due date or fall later
          </span>
        )}
      </div>
    </div>
  );
}
