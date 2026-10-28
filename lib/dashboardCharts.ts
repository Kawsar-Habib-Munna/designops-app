// Turns the team's task rows into the numbers behind the three dashboard charts (status split, due-by-day, completions
// per day). Pure functions of (tasks, today), so they are easy to test. Dates are 'YYYY-MM-DD' strings in local time.
import type { OutlookBucket } from '@/app/components/OutlookChart';

export type ChartTask = { status: string; due_date: string | null; updated_at: string; project_id?: string | null };

// Task statuses in their natural order. Colours are the same ones the status chips use for these states, and the
// chart's legend names every one, so colour is never the only way to tell them apart.
export const STATUS_SEGMENTS: { key: string; label: string; color: string }[] = [
  { key: 'todo', label: 'To do', color: 'var(--ink-faint)' },
  { key: 'in_progress', label: 'In progress', color: 'var(--accent)' },
  { key: 'review', label: 'In review', color: 'var(--warning)' },
  { key: 'done', label: 'Done', color: 'var(--positive)' },
];

export function statusCounts(tasks: ChartTask[]) {
  return STATUS_SEGMENTS.map((s) => ({ ...s, count: tasks.filter((t) => t.status === s.key).length }));
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const at = (iso: string) => new Date(`${iso}T00:00:00`);

// Open tasks by the day they are due: an "Overdue" column, then today and the next 6 days. `later` counts the open
// tasks left out (no due date, or due after the window) so the chart can say so.
export function dueNextDays(tasks: ChartTask[], today: string, days = 7): { buckets: OutlookBucket[]; later: number } {
  const t0 = at(today);
  const buckets: OutlookBucket[] = [{ key: 'overdue', label: 'Overdue', range: 'before today', tasks: 0, hours: 0, overdue: true }];
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = shift(t0, i);
    dayKeys.push(isoOf(d));
    buckets.push({
      key: isoOf(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short' }),
      range: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
      tasks: 0,
      hours: 0,
    });
  }
  let later = 0;
  for (const t of tasks) {
    if (t.status === 'done') continue;
    if (!t.due_date) {
      later += 1;
      continue;
    }
    if (t.due_date < today) {
      buckets[0].tasks += 1;
      continue;
    }
    const idx = dayKeys.indexOf(t.due_date);
    if (idx === -1) later += 1;
    else buckets[idx + 1].tasks += 1;
  }
  return { buckets, later };
}

// Tasks marked done per day for the last `days` days (oldest first). A task's completion day is taken from its
// updated_at, so this counts "finished tasks by their last update" — close, but a later edit to a done task moves it.
export function completionsByDay(tasks: ChartTask[], today: string, days = 14): { date: string; label: string; sub: string; value: number }[] {
  const t0 = at(today);
  const out = Array.from({ length: days }, (_, i) => {
    const d = shift(t0, i - (days - 1));
    return {
      date: isoOf(d),
      label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      sub: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
      value: 0,
    };
  });
  const byDate = new Map(out.map((p) => [p.date, p]));
  for (const t of tasks) {
    if (t.status !== 'done') continue;
    const p = byDate.get(isoOf(new Date(t.updated_at)));
    if (p) p.value += 1;
  }
  return out;
}

// ---- projects ----

export type ChartProject = { id: string; name: string; status: string; due_date: string | null };

// Same four states (and the same chip colours) the project cards use; every one is named in the legend.
export const PROJECT_SEGMENTS: { key: string; label: string; color: string }[] = [
  { key: 'active', label: 'Active', color: 'var(--accent)' },
  { key: 'review', label: 'In review', color: 'var(--warning)' },
  { key: 'on_hold', label: 'On hold', color: 'var(--ink-faint)' },
  { key: 'completed', label: 'Completed', color: 'var(--positive)' },
];

export function projectStatusCounts(projects: ChartProject[]) {
  return PROJECT_SEGMENTS.map((s) => ({ ...s, count: projects.filter((p) => p.status === s.key).length }));
}

export type ProjectProgressRow = { id: string; name: string; done: number; total: number; pct: number };

// Share of each unfinished project's tasks that are done, least-finished first so the projects that need attention
// lead. Projects without tasks are left out (nothing to measure).
export function projectProgress(projects: ChartProject[], tasks: ChartTask[]): ProjectProgressRow[] {
  const stat = new Map<string, { done: number; total: number }>();
  for (const t of tasks) {
    if (!t.project_id) continue;
    const s = stat.get(t.project_id) ?? { done: 0, total: 0 };
    s.total += 1;
    if (t.status === 'done') s.done += 1;
    stat.set(t.project_id, s);
  }
  return projects
    .filter((p) => p.status !== 'completed')
    .flatMap((p) => {
      const s = stat.get(p.id);
      return s && s.total > 0 ? [{ id: p.id, name: p.name, done: s.done, total: s.total, pct: Math.round((s.done / s.total) * 100) }] : [];
    })
    .sort((a, b) => a.pct - b.pct || b.total - a.total);
}

// Unfinished projects by deadline week: an "Overdue" column, then this week and the next 5. `later` counts the ones
// without a deadline or due after the window.
export function projectsDueWeeks(projects: ChartProject[], today: string, weeks = 6): { buckets: OutlookBucket[]; later: number } {
  const t0 = at(today);
  const buckets: OutlookBucket[] = [{ key: 'overdue', label: 'Overdue', range: 'before today', tasks: 0, hours: 0, overdue: true }];
  const edges: string[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const from = shift(t0, i * 7);
    const to = shift(t0, i * 7 + 6);
    edges.push(isoOf(from));
    buckets.push({
      key: isoOf(from),
      label: i === 0 ? 'This week' : i === 1 ? 'Next week' : from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      range: `${from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      tasks: 0,
      hours: 0,
    });
  }
  const end = isoOf(shift(t0, weeks * 7));
  let later = 0;
  for (const p of projects) {
    if (p.status === 'completed') continue;
    if (!p.due_date || p.due_date >= end) {
      later += 1;
    } else if (p.due_date < today) {
      buckets[0].tasks += 1;
    } else {
      let w = 0;
      for (let i = 0; i < edges.length; i += 1) if (p.due_date >= edges[i]) w = i;
      buckets[w + 1].tasks += 1;
    }
  }
  return { buckets, later };
}
