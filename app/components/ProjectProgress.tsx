'use client';

// Per-project completion: one thin bar per unfinished project showing the share of its tasks that are done, least
// finished first. One measure on a fixed 0–100% scale = ranked bars, single hue, the value at the bar tip, plus a
// Table view with the task counts. Names render as React text only.
import { useState } from 'react';
import type { ProjectProgressRow } from '@/lib/dashboardCharts';
import './dash-charts.css';

const MAX_ROWS = 6;

export default function ProjectProgress({ rows }: { rows: ProjectProgressRow[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const shown = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shown.length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;

  if (rows.length === 0) {
    return <p className="sb-empty">No open projects with tasks yet.</p>;
  }

  return (
    <div className="pp">
      <div className="tc-toolbar">
        <span className="tc-caption">Tasks done per open project</span>
        <div className="tc-seg" role="group" aria-label="Progress view">
          <button type="button" className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>
            Chart
          </button>
          <button type="button" className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            Table
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <ul className="pp-list" aria-label="Project completion, least finished first">
          {shown.map((r) => (
            <li
              key={r.id}
              className="pp-row"
              tabIndex={0}
              title={`${r.name}: ${r.done} of ${r.total} tasks done`}
              aria-label={`${r.name}: ${r.pct}% done, ${r.done} of ${r.total} tasks`}
            >
              <span className="pp-name">{r.name}</span>
              <span className="pp-track">
                <span className="pp-bar" style={{ width: `${r.pct}%` }} />
              </span>
              <b className="pp-val tabular">{r.pct}%</b>
            </li>
          ))}
        </ul>
      ) : (
        <table className="tc-table">
          <thead>
            <tr>
              <th>Project</th>
              <th className="num">Done</th>
              <th className="num">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num tabular">{r.pct}%</td>
                <td className="num tabular">
                  {r.done}/{r.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="tc-foot">
        <span>
          Average: <b className="tabular">{avg}%</b> across <b className="tabular">{rows.length}</b> open {rows.length === 1 ? 'project' : 'projects'}
        </span>
        {view === 'chart' && hidden > 0 && <span>+{hidden} more in Table view</span>}
      </div>
    </div>
  );
}
