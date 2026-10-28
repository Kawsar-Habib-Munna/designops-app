'use client';

// Part-to-whole as a ring: a thin donut (stroke arcs with small gaps, round-free ends) with the total in the centre,
// and a legend naming every segment with its count and share, so nothing depends on colour alone. Hovering or
// focusing a legend row or an arc highlights the matching one and shows its figure in the centre. Labels render as
// React text only.
import { useState } from 'react';
import type { StatusSegment } from './StatusBar';
import './dash-charts.css';

const SIZE = 168;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GAP = 3; // px of empty arc between segments

export default function DonutChart({ segments, noun = 'project' }: { segments: StatusSegment[]; noun?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className="sb-empty">No {noun}s yet — they will appear here once some are created.</p>;
  }

  const visible = segments.filter((s) => s.count > 0);
  const summary = segments.map((s) => `${s.label} ${s.count}`).join(', ');
  const focus = segments.find((s) => s.key === active) ?? null;

  const arcs = visible.map((s, i) => {
    const before = visible.slice(0, i).reduce((sum, v) => sum + v.count, 0);
    const len = (s.count / total) * C;
    return { s, dash: Math.max(len - (visible.length > 1 ? GAP : 0), 0.5), offset: (before / total) * C };
  });

  return (
    <div className="dn">
      <div className="dn-ring" onPointerLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="dn-svg" role="img" aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} status: ${summary}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="dn-track" strokeWidth={STROKE} />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ s, dash, offset: off }) => (
              <circle
                key={s.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-off}
                className={`dn-arc${active && active !== s.key ? ' is-dim' : ''}`}
                onPointerEnter={() => setActive(s.key)}
              >
                <title>{`${s.label}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="dn-center" aria-hidden="true">
          <span className="dn-num tabular">{focus ? focus.count : total}</span>
          <span className="dn-sub">{focus ? focus.label : total === 1 ? noun : `${noun}s`}</span>
        </div>
      </div>

      <ul className="sb-legend dn-legend">
        {segments.map((s) => (
          <li
            key={s.key}
            tabIndex={0}
            className={active === s.key ? 'is-active' : undefined}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
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
