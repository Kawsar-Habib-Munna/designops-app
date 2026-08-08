"use client";

// Projects — সব প্রজেক্টের হালকা লিস্ট ভিউ, রিয়েল Supabase ডেটা (clients join),
// প্রতিটা কার্ড /projects/[id]-এ নিয়ে যায় (Project Details পেজ)। নতুন প্রজেক্ট
// তৈরি করার মডালও এখানেই — এটা ছাড়া প্রজেক্ট টেবিলে ডেটা ঢোকানোর কোনো উপায় ছিল না।

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import "./projects.css";
import { supabase } from "@/lib/supabaseClient";
import { useSession } from "@/lib/useSession";
import { formatBnDate } from "@/lib/format";
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
  message:
    '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
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

const NAV_ITEMS: {
  icon: IconName;
  label: string;
  href: string;
  active?: boolean;
}[] = [
  { icon: "grid", label: "Dashboard", href: "/dashboard" },
  { icon: "folder", label: "Projects", href: "/projects", active: true },
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

const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "চলছে", cls: "s-progress" },
  review: { label: "রিভিউ", cls: "s-review" },
  completed: { label: "সম্পন্ন", cls: "s-done" },
  on_hold: { label: "হোল্ডে", cls: "s-todo" },
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
  description: string | null;
  clients: { company_name: string } | null;
};

type ClientOption = { id: string; company_name: string };

export default function ProjectsListPage() {
  const { user, loading: sessionLoading } = useSession();
  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newStartDate, setNewStartDate] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newBudget, setNewBudget] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [taskStats, setTaskStats] = useState<
    Record<string, { done: number; total: number }>
  >({});

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [projectsRes, clientsRes, profileRes, tasksRes] = await Promise.all(
        [
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
            .select("id, full_name, role, avatar_color")
            .eq("id", user!.id)
            .single(),
          supabase
            .from("tasks")
            .select("project_id, status")
            .not("project_id", "is", null),
        ],
      );

      if (projectsRes.error) setError(projectsRes.error.message);
      setProjects((projectsRes.data as unknown as ProjectRow[]) ?? []);
      setClientOptions((clientsRes.data as ClientOption[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

      const stats: Record<string, { done: number; total: number }> = {};
      for (const t of (tasksRes.data as {
        project_id: string;
        status: string;
      }[]) ?? []) {
        const cur = stats[t.project_id] ?? { done: 0, total: 0 };
        cur.total += 1;
        if (t.status === "done") cur.done += 1;
        stats[t.project_id] = cur;
      }
      setTaskStats(stats);

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
        description: newDescription.trim() || null,
        project_manager_id: user.id,
        progress: 0,
      })
      .select("id, name, status, progress, due_date, clients(company_name)")
      .single();

    if (error) {
      setError(error.message);
      setCreating(false);
      return;
    }

    if (data) {
      const row = data as unknown as ProjectRow;
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
    setNewDescription("");
    setCreating(false);
    setShowCreate(false);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`projectslist-root${dark ? " dark" : ""}`}>
      <div className="shell">
        <aside className="sidebar" aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div>
                <div className="brand-name">FLOW 53</div>
                <div className="brand-sub">Innovate · Design · Elevate</div>
              </div>
            </div>
            <nav className="nav-group" aria-label="Sidebar">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`nav-item${item.active ? " active" : ""}`}
                  aria-current={item.active ? "page" : undefined}
                >
                  <Icon name={item.icon} /> {item.label}
                </Link>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <a key={item.label} href={item.href} className="nav-item">
                  <Icon name={item.icon} /> {item.label}
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

        <div className="main">
          <header className="topbar">
            <button className="search-box">
              <Icon name="search" size={14} />
              <span style={{ flex: 1, textAlign: "left" }}>
                খুঁজুন — প্রজেক্ট, টাস্ক, মানুষ...
              </span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>
            <button
              className="btn btn-accent"
              onClick={() => setShowCreate(true)}
            >
              + নতুন তৈরি করুন
            </button>
            <button className="icon-btn" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              <span className="dot-indicator"></span>
            </button>
            <button
              className="icon-btn"
              aria-label="থিম পরিবর্তন"
              onClick={() => setDark((d) => !d)}
            >
              <Icon name={dark ? "moon" : "sun"} />
            </button>
          </header>

          <main className="content">
            <h1 className="page-title">Projects</h1>
            <p className="page-sub">
              সব প্রজেক্ট এক জায়গায় — বিস্তারিত দেখতে যেকোনো একটাতে ক্লিক
              করুন।
            </p>

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
              <p
                style={{ padding: 24, fontSize: 13, color: "var(--ink-faint)" }}
              >
                লোড হচ্ছে…
              </p>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <button
                  className="empty-icon"
                  onClick={() => setShowCreate(true)}
                  aria-label="নতুন প্রজেক্ট তৈরি করুন"
                >
                  ＋
                </button>
                <div className="empty-title">এখনও কোনো প্রজেক্ট নেই</div>
                <button
                  className="btn btn-accent btn-sm"
                  onClick={() => setShowCreate(true)}
                  style={{ marginTop: 10 }}
                >
                  + প্রথম প্রজেক্ট তৈরি করুন
                </button>
              </div>
            ) : (
              <div className="proj-grid">
                {projects.map((p) => {
                  const meta = PROJECT_STATUS_META[p.status] ?? {
                    label: p.status,
                    cls: "s-todo",
                  };
                  const stat = taskStats[p.id];
                  const progress =
                    stat && stat.total > 0
                      ? Math.round((stat.done / stat.total) * 100)
                      : 0;
                  return (
                    <Link
                      className="proj-card"
                      key={p.id}
                      href={`/projects/${p.id}`}
                    >
                      <div className="proj-card-top">
                        <div className="proj-card-icon">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="proj-card-name">{p.name}</div>
                          <div className="proj-card-client">
                            {p.clients?.company_name ?? "—"}
                          </div>
                        </div>
                      </div>
                      {p.description && (
                        <p className="proj-card-desc">{p.description}</p>
                      )}
                      <span className={`status-pill ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="proj-card-foot">
                        <span className="tabular">{progress}% সম্পন্ন</span>
                        <span>ডেডলাইন: {formatBnDate(p.due_date) || "—"}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

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

              <label className="field-label">বাজেট (৳)</label>
              <input
                className="field-input"
                type="number"
                min="0"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="ঐচ্ছিক"
              />

              <label className="field-label">বিবরণ</label>
              <textarea
                className="field-input"
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="প্রজেক্টের সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />

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
    </div>
  );
}
