"use client";

// Projects — সব প্রজেক্টের হালকা লিস্ট ভিউ, রিয়েল Supabase ডেটা (clients join),
// প্রতিটা কার্ড /projects/[id]-এ নিয়ে যায় (Project Details পেজ)। নতুন প্রজেক্ট
// তৈরি করার মডালও এখানেই — এটা ছাড়া প্রজেক্ট টেবিলে ডেটা ঢোকানোর কোনো উপায় ছিল না।

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import "./projects.css";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/lib/useSession";
import { todayISO } from "@/lib/format";
import SignInScreen from "@/app/components/SignInScreen";
import Avatar from "@/app/components/Avatar";
import { CURRENCIES, currencyLabel } from "@/lib/currency";
import RichTextField from "@/app/components/RichTextField";
import RichText from "@/app/components/RichText";
import DeadlineCalendar from "./DeadlineCalendar";

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder:
    '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
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
  message:
    '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers:
    '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  arrow: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}



const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  planning: { label: "Planning", cls: "s-todo" },
  active: { label: "Active", cls: "s-progress" },
  review: { label: "In review", cls: "s-review" },
  completed: { label: "Completed", cls: "s-done" },
  on_hold: { label: "On hold", cls: "s-todo" },
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
  description: string | null;
  clients: { company_name: string } | null;
  taskCount: number;
  discussionCount: number;
  fileCount: number;
  avatars: { full_name: string; avatar_color: string | null; avatar_url: string | null }[];
};

type ClientOption = { id: string; company_name: string };

