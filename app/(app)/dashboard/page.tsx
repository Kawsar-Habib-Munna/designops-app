"use client";

// Dashboard — lib/supabaseClient.ts দিয়ে রিয়েল Supabase ডেটা: projects, tasks,
// activity_log, meetings, profiles। RLS পলিসি অনুযায়ী sign-in করা authenticated
// ইউজার লাগবে (lib/useSession.ts + SignInScreen)।

import { useEffect, useState } from "react";
import Link from "next/link";
import "./dashboard.css";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/lib/useSession";
import { formatTimeBn, todayISO } from "@/lib/format";
import SignInScreen from "@/app/components/SignInScreen";
import Avatar from "@/app/components/Avatar";
import StatusBar from "@/app/components/StatusBar";
import TrendChart from "@/app/components/TrendChart";
import OutlookChart from "@/app/components/OutlookChart";
import WorkloadChart from "@/app/components/WorkloadChart";
import ProjectProgress from "@/app/components/ProjectProgress";
import DonutChart from "@/app/components/DonutChart";
import {
  completionsByDay,
  dueNextDays,
  projectProgress,
  projectStatusCounts,
  projectsDueWeeks,
  statusCounts,
  type ChartProject,
  type ChartTask,
} from "@/lib/dashboardCharts";

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder:
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  'kpi-projects': '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>',
  'kpi-tasks': '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  'kpi-timer': '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  'kpi-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'kpi-team': '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
  'kpi-chart': '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  arrow: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  checklist: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  building:
    '<path d="M6 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18"/><path d="M6 12h12"/><path d="M6 22h14"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  bar: '<path d="M3 21h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="8" width="3" height="10"/><rect x="16" y="4" width="3" height="14"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  chevrons: '<path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert:
    '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  "chevron-right": '<path d="M9 6l6 6-6 6"/>',
  tick: '<path d="M20 6L9 17l-5-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  upload:
    '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  message:
    '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers:
    '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  "user-plus":
    '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  spark:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  "folder-plus":
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/><path d="M12 11v4"/><path d="M10 13h4"/>',
  video:
    '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  "more-horizontal":
    '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  dollar: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  whiteboard: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 9l3 3 2-2 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
};

// action টাইপ অনুযায়ী আইকন + রং — flat ধূসর আইকনের বদলে অ্যাকশনের ধরন (তৈরি/মুছে
// ফেলা/পেমেন্ট/স্ট্যাটাস বদল ইত্যাদি) এক নজরে বোঝা যায়
function activityMeta(action: string): { icon: keyof typeof ICON_PATHS; cls: string } {
  switch (action) {
    case "task_created":
    case "project_created":
    case "client_added":
      return { icon: "plus", cls: "act-positive" };
    case "project_deleted":
    case "payment_cancelled":
    case "sow_cancelled":
      return { icon: "close", cls: "act-danger" };
    case "payment_received":
    case "payment_confirmation_submitted":
      return { icon: "dollar", cls: "act-positive" };
    case "sow_signed":
    case "sow_agency_signed":
      return { icon: "check-circle", cls: "act-positive" };
    case "sow_sent":
    case "info_requested":
    case "info_request_resolved":
    case "requirements_submitted":
      return { icon: "message", cls: "act-accent" };
    case "file_uploaded":
      return { icon: "upload", cls: "act-accent" };
    case "client_notified":
      return { icon: "bell", cls: "act-accent" };
    case "status_changed":
    case "project_updated":
    case "manager_assigned":
      return { icon: "chevron-right", cls: "act-accent" };
    default:
      return { icon: "check-circle", cls: "act-neutral" };
  }
}

type IconName = keyof typeof ICON_PATHS;

function Icon({
  name,
  size = 16,
  color = "currentColor",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}



const QUICK_ACTIONS: { icon: IconName; label: string; href?: string }[] = [
  { icon: "folder-plus", label: "New project" },
  { icon: "plus", label: "Create task", href: "/tasks" },
  { icon: "dollar", label: "Budget", href: "/budget" },
  { icon: "whiteboard", label: "Whiteboard", href: "/whiteboard" },
  { icon: "user-plus", label: "Invite member" },
  { icon: "upload", label: "Upload file" },
  { icon: "video", label: "Start meeting" },
  { icon: "bar", label: "Build report" },
];

const PRIORITY_COLOR: Record<string, string> = {
  low: "var(--ink-faint)",
  normal: "var(--accent)",
  high: "var(--warning)",
  urgent: "var(--danger)",
};

const PROJECT_CHIP: Record<string, { cls: string; label: string }> = {
  active: { cls: "chip-progress", label: "চলছে" },
  review: { cls: "chip-review", label: "রিভিউ" },
  completed: { cls: "chip-done", label: "সম্পন্ন" },
  on_hold: { cls: "chip-overdue", label: "হোল্ডে" },
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: string | null;
  avatar_color: string | null;
  avatar_url?: string | null;
  is_admin?: boolean;
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  due_date: string | null;
  clients: { company_name: string } | null;
  manager: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
  taskCount: number;
  doneCount: number;
  discussionCount: number;
  fileCount: number;
  avatars: { full_name: string; avatar_color: string | null; avatar_url: string | null }[];
};

type DashTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  projects: { name: string } | null;
};

type DashChecklistItem = { id: string; task_id: string; label: string; is_done: boolean; position: number | null };

type DashTodo = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_time: string | null;
  projects: { name: string } | null;
};

