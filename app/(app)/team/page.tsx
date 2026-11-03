'use client';

// Team Workload — lib/supabaseClient.ts দিয়ে রিয়েল ডেটা: profiles + tasks
// (assignee/project join) + activity_log। ক্যাপাসিটি% = active task সংখ্যা
// ভিত্তিক হিউরিস্টিক (৫টা অ্যাক্টিভ টাস্ক = ১০০%, dashboard/project-details
// পেজেও একই লজিক ব্যবহার হয়েছে) — schema-তে "capacity hours" বা কোনো
// working-hours সেটিং নেই বলে এটাই সবচেয়ে honest approximation।
//
// নোট: মূল ডিজাইনের "Today's Availability Timeline" ও "Workload Heatmap"
// সেকশন দুটো বাদ দেওয়া হয়েছে — schema-তে কোনো attendance/presence বা
// সময়ভিত্তিক (দিন-অনুযায়ী ঘণ্টা) লগ টেবিল নেই, তাই ফেক শিডিউল/হিটম্যাপ
// বসানো হয়নি। এগুলো চালু করতে একটা schedule/attendance টেবিল লাগবে।

import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from 'react';
import Link from 'next/link';
import './team.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDate, todayISO, formatDate, relativeTime } from '@/lib/format';
import { STAGE_LABEL, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
import { uploadFileToDrive } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import Avatar from '@/app/components/Avatar';
import CapacityChart from '@/app/components/CapacityChart';
import OutlookChart, { type OutlookBucket } from '@/app/components/OutlookChart';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  checklist: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  chevrons: '<path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  reload: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/><path d="M17 12.5h.01"/>',
  export: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 19h16"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  'user-plus': '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  gauge: '<path d="M12 15l3.5-5.5"/><circle cx="12" cy="15" r="1.5"/><path d="M4 15a8 8 0 1 1 16 0"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}



type SortKey = 'capacity' | 'tasks' | 'hours' | 'projects' | 'deadline' | 'activity';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'capacity', label: 'Capacity' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'hours', label: 'Hours' },
  { key: 'projects', label: 'Projects' },
  { key: 'deadline', label: 'Deadline Pressure' },
  { key: 'activity', label: 'Recent Activity' },
];

function capacityState(percent: number): { key: 'available' | 'balanced' | 'busy' | 'overloaded'; label: string; cls: string; color: string } {
  if (percent >= 85) return { key: 'overloaded', label: 'Overloaded', cls: 'st-overloaded', color: 'var(--danger)' };
  if (percent >= 65) return { key: 'busy', label: 'Busy', cls: 'st-busy', color: 'var(--warning)' };
  if (percent >= 30) return { key: 'balanced', label: 'Balanced', cls: 'st-balanced', color: 'var(--accent)' };
  return { key: 'available', label: 'Available', cls: 'st-available', color: 'var(--positive)' };
}

// the state boundaries from capacityState above (30 / 65 / 85) and a legend built from the same function,
// so the Workload Distribution chart names exactly the states the cards use
const CAPACITY_BOUNDS = [30, 65, 85];
const CAPACITY_LEGEND = [
  { at: 10, range: 'under 30%' },
  { at: 40, range: '30–64%' },
  { at: 70, range: '65–84%' },
  { at: 90, range: '85% and over' },
].map(({ at, range }) => {
  const st = capacityState(at);
  return { label: st.label, color: st.color, range };
});

function isThisWeek(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 7 * 86400000;
}

const WEEKLY_CAPACITY_HOURS = 40;

// capacity ring (the % sits in the middle): radius and circumference
const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; is_admin?: boolean };
type FullProfileRow = {
  id: string;
  full_name: string;
  role: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
  bio: string | null;
  behance_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
};

type TeamTaskRow = {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  workflow_stage: string;
  due_date: string | null;
  estimated_hours: number | null;
  updated_at: string;
  assignee_id: string | null;
  projects: { id: string; name: string; status: string; progress: number | null; due_date: string | null; project_manager_id: string | null } | null;
};

// Workload Heatmap: for every member, how many open tasks and To-Dos fall due on each of the next 14 days (plus the overdue ones)
type HeatmapRow = { id: string; name: string; avatar_color: string | null; avatar_url: string | null; counts: number[]; overdue: number; total: number };
type HeatmapData = { days: string[]; rows: HeatmapRow[]; max: number };
const HEATMAP_DAYS = 14;

type TeamActivity = { id: string; detail: string | null; created_at: string; profiles: { full_name: string } | null };

type MemberStat = {
  id: string;
  name: string;
  role: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  bio: string | null;
  behance_url: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  activeTasks: number;
  projectIds: string[];
  estHours: number;
  nextDeadline: string | null;
  activeTodos: number;
  overdueTasks: number;
  dueToday: number;
  completedToday: number;
  currentStage: string | null;
  primaryProjectId: string | null;
  primaryProjectName: string | null;
  managerName: string | null;
  lastActivityAt: string | null;
  capacityPercent: number;
};

type MemberTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  workflow_stage: string;
  due_date: string | null;
  estimated_hours: number | null;
  projects: { id: string; name: string } | null;
};
type MemberActivity = { id: string; action: string; detail: string | null; created_at: string };
// Activity is stored with Bengali sentences; the drawer shows plain English, using the stored text only when it is already English
const ACTIVITY_EN: Record<string, string> = {
  task_created: 'Created a task',
  task_updated: 'Updated a task',
  task_completed: 'Completed a task',
  task_assigned: 'Assigned a task',
  file_uploaded: 'Uploaded a file',
  status_changed: 'Changed a client status',
  info_requested: 'Requested more information',
  info_request_resolved: 'Resolved an information request',
  client_deleted: 'Deleted a client',
  manager_assigned: 'Assigned an account manager',
  sow_sent: 'Sent a SOW to the client',
  sow_signed: 'SOW signed by the client',
  sow_agency_signed: 'Signed a SOW on the agency side',
  sow_cancelled: 'Changed a SOW status',
  payment_cancelled: 'Cancelled a payment request',
  payment_received: 'Confirmed a payment',
  payment_confirmation_submitted: 'Payment confirmation submitted',
};
const activityText = (a: { action: string; detail: string | null }) =>
  a.detail && !/[ঀ-৿]/.test(a.detail) ? a.detail : ACTIVITY_EN[a.action] ?? (a.action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));

type MemberDetail = { tasks: MemberTask[]; doneThisWeek: number; doneTotal: number; activity: MemberActivity[]; email: string | null; whatsapp: string | null };

const TASK_STATUS_EN: Record<string, string> = { todo: 'To do', in_progress: 'In progress', review: 'In review', done: 'Done' };
const TASK_PRIORITY_EN: Record<string, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };

type AllocProject = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  due_date: string | null;
  assignees: { id: string; name: string; avatar_color: string | null; avatar_url: string | null }[];
};

const TEAM_SELECT =
  'id, status, priority, workflow_stage, due_date, estimated_hours, updated_at, assignee_id, projects(id, name, status, progress, due_date, project_manager_id)';

// Workload Outlook: open, assigned tasks grouped by the week they are due — an "Overdue" bucket, then this week
// (from today) and the next five Monday-based weeks. Tasks with no due date, or due later than that, are counted
// separately so the chart can say how many it left out.
const OUTLOOK_WEEKS = 6;
function buildOutlook(tasks: TeamTaskRow[]): { buckets: OutlookBucket[]; undated: number } {
  const today = todayISO();
  const t0 = new Date(`${today}T00:00:00`);
  const shift = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const monday = shift(t0, -((t0.getDay() + 6) % 7));

  const ranges: { b: OutlookBucket; from: string; to: string }[] = [
    { b: { key: 'overdue', label: 'Overdue', range: 'before today', tasks: 0, hours: 0, overdue: true }, from: '0000-00-00', to: iso(shift(t0, -1)) },
  ];
  for (let i = 0; i < OUTLOOK_WEEKS; i += 1) {
    const start = shift(monday, 7 * i);
    const end = shift(start, 6);
    const label = i === 0 ? 'This week' : i === 1 ? 'Next week' : fmt(start);
    ranges.push({
      b: { key: `w${i}`, label, range: `${fmt(i === 0 ? t0 : start)} – ${fmt(end)}`, tasks: 0, hours: 0 },
      from: i === 0 ? today : iso(start),
      to: iso(end),
    });
  }

  let undated = 0;
  for (const t of tasks) {
    if (!t.assignee_id || t.status === 'done') continue;
    if (!t.due_date) {
      undated += 1;
      continue;
    }
    const due = t.due_date;
    const hit = ranges.find((r) => due >= r.from && due <= r.to);
    if (!hit) {
      undated += 1;
      continue;
    }
    hit.b.tasks += 1;
    hit.b.hours += t.estimated_hours ?? 0;
  }
  return { buckets: ranges.map((r) => r.b), undated };
}