export default function ProjectsListPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"due_date" | "name" | "progress">("due_date");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newCurrency, setNewCurrency] = useState("BDT");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [taskStats, setTaskStats] = useState<
    Record<string, { done: number; total: number }>
  >({});

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    clientId: "",
    status: "active",
    startDate: "",
    dueDate: "",
    budget: "",
    currency: "BDT",
    description: "",
  });
  // false when the projects.currency column does not exist yet (migration not run) — the edit form then leaves it alone
  const [editHasCurrency, setEditHasCurrency] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [projectsRes, clientsRes, profileRes, tasksRes, discussionsRes, attachmentsRes] =
        await Promise.all([
          supabase
            .from("projects")
            .select(
              "id, name, status, progress, due_date, description, clients(company_name)",
            )
            .order("due_date", { ascending: true }),
          supabase
            .from("clients")
            .select("id, company_name")
            .order("company_name"),
          supabase
            .from("profiles")
            .select("id, full_name, role, avatar_color, avatar_url, is_admin")
            .eq("id", user!.id)
            .single(),
          supabase
            .from("tasks")
            .select("project_id, status, assignee_id, profiles!assignee_id(full_name, avatar_color, avatar_url)")
            .not("project_id", "is", null),
          supabase.from("discussions").select("project_id").not("project_id", "is", null),
          supabase.from("attachments").select("task_id, folder_id, tasks(project_id), folders(project_id)"),
        ]);

      if (projectsRes.error) setError(projectsRes.error.message);
      setClientOptions((clientsRes.data as ClientOption[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

      const stats: Record<string, { done: number; total: number }> = {};
      const avatarsByProject = new Map<string, Map<string, { full_name: string; avatar_color: string | null; avatar_url: string | null }>>();
      for (const t of (tasksRes.data as unknown as {
        project_id: string;
        status: string;
        assignee_id: string | null;
        profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
      }[]) ?? []) {
        const cur = stats[t.project_id] ?? { done: 0, total: 0 };
        cur.total += 1;
        if (t.status === "done") cur.done += 1;
        stats[t.project_id] = cur;

        if (t.assignee_id && t.profiles) {
          const avatars = avatarsByProject.get(t.project_id) ?? new Map();
          avatars.set(t.assignee_id, t.profiles);
          avatarsByProject.set(t.project_id, avatars);
        }
      }
      setTaskStats(stats);

      const discussionCounts = new Map<string, number>();
      for (const row of (discussionsRes.data as { project_id: string }[]) ?? []) {
        discussionCounts.set(row.project_id, (discussionCounts.get(row.project_id) ?? 0) + 1);
      }

      const fileCounts = new Map<string, number>();
      for (const row of (attachmentsRes.data as unknown as {
        task_id: string | null;
        folder_id: string | null;
        tasks: { project_id: string | null } | null;
        folders: { project_id: string | null } | null;
      }[]) ?? []) {
        const projectId = row.tasks?.project_id ?? row.folders?.project_id ?? null;
        if (projectId) fileCounts.set(projectId, (fileCounts.get(projectId) ?? 0) + 1);
      }

      const projectsWithStats = ((projectsRes.data as unknown as ProjectRow[]) ?? []).map((p) => ({
        ...p,
        taskCount: stats[p.id]?.total ?? 0,
        discussionCount: discussionCounts.get(p.id) ?? 0,
        fileCount: fileCounts.get(p.id) ?? 0,
        avatars: Array.from((avatarsByProject.get(p.id) ?? new Map()).values()),
      }));
      setProjects(projectsWithStats);

      setLoading(false);
    }

    run();
  }, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !user) return;

    setCreating(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: newName.trim(),
        category: newCategory.trim() || null,
        client_id: newClientId || null,
        status: newStatus,
        start_date: newStartDate || null,
        due_date: newDueDate || null,
        budget: newBudget ? Number(newBudget) : null,
        ...(newCurrency !== "BDT" ? { currency: newCurrency } : {}),
        description: newDescription.trim() || null,
        project_manager_id: user.id,
        progress: 0,
      })
      .select("id, name, status, progress, due_date, clients(company_name)")
      .single();

    if (error) {
      setError(/currency/i.test(error.message) ? "The projects.currency column is missing — run the migration at the end of sql/schema.sql in Supabase, then try again." : error.message);
      setCreating(false);
      return;
    }

    if (data) {
      const row: ProjectRow = {
        ...(data as unknown as Omit<ProjectRow, "taskCount" | "discussionCount" | "fileCount" | "avatars">),
        description: newDescription.trim() || null,
        taskCount: 0,
        discussionCount: 0,
        fileCount: 0,
        avatars: [],
      };
      setProjects((prev) =>
        [...prev, row].sort((a, b) =>
          (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
        ),
      );
      await supabase.from("activity_log").insert({
        actor_id: user.id,
        action: "project_created",
        entity_type: "project",
        entity_id: row.id,
        detail: `"${row.name}" প্রজেক্ট তৈরি করা হয়েছে`,
      });
    }

    setNewName("");
    setNewCategory("");
    setNewClientId("");
    setNewStatus("active");
    setNewStartDate("");
    setNewDueDate("");
    setNewBudget("");
    setNewCurrency("BDT");
    setNewDescription("");
    setCreating(false);
    setShowCreate(false);
  }

  useEffect(() => {
    if (!openMenuId) return;
    function closeMenu() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openMenuId]);

  async function openEditModal(p: ProjectRow) {
    setOpenMenuId(null);
    setEditError(null);
    setEditingId(p.id);
    setEditLoading(true);
    let hasCurrency = true;
    let { data, error } = await supabase
      .from("projects")
      .select("id, name, category, client_id, status, start_date, due_date, budget, currency, description")
      .eq("id", p.id)
      .single();
    if (error && /currency/i.test(error.message)) {
      hasCurrency = false;
      ({ data, error } = await supabase
        .from("projects")
        .select("id, name, category, client_id, status, start_date, due_date, budget, description")
        .eq("id", p.id)
        .single());
    }
    setEditLoading(false);
    if (error || !data) {
      setEditError(error?.message ?? "লোড করা যায়নি।");
      return;
    }
    setEditHasCurrency(hasCurrency);
    setEditForm({
      name: data.name ?? "",
      category: data.category ?? "",
      clientId: data.client_id ?? "",
      status: data.status ?? "active",
      startDate: data.start_date ?? "",
      dueDate: data.due_date ?? "",
      budget: data.budget != null ? String(data.budget) : "",
      currency: (data as { currency?: string | null }).currency ?? "BDT",
      description: data.description ?? "",
    });
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm.name.trim() || !user) return;

    setEditSaving(true);
    setEditError(null);
    const { data, error } = await supabase
      .from("projects")
      .update({
        name: editForm.name.trim(),
        category: editForm.category.trim() || null,
        client_id: editForm.clientId || null,
        status: editForm.status,
        start_date: editForm.startDate || null,
        due_date: editForm.dueDate || null,
        budget: editForm.budget ? Number(editForm.budget) : null,
        ...(editHasCurrency || editForm.currency !== "BDT" ? { currency: editForm.currency } : {}),
        description: editForm.description.trim() || null,
      })
      .eq("id", editingId)
      .select("id, name, status, progress, due_date, description, clients(company_name)")
      .single();
    setEditSaving(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    if (data) {
      const updated = data as unknown as Pick<ProjectRow, "id" | "name" | "status" | "progress" | "due_date" | "description" | "clients">;
      setProjects((prev) => prev.map((row) => (row.id === editingId ? { ...row, ...updated } : row)));
      await supabase.from("activity_log").insert({
        actor_id: user.id,
        action: "project_updated",
        entity_type: "project",
        entity_id: editingId,
        detail: `"${editForm.name.trim()}" প্রজেক্ট আপডেট করা হয়েছে`,
      });
    }

    setEditingId(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || !user || deleteConfirmText.trim() !== deleteTarget.name) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("projects").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setProjects((prev) => prev.filter((row) => row.id !== deleteTarget.id));
    await supabase.from("activity_log").insert({
      actor_id: user.id,
      action: "project_deleted",
      entity_type: "project",
      entity_id: deleteTarget.id,
      detail: `"${deleteTarget.name}" প্রজেক্ট স্থায়ীভাবে মুছে ফেলা হয়েছে`,
    });
    setDeleteTarget(null);
    setDeleteConfirmText("");
  }

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byStatus = statusFilter === "all" ? projects : projects.filter((p) => p.status === statusFilter);
    const filtered = q
      ? byStatus.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.clients?.company_name ?? "").toLowerCase().includes(q),
        )
      : byStatus;
    const sorted = [...filtered];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "progress") {
      sorted.sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
    } else {
      sorted.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    }
    return sorted;
  }, [projects, search, sortBy, statusFilter]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <>
      <main className="content">
            <div className="pj-head">
              <div>
                <h1 className="page-title">Projects</h1>
                <p className="page-sub">Every project in one place. Open any card for the full details.</p>
              </div>
              <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
                <Icon name="plus" size={15} /> New project
              </button>
            </div>

            {!loading && projects.length > 0 && (
              <div className="pj-stats">
                {[
                  { key: "all", label: "Total projects", value: projects.length, icon: "layers" as IconName, tone: "ink" },
                  { key: "planning", label: "Planning", value: projects.filter((p) => p.status === "planning").length, icon: "edit" as IconName, tone: "blue" },
                  { key: "active", label: "Active", value: projects.filter((p) => p.status === "active").length, icon: "grid" as IconName, tone: "accent" },
                  { key: "review", label: "In review", value: projects.filter((p) => p.status === "review").length, icon: "checklist" as IconName, tone: "amber" },
                  { key: "on_hold", label: "On hold", value: projects.filter((p) => p.status === "on_hold").length, icon: "pause" as IconName, tone: "grey" },
                  { key: "completed", label: "Completed", value: projects.filter((p) => p.status === "completed").length, icon: "check" as IconName, tone: "green" },
                ].map((st) => {
                  const share = Math.round((st.value / projects.length) * 100);
                  return (
                    <button
                      type="button"
                      className={`pj-stat tone-${st.tone}${statusFilter === st.key ? " is-selected" : ""}`}
                      key={st.key}
                      onClick={() => setStatusFilter(st.key)}
                      aria-pressed={statusFilter === st.key}
                      aria-label={`Show ${st.label}`}
                    >
                      <span className="pj-stat-top">
                        <span className="pj-stat-icon"><Icon name={st.icon} size={17} /></span>
                        <span className="pj-stat-go" aria-hidden="true"><Icon name="arrow" size={13} /></span>
                      </span>
                      <span className="pj-stat-main">
                        <span className="pj-stat-text">
                          <b className="tabular">{st.value}</b>
                          <span>{st.label}</span>
                        </span>
                        <span className="pj-stat-ring" aria-hidden="true">
                          <svg viewBox="0 0 48 48">
                            <defs>
                              <linearGradient id={`pj-stat-grad-${st.key}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" style={{ stopColor: "var(--tone)" }} />
                                <stop offset="100%" style={{ stopColor: "color-mix(in srgb, var(--tone) 55%, #ffffff)" }} />
                              </linearGradient>
                            </defs>
                            <circle cx={24} cy={24} r={20} fill="none" stroke="color-mix(in srgb, var(--tone) 12%, var(--surface))" strokeWidth={3.5} />
                            {st.value > 0 && (
                              <circle
                                cx={24}
                                cy={24}
                                r={20}
                                fill="none"
                                stroke={`url(#pj-stat-grad-${st.key})`}
                                strokeWidth={3.5}
                                strokeLinecap="round"
                                strokeDasharray={125.66}
                                strokeDashoffset={125.66 - (st.value / projects.length) * 125.66}
                                transform="rotate(-90 24 24)"
                              />
                            )}
                          </svg>
                          <span className="pj-stat-ring-pct tabular">{share}%</span>
                        </span>
                      </span>
                      <span className="pj-stat-foot">
                        <i />
                        {st.key === "all" ? "Across every status" : st.value === 0 ? "None right now" : `${share}% of all projects`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!loading && projects.length > 0 && (() => {
              const SEGS = [
                { key: "planning", label: "Planning", color: "#2189d9" },
                { key: "active", label: "Active", color: "var(--accent)" },
                { key: "review", label: "In review", color: "var(--warning)" },
                { key: "on_hold", label: "On hold", color: "var(--ink-faint)" },
                { key: "completed", label: "Completed", color: "var(--positive)" },
              ].map((x) => ({ ...x, n: projects.filter((p) => p.status === x.key).length }));
              const total = projects.length;
              const CX = 110;
              const R = 56;
              const SW = 16;
              const C = 2 * Math.PI * R;
              const GAP = 5;
              const shown = SEGS.filter((x) => x.n > 0);
              let acc = 0;
              const arcs = shown.map((x) => {
                const len = (x.n / total) * C;
                // round caps add half a stroke to each end, so the dash is shortened by a full stroke plus the gap
                const dash = shown.length > 1 ? Math.max(len - SW - GAP, 0.1) : C;
                const mid = ((acc + len / 2) / C) * 2 * Math.PI - Math.PI / 2;
                const arc = {
                  ...x,
                  dash,
                  off: acc + (shown.length > 1 ? (SW + GAP) / 2 : 0),
                  pct: Math.round((x.n / total) * 100),
                  lx1: CX + Math.cos(mid) * (R + SW / 2 + 3),
                  ly1: CX + Math.sin(mid) * (R + SW / 2 + 3),
                  lx2: CX + Math.cos(mid) * (R + SW / 2 + 10),
                  ly2: CX + Math.sin(mid) * (R + SW / 2 + 10),
                  tx: CX + Math.cos(mid) * (R + SW / 2 + 14),
                  ty: CX + Math.sin(mid) * (R + SW / 2 + 14),
                  right: Math.cos(mid) >= 0,
                };
                acc += len;
                return arc;
              });

              return (
                <div className="pj-graphs">
                  <div className="pj-g-card">
                    <div className="pj-g-head">
                      <span className="pj-g-title">Status split</span>
                      <span className="pj-g-sub">{total} {total === 1 ? "project" : "projects"} in total</span>
                    </div>
                    <div className="pj-g-donut">
                      <svg viewBox="0 0 220 220" role="img" aria-label="Projects by status">
                        {/* thin inner rings, a soft detail like a dial */}
                        <circle cx={CX} cy={CX} r={R - SW / 2 - 8} fill="none" stroke="var(--border)" strokeWidth={1} />
                        <circle cx={CX} cy={CX} r={R - SW / 2 - 14} fill="none" stroke="var(--border-soft)" strokeWidth={1} strokeDasharray="2 4" />
                        <circle cx={CX} cy={CX} r={R} fill="none" stroke="var(--border-soft)" strokeWidth={SW} />
                        <g transform={`rotate(-90 ${CX} ${CX})`}>
                          {arcs.map((x) => (
                            <circle
                              key={x.key}
                              cx={CX}
                              cy={CX}
                              r={R}
                              fill="none"
                              stroke={x.color}
                              strokeWidth={SW}
                              strokeLinecap={shown.length > 1 ? "round" : "butt"}
                              strokeDasharray={`${x.dash} ${C - x.dash}`}
                              strokeDashoffset={-x.off}
                            >
                              <title>{`${x.label}: ${x.n}`}</title>
                            </circle>
                          ))}
                        </g>
                        {/* percentage labels with a short leader line */}
                        {arcs.map((x) => (
                          <g key={`l-${x.key}`}>
                            <line x1={x.lx1} y1={x.ly1} x2={x.lx2} y2={x.ly2} stroke="var(--ink-faint)" strokeWidth={1} />
                            <text x={x.tx + (x.right ? 3 : -3)} y={x.ty} textAnchor={x.right ? "start" : "end"} dominantBaseline="middle" className="pj-g-pct-label">
                              {x.pct}%
                            </text>
                          </g>
                        ))}
                      </svg>
                      <div className="pj-g-donut-center">
                        <span>Total</span>
                        <b className="tabular">{total}</b>
                      </div>
                    </div>
                    <ul className="pj-g-legend">
                      {SEGS.map((x) => (
                        <li key={x.key} className={x.n === 0 ? "is-zero" : undefined}>
                          <i style={{ background: x.color }} />
                          <span className="pj-g-legend-label">{x.label}</span>
                          <span className="pj-g-leader" aria-hidden="true" />
                          <b className="tabular">{x.n}</b>
                          <span className="pj-g-legend-pct tabular">{Math.round((x.n / total) * 100)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pj-g-card">
                    <div className="pj-g-head">
                      <span className="pj-g-title">Deadlines calendar</span>
                      <span className="pj-g-sub">Hover a day to see its projects</span>
                    </div>
                    <DeadlineCalendar projects={projects.map((p) => ({ id: p.id, name: p.name, due_date: p.due_date, status: p.status }))} today={todayISO()} />
                  </div>
                </div>
              );
            })()}

            <div className="pj-toolbar">
              <label className="toolbar-search">
                <Icon name="search" size={15} />
                <input
                  placeholder="Search projects or clients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" className="pj-search-clear" aria-label="Clear search" onClick={() => setSearch("")}>
                    <Icon name="close" size={12} />
                  </button>
                )}
              </label>
              <div className="pj-tabs" role="group" aria-label="Filter by status">
                {[
                  { key: "all", label: "All" },
                  { key: "planning", label: "Planning" },
                  { key: "active", label: "Active" },
                  { key: "review", label: "In review" },
                  { key: "on_hold", label: "On hold" },
                  { key: "completed", label: "Completed" },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.key}
                    className={statusFilter === t.key ? "active" : ""}
                    onClick={() => setStatusFilter(t.key)}
                  >
                    {t.label}
                    <em className="tabular">{t.key === "all" ? projects.length : projects.filter((p) => p.status === t.key).length}</em>
                  </button>
                ))}
              </div>
              <label className="pj-sort">
                <Icon name="sort" size={15} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "due_date" | "name" | "progress")}
                  aria-label="Sort projects"
                >
                  <option value="due_date">Deadline</option>
                  <option value="name">Name</option>
                  <option value="progress">Progress</option>
                </select>
                <svg className="pj-sort-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </label>
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {loading ? (
              <p style={{ padding: 24, fontSize: 13, color: "var(--ink-faint)" }}>Loading…</p>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <button className="empty-icon" onClick={() => setShowCreate(true)} aria-label="Create a new project">
                  ＋
                </button>
                <div className="empty-title">No projects yet</div>
                <button className="btn btn-accent btn-sm" onClick={() => setShowCreate(true)} style={{ marginTop: 10 }}>
                  + Create your first project
                </button>
              </div>
            ) : visibleProjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">
                  {search ? <>No project matches &quot;{search}&quot;</> : "No projects in this status"}
                </div>
              </div>
            ) : (
              <div className="proj-grid">
                {visibleProjects.map((p) => {
                  const meta = PROJECT_STATUS_META[p.status] ?? { label: p.status, cls: "s-todo" };
                  const stat = taskStats[p.id];
                  const progress = stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0;
                  const visibleAvatars = p.avatars.slice(0, 3);
                  const extraAvatars = p.avatars.length - visibleAvatars.length;
                  const late = p.status !== "completed" && !!p.due_date && p.due_date < todayISO();
                  const daysLeft = p.due_date ? Math.round((new Date(p.due_date + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000) : 0;
                  const ringColor = late ? "var(--danger)" : p.status === "completed" ? "var(--positive)" : "url(#pj-ring-grad)";
                  return (
                    <div
                      className={`proj-card pj-card band-${p.status}`}
                      key={p.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push(`/projects/${p.id}`);
                      }}
                    >
                      <button
                        type="button"
                        className="proj-card-menu-btn"
                        aria-label="More options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((id) => (id === p.id ? null : p.id));
                        }}
                      >
                        <Icon name="more" size={15} />
                      </button>
                      {openMenuId === p.id && (
                        <div className="proj-card-menu" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="proj-card-menu-item" onClick={() => openEditModal(p)}>
                            <Icon name="edit" size={13} /> Edit Project
                          </button>
                          {profile?.is_admin && (
                            <>
                              <div className="proj-card-menu-divider" />
                              <button
                                type="button"
                                className="proj-card-menu-item danger"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setDeleteTarget(p);
                                  setDeleteConfirmText("");
                                  setDeleteError(null);
                                }}
                              >
                                <Icon name="trash" size={13} /> Delete Project
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      <div className="pj2-id">
                        <div className="pj2-icon">{p.name.charAt(0).toUpperCase()}</div>
                        <div className="pj2-title">
                          <div className="pj2-name-row">
                            <span className="pj2-name">{p.name}</span>
                            <span className="pj2-status"><i />{meta.label}</span>
                          </div>
                          <div className="pj2-client">{p.clients?.company_name ?? "No client"}</div>
                        </div>
                      </div>

                      {p.description ? (
                        <RichText text={p.description} className="proj-card-desc" />
                      ) : (
                        <p className="pj2-nodesc">No description yet.</p>
                      )}

                      <div className="pj2-metrics">
                        <div className="pj2-metric">
                          <div className="pj2-ring" aria-label={`${progress}% complete`}>
                            <svg viewBox="0 0 64 64">
                              <defs>
                                <linearGradient id="pj-ring-grad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="var(--accent)" />
                                  <stop offset="100%" stopColor="#2189d9" />
                                </linearGradient>
                              </defs>
                              <circle cx={32} cy={32} r={19} fill="none" stroke="var(--border)" strokeWidth={0.8} />
                              <circle cx={32} cy={32} r={16} fill="none" stroke="var(--border-soft)" strokeWidth={0.8} strokeDasharray="1.5 2.5" />
                              <circle cx={32} cy={32} r={26} fill="none" stroke="var(--border-soft)" strokeWidth={8} />
                              {progress > 0 && (
                                <circle
                                  cx={32}
                                  cy={32}
                                  r={26}
                                  fill="none"
                                  stroke={ringColor}
                                  strokeWidth={8}
                                  strokeLinecap="round"
                                  strokeDasharray={163.36}
                                  strokeDashoffset={163.36 - (progress / 100) * 163.36}
                                  transform="rotate(-90 32 32)"
                                />
                              )}
                            </svg>
                            <span className="pj2-ring-pct tabular">{progress}%</span>
                          </div>
                          <span className="pj2-label">Progress</span>
                        </div>
                        <div className="pj2-metric">
                          <span className="pj2-value tabular"><b>{stat?.done ?? 0}</b><i>/{stat?.total ?? p.taskCount}</i></span>
                          <span className="pj2-label">Tasks done</span>
                        </div>
                        <div className="pj2-metric">
                          {p.due_date ? (
                            <>
                              <span className={`pj2-value${late ? " is-late" : ""}`}>
                                {new Date(p.due_date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                              </span>
                              <span className={`pj2-label pj2-due${late ? " is-late" : ""}`}>
                                {p.status === "completed"
                                  ? "Deadline"
                                  : late
                                    ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} overdue`
                                    : daysLeft === 0
                                      ? "Due today"
                                      : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="pj2-value muted">—</span>
                              <span className="pj2-label">No deadline</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pj-foot">
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
                          <span className="pj2-noteam">No team yet</span>
                        )}
                        <div className="pj-counts">
                          <span title="Discussions"><Icon name="message" size={13} /> <b className="tabular">{p.discussionCount}</b></span>
                          <span title="Files"><Icon name="file" size={13} /> <b className="tabular">{p.fileCount}</b></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
      {showCreate && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">নতুন প্রজেক্ট তৈরি করুন</div>
            <form onSubmit={handleCreate}>
              <label className="field-label">প্রজেক্টের নাম</label>
              <input
                className="field-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="যেমন: Aarambho — ব্র্যান্ড অ্যাপ রিডিজাইন"
                autoFocus
                required
              />

              <label className="field-label">ক্যাটাগরি</label>
              <input
                className="field-input"
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="যেমন: Mobile App · UX/UI (ঐচ্ছিক)"
              />

              <label className="field-label">ক্লায়েন্ট</label>
              <select
                className="field-input"
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
              >
                <option value="">কোনো ক্লায়েন্ট নেই</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>

              <label className="field-label">স্ট্যাটাস</label>
              <select
                className="field-input"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {Object.entries(PROJECT_STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>

              <div className="field-row">
                <div>
                  <label className="field-label">শুরুর তারিখ</label>
                  <input
                    className="field-input"
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">ডেডলাইন</label>
                  <input
                    className="field-input"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
              </div>

              <label className="field-label">বাজেট</label>
              <div className="value-row">
                <select className="field-input" aria-label="Currency" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {currencyLabel(c)}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  placeholder="ঐচ্ছিক"
                />
              </div>

              <label className="field-label">বিবরণ</label>
              <RichTextField value={newDescription} onChange={setNewDescription} textareaClassName="field-input" placeholder="প্রজেক্টের সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)" rows={3} />

              <div className="modal-foot">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowCreate(false)}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="btn btn-accent btn-sm"
                  disabled={creating || !newName.trim()}
                >
                  {creating ? "তৈরি হচ্ছে…" : "প্রজেক্ট তৈরি করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingId && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editSaving) setEditingId(null);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">প্রজেক্ট এডিট করুন</div>
            {editLoading ? (
              <p style={{ fontSize: 13, color: "var(--ink-faint)", padding: "8px 0 4px" }}>লোড হচ্ছে…</p>
            ) : (
              <form onSubmit={handleEditSubmit}>
                <label className="field-label">প্রজেক্টের নাম</label>
                <input
                  className="field-input"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  autoFocus
                  required
                />

                <label className="field-label">ক্যাটাগরি</label>
                <input
                  className="field-input"
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="ঐচ্ছিক"
                />

                <label className="field-label">ক্লায়েন্ট</label>
                <select
                  className="field-input"
                  value={editForm.clientId}
                  onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value })}
                >
                  <option value="">কোনো ক্লায়েন্ট নেই</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>

                <label className="field-label">স্ট্যাটাস</label>
                <select
                  className="field-input"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  {Object.entries(PROJECT_STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>

                <div className="field-row">
                  <div>
                    <label className="field-label">শুরুর তারিখ</label>
                    <input
                      className="field-input"
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="field-label">ডেডলাইন</label>
                    <input
                      className="field-input"
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <label className="field-label">বাজেট</label>
                <div className="value-row">
                  <select className="field-input" aria-label="Currency" value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {currencyLabel(c)}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    value={editForm.budget}
                    onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                    placeholder="ঐচ্ছিক"
                  />
                </div>

                <label className="field-label">বিবরণ</label>
                <RichTextField value={editForm.description} onChange={(v) => setEditForm({ ...editForm, description: v })} textareaClassName="field-input" placeholder="ঐচ্ছিক" rows={3} />

                {editError && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "var(--danger-soft)",
                      color: "var(--danger)",
                      fontSize: 12.5,
                    }}
                  >
                    {editError}
                  </div>
                )}

                <div className="modal-foot">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} disabled={editSaving}>
                    বাতিল
                  </button>
                  <button type="submit" className="btn btn-accent btn-sm" disabled={editSaving || !editForm.name.trim()}>
                    {editSaving ? "সেভ হচ্ছে…" : "সেভ করুন"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">প্রজেক্ট স্থায়ীভাবে ডিলিট করবেন?</div>
            <div className="delete-warning">
              এটা অপরিবর্তনীয়। &quot;{deleteTarget.name}&quot;-এর সাথে যুক্ত সব Task, Milestone, SOW, Invoice, Payment, Client Message, Approval, Change Request এবং Update স্থায়ীভাবে মুছে যাবে।
            </div>
            <label className="field-label">
              নিশ্চিত করতে প্রজেক্টের নাম টাইপ করুন: <b>{deleteTarget.name}</b>
            </label>
            <input
              className="field-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoFocus
            />
            {deleteError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  fontSize: 12.5,
                }}
              >
                {deleteError}
              </div>
            )}
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
              >
                বাতিল
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={deleting || deleteConfirmText.trim() !== deleteTarget.name}
                onClick={handleDeleteConfirm}
              >
                {deleting ? "ডিলিট হচ্ছে…" : "স্থায়ীভাবে ডিলিট করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
