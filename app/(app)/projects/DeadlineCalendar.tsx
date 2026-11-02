"use client";

// A month calendar of project deadlines for the Projects page. Days that have deadlines get coloured dots (red when the
// project is overdue, green when completed, indigo otherwise); hovering or focusing a day lists the projects, and
// clicking a day with a single project opens it. Names are rendered as React text only.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; name: string; due_date: string | null; status: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function toneOf(p: Item, today: string): "late" | "done" | "open" {
  if (p.status === "completed") return "done";
  if (p.due_date && p.due_date < today) return "late";
  return "open";
}

export default function DeadlineCalendar({ projects, today }: { projects: Item[]; today: string }) {
  const router = useRouter();
  const [view, setView] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));

  const byDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const p of projects) {
      if (!p.due_date) continue;
      map.set(p.due_date, [...(map.get(p.due_date) ?? []), p]);
    }
    return map;
  }, [projects]);

  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const lead = first.getDay();
  const rows = Math.ceil((lead + daysInMonth) / 7);
  const prevDays = new Date(view.y, view.m, 0).getDate();

  const cells = Array.from({ length: rows * 7 }, (_, i) => {
    const day = i - lead + 1;
    if (day < 1) return { day: prevDays + day, iso: "", out: true };
    if (day > daysInMonth) return { day: day - daysInMonth, iso: "", out: true };
    return { day, iso: isoOf(view.y, view.m, day), out: false };
  });

  const monthTotal = cells.reduce((n, c) => n + (c.iso ? (byDate.get(c.iso)?.length ?? 0) : 0), 0);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isThisMonth = view.y === Number(today.slice(0, 4)) && view.m === Number(today.slice(5, 7)) - 1;

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <div className="pj-cal">
      <div className="pj-cal-head">
        <div className="pj-cal-title">
          <span className="pj-cal-month">{label}</span>
          <span className="pj-cal-count"><b className="tabular">{monthTotal}</b> {monthTotal === 1 ? "deadline" : "deadlines"}</span>
        </div>
        <div className="pj-cal-nav">
          {!isThisMonth && (
            <button type="button" className="pj-cal-today" onClick={() => setView({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}>
              Today
            </button>
          )}
          <button type="button" className="pj-cal-btn" aria-label="Previous month" onClick={() => shift(-1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" className="pj-cal-btn" aria-label="Next month" onClick={() => shift(1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div className="pj-cal-grid" role="grid" aria-label={`Project deadlines, ${label}`}>
        {WEEKDAYS.map((w, i) => (
          <div className="pj-cal-wd" key={i} role="columnheader">{w}</div>
        ))}
        {cells.map((c, i) => {
          const items = c.iso ? (byDate.get(c.iso) ?? []) : [];
          const col = i % 7;
          const isToday = c.iso === today;
          const dayTone = items.some((p) => toneOf(p, today) === "late") ? "late" : items.some((p) => toneOf(p, today) === "open") ? "open" : "done";
          return (
            <div
              key={i}
              role="gridcell"
              className={`pj-cal-day${c.out ? " out" : ""}${isToday ? " today" : ""}${items.length ? ` has d-${dayTone}` : ""}${items.length === 1 ? " link" : ""}${col <= 1 ? " edge-l" : col >= 5 ? " edge-r" : ""}${i < 14 ? " row-top" : ""}`}
              tabIndex={items.length ? 0 : -1}
              aria-label={items.length ? `${c.iso}: ${items.map((p) => p.name).join(", ")}` : undefined}
              onClick={() => {
                if (items.length === 1) router.push(`/projects/${items[0].id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && items.length === 1) router.push(`/projects/${items[0].id}`);
              }}
            >
              <span className="pj-cal-num tabular">{c.day}</span>
              {items.length > 0 && (
                <>
                  <span className="pj-cal-dots">
                    {items.slice(0, 3).map((p) => (
                      <i key={p.id} className={`tone-${toneOf(p, today)}`} />
                    ))}
                    {items.length > 3 && <em>+{items.length - 3}</em>}
                  </span>
                  <span className="pj-cal-name">
                    <span className="pj-cal-name-text">{items[0].name}</span>
                    {items.length > 1 && <em>+{items.length - 1}</em>}
                  </span>
                  <div className="pj-cal-tip" role="tooltip">
                    <div className="pj-cal-tip-head">
                      {new Date(c.iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}
                      <b className="tabular">{items.length}</b>
                    </div>
                    <ul>
                      {items.slice(0, 6).map((p) => (
                        <li key={p.id}>
                          <i className={`tone-${toneOf(p, today)}`} />
                          <span>{p.name}</span>
                        </li>
                      ))}
                    </ul>
                    {items.length > 6 && <div className="pj-cal-tip-more">+{items.length - 6} more</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <ul className="pj-cal-legend">
        <li><i className="tone-open" />Upcoming</li>
        <li><i className="tone-late" />Overdue</li>
        <li><i className="tone-done" />Completed</li>
      </ul>
    </div>
  );
}