async function fetchTeamData() {
  const [profilesRes, tasksRes, activityRes, todosRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, is_admin, bio, behance_url, linkedin_url, facebook_url, instagram_url').order('full_name'),
    supabase.from('tasks').select(TEAM_SELECT),
    supabase.from('activity_log').select('id, detail, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('todos').select('assignee_id, status, due_date, completed_at'),
  ]);
  const todoRows = (todosRes.data as { assignee_id: string | null; status: string; due_date: string | null; completed_at: string | null }[]) ?? [];

  const firstErrored = [profilesRes, tasksRes, activityRes].find((r) => r.error);

  const profiles = (profilesRes.data as FullProfileRow[]) ?? [];
  const tasks = (tasksRes.data as unknown as TeamTaskRow[]) ?? [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // ---- per-member aggregation ----
  const memberAgg = new Map<
    string,
    { activeTasks: number; projectIds: Set<string>; estHours: number; nextDeadline: string | null; todos: number; overdue: number; dueToday: number; doneToday: number; lastActivityAt: string | null; stageByProject: Map<string, { stage: string; updatedAt: string }>; projectTaskCount: Map<string, number> }
  >();

  const todayStr = todayISO();
  // the local calendar day of a timestamp, as YYYY-MM-DD, so "today" means the viewer's own today
  const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  for (const t of tasks) {
    if (!t.assignee_id) continue;
    const cur =
      memberAgg.get(t.assignee_id) ??
      { activeTasks: 0, projectIds: new Set<string>(), estHours: 0, nextDeadline: null, todos: 0, overdue: 0, dueToday: 0, doneToday: 0, lastActivityAt: null, stageByProject: new Map(), projectTaskCount: new Map() };

    if (t.status !== 'done') {
      cur.activeTasks += 1;
      cur.estHours += t.estimated_hours ?? 0;
      if (t.due_date && t.due_date < todayStr) cur.overdue += 1;
      else if (t.due_date === todayStr) cur.dueToday += 1;
      if (t.due_date && (!cur.nextDeadline || t.due_date < cur.nextDeadline)) cur.nextDeadline = t.due_date;
      if (t.projects) {
        cur.projectIds.add(t.projects.id);
        cur.projectTaskCount.set(t.projects.id, (cur.projectTaskCount.get(t.projects.id) ?? 0) + 1);
        const existingStage = cur.stageByProject.get(t.projects.id);
        if (!existingStage || t.updated_at > existingStage.updatedAt) cur.stageByProject.set(t.projects.id, { stage: t.workflow_stage, updatedAt: t.updated_at });
      }
    }
    if (t.status === 'done' && localDay(t.updated_at) === todayStr) cur.doneToday += 1;
    if (!cur.lastActivityAt || t.updated_at > cur.lastActivityAt) cur.lastActivityAt = t.updated_at;

    memberAgg.set(t.assignee_id, cur);
  }

  // To-Do page items: an open To-Do adds to the workload like an open task does
  const emptyAgg = () => ({ activeTasks: 0, projectIds: new Set<string>(), estHours: 0, nextDeadline: null as string | null, todos: 0, overdue: 0, dueToday: 0, doneToday: 0, lastActivityAt: null as string | null, stageByProject: new Map<string, { stage: string; updatedAt: string }>(), projectTaskCount: new Map<string, number>() });
  for (const td of todoRows) {
    if (!td.assignee_id) continue;
    const cur = memberAgg.get(td.assignee_id) ?? emptyAgg();
    if (td.status !== 'completed') {
      cur.todos += 1;
      if (td.due_date && td.due_date < todayStr) cur.overdue += 1;
      else if (td.due_date === todayStr) cur.dueToday += 1;
      if (td.due_date && (!cur.nextDeadline || td.due_date < cur.nextDeadline)) cur.nextDeadline = td.due_date;
    } else if (td.completed_at && localDay(td.completed_at) === todayStr) {
      cur.doneToday += 1;
    }
    memberAgg.set(td.assignee_id, cur);
  }

  const members: MemberStat[] = profiles.map((p) => {
    const agg = memberAgg.get(p.id);
    const activeTasks = agg?.activeTasks ?? 0;
    const estHours = agg?.estHours ?? 0;
    const projectIds = agg ? Array.from(agg.projectIds) : [];

    let primaryProjectId: string | null = null;
    let primaryProjectName: string | null = null;
    let currentStage: string | null = null;
    let managerName: string | null = null;

    if (agg && agg.projectTaskCount.size > 0) {
      let maxCount = -1;
      for (const [pid, count] of agg.projectTaskCount) {
        if (count > maxCount) {
          maxCount = count;
          primaryProjectId = pid;
        }
      }
      const projRow = tasks.find((t) => t.projects?.id === primaryProjectId)?.projects ?? null;
      primaryProjectName = projRow?.name ?? null;
      managerName = projRow?.project_manager_id ? profileById.get(projRow.project_manager_id)?.full_name ?? null : null;
      currentStage = primaryProjectId ? agg.stageByProject.get(primaryProjectId)?.stage ?? null : null;
    }

    const activeTodos = agg?.todos ?? 0;
    // the workload: open tasks plus open To-Dos, five items being a full load
    const capacityPercent = Math.min(100, Math.round((((activeTasks || 0) + (activeTodos || 0)) / 5) * 100)) || 0;

    return {
      id: p.id,
      name: p.full_name,
      role: p.role,
      avatar_color: p.avatar_color,
      avatar_url: p.avatar_url ?? null,
      is_admin: !!p.is_admin,
      bio: p.bio ?? null,
      behance_url: p.behance_url ?? null,
      linkedin_url: p.linkedin_url ?? null,
      facebook_url: p.facebook_url ?? null,
      instagram_url: p.instagram_url ?? null,
      activeTasks,
      projectIds,
      estHours,
      nextDeadline: agg?.nextDeadline ?? null,
      activeTodos,
      overdueTasks: agg?.overdue ?? 0,
      dueToday: agg?.dueToday ?? 0,
      completedToday: agg?.doneToday ?? 0,
      currentStage,
      primaryProjectId,
      primaryProjectName,
      managerName,
      lastActivityAt: agg?.lastActivityAt ?? null,
      capacityPercent,
    };
  });

  // ---- project allocation ----
  // প্রতিটা প্রজেক্টের progress এখন real টাস্ক completion থেকে হিসাব করা হয়
  // (projects.progress কলাম সবসময় 0-ই থাকে, কোথাও আপডেট হয় না)।
  const projectTaskStats = new Map<string, { done: number; total: number }>();
  for (const t of tasks) {
    if (!t.projects) continue;
    const cur = projectTaskStats.get(t.projects.id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.status === 'done') cur.done += 1;
    projectTaskStats.set(t.projects.id, cur);
  }

  const allocMap = new Map<string, AllocProject>();
  for (const t of tasks) {
    if (!t.projects || t.status === 'done') continue;
    const stat = projectTaskStats.get(t.projects.id);
    const progress = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
    const proj = allocMap.get(t.projects.id) ?? { id: t.projects.id, name: t.projects.name, status: t.projects.status, progress, due_date: t.projects.due_date, assignees: [] };
    if (t.assignee_id && !proj.assignees.some((a) => a.id === t.assignee_id)) {
      const profile = profileById.get(t.assignee_id);
      if (profile) proj.assignees.push({ id: profile.id, name: profile.full_name, avatar_color: profile.avatar_color, avatar_url: profile.avatar_url ?? null });
    }
    allocMap.set(t.projects.id, proj);
  }

  const heatDays: string[] = [];
  for (let i = 0; i < HEATMAP_DAYS; i++) {
    const d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() + i);
    heatDays.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const heatRows: HeatmapRow[] = profiles.map((p) => ({ id: p.id, name: p.full_name, avatar_color: p.avatar_color, avatar_url: p.avatar_url ?? null, counts: heatDays.map(() => 0), overdue: 0, total: 0 }));
  const heatById = new Map(heatRows.map((r) => [r.id, r]));
  const addHeat = (assigneeId: string | null, due: string | null) => {
    if (!assigneeId || !due) return;
    const row = heatById.get(assigneeId);
    if (!row) return;
    if (due < todayStr) {
      row.overdue += 1;
      row.total += 1;
      return;
    }
    const idx = heatDays.indexOf(due);
    if (idx >= 0) {
      row.counts[idx] += 1;
      row.total += 1;
    }
  };
  for (const t of tasks) if (t.status !== 'done') addHeat(t.assignee_id, t.due_date);
  for (const td of todoRows) if (td.status !== 'completed') addHeat(td.assignee_id, td.due_date);
  const heatmap: HeatmapData = { days: heatDays, rows: heatRows.filter((r) => r.total > 0).sort((x, y) => y.total - x.total), max: Math.max(1, ...heatRows.flatMap((r) => r.counts)) };

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    heatmap,
    members,
    allocations: Array.from(allocMap.values()),
    activity: (activityRes.data as unknown as TeamActivity[]) ?? [],
    completedThisWeek: tasks.filter((t) => t.status === 'done' && isThisWeek(t.updated_at)).length,
    outlook: buildOutlook(tasks),
  };
}

