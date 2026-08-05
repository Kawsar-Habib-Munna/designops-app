"use client";

// Dashboard — lib/supabaseClient.ts দিয়ে রিয়েল Supabase ডেটা: projects, tasks,
// activity_log, meetings, profiles। RLS পলিসি অনুযায়ী sign-in করা authenticated
// ইউজার লাগবে (lib/useSession.ts + SignInScreen)।

import { useEffect, useState } from "react";
import Link from "next/link";
import "./dashboard.css";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/lib/useSession";
import { formatBnDate, formatTimeBn, dueMeta, todayISO } from "@/lib/format";
import SignInScreen from "@/app/components/SignInScreen";
import ProfileMenu from "@/app/components/ProfileMenu";

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder:
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
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
  upload:
    '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  message:
    '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  "user-plus":
    '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  spark:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  "folder-plus":
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/><path d="M12 11v4"/><path d="M10 13h4"/>',
  video:
    '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
};

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

const NAV_ITEMS: {
  icon: IconName;
  label: string;
  href: string;
  active?: boolean;
}[] = [
  { icon: "grid", label: "Dashboard", href: "/dashboard", active: true },
  { icon: "folder", label: "Projects", href: "/projects" },
  { icon: "check", label: "Tasks", href: "/tasks" },
  { icon: "calendar", label: "Calendar", href: "/calendar" },
  { icon: "users", label: "Team", href: "/team" },
  { icon: "building", label: "Clients", href: "#" },
  { icon: "file", label: "Files", href: "/files" },
  { icon: "message", label: "Discussions", href: "/discussions" },
  { icon: "bar", label: "Reports", href: "#" },
];

const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: "bell", label: "Notifications", href: "#" },
  { icon: "settings", label: "Settings", href: "#" },
];

const QUICK_ACTIONS: { icon: IconName; label: string; href?: string }[] = [
  { icon: "folder-plus", label: "নতুন প্রজেক্ট" },
  { icon: "plus", label: "টাস্ক তৈরি", href: "/tasks" },
  { icon: "user-plus", label: "মেম্বার ইনভাইট" },
  { icon: "upload", label: "ফাইল আপলোড" },
  { icon: "video", label: "মিটিং শুরু" },
  { icon: "bar", label: "রিপোর্ট বানান" },
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
};

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  due_date: string | null;
  clients: { company_name: string } | null;
  manager: { full_name: string; avatar_color: string | null } | null;
};

type DashTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 16) return "Good Noon";
  if (h < 19) return "Good Afternoon";
  return "Good Evening";
}

