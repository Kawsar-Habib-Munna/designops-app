'use client';

// Part-to-whole: how the team's tasks split across statuses. A single stacked bar (2px surface gaps between segments,
// rounded ends) with a legend that names every status and shows its count and share, so nothing depends on colour
// alone. Hovering a legend row or a segment highlights the matching one. Labels render as React text only.
import { useState } from 'react';
import './dash-charts.css';

export type StatusSegment = { key: string; label: string; color: string; count: number };

export default function StatusBar({ segments, noun = 'task' }: { segments: StatusSegment[]; noun?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className="sb-empty">No {noun}s yet — they will appear here once some are created.</p>;
  }

  const summary = segments.map((s) => `${s.label} ${s.count}`).join(', ');

  return (
    <div className="sb">
      <div className="sb-total">
        <span className="sb-total-num">{total}</span>
        <span className="sb-total-label">{total === 1 ? noun : `${noun}s`} in total</span>
      </div>

      <div className="sb-bar" role="img" aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} status: ${summary}`} onPointerLeave={() => setActive(null)}>
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`sb-seg${active && active !== s.key ? ' is-dim' : ''}`}
              style={{ flexGrow: s.count, background: s.color }}
              title={`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}
              onPointerEnter={() => setActive(s.key)}
            />
          ))}
      </div>

      <ul className="sb-legend">
        {segments.map((s) => (
          <li
            key={s.key}
            className={active === s.key ? 'is-active' : undefined}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
          >
            <span className="sb-dot" style={{ background: s.color }} />
            <span className="sb-label">{s.label}</span>
            <b className="sb-count tabular">{s.count}</b>
            <span className="sb-pct tabular">{Math.round((s.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