// everything the member panel shows besides what the card already has
async function fetchMemberDetail(memberId: string): Promise<MemberDetail> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const contactPromise = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch('/api/team/member-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` },
        body: JSON.stringify({ userId: memberId }),
      });
      if (!res.ok) return { email: null, whatsapp: null };
      const json = (await res.json()) as { email?: string | null; whatsapp?: string | null };
      return { email: json.email ?? null, whatsapp: json.whatsapp ?? null };
    } catch {
      return { email: null, whatsapp: null };
    }
  })();
  const [openRes, weekRes, totalRes, actRes, contact] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, priority, workflow_stage, due_date, estimated_hours, projects(id, name)')
      .eq('assignee_id', memberId)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(40),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', memberId).eq('status', 'done').gte('updated_at', weekAgo),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', memberId).eq('status', 'done'),
    supabase.from('activity_log').select('id, action, detail, created_at').eq('actor_id', memberId).order('created_at', { ascending: false }).limit(6),
    contactPromise,
  ]);
  return {
    tasks: (openRes.data as unknown as MemberTask[]) ?? [],
    doneThisWeek: weekRes.count ?? 0,
    doneTotal: totalRes.count ?? 0,
    activity: (actRes.data as MemberActivity[]) ?? [],
    email: contact.email,
    whatsapp: contact.whatsapp,
  };
}