function buildInsights(
  overdue: number,
  workload: WorkloadEntry[],
  projects: ProjectRow[],
) {
  const list: string[] = [];
  if (overdue > 0)
    list.push(`${overdue}টা টাস্ক ডেডলাইন মিস করেছে — এগুলো আগে দেখুন।`);
  if (workload[0]) {
    list.push(
      `${workload[0].name}-এর workload টিমে সবচেয়ে বেশি (${workload[0].count}টা টাস্ক) — নতুন টাস্ক অন্য কাউকে দিন।`,
    );
  }
  const weekFromNow = Date.now() + 7 * 86400000;
  const atRisk = projects.find(
    (p) =>
      p.status === "active" &&
      (p.progress ?? 0) < 50 &&
      p.due_date &&
      new Date(p.due_date).getTime() < weekFromNow,
  );
  if (atRisk)
    list.push(`${atRisk.name} প্রজেক্ট বর্তমান গতিতে ডেডলাইন মিস করতে পারে।`);
  if (list.length === 0)
    list.push("এই মুহূর্তে কোনো জরুরি সতর্কতা নেই — সব ট্র্যাকে আছে।");
  return list;
}

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useSession();

  const [dark, setDark] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

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
        tasksRes,
        activityRes,
        workloadRes,
        meetingsRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, avatar_color")
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
            "id, name, status, progress, due_date, clients(company_name), manager:profiles!project_manager_id(full_name, avatar_color)",
          )
          .order("due_date", { ascending: true })
          .limit(5),
        supabase.from("tasks").select("project_id, status").not("project_id", "is", null),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, projects(name)")
          .eq("assignee_id", user!.id)
          .neq("status", "done")
          .order("due_date", { ascending: true })
          .limit(6),
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
      for (const row of (projectTaskStatsRes.data as { project_id: string; status: string }[]) ?? []) {
        const cur = projectTaskStats.get(row.project_id) ?? { done: 0, total: 0 };
        cur.total += 1;
        if (row.status === "done") cur.done += 1;
        projectTaskStats.set(row.project_id, cur);
      }
      const projectsWithProgress = ((projectsRes.data as unknown as ProjectRow[]) ?? []).map((p) => {
        const stat = projectTaskStats.get(p.id);
        return { ...p, progress: stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0 };
      });
      setProjects(projectsWithProgress);
      setTasks((tasksRes.data as unknown as DashTask[]) ?? []);
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

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const displayName = profile?.full_name ?? user.email ?? "ব্যবহারকারী";
  const firstName = displayName.split(" ")[0];
  const avatarInitial = Array.from(firstName)[0]?.toUpperCase() ?? "?";
  const insights = buildInsights(kpis.overdue, workload, projects);

  const kpiCards: {
    icon: IconName;
    iconTone?: "danger" | "positive";
    value: string;
    label: string;
  }[] = [
    {
      icon: "folder",
      value: String(kpis.activeProjects),
      label: "Active Projects",
    },
    { icon: "check", value: String(kpis.pendingTasks), label: "Pending Tasks" },
    { icon: "clock", value: String(kpis.dueToday), label: "Due Today" },
    {
      icon: "alert",
      iconTone: "danger",
      value: String(kpis.overdue),
      label: "Overdue Tasks",
    },
    {
      icon: "users",
      iconTone: "positive",
      value: String(kpis.teamCount),
      label: "Team Members",
    },
    { icon: "bar", value: `${kpis.completion}%`, label: "Completion Rate" },
  ];

  const cmdkItems: { icon: IconName; label: string }[] = [
    { icon: "plus", label: "নতুন টাস্ক তৈরি করুন" },
    { icon: "folder-plus", label: "নতুন প্রজেক্ট তৈরি করুন" },
    ...projects
      .slice(0, 3)
      .map((p) => ({ icon: "folder" as IconName, label: p.name })),
    { icon: "users", label: "টিম মেম্বার দেখুন" },
  ];

  return (
    <div className={`dashboard-root${dark ? " dark" : ""}`}>
      <div className="shell">
        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar" aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark">DS</div>
              <div>
                <div className="brand-name">DesignOps</div>
                <div className="brand-sub">Studio Nine</div>
              </div>
            </div>

            <nav className="nav-group" aria-label="Sidebar">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`nav-item${item.active ? " active" : ""}`}
                  aria-current={item.active ? "page" : undefined}
                >
                  <span className="n-icon">
                    <Icon name={item.icon} />
                  </span>{" "}
                  {item.label}
                </a>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <a key={item.label} href={item.href} className="nav-item">
                  <span className="n-icon">
                    <Icon name={item.icon} />
                  </span>{" "}
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <ProfileMenu
            profile={profile}
            email={user.email ?? ""}
            onUpdated={setProfile}
          />
        </aside>

        {/* ============ MAIN ============ */}
        <div className="main">
          {/* ---- TOPBAR ---- */}
          <header className="topbar">
            <button
              className="search-box"
              onClick={() => setCmdkOpen(true)}
              aria-haspopup="dialog"
            >
              <Icon name="search" />
              <span style={{ flex: 1, textAlign: "left" }}>
                খুঁজুন — প্রজেক্ট, টাস্ক, মানুষ...
              </span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>

            <Link className="btn btn-accent" href="/tasks">
              <Icon name="plus" /> নতুন তৈরি করুন
            </Link>

            <button className="icon-btn" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
            </button>

            <button
              className="icon-btn"
              aria-label="থিম পরিবর্তন"
              onClick={() => setDark((d) => !d)}
            >
              <Icon name={dark ? "moon" : "sun"} />
            </button>

            <div
              className="avatar"
              style={{
                width: 30,
                height: 30,
                fontSize: 12,
                background: profile?.avatar_color ?? undefined,
              }}
            >
              {avatarInitial}
            </div>
          </header>

          {/* ---- CONTENT ---- */}
          <main className="content">
            <div className="welcome-row">
              <div>
                <h1 className="welcome-title">
                  {greeting()}, {firstName} 👋
                </h1>
                <p className="welcome-sub">
                  আজ টিমজুড়ে যা যা ঘটছে, তার সারসংক্ষেপ এখানে।
                </p>
              </div>
              <span className="date-chip">
                {new Date().toLocaleDateString("bn-BD", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>

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
              {kpiCards.map((card) => (
                <div className="kpi-card" key={card.label}>
                  <div className="kpi-top">
                    <div
                      className="kpi-icon"
                      style={
                        card.iconTone === "danger"
                          ? {
                              background: "var(--danger-soft)",
                              color: "var(--danger)",
                            }
                          : card.iconTone === "positive"
                            ? {
                                background: "var(--positive-soft)",
                                color: "var(--positive)",
                              }
                            : undefined
                      }
                    >
                      <Icon name={card.icon} />
                    </div>
                  </div>
                  <div className="kpi-value tabular">
                    {dataLoading ? "—" : card.value}
                  </div>
                  <div className="kpi-label">{card.label}</div>
                </div>
              ))}
            </section>

            {/* TWO COLUMN LAYOUT */}
            <div className="grid-2col">
              {/* LEFT COLUMN */}
              <div>
                {/* Project Overview */}
                <section className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      Project Overview{" "}
                      <span className="count">
                        · {kpis.activeProjects} active
                      </span>
                    </span>
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
                    ) : projects.length === 0 ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--ink-faint)",
                        }}
                      >
                        কোনো প্রজেক্ট নেই।
                      </p>
                    ) : (
                      projects.map((p) => {
                        const chip = PROJECT_CHIP[p.status] ?? {
                          cls: "chip-progress",
                          label: p.status,
                        };
                        return (
                          <Link
                            href={`/projects/${p.id}`}
                            className="project-row"
                            key={p.id}
                          >
                            <div className="project-icon">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="project-main">
                              <div className="project-name">{p.name}</div>
                              <div className="project-client">
                                {p.clients?.company_name ?? "—"}
                              </div>
                            </div>
                            <span className={`chip ${chip.cls}`}>
                              {chip.label}
                            </span>
                            <div className="project-progress-wrap">
                              <div className="progress-track">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${p.progress ?? 0}%`,
                                    ...(chip.cls === "chip-overdue"
                                      ? { background: "var(--danger)" }
                                      : {}),
                                  }}
                                ></div>
                              </div>
                              <div className="progress-num tabular">
                                {p.progress ?? 0}%
                              </div>
                            </div>
                            <div className="project-deadline">
                              {formatBnDate(p.due_date)}
                            </div>
                            {p.manager && (
                              <div className="avatar-stack">
                                <div
                                  className="avatar"
                                  style={{
                                    width: 24,
                                    height: 24,
                                    fontSize: 10,
                                    background:
                                      p.manager.avatar_color ?? undefined,
                                  }}
                                >
                                  {p.manager.full_name.charAt(0)}
                                </div>
                              </div>
                            )}
                          </Link>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* My Tasks */}
                <section className="panel">
                  <div className="panel-head">
                    <span className="panel-title">
                      My Tasks{" "}
                      <span className="count">· {tasks.length}টা বাকি</span>
                    </span>
                    <Link className="panel-link" href="/tasks">
                      সব দেখুন <Icon name="chevron-right" />
                    </Link>
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
                    ) : tasks.length === 0 ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--ink-faint)",
                        }}
                      >
                        আপনার নামে কোনো বাকি টাস্ক নেই 🎉
                      </p>
                    ) : (
                      tasks.map((task) => {
                        const due = dueMeta(task.due_date, task.status);
                        return (
                          <div className="task-row" key={task.id}>
                            <button
                              className="task-status-dot"
                              aria-label="সম্পন্ন হিসেবে চিহ্নিত করুন"
                              onClick={() => toggleTask(task.id, task.status)}
                            ></button>
                            <Link href={`/tasks?task=${task.id}`} className="task-main">
                              <div className="task-title">{task.title}</div>
                              <div className="task-meta">
                                <span
                                  className="priority-dot"
                                  style={{
                                    background: PRIORITY_COLOR[task.priority],
                                  }}
                                ></span>
                                <span className="task-project-tag">
                                  {task.projects?.name ?? "কোনো প্রজেক্ট নেই"}
                                </span>
                              </div>
                            </Link>
                            <div
                              className={`task-due${due.cls ? ` ${due.cls}` : ""}`}
                            >
                              {due.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Activity Feed */}
                <section className="panel">
                  <div className="panel-head">
                    <span className="panel-title">Activity Feed</span>
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
                    ) : activity.length === 0 ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--ink-faint)",
                        }}
                      >
                        এখনো কোনো অ্যাক্টিভিটি নেই।
                      </p>
                    ) : (
                      activity.map((a) => (
                        <div className="activity-row" key={a.id}>
                          <div className="activity-icon">
                            <Icon
                              name={
                                a.action === "task_created"
                                  ? "plus"
                                  : "check-circle"
                              }
                              size={14}
                            />
                          </div>
                          <div>
                            <div className="activity-text">
                              <b>{a.profiles?.full_name ?? "কেউ একজন"}</b>{" "}
                              {a.detail}
                            </div>
                            <div className="activity-time">
                              {new Date(a.created_at).toLocaleString("bn-BD")}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {/* RIGHT COLUMN */}
              <div>
                {/* Insights */}
                <section className="ai-card">
                  <div className="ai-head">
                    <div className="ai-badge">
                      <Icon name="spark" color="#fff" />
                    </div>
                    <div className="ai-title">ইনসাইট</div>
                  </div>
                  <div className="ai-list">
                    {insights.map((text, i) => (
                      <div className="ai-item" key={i}>
                        <span className="dot"></span> {text}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Team Workload */}
                <section className="panel">
                  <div className="panel-head">
                    <span className="panel-title">Team Workload</span>
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
                    ) : workload.length === 0 ? (
                      <p
                        style={{
                          padding: 16,
                          fontSize: 13,
                          color: "var(--ink-faint)",
                        }}
                      >
                        কোনো টাস্ক অ্যাসাইন করা নেই।
                      </p>
                    ) : (
                      workload.map((w) => {
                        const percent = Math.min(
                          100,
                          Math.round(
                            (w.count / (workload[0]?.count || 1)) * 100,
                          ),
                        );
                        return (
                          <div className="workload-row" key={w.name}>
                            <span className="workload-name">{w.name}</span>
                            <div className="workload-bar-wrap">
                              <div className="progress-track">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${percent}%`,
                                    background:
                                      percent >= 90
                                        ? "var(--danger)"
                                        : percent <= 30
                                          ? "var(--positive)"
                                          : undefined,
                                  }}
                                ></div>
                              </div>
                            </div>
                            <span className="workload-count tabular">
                              {w.count}
                            </span>
                          </div>
                        );
                      })
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
                <section className="panel">
                  <div className="panel-head">
                    <span className="panel-title">Quick Actions</span>
                  </div>
                  <div className="qa-grid">
                    {QUICK_ACTIONS.map((qa) =>
                      qa.href ? (
                        <a className="qa-btn" key={qa.label} href={qa.href}>
                          <div className="qa-icon">
                            <Icon name={qa.icon} size={14} />
                          </div>
                          <span className="qa-label">{qa.label}</span>
                        </a>
                      ) : (
                        <button className="qa-btn" key={qa.label} type="button">
                          <div className="qa-icon">
                            <Icon name={qa.icon} size={14} />
                          </div>
                          <span className="qa-label">{qa.label}</span>
                        </button>
                      ),
                    )}
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>

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
    </div>
  );
}
