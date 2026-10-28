'use client';

// Workload Distribution (Team page): each person's share of their weekly capacity as a ranked meter. A bar's
// colour is the person's capacity STATE (Available / Balanced / Busy / Overloaded) — the track behind it is a
// lighter tint of the same colour, and the vertical hairlines sit at the state boundaries, so the state reads off
// the position as well as the colour. A legend names the states (colour never works alone), every row also carries
// its value as text, and a hover/focus tooltip adds the detail. Names render as React text, never HTML.
import { useState } from 'react';
import Avatar from './Avatar';
import './capacity-chart.css';

export type CapacityRow = {
  id: string;
  name: string;
  avatar_color: string | null;
  avatar_url?: string | null;
  percent: number;
  tasks: number;
  projects: number;
  estHours: number;
  stateLabel: string;
  stateColor: string;
};

export type CapacityLegendItem = { label: string; color: string; range: string };

export default function CapacityChart({
  rows,
  legend,
  bounds,
  weeklyHours,
}: {
  rows: CapacityRow[];
  legend: CapacityLegendItem[];
  // the % values where one state ends and the next begins (drawn as hairlines + axis labels)
  bounds: number[];
  weeklyHours: number;
}) {
  const [hover, setHover] = useState<{ index: number; x: number; y: number; flip: boolean } | null>(null);

  const maxPercent = Math.max(...rows.map((r) => r.percent), 100);
  const axisMax = Math.ceil(maxPercent / 20) * 20;
  const ticks = [0, ...bounds, axisMax].filter((v, i, a) => a.indexOf(v) === i && v <= axisMax);
  const pct = (v: number) => `${(Math.min(v, axisMax) / axisMax) * 100}%`;
  const tip = hover ? rows[hover.index] : null;

  function showAt(index: number, el: HTMLElement, clientX?: number, clientY?: number) {
    const box = el.closest('.cc-chart')?.getBoundingClientRect();
    if (!box) return;
    const rect = el.getBoundingClientRect();
    const x = (clientX ?? rect.left + rect.width / 2) - box.left;
    const y = (clientY ?? rect.top + rect.height / 2) - box.top;
    setHover({ index, x, y, flip: x > box.width * 0.6 });
  }

  return (
    <div className="cc">
      <ul className="cc-legend" aria-label="Capacity states">
        {legend.map((l) => (
          <li key={l.label}>
            <span className="cc-legend-dot" style={{ background: l.color }} />
            <span className="cc-legend-label">{l.label}</span>
            <span className="cc-legend-range">{l.range}</span>
          </li>
        ))}
      </ul>

      <div className="cc-chart" onPointerLeave={() => setHover(null)}>
        <div className="cc-plot" role="list" aria-label="Share of weekly capacity per person">
          <div className="cc-grid" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className="cc-gridline" style={{ left: pct(t) }} />
            ))}
          </div>

          {rows.map((r, i) => (
            <div
              key={r.id}
              className={`cc-row${hover?.index === i ? ' is-hover' : ''}`}
              role="listitem"
              tabIndex={0}
              aria-label={`${r.name}: ${r.percent}% of weekly capacity, ${r.stateLabel}, ${r.tasks} active ${r.tasks === 1 ? 'task' : 'tasks'}`}
              onPointerMove={(e) => showAt(i, e.currentTarget, e.clientX, e.clientY)}
              onFocus={(e) => showAt(i, e.currentTarget)}
              onBlur={() => setHover(null)}
            >
              <span className="cc-person">
                <Avatar person={{ full_name: r.name, avatar_color: r.avatar_color, avatar_url: r.avatar_url }} size={28} />
                <span className="cc-name" title={r.name}>
                  {r.name}
                </span>
              </span>
              <span className="cc-track" style={{ ['--cc-color' as string]: r.stateColor }}>
                <span className="cc-bar" style={{ width: pct(r.percent) }} />
                <span className="cc-val tabular" style={{ left: `calc(${pct(r.percent)} + 8px)` }}>
                  {r.percent}%
                </span>
              </span>
              <span className="cc-meta tabular">
                {r.tasks} {r.tasks === 1 ? 'task' : 'tasks'}
              </span>
            </div>
          ))}
        </div>

        <div className="cc-axis" aria-hidden="true">
          <span />
          <span className="cc-axis-track">
            {ticks.map((t) => (
              <span key={t} className="cc-tick tabular" style={{ left: pct(t) }}>
                {t}%
              </span>
            ))}
          </span>
          <span />
        </div>

        {tip && hover && (
          <div className={`cc-tooltip${hover.flip ? ' flip' : ''}`} role="status" style={{ left: hover.x, top: hover.y }}>
            <div className="cc-tooltip-value tabular">
              <span className="cc-tooltip-key" style={{ background: tip.stateColor }} />
              {tip.percent}% · {tip.stateLabel}
            </div>
            <div className="cc-tooltip-name">{tip.name}</div>
            <div className="cc-tooltip-detail tabular">
              Est. {tip.estHours}h of {weeklyHours}h · {tip.tasks} active {tip.tasks === 1 ? 'task' : 'tasks'} · {tip.projects}{' '}
              {tip.projects === 1 ? 'project' : 'projects'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
