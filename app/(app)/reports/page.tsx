'use client';

// Reports — one page that sums up the whole studio from the live tables: tasks done / open / overdue in a chosen window,
// how every team member is doing, how every project is moving and how many clients sit in each stage. Download it as CSV
// or print it / save it as a PDF.

import { useCallback, useEffect, useMemo, useState } from 'react';
import '../todos/todos.css';
import './reports.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { todayISO, formatDate } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';
import Avatar from '@/app/components/Avatar';
import { TopbarActions } from '@/app/components/appShellContext';

const ICON_PATHS: Record<string, string> = {
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  export: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/><path d="M17 12.5h.01"/>',
  'chevron-left': '<path d="M15 18l-6-6 6-6"/>',
};

function Icon({ name, size = 16 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

type TaskRow = { id: string; status: string; priority: string; due_date: string | null; estimated_hours: number | null; updated_at: string; assignee_id: string | null; project_id: string | null };
type PersonRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url: string | null };
type ProjectRow = { id: string; name: string; status: string; progress: number | null; due_date: string | null; clients: { company_name: string } | { company_name: string }[] | null };

// from / to are day offsets from today; "Due" counts the day itself for the single-day ranges and today for the longer ones
const RANGES = [
  { key: 'today', label: 'Today', short: 'today', from: 0, to: 0, dueLabel: 'Due today', dueOffset: 0 },
  { key: 'yesterday', label: 'Yesterday', short: 'yesterday', from: -1, to: -1, dueLabel: 'Due yesterday', dueOffset: -1 },
  { key: 'tomorrow', label: 'Tomorrow', short: 'tomorrow', from: 1, to: 1, dueLabel: 'Due tomorrow', dueOffset: 1 },
  { key: '7', label: 'Last 7 days', short: '7d', from: -6, to: 0, dueLabel: 'Due today', dueOffset: 0 },
  { key: '30', label: 'Last 30 days', short: '30d', from: -29, to: 0, dueLabel: 'Due today', dueOffset: 0 },
  { key: '90', label: 'Last 90 days', short: '90d', from: -89, to: 0, dueLabel: 'Due today', dueOffset: 0 },
];

function addDaysISO(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const PAGE_SIZE = 6;

const cap = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE;
  return (
    <div className="rv-pager">
      <span className="rv-pager-info tabular">{from + 1}-{Math.min(from + PAGE_SIZE, total)} of {total}</span>
      <div className="rv-pager-btns">
        <button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><Icon name="chevron-left" size={14} /></button>
        <span className="rv-pager-page tabular">{page} / {pages}</span>
        <button type="button" className="next" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next page"><Icon name="chevron-left" size={14} /></button>
      </div>
    </div>
  );
}

async function fetchReport() {
  const [t, p, pr] = await Promise.all([
    supabase.from('tasks').select('id, status, priority, due_date, estimated_hours, updated_at, assignee_id, project_id'),
    supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url').order('order_index'),
    supabase.from('projects').select('id, name, status, progress, due_date, clients(company_name)').order('created_at', { ascending: false }),
  ]);
  return {
    error: t.error?.message ?? p.error?.message ?? pr.error?.message ?? null,
    tasks: (t.data as TaskRow[]) ?? [],
    people: (p.data as PersonRow[]) ?? [],
    projects: (pr.data as unknown as ProjectRow[]) ?? [],
  };
}

export default function ReportsPage() {
  const { user, loading: sessionLoading } = useSession();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState('30');
  const [memberPage, setMemberPage] = useState(1);
  const [projectPage, setProjectPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);

  const apply = useCallback((r: Awaited<ReturnType<typeof fetchReport>>) => {
    setError(r.error);
    setTasks(r.tasks);
    setPeople(r.people);
    setProjects(r.projects);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function run() {
      const r = await fetchReport();
      if (!cancelled) apply(r);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [user, apply]);

  async function reload() {
    setLoading(true);
    apply(await fetchReport());
  }

  const today = todayISO();
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[4];
  const report = useMemo(() => {
    const winFrom = addDaysISO(today, range.from);
    const winTo = addDaysISO(today, range.to);
    const dueDay = addDaysISO(today, range.dueOffset);
    const doneInRange = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      const d = localDay(t.updated_at);
      return d >= winFrom && d <= winTo;
    });

    const members = people
      .map((p) => {
        const mine = tasks.filter((t) => t.assignee_id === p.id);
        const mineOpen = mine.filter((t) => t.status !== 'done');
        const done = doneInRange.filter((t) => t.assignee_id === p.id).length;
        const workload = Math.min(100, Math.round((mineOpen.length / 5) * 100));
        const next = mineOpen.filter((t) => t.due_date && t.due_date >= today).map((t) => t.due_date as string).sort()[0] ?? null;
        return {
          ...p,
          open: mineOpen.length,
          done,
          doneTotal: mine.length - mineOpen.length,
          overdue: mineOpen.filter((t) => t.due_date && t.due_date < today).length,
          dueToday: mineOpen.filter((t) => t.due_date === dueDay).length,
          hours: mineOpen.reduce((n, t) => n + (t.estimated_hours ?? 0), 0),
          projects: new Set(mineOpen.map((t) => t.project_id).filter(Boolean)).size,
          completion: done + mineOpen.length > 0 ? Math.round((done / (done + mineOpen.length)) * 100) : 0,
          workload,
          state: workload < 30 ? 'Available' : workload < 65 ? 'Balanced' : workload < 85 ? 'Busy' : 'Overloaded',
          next,
        };
      })
      .sort((a, b) => b.done - a.done || b.open - a.open);

    const projectRows = projects.map((p) => {
      const mine = tasks.filter((t) => t.project_id === p.id);
      const done = mine.filter((t) => t.status === 'done').length;
      return { id: p.id, name: p.name, client: one(p.clients)?.company_name ?? '-', status: p.status, due: p.due_date, tasks: mine.length, done, progress: mine.length ? Math.round((done / mine.length) * 100) : Math.round(p.progress ?? 0) };
    });

    return { members, projectRows };
  }, [tasks, people, projects, range, today]);

  function downloadCsv() {
    const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const row = (cells: (string | number)[]) => cells.map(esc).join(',');
    const lines = [
      row(['Report', range.label, `Generated ${today}`]),
      '',
      row(['Team member', 'Role', 'Workload %', 'Status', 'Open tasks', `Done (${range.label})`, 'Done in total', 'Completion %', 'Overdue', range.dueLabel, 'Projects', 'Open hours', 'Next deadline']),
      ...report.members.map((m) => row([m.full_name, m.role ?? 'Team Member', m.workload, m.state, m.open, m.done, m.doneTotal, m.completion, m.overdue, m.dueToday, m.projects, m.hours, m.next ?? ''])),
      '',
      row(['Project', 'Client', 'Status', 'Tasks', 'Done', 'Progress %', 'Due']),
      ...report.projectRows.map((p) => row([p.name, p.client, cap(p.status), p.tasks, p.done, p.progress, p.due ?? ''])),
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const mPage = Math.min(memberPage, Math.max(1, Math.ceil(report.members.length / PAGE_SIZE)));
  const pPage = Math.min(projectPage, Math.max(1, Math.ceil(report.projectRows.length / PAGE_SIZE)));
  const memberSlice = report.members.slice((mPage - 1) * PAGE_SIZE, mPage * PAGE_SIZE);
  const projectSlice = report.projectRows.slice((pPage - 1) * PAGE_SIZE, (pPage - 1) * PAGE_SIZE + PAGE_SIZE);
  const rangeLabel = range.label;

  return (
    <>
      <TopbarActions>{null}</TopbarActions>
      <main className={`content rv-page${showPreview ? ' rv-hide-print' : ''}`}>
        <div className="rv-head">
          <div className="rv-text">
            <h1 className="rv-title">Reports</h1>
            <p className="rv-sub">How the team and the projects are doing. {rangeLabel}.</p>
          </div>
          <div className="rv-actions">
            <select className="rv-select" value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} aria-label="Date range">
              {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <button type="button" className="rv-btn" onClick={reload} disabled={loading}><Icon name="refresh" size={14} /> Reload</button>
            <button type="button" className="rv-btn" onClick={downloadCsv} disabled={loading}><Icon name="export" size={14} /> Download CSV</button>
            <button type="button" className="rv-btn" onClick={() => setShowPreview(true)} disabled={loading}><Icon name="eye" size={14} /> Preview</button>
            <button type="button" className="rv-primary" onClick={() => window.print()} disabled={loading}><Icon name="printer" size={14} /> Print / Save PDF</button>
          </div>
        </div>

        {error && <div className="rv-error">{error}</div>}

        <section className="rv-card">
          <div className="rv-card-head"><h2>Team performance</h2><span className="rv-count tabular">{report.members.length}</span></div>
          <div className="rv-scroll">
            <table className="rv-table">
              <thead><tr><th>Member</th><th>Workload</th><th>Status</th><th>Open</th><th>Done ({range.short})</th><th>Done total</th><th>Completion</th><th>Overdue</th><th>{range.dueLabel}</th><th>Projects</th><th>Open hours</th><th>Next deadline</th></tr></thead>
              <tbody>
                {memberSlice.map((m) => (
                  <tr key={m.id}>
                    <td><div className="rv-person"><Avatar person={{ full_name: m.full_name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={30} /><span><b>{m.full_name}</b><em>{m.role ?? 'Team Member'}</em></span></div></td>
                    <td className="tabular">{m.workload}%</td>
                    <td><span className={`rv-state ${m.state.toLowerCase()}`}>{m.state}</span></td>
                    <td className="tabular">{m.open}</td>
                    <td className="tabular">{m.done}</td>
                    <td className="tabular">{m.doneTotal}</td>
                    <td className="tabular">{m.completion}%</td>
                    <td className={`tabular${m.overdue > 0 ? ' red' : ''}`}>{m.overdue}</td>
                    <td className="tabular">{m.dueToday}</td>
                    <td className="tabular">{m.projects}</td>
                    <td className="tabular">{m.hours}h</td>
                    <td className="rv-muted">{m.next ? formatDate(m.next) : '-'}</td>
                  </tr>
                ))}
                {!loading && memberSlice.length === 0 && <tr><td colSpan={12} className="rv-empty-cell">No team members yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={mPage} total={report.members.length} onPage={setMemberPage} />
        </section>

        <section className="rv-card">
          <div className="rv-card-head"><h2>Projects</h2><span className="rv-count tabular">{report.projectRows.length}</span></div>
          <div className="rv-scroll">
            <table className="rv-table">
              <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Tasks</th><th>Due</th></tr></thead>
              <tbody>
                {projectSlice.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b></td>
                    <td className="rv-muted">{p.client}</td>
                    <td><span className="rv-status">{cap(p.status)}</span></td>
                    <td className="tabular">{p.progress}%</td>
                    <td className="tabular">{p.done}/{p.tasks}</td>
                    <td className="rv-muted">{p.due ? formatDate(p.due) : '-'}</td>
                  </tr>
                ))}
                {!loading && projectSlice.length === 0 && <tr><td colSpan={6} className="rv-empty-cell">No projects yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager page={pPage} total={report.projectRows.length} onPage={setProjectPage} />
        </section>
      </main>

      {showPreview && (
        <div className="rv-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div className="rv-modal" role="dialog" aria-modal="true" aria-label="Report preview">
            <div className="rv-modal-bar">
              <span className="rv-modal-title">Report preview</span>
              <div className="rv-modal-actions">
                <button type="button" className="rv-btn" onClick={downloadCsv}><Icon name="export" size={14} /> Download CSV</button>
                <button type="button" className="rv-primary" onClick={() => window.print()}><Icon name="printer" size={14} /> Print / Save PDF</button>
                <button type="button" className="rv-x" aria-label="Close" onClick={() => setShowPreview(false)}><Icon name="close" size={16} /></button>
              </div>
            </div>
            <div className="rv-modal-scroll">
              <div className="rv-sheet">
                <div className="rv-sheet-head">
                  <div>
                    <div className="rv-sheet-brand">FLOW 53</div>
                    <h2>Team &amp; Project Report</h2>
                  </div>
                  <div className="rv-sheet-stamp">{rangeLabel}<br />Generated {formatDate(today)}</div>
                </div>
                <h3>Team performance</h3>
                <table className="rv-sheet-table">
                  <thead><tr><th>Member</th><th>Workload</th><th>Status</th><th>Open</th><th>Done ({range.short})</th><th>Done total</th><th>Completion</th><th>Overdue</th><th>{range.dueLabel}</th><th>Projects</th><th>Hours</th><th>Next deadline</th></tr></thead>
                  <tbody>
                    {report.members.map((m) => (
                      <tr key={m.id}>
                        <td><b>{m.full_name}</b><span>{m.role ?? 'Team Member'}</span></td>
                        <td>{m.workload}%</td><td>{m.state}</td><td>{m.open}</td><td>{m.done}</td><td>{m.doneTotal}</td><td>{m.completion}%</td>
                        <td className={m.overdue > 0 ? 'red' : ''}>{m.overdue}</td><td>{m.dueToday}</td><td>{m.projects}</td><td>{m.hours}h</td><td>{m.next ? formatDate(m.next) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>Projects</h3>
                <table className="rv-sheet-table">
                  <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Tasks</th><th>Due</th></tr></thead>
                  <tbody>
                    {report.projectRows.map((p) => (
                      <tr key={p.id}><td><b>{p.name}</b></td><td>{p.client}</td><td>{cap(p.status)}</td><td>{p.progress}%</td><td>{p.done}/{p.tasks}</td><td>{p.due ? formatDate(p.due) : '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