type ActivityRow = {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

type MeetingRow = { id: string; title: string; meeting_time: string | null };

type WorkloadEntry = { name: string; count: number };

// the welcome card: a plain-English greeting and a one-line read of the day from the live numbers
function greetingEn(): { text: string; night: boolean } {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good Morning', night: false };
  if (h < 18) return { text: 'Good Afternoon', night: false };
  return { text: 'Good Evening', night: h >= 20 };
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "Today", "Tomorrow", "3 days left" or "2 days late" for the task rows
function dueLabel(due: string | null): { text: string; cls: '' | 'soon' | 'overdue' } {
  if (!due) return { text: 'No date', cls: '' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `${plural(Math.abs(diff), 'day', 'days')} late`, cls: 'overdue' };
  if (diff === 0) return { text: 'Today', cls: 'soon' };
  if (diff === 1) return { text: 'Tomorrow', cls: '' };
  return { text: `${diff} days left`, cls: '' };
}

// activity feed: "5 min ago" style times and the Today / Yesterday / Earlier grouping
function agoEn(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} ${day === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
function activityGroup(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((t.getTime() - d.getTime()) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
}

type Insight = { tone: 'danger' | 'warning' | 'positive'; icon: IconName; title: string; text: string; href: string };

function buildInsights(overdue: number, workload: WorkloadEntry[], projects: ProjectRow[]): Insight[] {
  const list: Insight[] = [];
  if (overdue > 0)
    list.push({ tone: 'danger', icon: 'alert', title: 'Overdue tasks', text: `${plural(overdue, 'task has', 'tasks have')} missed the deadline. Review them first.`, href: '/tasks' });
  if (workload[0])
    list.push({ tone: 'warning', icon: 'users', title: 'Heaviest workload', text: `${workload[0].name} has the most open tasks (${workload[0].count}). Give new work to someone else.`, href: '/team' });
  const weekFromNow = Date.now() + 7 * 86400000;
  const atRisk = projects.find((p) => p.status === 'active' && (p.progress ?? 0) < 50 && p.due_date && new Date(p.due_date).getTime() < weekFromNow);
  if (atRisk)
    list.push({ tone: 'warning', icon: 'clock', title: 'Project at risk', text: `${atRisk.name} may miss its deadline at the current pace.`, href: '/projects' });
  if (list.length === 0)
    list.push({ tone: 'positive', icon: 'check', title: 'All on track', text: 'No urgent alerts right now. Everything is moving as planned.', href: '/projects' });
  return list;
}

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();

  const [cmdkOpen, setCmdkOpen] = useState(false);
  // the top bar's search box (in the shared shell) asks the dashboard to open its command palette
  useEffect(() => {
    const open = () => setCmdkOpen(true);
    window.addEventListener("app:open-search", open);
    return () => window.removeEventListener("app:open-search", open);
  }, []);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [kpis, setKpis] = useState({
    activeProjects: 0,
    pendingTasks: 0,
    dueToday: 0,
    overdue: 0,
    teamCount: 0,
    completion: 0,
  });
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<DashTask[]>([]);
  const [todos, setTodos] = useState<DashTodo[]>([]);
  // every task, only the columns the charts need (status, due date, last update)
  const [chartTasks, setChartTasks] = useState<ChartTask[]>([]);
  // every project, only the columns the project charts need
  const [chartProjects, setChartProjects] = useState<ChartProject[]>([]);
  // each of my tasks' checklist (the subtasks inside it), keyed by task id
  const [checklists, setChecklists] = useState<Record<string, DashChecklistItem[]>>({});
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [workload, setWorkload] = useState<WorkloadEntry[]>([]);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(true);
      }
      if (e.key === "Escape") setCmdkOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadDashboard() {
      setDataLoading(true);
      setError(null);
      const today = todayISO();

      const [
        profileRes,
        activeProjectsRes,
        pendingTasksRes,
        dueTodayRes,
        overdueRes,
        teamCountRes,
        totalTasksRes,
        doneTasksRes,
        projectsRes,
        projectTaskStatsRes,
        projectDiscussionsRes,
        projectAttachmentsRes,
        tasksRes,
        activityRes,
        workloadRes,
        meetingsRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin")
          .eq("id", user!.id)
          .single(),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .neq("status", "done"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("due_date", today)
          .neq("status", "done"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .lt("due_date", today)
          .neq("status", "done"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "done"),
        supabase
          .from("projects")
          .select(
            "id, name, status, progress, due_date, clients(company_name), manager:profiles!project_manager_id(full_name, avatar_color, avatar_url)",
          )
          .order("due_date", { ascending: true })
          .limit(5),
        supabase
          .from("tasks")
          .select("project_id, status, assignee_id, profiles!assignee_id(full_name, avatar_color, avatar_url)")
          .not("project_id", "is", null),
        supabase.from("discussions").select("project_id").not("project_id", "is", null),
        supabase
          .from("attachments")
          .select("task_id, folder_id, tasks(project_id), folders(project_id)"),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, projects(name)")
          .eq("assignee_id", user!.id)
          .neq("status", "done")
          .order("due_date", { ascending: true })
          .limit(100),
        supabase
          .from("activity_log")
          .select("id, action, detail, created_at, profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("tasks")
          .select("assignee_id, profiles!assignee_id(full_name)")
          .neq("status", "done")
          .not("assignee_id", "is", null),
        supabase
          .from("meetings")
          .select("id, title, meeting_time")
          .eq("meeting_date", today)
          .order("meeting_time", { ascending: true }),
      ]);

      if (cancelled) return;

      const firstErrored = [
        profileRes,
        activeProjectsRes,
        pendingTasksRes,
        dueTodayRes,
        overdueRes,
        teamCountRes,
        totalTasksRes,
        doneTasksRes,
        projectsRes,
        projectTaskStatsRes,
        projectDiscussionsRes,
        projectAttachmentsRes,
        tasksRes,
        activityRes,
        workloadRes,
        meetingsRes,
      ].find((r) => r.error);
      if (firstErrored?.error) setError(firstErrored.error.message);

      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

      setKpis({
        activeProjects: activeProjectsRes.count ?? 0,
        pendingTasks: pendingTasksRes.count ?? 0,
        dueToday: dueTodayRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        teamCount: teamCountRes.count ?? 0,
        completion: totalTasksRes.count
          ? Math.round(((doneTasksRes.count ?? 0) / totalTasksRes.count) * 100)
          : 0,
      });

      const projectTaskStats = new Map<string, { done: number; total: number }>();
      const projectAvatars = new Map<string, Map<string, { full_name: string; avatar_color: string | null; avatar_url: string | null }>>();
      for (const row of (projectTaskStatsRes.data as unknown as {
        project_id: string;
        status: string;
        assignee_id: string | null;
        profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
      }[]) ?? []) {
        const cur = projectTaskStats.get(row.project_id) ?? { done: 0, total: 0 };
        cur.total += 1;
        if (row.status === "done") cur.done += 1;
        projectTaskStats.set(row.project_id, cur);

        if (row.assignee_id && row.profiles) {
          const avatars = projectAvatars.get(row.project_id) ?? new Map();
          avatars.set(row.assignee_id, row.profiles);
          projectAvatars.set(row.project_id, avatars);
        }
      }

      const projectDiscussionCounts = new Map<string, number>();
      for (const row of (projectDiscussionsRes.data as { project_id: string }[]) ?? []) {
        projectDiscussionCounts.set(row.project_id, (projectDiscussionCounts.get(row.project_id) ?? 0) + 1);
      }

      const projectFileCounts = new Map<string, number>();
      for (const row of (projectAttachmentsRes.data as unknown as {
        task_id: string | null;
        folder_id: string | null;
        tasks: { project_id: string | null } | null;
        folders: { project_id: string | null } | null;
      }[]) ?? []) {
        const projectId = row.tasks?.project_id ?? row.folders?.project_id ?? null;
        if (projectId) projectFileCounts.set(projectId, (projectFileCounts.get(projectId) ?? 0) + 1);
      }

      const projectsWithProgress = ((projectsRes.data as unknown as ProjectRow[]) ?? []).map((p) => {
        const stat = projectTaskStats.get(p.id);
        return {
          ...p,
          progress: stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0,
          taskCount: stat?.total ?? 0,
          doneCount: stat?.done ?? 0,
          discussionCount: projectDiscussionCounts.get(p.id) ?? 0,
          fileCount: projectFileCounts.get(p.id) ?? 0,
          avatars: Array.from((projectAvatars.get(p.id) ?? new Map()).values()),
        };
      });
      setProjects(projectsWithProgress);
      const myTaskRows = (tasksRes.data as unknown as DashTask[]) ?? [];
      setTasks(myTaskRows);

      // the checklist (subtasks) of each of those tasks, shown under the task in the My Tasks card
      if (myTaskRows.length > 0) {
        const clRes = await supabase
          .from("checklist_items")
          .select("id, task_id, label, is_done, position")
          .in("task_id", myTaskRows.map((t) => t.id))
          .order("position", { ascending: true });
        const grouped: Record<string, DashChecklistItem[]> = {};
        for (const item of ((clRes.data as unknown as DashChecklistItem[]) ?? [])) {
          (grouped[item.task_id] ??= []).push(item);
        }
        if (!cancelled) setChecklists(clRes.error ? {} : grouped);
      }

      // all tasks (light columns) for the dashboard charts
      const chartRes = await supabase.from("tasks").select("status, due_date, updated_at, project_id").limit(5000);
      const chartProjRes = await supabase.from("projects").select("id, name, status, due_date").limit(1000);
      if (!cancelled) setChartProjects(chartProjRes.error ? [] : ((chartProjRes.data as unknown as ChartProject[]) ?? []));
      if (!cancelled) setChartTasks(chartRes.error ? [] : ((chartRes.data as unknown as ChartTask[]) ?? []));

      // the To-Do list items due today (only today; the full list lives on /todos)
      const todosRes = await supabase
        .from("todos")
        .select("id, title, status, priority, due_time, projects(name)")
        .eq("assignee_id", user!.id)
        .eq("due_date", today)
        .order("due_time", { ascending: true, nullsFirst: false });
      if (!cancelled) setTodos(todosRes.error ? [] : ((todosRes.data as unknown as DashTodo[]) ?? []));
      setActivity((activityRes.data as unknown as ActivityRow[]) ?? []);
      setMeetings((meetingsRes.data as MeetingRow[]) ?? []);

      const counts = new Map<string, WorkloadEntry>();
      for (const row of (workloadRes.data as unknown as {
        assignee_id: string;
        profiles: { full_name: string } | null;
      }[]) ?? []) {
        const name = row.profiles?.full_name ?? "অজানা";
        const existing = counts.get(row.assignee_id);
        counts.set(row.assignee_id, {
          name,
          count: (existing?.count ?? 0) + 1,
        });
      }
      setWorkload(
        Array.from(counts.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      );

      setDataLoading(false);
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggleChecklistItem(taskId: string, itemId: string, wasDone: boolean) {
    const flip = (done: boolean) =>
      setChecklists((prev) => ({
        ...prev,
        [taskId]: (prev[taskId] ?? []).map((it) => (it.id === itemId ? { ...it, is_done: done } : it)),
      }));
    flip(!wasDone);
    const { error } = await supabase.from("checklist_items").update({ is_done: !wasDone }).eq("id", itemId);
    if (error) {
      setError(error.message);
      flip(wasDone);
    }
  }

  async function toggleTodo(todoId: string, currentStatus: string) {
    if (!user) return;
    const next = currentStatus === "completed" ? "pending" : "completed";
    setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: next } : t)));
    const { error } = await supabase
      .from("todos")
      .update({ status: next, completed_at: next === "completed" ? new Date().toISOString() : null })
      .eq("id", todoId);
    if (error) {
      setError(error.message);
      setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, status: currentStatus } : t)));
    }
  }

  async function toggleTask(taskId: string, currentStatus: string) {
    if (!user) return;
    const newStatus = currentStatus === "done" ? "todo" : "done";

    setTasks((prev) =>
      newStatus === "done" ? prev.filter((t) => t.id !== taskId) : prev,
    );

    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", taskId);
    if (error) {
      setError(error.message);
      return;
    }

    await supabase.from("activity_log").insert({
      actor_id: user.id,
      action: "status_changed",
      entity_type: "task",
      entity_id: taskId,
      detail:
        newStatus === "done"
          ? "একটা টাস্ক সম্পন্ন করা হয়েছে"
          : "একটা টাস্ক আবার খোলা হয়েছে",
    });
  }

  async function handleDeleteActivity(id: string) {
    if (!window.confirm("এই অ্যাক্টিভিটি এন্ট্রিটা ডিলিট করতে চান? এটা ফিরিয়ে আনা যাবে না।")) return;
    setActivity((prev) => prev.filter((a) => a.id !== id));
    const { error: err } = await supabase.from("activity_log").delete().eq("id", id);
    if (err) setError(err.message);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const displayName = profile?.full_name ?? user.email ?? "ব্যবহারকারী";
  // the full name, each word capitalised; an email falls back to the part before the @ ("kawsar.edux@…" becomes "Kawsar Edux")
  const firstName = displayName
    .split("@")[0]
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || displayName;
  const insights = buildInsights(kpis.overdue, workload, projects);
  const statusSegs = statusCounts(chartTasks);
  const due = dueNextDays(chartTasks, todayISO());
  const completions = completionsByDay(chartTasks, todayISO());
  const projStatusSegs = projectStatusCounts(chartProjects);
  const projProgress = projectProgress(chartProjects, chartTasks);
  const projDue = projectsDueWeeks(chartProjects, todayISO());

  const kpiCards: {
    icon: IconName;
    iconTone?: "danger" | "positive" | "warning" | "info";
    value: string;
    label: string;
    href: string;
    percent?: number;
    hint: string;
    hintTone: "good" | "warn" | "bad" | "neutral";
  }[] = [
    {
      icon: "kpi-projects",
      value: String(kpis.activeProjects),
      label: "Active Projects",
      href: "/projects",
      hint: kpis.activeProjects > 0 ? "In progress now" : "No active projects",
      hintTone: "neutral",
    },
    {
      icon: "kpi-tasks",
      iconTone: "info",
      value: String(kpis.pendingTasks),
      label: "Pending Tasks",
      href: "/tasks",
      hint: kpis.pendingTasks > 0 ? "Open and waiting" : "Nothing waiting",
      hintTone: "neutral",
    },
    {
      icon: "kpi-timer",
      iconTone: "warning",
      value: String(kpis.dueToday),
      label: "Due Today",
      href: "/tasks",
      hint: kpis.dueToday > 0 ? "Finish before tonight" : "Nothing due today",
      hintTone: kpis.dueToday > 0 ? "warn" : "good",
    },
    {
      icon: "kpi-alert",
      iconTone: "danger",
      value: String(kpis.overdue),
      label: "Overdue Tasks",
      href: "/tasks",
      hint: kpis.overdue > 0 ? "Needs attention" : "All on time",
      hintTone: kpis.overdue > 0 ? "bad" : "good",
    },
    {
      icon: "kpi-team",
      iconTone: "positive",
      value: String(kpis.teamCount),
      label: "Team Members",
      href: "/team",
      hint: "On the team",
      hintTone: "neutral",
    },
    {
      icon: "kpi-chart",
      value: `${kpis.completion}%`,
      label: "Completion Rate",
      href: "/tasks",
      percent: kpis.completion,
      hint: kpis.completion >= 70 ? "Great pace" : kpis.completion >= 40 ? "Making progress" : "Just getting started",
      hintTone: kpis.completion >= 70 ? "good" : "neutral",
    },
  ];

  const KPI_TONE_STYLE: Record<string, { bg: string; fg: string }> = {
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
    positive: { bg: "var(--positive-soft)", fg: "var(--positive)" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
    info: { bg: "color-mix(in srgb, #2189d9 12%, var(--surface))", fg: "#2189d9" },
  };

  const cmdkItems: { icon: IconName; label: string }[] = [
    { icon: "plus", label: "নতুন টাস্ক তৈরি করুন" },
    { icon: "folder-plus", label: "নতুন প্রজেক্ট তৈরি করুন" },
    ...projects
      .slice(0, 3)
      .map((p) => ({ icon: "folder" as IconName, label: p.name })),
    { icon: "users", label: "টিম মেম্বার দেখুন" },
  ];

  return (
    <>
      {/* ---- TOPBAR ---- */}
      {/* ---- CONTENT ---- */}
      <main className="content">
            {(() => {
              const g = greetingEn();
              const ringR = 40;
              const ringC = 2 * Math.PI * ringR;
              const pct = Math.max(0, Math.min(100, kpis.completion));
              const focus = dataLoading
                ? "Loading today's numbers…"
                : kpis.overdue > 0
                  ? `${plural(kpis.overdue, 'task is', 'tasks are')} overdue${kpis.dueToday > 0 ? ` and ${plural(kpis.dueToday, 'more is', 'more are')} due today` : ''}. Let's clear them first.`
                  : kpis.dueToday > 0
                    ? `${plural(kpis.dueToday, 'task is', 'tasks are')} due today. Nothing is overdue.`
                    : 'Nothing is due today and nothing is overdue. A good day to plan ahead.';
              return (
                <section className="wc" aria-label="Welcome">
                  <div className="wc-main">
                    <div className="wc-date">
                      <span className="wc-date-icon"><Icon name={g.night ? 'moon' : 'sun'} size={14} /></span>
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div className="wc-title-row">
                      <Avatar person={profile} size={56} />
                      <h1 className="wc-title">
                        {g.text},<br />
                        <span>{firstName}</span>
                      </h1>
                    </div>
                    <p className="wc-focus">{focus}</p>
                    <div className="wc-actions">
                      <Link className="btn btn-accent" href="/tasks"><Icon name="checklist" size={14} /> View tasks</Link>
                      <Link className="btn btn-ghost" href="/projects"><Icon name="folder" size={14} /> Open projects</Link>
                    </div>
                  </div>

                  <div className="wc-pulse">
                    <div className="wc-ring" role="img" aria-label={`${pct}% of tasks completed`}>
                      <svg viewBox="0 0 100 100" width="116" height="116">
                        <circle cx="50" cy="50" r={ringR} fill="none" stroke="var(--border-soft)" strokeWidth="9" />
                        {pct > 0 && (
                          <circle cx="50" cy="50" r={ringR} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC - (ringC * pct) / 100} transform="rotate(-90 50 50)" />
                        )}
                      </svg>
                      <div className="wc-ring-center">
                        <strong className="tabular">{dataLoading ? '—' : `${pct}%`}</strong>
                        <span>complete</span>
                      </div>
                    </div>
                    <ul className="wc-stats">
                      <li><i style={{ background: 'var(--warning)' }} />Due today<b className="tabular">{dataLoading ? '—' : kpis.dueToday}</b></li>
                      <li><i style={{ background: 'var(--danger)' }} />Overdue<b className="tabular">{dataLoading ? '—' : kpis.overdue}</b></li>
                      <li><i style={{ background: 'var(--accent)' }} />Pending<b className="tabular">{dataLoading ? '—' : kpis.pendingTasks}</b></li>
                    </ul>
                  </div>
                </section>
              );
            })()}

            {error && (
              <div
                style={{
                  marginBottom: 20,
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {/* KPI GRID */}
            <section className="kpi-grid" aria-label="মূল সূচক">
              {kpiCards.map((card) => {
                const tone = card.iconTone ? KPI_TONE_STYLE[card.iconTone] : null;
                return (
                  <div className="kpi-card" key={card.label} style={{ ["--kpi-tone" as string]: tone ? tone.fg : "var(--accent)" }}>
                    <div className="kpi-top">
                      <div className="kpi-icon" style={tone ? { background: tone.bg, color: tone.fg } : undefined}>
                        <Icon name={card.icon} size={18} />
                      </div>
                      <Link className="kpi-menu-link" href={card.href} aria-label={`${card.label} details`}>
                        <Icon name="arrow" size={14} />
                      </Link>
                    </div>
                    <div className="kpi-main">
                      <div className="kpi-text">
                        <div className="kpi-value tabular">{dataLoading ? "—" : card.value}</div>
                        <div className="kpi-label">{card.label}</div>
                      </div>
                      {card.percent !== undefined && (
                        <div className="kpi-ring-wrap" aria-hidden="true">
                          <svg width={46} height={46} viewBox="0 0 64 64">
                            <defs>
                              <linearGradient id="kpi-ring-grad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="var(--accent)" />
                                <stop offset="100%" stopColor="#2189d9" />
                              </linearGradient>
                            </defs>
                            <circle cx={32} cy={32} r={27} fill="none" stroke="var(--accent-soft)" strokeWidth={6} />
                            {card.percent > 0 && (
                              <circle
                                cx={32}
                                cy={32}
                                r={27}
                                fill="none"
                                stroke="url(#kpi-ring-grad)"
                                strokeWidth={6}
                                strokeLinecap="round"
                                strokeDasharray={169.65}
                                strokeDashoffset={169.65 - (Math.min(card.percent, 100) / 100) * 169.65}
                                transform="rotate(-90 32 32)"
                              />
                            )}
                            <circle cx={32} cy={32} r={19} fill="var(--accent-soft)" />
                          </svg>
                          <span className="kpi-ring-icon"><Icon name="kpi-chart" size={12} /></span>
                        </div>
                      )}
                    </div>
                    <div className={`kpi-foot hint-${card.hintTone}`}>
                      <i />
                      {dataLoading ? "Loading…" : card.hint}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* MY TASKS + INSIGHTS */}
            <div className="grid-2col top-row">
              <div>
                {/* My Tasks */}
                <section className="panel mt">
                  <div className="mt-head">
                    <span className="mt-badge"><Icon name="checklist" size={16} /></span>
                    <div className="mt-head-text">
                      <div className="mt-title">My Tasks</div>
                      <div className="mt-sub">{dataLoading ? 'Loading…' : tasks.length === 0 ? 'Nothing left to do' : `${plural(tasks.length, 'task', 'tasks')} to finish`}</div>
                    </div>
                    <Link className="mt-all" href="/tasks">
                      View all <span className="mt-all-go"><Icon name="chevron-right" size={13} /></span>
                    </Link>
                  </div>

                  <div className="mt-body">
                    {dataLoading ? (
                      <p className="mt-empty">Loading…</p>
                    ) : tasks.length === 0 ? (
                      <div className="mt-empty-card">
                        <span className="mt-empty-icon"><Icon name="check" size={18} /></span>
                        <strong>You&apos;re all caught up</strong>
                        <span>No open tasks are assigned to you.</span>
                      </div>
                    ) : (
                      <ul className="mt-list">
                        {tasks.map((task) => {
                          const due = dueLabel(task.due_date);
                          const items = checklists[task.id] ?? [];
                          const doneCount = items.filter((it) => it.is_done).length;
                          return (
                            <li className="mt-item" key={task.id}>
                              <div className="mt-row">
                                <button className="mt-check" aria-label="Mark as done" onClick={() => toggleTask(task.id, task.status)}>
                                  <Icon name="check" size={12} />
                                </button>
                                <Link href={`/tasks?task=${task.id}`} className="mt-main">
                                  <span className="mt-task-title">{task.title}</span>
                                  <span className="mt-meta">
                                    <span className="mt-project">{task.projects?.name ?? 'No project'}</span>
                                    <span className="mt-prio" style={{ ['--prio' as string]: PRIORITY_COLOR[task.priority] }}>
                                      <i />{task.priority}
                                    </span>
                                    {items.length > 0 && (
                                      <span className="mt-sub-count tabular">
                                        <Icon name="checklist" size={12} /> {doneCount}/{items.length}
                                      </span>
                                    )}
                                  </span>
                                </Link>
                                <span className={`mt-due${due.cls ? ` ${due.cls}` : ''}`}>{due.text}</span>
                              </div>
                              {items.length > 0 && (
                                <ul className="mt-subs">
                                  {items.slice(0, 5).map((it) => (
                                    <li key={it.id} className={it.is_done ? 'is-done' : undefined}>
                                      <button
                                        type="button"
                                        className={`task-check-box${it.is_done ? ' done' : ''}`}
                                        aria-label={it.is_done ? 'Mark as not done' : 'Mark as done'}
                                        aria-pressed={it.is_done}
                                        onClick={() => toggleChecklistItem(task.id, it.id, it.is_done)}
                                      ></button>
                                      <span>{it.label}</span>
                                    </li>
                                  ))}
                                  {items.length > 5 && (
                                    <li className="task-checklist-more">
                                      <Link href={`/tasks?task=${task.id}`}>+{items.length - 5} more</Link>
                                    </li>
                                  )}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="mt-todo">
                      <div className="mt-todo-head">
                        <span className="mt-todo-title">Today&apos;s To-Do</span>
                        <span className="mt-todo-count tabular">{todos.filter((t) => t.status === 'completed').length}/{todos.length} done</span>
                        <Link className="mt-all" href="/todos">
                          View all <span className="mt-all-go"><Icon name="chevron-right" size={13} /></span>
                        </Link>
                      </div>
                      {!dataLoading && todos.length === 0 ? (
                        <p className="mt-empty">No to-dos for today</p>
                      ) : (
                        <ul className="mt-list">
                          {todos.map((todo) => {
                            const done = todo.status === 'completed';
                            return (
                              <li className="mt-item" key={todo.id}>
                                <div className="mt-row">
                                  <button className={`mt-check${done ? ' done' : ''}`} aria-label={done ? 'Mark as not done' : 'Mark as done'} onClick={() => toggleTodo(todo.id, todo.status)}>
                                    <Icon name="check" size={12} />
                                  </button>
                                  <Link href="/todos" className="mt-main">
                                    <span className={`mt-task-title${done ? ' done' : ''}`}>{todo.title}</span>
                                    <span className="mt-meta">
                                      <span className="mt-project">{todo.projects?.name ?? 'No project'}</span>
                                      <span className="mt-prio" style={{ ['--prio' as string]: PRIORITY_COLOR[todo.priority === 'medium' ? 'normal' : todo.priority] }}>
                                        <i />{todo.priority === 'medium' ? 'normal' : todo.priority}
                                      </span>
                                    </span>
                                  </Link>
                                  <span className="mt-due">{todo.due_time ? formatTimeBn(todo.due_time) : 'Today'}</span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              </div>
              <div>
                {/* Insights */}
                <section className="ai-card">
                  <div className="ai-head">
                    <div className="ai-badge">
                      <Icon name="spark" size={15} />
                    </div>
                    <div className="ai-head-text">
                      <div className="ai-title">Insights</div>
                      <div className="ai-sub">Based on your live tasks and projects</div>
                    </div>
                    <span className="ai-count tabular">{dataLoading ? '—' : insights.length}</span>
                  </div>
                  <div className="ai-list">
                    {insights.map((it, i) => (
                      <Link className={`ai-item tone-${it.tone}`} href={it.href} key={i}>
                        <span className="ai-item-icon"><Icon name={it.icon} size={16} /></span>
                        <span className="ai-item-body">
                          <span className="ai-item-title">{it.title}</span>
                          <span className="ai-item-text">{it.text}</span>
                        </span>
                        <span className="ai-item-go" aria-hidden="true"><Icon name="chevron-right" size={14} /></span>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* TASK ANALYTICS */}
            {(() => {
              const taskTotal = statusSegs.reduce((n, x) => n + x.count, 0);
              const doneTotal = statusSegs.find((x) => x.key === 'done')?.count ?? 0;
              const donePct = taskTotal > 0 ? Math.round((doneTotal / taskTotal) * 100) : 0;
              const completedRecent = completions.reduce((n, x) => n + x.value, 0);
              const dueTotal = due.buckets.reduce((n, x) => n + x.tasks, 0);
              return (
                <section className="an" aria-label="Task analytics">
                  <div className="an-head">
                    <span className="an-badge"><Icon name="kpi-chart" size={16} /></span>
                    <div className="an-head-text">
                      <h2 className="an-title">Task Analytics</h2>
                      <div className="an-sub">How the team&apos;s work is moving, from live task data</div>
                    </div>
                    <div className="an-pills">
                      <span className="an-pill"><b className="tabular">{dataLoading ? '—' : taskTotal}</b> tasks</span>
                      <span className="an-pill good"><b className="tabular">{dataLoading ? '—' : `${donePct}%`}</b> done</span>
                    </div>
                  </div>

                  <div className="an-grid">
                    <div className="an-card">
                      <div className="an-card-head">
                        <span className="an-icon"><Icon name="kpi-tasks" size={15} /></span>
                        <div className="an-card-text">
                          <div className="an-card-title">Task status</div>
                          <div className="an-card-sub">Where every task stands</div>
                        </div>
                        <span className="an-stat tabular">{dataLoading ? '—' : taskTotal}</span>
                      </div>
                      <div className="an-card-body">
                        {dataLoading ? <p className="chart-loading">Loading…</p> : <StatusBar segments={statusSegs} />}
                      </div>
                    </div>

                    <div className="an-card">
                      <div className="an-card-head">
                        <span className="an-icon"><Icon name="check" size={15} /></span>
                        <div className="an-card-text">
                          <div className="an-card-title">Completed tasks</div>
                          <div className="an-card-sub">Marked done each day, last 14 days</div>
                        </div>
                        <span className="an-stat tabular">{dataLoading ? '—' : completedRecent}</span>
                      </div>
                      <div className="an-card-body">
                        {dataLoading ? <p className="chart-loading">Loading…</p> : <TrendChart points={completions} />}
                      </div>
                    </div>

                    <div className="an-card">
                      <div className="an-card-head">
                        <span className="an-icon"><Icon name="calendar" size={15} /></span>
                        <div className="an-card-text">
                          <div className="an-card-title">Due in the next 7 days</div>
                          <div className="an-card-sub">Open tasks due per day, whole team</div>
                        </div>
                        <span className="an-stat tabular">{dataLoading ? '—' : dueTotal}</span>
                      </div>
                      <div className="an-card-body">
                        {dataLoading ? (
                          <p className="chart-loading">Loading…</p>
                        ) : (
                          <OutlookChart buckets={due.buckets} undated={due.later} caption="Open tasks due per day · whole team" periodLabel="Day" showHours={false} />
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* PROJECT ANALYTICS */}
            {(() => {
              const projTotal = projStatusSegs.reduce((n, x) => n + x.count, 0);
              const projDone = projStatusSegs.find((x) => x.key === 'completed')?.count ?? 0;
              const projActive = projStatusSegs.find((x) => x.key === 'active')?.count ?? 0;
              const projDueTotal = projDue.buckets.reduce((n, x) => n + x.tasks, 0);
              return (
                <section className="an" aria-label="Project analytics">
                  <div className="an-head">
                    <span className="an-badge"><Icon name="kpi-projects" size={16} /></span>
                    <div className="an-head-text">
                      <h2 className="an-title">Project Analytics</h2>
                      <div className="an-sub">Where every project stands and what is due soon</div>
                    </div>
                    <div className="an-pills">
                      <span className="an-pill"><b className="tabular">{dataLoading ? '—' : projTotal}</b> projects</span>
                      <span className="an-pill good"><b className="tabular">{dataLoading ? '—' : projActive}</b> active</span>
                    </div>
                  </div>

                  <div className="an-grid">
                    <div className="an-card">
                      <div className="an-card-head">
                        <span className="an-icon"><Icon name="kpi-projects" size={15} /></span>
                        <div className="an-card-text">
                          <div className="an-card-title">Project status</div>
                          <div className="an-card-sub">{dataLoading ? '' : `${projDone} of ${projTotal} completed`}</div>
                        </div>
                        <span className="an-stat tabular">{dataLoading ? '—' : projTotal}</span>
                      </div>
                      <div className="an-card-body">
                        {dataLoading ? <p className="chart-loading">Loading…</p> : <DonutChart segments={projStatusSegs} noun="project" />}
                      </div>
                    </div>

                    <div className="an-card">
                      <div className="an-card-head">
                        <span className="an-icon"><Icon name="kpi-tasks" size={15} /></span>
                        <div className="an-card-text">
                          <div className="an-card-title">Project progress</div>
                          <div className="an-card-sub">Least finished first</div>
                        </div>
                        <span className="an-stat tabular">{dataLoading ? '—' : projProgress.length}</span>
                      </div>
                      <div className="an-card-body">
                        {dataLoading ? <p className="chart-loading">Loading…</p> : <ProjectProgress rows={projProgress} />}
                      </div>
                    </div>

                    <div className="an-card">
                      <div className="an-card-head">
                        <span className="an-icon"><Icon name="calendar" size={15} /></span>
                        <div className="an-card-text">
                          <div className="an-card-title">Project deadlines</div>
                          <div className="an-card-sub">Open projects due per week</div>
                        </div>
                        <span className="an-stat tabular">{dataLoading ? '—' : projDueTotal}</span>
                      </div>
                      <div className="an-card-body">
                        {dataLoading ? (
                          <p className="chart-loading">Loading…</p>
                        ) : (
                          <OutlookChart buckets={projDue.buckets} undated={projDue.later} caption="Open projects due per week" periodLabel="Week" showHours={false} noun="project" />
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* TWO COLUMN LAYOUT */}
            <div className="grid-2col bottom-row">
              {/* LEFT COLUMN */}
              <div>
                {/* Project Overview */}
                <section className="panel mt">
                  <div className="mt-head">
                    <span className="mt-badge"><Icon name="kpi-projects" size={16} /></span>
                    <div className="mt-head-text">
                      <div className="mt-title">Project Overview</div>
                      <div className="mt-sub">{dataLoading ? 'Loading…' : `${kpis.activeProjects} active of ${plural(projects.length, 'project', 'projects')}`}</div>
                    </div>
                    <Link className="mt-all" href="/projects">
                      View all <span className="mt-all-go"><Icon name="chevron-right" size={13} /></span>
                    </Link>
                  </div>
                  <div className="panel-body pcard-list">
                    {dataLoading ? (
                      <p className="mt-empty">Loading…</p>
                    ) : projects.length === 0 ? (
                      <p className="mt-empty">No projects yet.</p>
                    ) : (
                      projects.map((p) => {
                        const chip = PROJECT_CHIP[p.status] ?? {
                          cls: "chip-progress",
                          label: p.status,
                        };
                        const avatars = p.avatars.length > 0
                          ? p.avatars
                          : p.manager
                            ? [p.manager]
                            : [];
                        const visibleAvatars = avatars.slice(0, 4);
                        const extraAvatars = avatars.length - visibleAvatars.length;
                        return (
                          <Link href={`/projects/${p.id}`} className={`pcard is-${p.status}`} key={p.id}>
                            <div className="pcard-top">
                              <div className="project-icon">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="pcard-title">
                                <div className="project-name">{p.name}</div>
                                <div className="pcard-client">{p.clients?.company_name ?? "—"}</div>
                              </div>
                              <span className={`status-dot-pill ${chip.cls}`}>
                                <span className="status-dot"></span>
                                {chip.label}
                              </span>
                            </div>
                            <div className="pcard-mid2">
                              <div className="pcard-ring" aria-label={`${p.progress ?? 0}% complete`}>
                                <svg width={64} height={64} viewBox="0 0 64 64">
                                  <defs>
                                    <linearGradient id="pcard-ring-grad" x1="0" y1="0" x2="1" y2="1">
                                      <stop offset="0%" stopColor="var(--accent)" />
                                      <stop offset="100%" stopColor="#2189d9" />
                                    </linearGradient>
                                  </defs>
                                  <circle cx={32} cy={32} r={27} fill="none" stroke="var(--accent-soft)" strokeWidth={6} />
                                  {(p.progress ?? 0) > 0 && (
                                    <circle
                                      cx={32}
                                      cy={32}
                                      r={27}
                                      fill="none"
                                      stroke={chip.cls === "chip-overdue" ? "var(--danger)" : chip.cls === "chip-done" ? "var(--positive)" : "url(#pcard-ring-grad)"}
                                      strokeWidth={6}
                                      strokeLinecap="round"
                                      strokeDasharray={169.65}
                                      strokeDashoffset={169.65 - (Math.min(p.progress ?? 0, 100) / 100) * 169.65}
                                      transform="rotate(-90 32 32)"
                                    />
                                  )}
                                  <circle cx={32} cy={32} r={19} fill="var(--accent-soft)" />
                                </svg>
                                <span className="pcard-ring-pct tabular">{p.progress ?? 0}%</span>
                              </div>
                              <div className="pcard-facts">
                                <div className="pcard-fact">
                                  <span className="pcard-fact-label">Tasks</span>
                                  <span className="pcard-fact-value tabular"><b>{p.doneCount}</b> / {p.taskCount} done</span>
                                </div>
                                <div className="pcard-fact">
                                  <span className="pcard-fact-label">Deadline</span>
                                  {p.due_date ? (
                                    <span className={`pcard-fact-value${p.status !== "completed" && p.due_date < todayISO() ? " is-overdue" : ""}`}>
                                      {new Date(p.due_date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                                      {p.status !== "completed" && p.due_date < todayISO() && " · Overdue"}
                                    </span>
                                  ) : (
                                    <span className="pcard-fact-value muted">Not set</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="pcard-bottom">
                              {visibleAvatars.length > 0 ? (
                                <div className="avatar-stack">
                                  {visibleAvatars.map((a, i) => (
                                    <Avatar key={i} person={a} size={26} />
                                  ))}
                                  {extraAvatars > 0 && (
                                    <div className="avatar avatar-more" style={{ width: 26, height: 26, fontSize: 10 }}>
                                      +{extraAvatars}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span></span>
                              )}
                              <div className="pcard-stats">
                                <span className="pcard-stat" title="Discussions">
                                  <Icon name="message" size={13} /> <b className="tabular">{p.discussionCount}</b>
                                </span>
                                <span className="pcard-stat" title="Files">
                                  <Icon name="file" size={13} /> <b className="tabular">{p.fileCount}</b>
                                </span>
                              </div>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Activity Feed */}
                <section className="panel mt">
                  <div className="mt-head">
                    <span className="mt-badge"><Icon name="clock" size={16} /></span>
                    <div className="mt-head-text">
                      <div className="mt-title">Activity Feed</div>
                      <div className="mt-sub">Latest updates from the team</div>
                    </div>
                    {!dataLoading && activity.length > 0 && <span className="ai-count tabular">{activity.length}</span>}
                  </div>
                  <div className="act2-body">
                    {dataLoading ? (
                      <p className="mt-empty">Loading…</p>
                    ) : activity.length === 0 ? (
                      <p className="mt-empty">No activity yet.</p>
                    ) : (
                      (['Today', 'Yesterday', 'Earlier'] as const).map((group) => {
                        const rows = activity.filter((a) => activityGroup(a.created_at) === group);
                        if (rows.length === 0) return null;
                        return (
                          <div className="act2-group" key={group}>
                            <div className="act2-group-label">{group}</div>
                            <ul className="act2-list">
                              {rows.map((a) => {
                                const meta = activityMeta(a.action);
                                return (
                                  <li className="act2-row" key={a.id}>
                                    <span className={`act2-icon ${meta.cls}`}>
                                      <Icon name={meta.icon} size={14} />
                                    </span>
                                    <div className="act2-body-text">
                                      <div className="act2-text">
                                        <b>{a.profiles?.full_name ?? "Someone"}</b> {a.detail}
                                      </div>
                                      <div className="act2-time">{agoEn(a.created_at)}</div>
                                    </div>
                                    {profile?.is_admin && (
                                      <button className="act2-delete" onClick={() => handleDeleteActivity(a.id)} aria-label="Delete" title="Delete">
                                        <Icon name="trash" size={13} />
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN */}
              <div>
                {/* Team Workload */}
                <section className="panel mt">
                  <div className="mt-head">
                    <span className="mt-badge"><Icon name="kpi-team" size={16} /></span>
                    <div className="mt-head-text">
                      <div className="mt-title">Team Workload</div>
                      <div className="mt-sub">Open tasks per person · 5 is a full load</div>
                    </div>
                    <Link className="mt-all" href="/team">
                      View team <span className="mt-all-go"><Icon name="chevron-right" size={13} /></span>
                    </Link>
                  </div>
                  <div className="wl2-body">
                    {dataLoading ? (
                      <p className="mt-empty">Loading…</p>
                    ) : workload.length === 0 ? (
                      <p className="mt-empty">No tasks are assigned yet.</p>
                    ) : (
                      <WorkloadChart data={workload} />
                    )}
                  </div>
                </section>

                {/* Calendar Preview */}
                <section className="panel">
                  <div className="panel-head">
                    <span className="panel-title">আজকের সময়সূচি</span>
                  </div>
                  <div className="panel-body">
                    {dataLoading ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--ink-faint)",
                        }}
                      >
                        লোড হচ্ছে…
                      </p>
                    ) : meetings.length === 0 ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--ink-faint)",
                        }}
                      >
                        আজ কোনো মিটিং নেই।
                      </p>
                    ) : (
                      meetings.map((m) => (
                        <div className="cal-row" key={m.id}>
                          <span className="cal-time tabular">
                            {formatTimeBn(m.meeting_time) || "—"}
                          </span>
                          <span className="cal-dot"></span>
                          <span className="cal-title">{m.title}</span>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Quick Actions */}
                <section className="panel mt">
                  <div className="mt-head">
                    <span className="mt-badge"><Icon name="spark" size={16} /></span>
                    <div className="mt-head-text">
                      <div className="mt-title">Quick Actions</div>
                      <div className="mt-sub">Jump straight to common tasks</div>
                    </div>
                  </div>
                  <div className="qa-grid">
                    {QUICK_ACTIONS.map((qa) => {
                      const inner = (
                        <>
                          <span className="qa-icon">
                            <Icon name={qa.icon} size={16} />
                          </span>
                          <span className="qa-label">{qa.label}</span>
                          <span className="qa-go" aria-hidden="true"><Icon name="arrow" size={12} /></span>
                        </>
                      );
                      return qa.href ? (
                        <a className="qa-btn" key={qa.label} href={qa.href}>{inner}</a>
                      ) : (
                        <button className="qa-btn" key={qa.label} type="button">{inner}</button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </main>
      {/* Command Palette */}
      <div
        className={`cmdk-overlay${cmdkOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="কমান্ড সার্চ"
        onClick={(e) => {
          if (e.target === e.currentTarget) setCmdkOpen(false);
        }}
      >
        <div className="cmdk-box">
          <div className="cmdk-input-row">
            <Icon name="search" />
            <input
              type="text"
              placeholder="প্রজেক্ট, টাস্ক বা কমান্ড খুঁজুন..."
              autoFocus={cmdkOpen}
            />
            <span className="kbd">Esc</span>
          </div>
          <div className="cmdk-results">
            {cmdkItems.map((item, i) => (
              <div
                className={`cmdk-item${i === 0 ? " sel" : ""}`}
                key={`${item.label}-${i}`}
              >
                <Icon name={item.icon} /> {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