export default function TeamWorkloadPage() {
  const { user, loading: sessionLoading } = useSession();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [members, setMembers] = useState<MemberStat[]>([]);
  const [allocations, setAllocations] = useState<AllocProject[]>([]);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [outlook, setOutlook] = useState<{ buckets: OutlookBucket[]; undated: number }>({ buckets: [], undated: 0 });
  const [heatmap, setHeatmap] = useState<HeatmapData>({ days: [], rows: [], max: 1 });
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('capacity');

  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  // the member whose details are open in the side panel, and what is loaded for them
  const [detailMember, setDetailMember] = useState<MemberStat | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // clipboard not available: the address is still a mailto link
    }
  }

  async function openDetail(m: MemberStat) {
    setDetailMember(m);
    setDetail(null);
    setDetailLoading(true);
    setDetail(await fetchMemberDetail(m.id));
    setDetailLoading(false);
  }

  useEffect(() => {
    if (!detailMember) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailMember(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [detailMember]);

  // অ্যাডমিন যেকোনো মেম্বারের প্রোফাইল কার্ড (নাম/রোল/বায়ো/সোশ্যাল লিংক/ছবি)
  // সরাসরি এখান থেকে এডিট করতে পারে - আগে শুধু প্রত্যেকে নিজেরটাই ProfileMenu
  // থেকে এডিট করতে পারত।
  const [editMember, setEditMember] = useState<MemberStat | null>(null);
  const [emName, setEmName] = useState('');
  const [emRole, setEmRole] = useState('');
  const [emBio, setEmBio] = useState('');
  const [emBehance, setEmBehance] = useState('');
  const [emLinkedin, setEmLinkedin] = useState('');
  const [emFacebook, setEmFacebook] = useState('');
  const [emInstagram, setEmInstagram] = useState('');
  const [emSaving, setEmSaving] = useState(false);
  const [emError, setEmError] = useState<string | null>(null);
  const [emAvatarUploading, setEmAvatarUploading] = useState(false);
  const [emAvatarProgress, setEmAvatarProgress] = useState(0);
  const [emAvatarUrl, setEmAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchTeamData(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setMembers(result.members);
      setAllocations(result.allocations);
      setCompletedThisWeek(result.completedThisWeek);
      setOutlook(result.outlook);
      setHeatmap(result.heatmap);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user]);

  async function handleReload() {
    setReloading(true);
    const result = await fetchTeamData();
    setError(result.errorMessage);
    setMembers(result.members);
    setAllocations(result.allocations);
    setCompletedThisWeek(result.completedThisWeek);
    setReloading(false);
  }

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    setAddingMember(true);
    setAddMemberError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/team/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ fullName: newName.trim(), email: newEmail.trim(), password: newPassword, role: newRole.trim(), isAdmin: newIsAdmin }),
    });
    const result = await res.json();
    setAddingMember(false);

    if (!res.ok) {
      setAddMemberError(result.error ?? 'মেম্বার তৈরি করা যায়নি।');
      return;
    }

    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('');
    setNewIsAdmin(false);
    setShowAddMember(false);
    handleReload();
  }

  async function handleRemoveMember(id: string, name: string) {
    if (!window.confirm(`${name}-কে টিম থেকে রিমুভ করতে চান? এই অ্যাকশন ফেরানো যাবে না।`)) return;
    setBusyMemberId(id);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/team/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ userId: id }),
    });
    const result = await res.json();
    setBusyMemberId(null);

    if (!res.ok) {
      setError(result.error ?? 'মেম্বার রিমুভ করা যায়নি।');
      return;
    }
    handleReload();
  }

  async function handleToggleAdmin(id: string, makeAdmin: boolean) {
    setBusyMemberId(id);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/team/set-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ userId: id, isAdmin: makeAdmin }),
    });
    const result = await res.json();
    setBusyMemberId(null);

    if (!res.ok) {
      setError(result.error ?? 'এডমিন স্ট্যাটাস পরিবর্তন করা যায়নি।');
      return;
    }
    handleReload();
  }

  function openEditMember(m: MemberStat) {
    setEditMember(m);
    setEmName(m.name);
    setEmRole(m.role ?? '');
    setEmBio(m.bio ?? '');
    setEmBehance(m.behance_url ?? '');
    setEmLinkedin(m.linkedin_url ?? '');
    setEmFacebook(m.facebook_url ?? '');
    setEmInstagram(m.instagram_url ?? '');
    setEmAvatarUrl(m.avatar_url);
    setEmError(null);
  }

  async function handleEditMemberAvatarFile(file: File) {
    if (!editMember) return;
    if (!file.type.startsWith('image/')) {
      setEmError('শুধু ছবি ফাইল আপলোড করা যাবে।');
      return;
    }
    setEmAvatarUploading(true);
    setEmAvatarProgress(0);
    setEmError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      const result = await uploadFileToDrive(file, session.access_token, setEmAvatarProgress);
      setEmAvatarUrl(result.webViewLink);
    } catch (err) {
      setEmError(err instanceof Error ? err.message : 'ছবি আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setEmAvatarUploading(false);
      setEmAvatarProgress(0);
    }
  }

  async function handleSaveEditMember(e: FormEvent) {
    e.preventDefault();
    if (!editMember || !emName.trim()) return;
    setEmSaving(true);
    setEmError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/team/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({
        userId: editMember.id,
        full_name: emName,
        role: emRole,
        bio: emBio,
        behance_url: emBehance,
        linkedin_url: emLinkedin,
        facebook_url: emFacebook,
        instagram_url: emInstagram,
        avatar_url: emAvatarUrl,
      }),
    });
    const result = await res.json();
    setEmSaving(false);

    if (!res.ok) {
      setEmError(result.error ?? 'প্রোফাইল সেভ করা যায়নি।');
      return;
    }
    setEditMember(null);
    handleReload();
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResettingPassword(true);
    setResetError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/team/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ userId: resetTarget.id, password: resetPassword }),
    });
    const result = await res.json();
    setResettingPassword(false);

    if (!res.ok) {
      setResetError(result.error ?? 'পাসওয়ার্ড রিসেট করা যায়নি।');
      return;
    }

    setResetPassword('');
    setResetTarget(null);
  }

  const kpis = useMemo(() => {
    const active = members.filter((m) => m.activeTasks > 0);
    const available = members.filter((m) => capacityState(m.capacityPercent).key === 'available');
    const overloaded = members.filter((m) => capacityState(m.capacityPercent).key === 'overloaded');
    const avgCapacity = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.capacityPercent, 0) / members.length) : 0;
    return { total: members.length, active: active.length, available: available.length, overloaded: overloaded.length, avgCapacity };
  }, [members]);

  const sortedMembers = useMemo(() => {
    const copy = [...members];
    switch (sortKey) {
      case 'capacity':
        return copy.sort((a, b) => b.capacityPercent - a.capacityPercent);
      case 'tasks':
        return copy.sort((a, b) => b.activeTasks - a.activeTasks);
      case 'hours':
        return copy.sort((a, b) => b.estHours - a.estHours);
      case 'projects':
        return copy.sort((a, b) => b.projectIds.length - a.projectIds.length);
      case 'deadline':
        return copy.sort((a, b) => (a.nextDeadline ?? '9999').localeCompare(b.nextDeadline ?? '9999'));
      case 'activity':
        return copy.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
      default:
        return copy;
    }
  }, [members, sortKey]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const overloaded = members.filter((m) => capacityState(m.capacityPercent).key === 'overloaded');
    const free = members.filter((m) => m.activeTasks === 0);
    if (overloaded.length > 0) list.push(`${overloaded.map((m) => m.name).join(', ')} ওভারলোডেড — নতুন টাস্ক অন্য কাউকে দিন।`);
    if (free.length > 0) list.push(`${free.map((m) => m.name).join(', ')} এখন ফ্রি — নতুন টাস্ক দেওয়া যেতে পারে।`);
    const urgentOverloaded = overloaded.find((m) => m.nextDeadline && m.nextDeadline <= todayISO());
    if (urgentOverloaded) list.push(`${urgentOverloaded.name}-এর ডেডলাইন কাছাকাছি অথচ workload বেশি — নজর দিন।`);
    if (list.length === 0) list.push('টিমের workload এই মুহূর্তে ভারসাম্যপূর্ণ।');
    return list;
  }, [members]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const today = todayISO();

  return (
    <>
      <main className="content">
            <div className="th-head">
              <div className="th-text">
                <h1 className="th-title">Team Workload</h1>
                <p className="th-sub">টিমের ক্যাপাসিটি মনিটর করুন, workload ব্যালেন্স করুন, প্রজেক্ট এগিয়ে রাখুন।</p>
              </div>
              <div className="th-actions">
                <button className="th-btn" onClick={handleReload} disabled={reloading}>
                  <Icon name="reload" size={14} /> {reloading ? 'রিলোড হচ্ছে…' : 'Reload'}
                </button>
                <div className="th-more">
                  <button type="button" className="th-btn th-icon" aria-label="More actions" aria-haspopup="menu" aria-expanded={headerMenuOpen} onClick={() => setHeaderMenuOpen((o) => !o)}>
                    <Icon name="more" size={16} />
                  </button>
                  {headerMenuOpen && (
                    <>
                      <div className="th-backdrop" onClick={() => setHeaderMenuOpen(false)} />
                      <div className="th-menu" role="menu">
                        <button type="button" role="menuitem" disabled title="শীঘ্রই আসছে"><Icon name="export" size={14} /> Export <em>soon</em></button>
                        <button type="button" role="menuitem" disabled title="শীঘ্রই আসছে"><Icon name="bookmark" size={14} /> Saved Views <em>soon</em></button>
                        <button type="button" role="menuitem" disabled={loading || members.length === 0} onClick={() => { setHeaderMenuOpen(false); setShowReport(true); }}><Icon name="bar" size={14} /> Generate Report</button>
                      </div>
                    </>
                  )}
                </div>
                {profile?.is_admin && <button className="th-primary" onClick={() => setShowAddMember(true)}><Icon name="user-plus" size={15} /> টিম মেম্বার যোগ করুন</button>}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* KPI overview */}
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="users" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.total}</div><div className="kpi-label">Total Team Members</div><div className="kpi-deco"><Icon name="users" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="activity" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>{loading ? '—' : kpis.active}</div><div className="kpi-label">Active Members</div><div className="kpi-deco" style={{ color: 'var(--positive)' }}><Icon name="activity" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check-circle" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>{loading ? '—' : kpis.available}</div><div className="kpi-label">Available Members</div><div className="kpi-deco" style={{ color: 'var(--positive)' }}><Icon name="check-circle" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--danger)' }}>{loading ? '—' : kpis.overloaded}</div><div className="kpi-label">Overloaded Members</div><div className="kpi-deco" style={{ color: 'var(--danger)' }}><Icon name="alert" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="gauge" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : `${kpis.avgCapacity}%`}</div><div className="kpi-label">Average Capacity</div>{!loading && (
                <div className="kpi-ring-wrap">
                  <svg width={40} height={40} viewBox="0 0 40 40">
                    <circle cx={20} cy={20} r={16} fill="none" stroke="var(--border-soft)" strokeWidth={4} />
                    <circle cx={20} cy={20} r={16} fill="none" stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" strokeDasharray={100.5} strokeDashoffset={100.5 - (Math.min(kpis.avgCapacity, 100) / 100) * 100.5} />
                  </svg>
                </div>
              )}</div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>{loading ? '—' : completedThisWeek}</div><div className="kpi-label">Completed This Week</div><div className="kpi-deco" style={{ color: 'var(--positive)' }}><Icon name="check" size={56} /></div></div>
            </div>

            {/* Team Capacity Overview */}
            <section className="block">
              <div className="section-title-row">
                <div><span className="section-title">Team Capacity Overview</span></div>
              </div>
              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
              ) : members.length === 0 ? (
                <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="users" /></div><div className="empty-title">কোনো টিম মেম্বার নেই</div></div></div>
              ) : (
                <div className="member-grid">
                  {members.map((m) => {
                    const state = capacityState(m.capacityPercent);
                    const availableHours = Math.max(0, WEEKLY_CAPACITY_HOURS - m.estHours);
                    const todoCount = Number.isFinite(m.activeTodos) ? m.activeTodos : 0;
                    const openItems = m.activeTasks + todoCount;
                    return (
                      <article
                        className="member-card clickable"
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${m.name}: view details`}
                        onClick={() => openDetail(m)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault();
                            openDetail(m);
                          }
                        }}
                      >
                        <header className="mc-head">
                          <Avatar person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={48} />
                          <div className="mc-id">
                            <div className="mc-name">
                              <span>{m.name}</span>
                              {m.is_admin && <span className="state-chip st-balanced">Admin</span>}
                            </div>
                            <div className="mc-role">{m.role ?? 'Team Member'}</div>
                          </div>
                          {profile?.is_admin && (
                            <div className="mc-menu-wrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="mc-menu-btn"
                                aria-label={`${m.name} — actions`}
                                aria-haspopup="menu"
                                aria-expanded={openMenuId === m.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId((cur) => (cur === m.id ? null : m.id));
                                }}
                              >
                                <Icon name="more" size={16} />
                              </button>
                              {openMenuId === m.id && (
                                <div className="mc-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    title="প্রোফাইল এডিট করুন (নাম/রোল/বায়ো/সোশ্যাল লিংক/ছবি)"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      openEditMember(m);
                                    }}
                                  >
                                    প্রোফাইল এডিট
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={busyMemberId === m.id}
                                    title="পাসওয়ার্ড রিসেট করুন"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setResetTarget({ id: m.id, name: m.name });
                                      setResetPassword('');
                                      setResetError(null);
                                    }}
                                  >
                                    পাসওয়ার্ড রিসেট
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={busyMemberId === m.id || m.id === profile.id}
                                    title={m.id === profile.id ? 'নিজের এডমিন স্ট্যাটাস এখান থেকে বদলানো যাবে না' : ''}
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleToggleAdmin(m.id, !m.is_admin);
                                    }}
                                  >
                                    {m.is_admin ? 'এডমিন বাদ দিন' : 'এডমিন করুন'}
                                  </button>
                                  <div className="mc-menu-sep" />
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="danger"
                                    disabled={busyMemberId === m.id || m.id === profile.id}
                                    title={m.id === profile.id ? 'নিজেকে রিমুভ করা যাবে না' : 'রিমুভ করুন'}
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleRemoveMember(m.id, m.name);
                                    }}
                                  >
                                    রিমুভ
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </header>

                        <div className="mc3">
                          <div className="mc3-top">
                            <div className="mc3-left">
                              <span className="mc3-label">Workload</span>
                              <span className={`state-chip ${state.cls}`}>{state.label}</span>
                            </div>
                          </div>
                          <div className="mc3-line">
                            {/* five active tasks is a full load, so the bar fills 20% per task */}
                            <div className="mc3-track" role="img" aria-label={`${openItems} of 5 open items, ${m.capacityPercent}% workload`} style={{ '--c': state.color } as CSSProperties}>
                              <div className="mc3-bar-fill" style={{ width: `${Math.min(100, Math.max(0, m.capacityPercent))}%` }} />
                            </div>
                            <span className="mc3-pct tabular" style={{ color: state.color }}>{m.capacityPercent}%</span>
                          </div>
                          <div className="mc3-meta">
                            <span className="tabular"><b>{openItems}</b> of 5 · {m.activeTasks} task{m.activeTasks === 1 ? '' : 's'} + {todoCount} to-do{todoCount === 1 ? '' : 's'}</span>
                            <span className="tabular">{m.estHours > 0 ? `${m.estHours}h planned · ${availableHours}h free` : 'No time estimates yet'}</span>
                          </div>
                        </div>

                        <table className="mc3-table cols">
                          <thead>
                            <tr>
                              <th><span className="mc3-t-label"><Icon name="clock" size={14} />Overdue</span></th>
                              <th><span className="mc3-t-label"><Icon name="calendar" size={14} />Due today</span></th>
                              <th><span className="mc3-t-label"><Icon name="check-circle" size={14} />Done today</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className={`tabular${m.overdueTasks > 0 ? ' is-danger' : ''}`}>{m.overdueTasks}</td>
                              <td className={`tabular${m.dueToday > 0 ? ' is-warn' : ''}`}>{m.dueToday}</td>
                              <td className={`tabular${m.completedToday > 0 ? ' is-good' : ''}`}>{m.completedToday}</td>
                            </tr>
                          </tbody>
                        </table>

                        <footer className="mc4-foot">
                          <div className={`mc4-now${m.primaryProjectName ? '' : ' empty'}`}>
                            <div className="mc4-text">
                              <span className="mc4-label">Working on</span>
                              <span className="mc4-name">{m.primaryProjectName ?? 'কোনো অ্যাক্টিভ প্রজেক্ট নেই'}</span>
                            </div>
                            {m.primaryProjectName && (
                              <span className="mc4-stage"><i />{STAGE_LABEL[m.currentStage ?? ''] ?? m.currentStage ?? '—'}</span>
                            )}
                          </div>
                          <Link href={`/tasks?assignee=${m.id}`} className="mc4-assign" onClick={(e) => e.stopPropagation()}>Assign task</Link>
                        </footer>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Workload Outlook and Project Allocation, side by side */}
            <div className={`pair-row out-row${outlook.buckets.length > 0 ? '' : ' single'}`}>
            {outlook.buckets.length > 0 && (
              <section className="block">
                <div className="section-title-row">
                  <span className="section-title">Workload Outlook</span>
                </div>
                <div className="panel dist-panel">
                  <OutlookChart buckets={outlook.buckets} undated={outlook.undated} />
                </div>
              </section>
            )}
        <section className="block">
          <div className="section-title-row"><span className="section-title">Project Allocation</span></div>
          {allocations.length === 0 ? (
            <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="folder" /></div><div className="empty-title">কোনো অ্যাক্টিভ প্রজেক্ট নেই</div><div className="empty-sub">নতুন প্রজেক্ট শুরু হলে টিম অ্যালোকেশন এখানে দেখা যাবে।</div></div></div>
          ) : (
            <div className="proj-alloc-grid">
              {allocations.map((a) => {
                const isOverdue = a.due_date ? a.due_date < today : false;
                const healthColor = isOverdue ? 'var(--danger)' : (a.progress ?? 0) < 40 ? 'var(--warning)' : 'var(--positive)';
                return (
                  <Link className="proj-alloc-card" href={`/projects/${a.id}`} key={a.id}>
                    <div className="proj-alloc-top"><span className="proj-alloc-name">{a.name}</span><span className="health-dot" style={{ background: healthColor }}></span></div>
                    <div className="proj-alloc-deadline">ডেডলাইন · {formatBnDate(a.due_date) || '—'}</div>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${a.progress ?? 0}%` }}></div></div>
                    <div className="proj-alloc-foot">
                      <div className="avatar-stack">
                        {a.assignees.slice(0, 4).map((m) => (
                          <Avatar key={m.id} person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={24} />
                        ))}
                      </div>
                      <span className="tabular" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{a.progress ?? 0}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
            </div>

            {/* Workload Distribution and Today at a glance, side by side */}
            <div className="pair-row">
        {/* Today at a glance: each member's overdue, due today and done today, with the team total */}
        <section className="block">
          <div className="section-title-row"><span className="section-title">Today at a glance</span></div>
          {members.length === 0 ? (
            <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="users" /></div><div className="empty-title">কোনো টিম মেম্বার নেই</div></div></div>
          ) : (
            <div className="table-scroll">
              <table className="today-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="num">Overdue</th>
                    <th className="num">Due today</th>
                    <th className="num">Done today</th>
                  </tr>
                </thead>
                <tbody>
                  {[...members]
                    .sort((x, y) => y.overdueTasks - x.overdueTasks || y.dueToday - x.dueToday || x.name.localeCompare(y.name))
                    .map((m) => (
                      <tr key={m.id}>
                        <td><div className="assignee-cell"><Avatar person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={24} />{m.name}</div></td>
                        <td className={`num tabular${m.overdueTasks > 0 ? ' t-danger' : ' t-zero'}`}>{m.overdueTasks}</td>
                        <td className={`num tabular${m.dueToday > 0 ? ' t-warn' : ' t-zero'}`}>{m.dueToday}</td>
                        <td className={`num tabular${m.completedToday > 0 ? ' t-good' : ' t-zero'}`}>{m.completedToday}</td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Team total</td>
                    <td className="num tabular">{members.reduce((n, m) => n + m.overdueTasks, 0)}</td>
                    <td className="num tabular">{members.reduce((n, m) => n + m.dueToday, 0)}</td>
                    <td className="num tabular">{members.reduce((n, m) => n + m.completedToday, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
            <section className="block">
              <div className="section-title-row">
                <span className="section-title">Workload Distribution</span>
                <div className="sort-row">
                  {SORT_OPTIONS.map((s) => (
                    <button key={s.key} className={`sort-chip${sortKey === s.key ? ' active' : ''}`} onClick={() => setSortKey(s.key)}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="panel dist-panel">
                <CapacityChart
                  rows={sortedMembers.map((m) => {
                    const st = capacityState(m.capacityPercent);
                    return {
                      id: m.id,
                      name: m.name,
                      avatar_color: m.avatar_color,
                      avatar_url: m.avatar_url,
                      percent: m.capacityPercent,
                      tasks: m.activeTasks,
                      projects: m.projectIds.length,
                      estHours: m.estHours,
                      stateLabel: st.label,
                      stateColor: st.color,
                    };
                  })}
                  legend={CAPACITY_LEGEND}
                  bounds={CAPACITY_BOUNDS}
                  weeklyHours={WEEKLY_CAPACITY_HOURS}
                />
              </div>
            </section>
            </div>

        {/* Current Assignments */}
        <section className="block">
          <div className="section-title-row"><span className="section-title">Current Assignments</span></div>
          {members.filter((m) => m.activeTasks > 0).length === 0 ? (
            <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="check" /></div><div className="empty-title">এখন কারো নামে অ্যাক্টিভ টাস্ক নেই</div></div></div>
          ) : (
            <div className="table-scroll">
              <table className="assign-table">
                <thead><tr><th>Member</th><th>Projects</th><th>Tasks</th><th>Current Stage</th><th>Next Deadline</th><th>Capacity</th><th>Manager</th><th>Action</th></tr></thead>
                <tbody>
                  {sortedMembers.filter((m) => m.activeTasks > 0).map((m) => {
                    const projectNames = m.projectIds.map((pid) => allocations.find((a) => a.id === pid)?.name).filter(Boolean);
                    const isOverdue = m.nextDeadline ? m.nextDeadline < today : false;
                    const isSoon = m.nextDeadline ? m.nextDeadline >= today && m.nextDeadline <= todayISO() : false;
                    const state = capacityState(m.capacityPercent);
                    return (
                      <tr key={m.id}>
                        <td><div className="assignee-cell"><Avatar person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={22} />{m.name}</div></td>
                        <td>{projectNames.length > 0 ? projectNames.join(', ') : '—'}</td>
                        <td className="tabular">{m.activeTasks}</td>
                        <td>{m.currentStage ? <span className="stage-pill">{STAGE_LABEL[m.currentStage] ?? m.currentStage}</span> : '—'}</td>
                        <td className="tabular" style={{ color: isOverdue ? 'var(--danger)' : isSoon ? 'var(--warning)' : undefined, fontWeight: isOverdue || isSoon ? 600 : undefined }}>{formatBnDate(m.nextDeadline) || '—'}</td>
                        <td className="tabular" style={{ color: state.color, fontWeight: 600 }}>{m.capacityPercent}%</td>
                        <td>{m.managerName ?? '—'}</td>
                        <td>
                          {state.key === 'available' ? (
                            <Link className="btn btn-accent btn-sm" href={`/tasks?assignee=${m.id}`}>টাস্ক দিন</Link>
                          ) : (
                            <Link className="btn btn-ghost btn-sm" href="/tasks" title="টাস্ক লিস্টে গিয়ে যেকোনো টাস্ক এক্সপ্যান্ড করে নতুন করে অ্যাসাইন করুন">রি-অ্যাসাইন</Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

            <div className="grid-2col">
              <div>
                {/* Workload Heatmap: who has how much falling due on which day, for the next two weeks */}
                <section className="block">
                  <div className="section-title-row">
                    <span className="section-title">Workload Heatmap</span>
                    <span className="hm-legend" aria-hidden="true">Less <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> More</span>
                  </div>
                  {heatmap.rows.length === 0 ? (
                    <div className="panel">
                      <div className="empty-state">
                        <div className="empty-icon"><Icon name="calendar" /></div>
                        <div className="empty-title">এই দুই সপ্তাহে কোনো ডেডলাইন নেই</div>
                        <div className="empty-sub">টাস্ক বা To-Do-তে ডেডলাইন দিলে এখানে কার কোন দিনে কতটা কাজ জমা আছে দেখা যাবে।</div>
                      </div>
                    </div>
                  ) : (
                    <div className="hm-card">
                    <div className="table-scroll hm-scroll">
                      <table className="hm-table">
                        <thead>
                          <tr>
                            <th className="hm-name">Member</th>
                            <th className="hm-over">Overdue</th>
                            {heatmap.days.map((d) => {
                              const dt = new Date(d + 'T00:00:00');
                              const weekend = dt.getDay() === 0 || dt.getDay() === 6;
                              return (
                                <th key={d} className={`hm-day${d === today ? ' today' : ''}${weekend ? ' weekend' : ''}`}>
                                  <span>{dt.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2)}</span>
                                  <b>{dt.getDate()}</b>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {heatmap.rows.map((r) => (
                            <tr key={r.id}>
                              <td className="hm-name"><div className="assignee-cell"><Avatar person={{ full_name: r.name, avatar_color: r.avatar_color, avatar_url: r.avatar_url }} size={22} />{r.name}</div></td>
                              <td className={`hm-over tabular${r.overdue > 0 ? ' has' : ''}`}>{r.overdue > 0 ? r.overdue : ''}</td>
                              {r.counts.map((n, i) => {
                                const level = n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / heatmap.max) * 4)));
                                const dt = new Date(heatmap.days[i] + 'T00:00:00');
                                return (
                                  <td key={i} className="hm-cell-wrap">
                                    <span className={`hm-cell l${level}`} title={`${r.name}: ${n} due on ${dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}>{n > 0 ? n : ''}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="hm-foot">
                      {(() => {
                        const dayTotals = heatmap.days.map((_, i) => heatmap.rows.reduce((n, r) => n + r.counts[i], 0));
                        const dueTotal = dayTotals.reduce((n, x) => n + x, 0);
                        const overdueTotal = heatmap.rows.reduce((n, r) => n + r.overdue, 0);
                        const peakIdx = dayTotals.indexOf(Math.max(...dayTotals));
                        const peakDay = dueTotal > 0 ? new Date(heatmap.days[peakIdx] + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : null;
                        const busiest = [...heatmap.rows].sort((x, y) => y.counts.reduce((n, c) => n + c, 0) - x.counts.reduce((n, c) => n + c, 0))[0];
                        const busiestN = busiest ? busiest.counts.reduce((n, c) => n + c, 0) : 0;
                        return (
                          <div className="hm-facts">
                            <div><span>Due in 14 days</span><b className="tabular">{dueTotal}</b></div>
                            <div><span>Busiest day</span><b className="tabular">{peakDay ? `${peakDay} · ${dayTotals[peakIdx]}` : 'No deadlines yet'}</b></div>
                            <div><span>Most loaded</span><b>{busiestN > 0 && busiest ? `${busiest.name.split(' ')[0]} · ${busiestN}` : 'Nobody yet'}</b></div>
                            <div><span>Already overdue</span><b className={`tabular${overdueTotal > 0 ? ' danger' : ''}`}>{overdueTotal}</b></div>
                          </div>
                        );
                      })()}
                      <div className="hm-how">
                        <span className="hm-how-title">How to read this</span>
                        <ul className="hm-how-list">
                          <li><i className="hm-dot l3" />Each square = open tasks + To-Dos due that day</li>
                          <li><i className="hm-dot l1" />Darker purple = more work due</li>
                          <li><i className="hm-dot over" />Overdue column = past the due date</li>
                          <li><i className="hm-dot none" />No due date = not shown</li>
                        </ul>
                      </div>
                    </div>
                    </div>
                  )}
                </section>
              </div>

              <div>
                {/* AI Workload Insights */}
                <section className="ai-card block">
                  <div className="ai-head"><div className="ai-badge"><Icon name="spark" size={16} /></div><div className="ai-title">AI ইনসাইট</div><span className="ai-count tabular">{insights.length}</span></div>
                  <div className="ai-list">{insights.map((text, i) => (<div className="ai-item" key={i}><span className="dot"></span> {text}</div>))}</div>
                </section>

                {/* Quick Actions */}
                <section className="panel">
                  <div className="panel-head"><span className="panel-title">Quick Actions</span></div>
                  <div className="qa-grid">
                    <Link className="qa-btn" href="/tasks"><div className="qa-icon"><Icon name="plus" size={14} /></div><span className="qa-label">টাস্ক তৈরি</span></Link>
                    <Link className="qa-btn" href="/projects"><div className="qa-icon"><Icon name="folder" size={14} /></div><span className="qa-label">প্রজেক্ট দেখুন</span></Link>
                    {profile?.is_admin ? (
                      <button className="qa-btn" onClick={() => setShowAddMember(true)}><div className="qa-icon"><Icon name="user-plus" size={14} /></div><span className="qa-label">মেম্বার যোগ করুন</span></button>
                    ) : (
                      <button className="qa-btn" disabled title="শুধু এডমিনরা মেম্বার যোগ করতে পারবে"><div className="qa-icon"><Icon name="user-plus" size={14} /></div><span className="qa-label">মেম্বার যোগ করুন</span></button>
                    )}
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="bar" size={14} /></div><span className="qa-label">রিপোর্ট বানান</span></button>
                  </div>
                </section>
              </div>
            </div>
          </main>
      {showReport && (() => {
        const generated = new Date();
        const rows = [...members].sort((x, y) => y.capacityPercent - x.capacityPercent);
        const openTasks = rows.reduce((n, r) => n + r.activeTasks, 0);
        const openTodos = rows.reduce((n, r) => n + r.activeTodos, 0);
        const overdue = rows.reduce((n, r) => n + r.overdueTasks, 0);
        const hours = rows.reduce((n, r) => n + r.estHours, 0);
        const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.capacityPercent, 0) / rows.length) : 0;
        const dueNext14 = heatmap.rows.reduce((n, r) => n + r.counts.reduce((a, c) => a + c, 0), 0);
        const stamp = generated.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        const downloadCsv = () => {
          const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
          const head = ['Member', 'Role', 'Workload %', 'Status', 'Open tasks', 'Pending To-Dos', 'Estimated hours', 'Overdue', 'Due today', 'Done today', 'Projects', 'Next deadline'];
          const lines = rows.map((r) => [r.name, r.role ?? 'Team Member', r.capacityPercent, capacityState(r.capacityPercent).label, r.activeTasks, r.activeTodos, r.estHours, r.overdueTasks, r.dueToday, r.completedToday, r.projectIds.length, r.nextDeadline ?? ''].map(esc).join(','));
          const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `team-workload-${todayISO()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };
        return (
          <div className="rp-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}>
            <div className="rp-modal" role="dialog" aria-modal="true" aria-label="Team workload report">
              <div className="rp-bar">
                <span className="rp-bar-title">Team Workload Report</span>
                <div className="rp-bar-actions">
                  <button type="button" className="th-btn" onClick={downloadCsv}><Icon name="export" size={14} /> Download CSV</button>
                  <button type="button" className="rp-print" onClick={() => window.print()}><span className="rp-print-ico"><Icon name="printer" size={14} /></span>Print / Save PDF</button>
                  <button type="button" className="md-close" aria-label="Close" onClick={() => setShowReport(false)}><Icon name="close" size={16} /></button>
                </div>
              </div>
              <div className="rp-scroll">
                <div className="rp-sheet">
                  <div className="rp-head">
                    <div>
                      <div className="rp-brand">FLOW 53</div>
                      <h2 className="rp-title">Team Workload Report</h2>
                    </div>
                    <div className="rp-stamp">Generated {stamp}</div>
                  </div>
                  <table className="rp-sum">
                    <tbody>
                      <tr>
                        <td><b>{rows.length}</b><span>Team members</span></td>
                        <td><b>{openTasks}</b><span>Open tasks</span></td>
                        <td><b>{openTodos}</b><span>Pending To-Dos</span></td>
                        <td><b>{avg}%</b><span>Average workload</span></td>
                      </tr>
                      <tr>
                        <td><b>{hours}h</b><span>Estimated of {rows.length * WEEKLY_CAPACITY_HOURS}h</span></td>
                        <td><b className={overdue > 0 ? 'rp-red' : ''}>{overdue}</b><span>Overdue tasks</span></td>
                        <td><b>{dueNext14}</b><span>Due in next 14 days</span></td>
                        <td><b>{completedThisWeek}</b><span>Completed this week</span></td>
                      </tr>
                    </tbody>
                  </table>
                  <h3 className="rp-h">Workload by member</h3>
                  <table className="rp-table">
                    <thead>
                      <tr><th>Member</th><th>Workload</th><th>Status</th><th>Tasks</th><th>To-Dos</th><th>Hours</th><th>Overdue</th><th>Due today</th><th>Next deadline</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td><b>{r.name}</b><span>{r.role ?? 'Team Member'}</span></td>
                          <td className="tabular">{r.capacityPercent}%</td>
                          <td>{capacityState(r.capacityPercent).label}</td>
                          <td className="tabular">{r.activeTasks}</td>
                          <td className="tabular">{r.activeTodos}</td>
                          <td className="tabular">{r.estHours}h</td>
                          <td className={`tabular${r.overdueTasks > 0 ? ' rp-red' : ''}`}>{r.overdueTasks}</td>
                          <td className="tabular">{r.dueToday}</td>
                          <td>{r.nextDeadline ? formatDate(r.nextDeadline) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="rp-foot">Workload % = (open tasks + pending To-Dos) / 5, capped at 100. Under 30% Available, 30-64% Balanced, 65-84% Busy, 85% and above Overloaded. Hours are the estimated hours of open tasks against a {WEEKLY_CAPACITY_HOURS}h week.</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {detailMember && (() => {
        const m = detailMember;
        const state = capacityState(m.capacityPercent);
        const availableHours = Math.max(0, WEEKLY_CAPACITY_HOURS - m.estHours);
        const today0 = todayISO();
        const socials = [
          { label: 'Behance', url: m.behance_url },
          { label: 'LinkedIn', url: m.linkedin_url },
          { label: 'Facebook', url: m.facebook_url },
          { label: 'Instagram', url: m.instagram_url },
        ].filter((x): x is { label: string; url: string } => !!x.url);
        const projects = detail ? Array.from(new Map(detail.tasks.filter((t) => t.projects).map((t) => [t.projects!.id, t.projects!.name])).entries()) : [];
        return (
          <div className="md-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetailMember(null); }}>
            <aside className="md-drawer" role="dialog" aria-modal="true" aria-label={`${m.name} details`}>
              <div className="md-top">
                <button type="button" className="md-close" aria-label="Close" onClick={() => setDetailMember(null)}>
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="md-hero">
                <Avatar person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={72} />
                <div className="md-hero-text">
                  <h2 className="md-name">{m.name}</h2>
                  <div className="md-role">{m.role ?? 'Team Member'}</div>
                  <div className="md-chips">
                    {m.is_admin && <span className="state-chip st-balanced">Admin</span>}
                    <span className={`state-chip ${state.cls}`}>{state.label}</span>
                  </div>
                </div>
              </div>

              <div className="md-actions">
                <Link href={`/tasks?assignee=${m.id}`} className="btn btn-accent btn-sm">
                  <Icon name="plus" size={13} /> Give a task
                </Link>
                {profile?.is_admin && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDetailMember(null); openEditMember(m); }}>
                    <Icon name="edit" size={13} /> Edit profile
                  </button>
                )}
              </div>

              <section className="md-stats">
                <div><b className="tabular">{m.activeTasks}</b><span>Open tasks</span></div>
                <div><b className="tabular">{m.projectIds.length}</b><span>Projects</span></div>
                <div><b className="tabular">{detail ? detail.doneThisWeek : 0}</b><span>Done this week</span></div>
                <div><b className="tabular">{detail ? detail.doneTotal : 0}</b><span>Done in total</span></div>
              </section>

              <section className="md-section">
                <h3 className="md-h">Contact</h3>
                <ul className="md-contact">
                  <li>
                    <span className="md-contact-icon"><Icon name="mail" size={15} /></span>
                    <span className="md-contact-body">
                      <span className="md-contact-label">Email</span>
                      {detailLoading ? (
                        <span className="md-contact-value muted">Loading…</span>
                      ) : detail?.email ? (
                        <a className="md-contact-value" href={`mailto:${detail.email}`}>{detail.email}</a>
                      ) : (
                        <span className="md-contact-value muted">Not available</span>
                      )}
                    </span>
                    {detail?.email && (
                      <button type="button" className="md-copy" aria-label="Copy email" title={copied === 'email' ? 'Copied' : 'Copy email'} onClick={() => copyText('email', detail.email as string)}>
                        <Icon name={copied === 'email' ? 'check' : 'copy'} size={14} />
                      </button>
                    )}
                  </li>
                  {(detailLoading || detail?.whatsapp) && (
                    <li>
                      <span className="md-contact-icon"><Icon name="phone" size={15} /></span>
                      <span className="md-contact-body">
                        <span className="md-contact-label">WhatsApp</span>
                        {detail?.whatsapp ? (
                          <a className="md-contact-value" href={`https://wa.me/${detail.whatsapp.replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer">{detail.whatsapp}</a>
                        ) : (
                          <span className="md-contact-value muted">Loading…</span>
                        )}
                      </span>
                      {detail?.whatsapp && (
                        <button type="button" className="md-copy" aria-label="Copy number" title={copied === 'phone' ? 'Copied' : 'Copy number'} onClick={() => copyText('phone', detail.whatsapp as string)}>
                          <Icon name={copied === 'phone' ? 'check' : 'copy'} size={14} />
                        </button>
                      )}
                    </li>
                  )}
                </ul>
              </section>

              {m.bio && (
                <section className="md-section">
                  <h3 className="md-h">About</h3>
                  <p className="md-bio">{m.bio}</p>
                </section>
              )}

              {socials.length > 0 && (
                <section className="md-section">
                  <h3 className="md-h">Links</h3>
                  <div className="md-socials">
                    {socials.map((x) => (
                      <a key={x.label} href={x.url} target="_blank" rel="noopener noreferrer" className="md-social">
                        <Icon name="link" size={13} /> {x.label}
                      </a>
                    ))}
                  </div>
                </section>
              )}

              <section className="md-section">
                <h3 className="md-h">Workload this week</h3>
                <div className="md-capacity">
                  <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${m.capacityPercent}% of weekly capacity`}>
                    <circle cx="38" cy="38" r={RING_R} fill="none" stroke="var(--border-soft)" strokeWidth="8" />
                    {m.capacityPercent > 0 && (
                      <circle cx="38" cy="38" r={RING_R} fill="none" stroke={state.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C - (RING_C * Math.min(100, m.capacityPercent)) / 100} transform="rotate(-90 38 38)" />
                    )}
                    <text x="38" y="43" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)">{m.capacityPercent}%</text>
                  </svg>
                  <div className="md-capacity-text">
                    <div><b className="tabular">{m.estHours}h</b> estimated of {WEEKLY_CAPACITY_HOURS}h</div>
                    <div><b className="tabular">{availableHours}h</b> still available</div>
                    {m.nextDeadline && <div>Next deadline <b>{formatDate(m.nextDeadline)}</b></div>}
                  </div>
                </div>
              </section>

              <section className="md-section">
                <h3 className="md-h">Open tasks {detail && <span className="md-count">{detail.tasks.length}</span>}</h3>
                {detailLoading ? (
                  <p className="md-empty">Loading…</p>
                ) : !detail || detail.tasks.length === 0 ? (
                  <p className="md-empty">No open tasks. {m.name.split(' ')[0]} is free.</p>
                ) : (
                  <ul className="md-tasks">
                    {detail.tasks.map((t) => {
                      const overdue = !!t.due_date && t.due_date < today0;
                      return (
                        <li key={t.id}>
                          <div className="md-task-main">
                            <span className="md-task-title">{t.title}</span>
                            <span className="md-task-meta">
                              {t.projects?.name ?? 'No project'} · {TASK_STATUS_EN[t.status] ?? t.status} · {STAGE_LABEL[t.workflow_stage] ?? t.workflow_stage}
                            </span>
                          </div>
                          <div className="md-task-side">
                            {t.due_date && <span className={`md-due${overdue ? ' overdue' : ''}`}>{overdue ? 'Overdue · ' : ''}{formatDate(t.due_date)}</span>}
                            <span className={`md-prio md-prio-${t.priority}`}>{TASK_PRIORITY_EN[t.priority] ?? t.priority}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {projects.length > 0 && (
                <section className="md-section">
                  <h3 className="md-h">Projects</h3>
                  <div className="md-socials">
                    {projects.map(([id, name]) => (
                      <Link key={id} href={`/projects/${id}`} className="md-social">{name}</Link>
                    ))}
                  </div>
                </section>
              )}

              <section className="md-section">
                <h3 className="md-h">Recent activity</h3>
                {detailLoading ? (
                  <p className="md-empty">Loading…</p>
                ) : !detail || detail.activity.length === 0 ? (
                  <p className="md-empty">No activity yet.</p>
                ) : (
                  <ul className="md-activity">
                    {detail.activity.map((a) => (
                      <li key={a.id}>
                        <span className="md-activity-text">{activityText(a)}</span>
                        <span className="md-activity-time">{relativeTime(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        );
      })()}

      {showAddMember && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddMember(false); }}>
          <div className="modal-box">
            <div className="modal-title">টিম মেম্বার যোগ করুন</div>
            <form onSubmit={handleAddMember}>
              <label className="field-label">নাম</label>
              <input className="field-input" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="যেমন: রাফি আহমেদ" autoFocus required />
              <label className="field-label">ইমেইল</label>
              <input className="field-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@studio.com" required />
              <label className="field-label">পাসওয়ার্ড (কমপক্ষে ৮ ক্যারেক্টার)</label>
              <input className="field-input" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="একটা অস্থায়ী পাসওয়ার্ড দিন" required minLength={8} />
              <label className="field-label">রোল (ঐচ্ছিক)</label>
              <input className="field-input" type="text" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="যেমন: UX Designer" />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
                এডমিন হিসেবে যোগ করুন (মেম্বার যোগ/রিমুভ করতে পারবে)
              </label>
              {addMemberError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{addMemberError}</p>}
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddMember(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={addingMember || !newName.trim() || !newEmail.trim() || newPassword.length < 8}>{addingMember ? 'তৈরি হচ্ছে…' : 'মেম্বার তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {resetTarget && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setResetTarget(null); }}>
          <div className="modal-box">
            <div className="modal-title">{resetTarget.name}-এর পাসওয়ার্ড রিসেট করুন</div>
            <form onSubmit={handleResetPassword}>
              <label className="field-label">নতুন পাসওয়ার্ড (কমপক্ষে ৮ ক্যারেক্টার)</label>
              <input className="field-input" type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="নতুন পাসওয়ার্ড" autoFocus required minLength={8} />
              {resetError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{resetError}</p>}
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetTarget(null)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={resettingPassword || resetPassword.length < 8}>{resettingPassword ? 'সেভ হচ্ছে…' : 'রিসেট করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editMember && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditMember(null); }}>
          <div className="modal-box">
            <div className="modal-title">{editMember.name}-এর প্রোফাইল এডিট করুন</div>
            <form onSubmit={handleSaveEditMember}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <Avatar person={{ full_name: emName, avatar_color: editMember.avatar_color, avatar_url: emAvatarUrl }} size={72} fontSize={26} />
                  <label
                    style={{
                      position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: '#fff',
                      fontSize: 12, cursor: 'pointer', border: '2px solid var(--surface)',
                    }}
                  >
                    ✎
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={emAvatarUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEditMemberAvatarFile(f); e.target.value = ''; }}
                    />
                  </label>
                </div>
              </div>
              {emAvatarUploading && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)', marginBottom: 10 }}>আপলোড হচ্ছে… {emAvatarProgress}%</p>}

              <label className="field-label">নাম</label>
              <input className="field-input" type="text" value={emName} onChange={(e) => setEmName(e.target.value)} placeholder="পুরো নাম" required />

              <label className="field-label">রোল</label>
              <input className="field-input" type="text" value={emRole} onChange={(e) => setEmRole(e.target.value)} placeholder="যেমন: UX Designer" />

              <label className="field-label">বায়ো</label>
              <textarea className="field-input" style={{ minHeight: 64, resize: 'vertical' }} value={emBio} onChange={(e) => setEmBio(e.target.value)} placeholder="এক-দুই লাইনে পরিচিতি" />

              <label className="field-label">Facebook লিংক</label>
              <input className="field-input" type="url" value={emFacebook} onChange={(e) => setEmFacebook(e.target.value)} placeholder="https://facebook.com/..." />

              <label className="field-label">Instagram লিংক</label>
              <input className="field-input" type="url" value={emInstagram} onChange={(e) => setEmInstagram(e.target.value)} placeholder="https://instagram.com/..." />

              <label className="field-label">Behance লিংক</label>
              <input className="field-input" type="url" value={emBehance} onChange={(e) => setEmBehance(e.target.value)} placeholder="https://behance.net/..." />

              <label className="field-label">LinkedIn লিংক</label>
              <input className="field-input" type="url" value={emLinkedin} onChange={(e) => setEmLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
              <p className="field-hint">এই তথ্যগুলো FLOW 53-এর পাবলিক About পেজের Team সেকশনে দেখানো হয়।</p>

              {emError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{emError}</p>}
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditMember(null)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={emSaving || !emName.trim()}>{emSaving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
