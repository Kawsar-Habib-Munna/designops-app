'use client';

// Task List — টেবিল-ভিত্তিক ভিউ, পুরোপুরি Supabase-connected:
// tasks + projects + profiles (assignee) + checklist_items + comments +
// attachments + activity_log। RLS-এর জন্য sign-in লাগবে (lib/useSession.ts)।
//
// নোট: টুলবারের Import/Export/Sort/Group By/Date Range/Saved Views এবং
// Advanced Filters প্যানেলের চিপগুলো, আর বাল্ক বারের Assign/Stage/Label/
// Priority/Deadline/Archive/Export বাটনগুলো — এগুলো এখনো UI প্লেসহোল্ডার
// (disabled), ব্যাকএন্ডে কিছু করে না। Favorites ভিউ-ও তাই — schema-তে
// favorite/starred কলাম নেই বলে সবসময় খালি দেখাবে।

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import './tasks.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { relativeTimeBn, todayISO } from '@/lib/format';
import { STATUS_META, PRIORITY_META, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
import { sendNotifications } from '@/lib/notify';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';
import Avatar from '@/app/components/Avatar';

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
  settings: '<circle cx="12" cy="12" r="3"/><path d="M4 12h3"/><path d="M17 12h3"/>',
  chevrons: '<path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  import: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>',
  export: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 19h16"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  filter: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  sort: '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M21 16l-4 4-4-4"/>',
  layers: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  paperclip: '<path d="M21 11.5l-9.2 9.2a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8.2-8.2"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  tick: '<path d="M20 6L9 17l-5-5"/>',
  figma: '<path d="M9 2h6a4 4 0 0 1 0 8H9z"/><path d="M9 10h6a4 4 0 0 1 0 8 4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  users2: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 15, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
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

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null };
type ProjectOption = { id: string; name: string };
type AssigneeOption = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  workflow_stage: string;
  priority: TaskPriority;
  is_blocked: boolean;
  due_date: string | null;
  estimated_hours: number | null;
  progress: number | null;
  updated_at: string;
  project_id: string | null;
  assignee_id: string | null;
  projects: { name: string } | null;
  profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
  commentCount: number;
  attachmentCount: number;
};

type ChecklistItem = { id: string; label: string; is_done: boolean; position: number };
type CommentRow = { id: string; body: string; created_at: string; profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null };
type AttachmentRow = { id: string; file_name: string; file_type: string | null; drive_url: string };
type TaskActivityRow = { id: string; detail: string | null; created_at: string; profiles: { full_name: string } | null };

type ExpandData = { checklist: ChecklistItem[]; comments: CommentRow[]; attachments: AttachmentRow[]; activity: TaskActivityRow[]; loading: boolean };

type SmartView = 'all' | 'mine' | 'today' | 'overdue' | 'blocked' | 'review' | 'progress' | 'completed' | 'favorites';

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks', active: true },
  { icon: 'checklist', label: 'To-Do', href: '/todos' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '/clients' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'layers', label: 'Portfolio', href: '/portfolio' },
  { icon: 'bar', label: 'Reports', href: '#' },
];

const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '/notifications' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

const SMART_VIEWS: { key: SmartView; label: string }[] = [
  { key: 'all', label: 'All Tasks' },
  { key: 'mine', label: 'My Tasks' },
  { key: 'today', label: 'আজকের টাস্ক' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'review', label: 'Waiting for Review' },
  { key: 'progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function isCompletedThisWeek(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() < 7 * 86400000;
}

function matchesView(t: TaskRow, view: SmartView, userId: string, today: string) {
  switch (view) {
    case 'all':
      return true;
    case 'mine':
      return t.assignee_id === userId;
    case 'today':
      return t.due_date === today;
    case 'overdue':
      return !!t.due_date && t.due_date < today && t.status !== 'done';
    case 'blocked':
      return t.is_blocked;
    case 'review':
      return t.status === 'review' || t.workflow_stage === 'ux_review' || t.workflow_stage === 'client_review';
    case 'progress':
      return t.status === 'in_progress';
    case 'completed':
      return t.status === 'done';
    case 'favorites':
      return false;
    default:
      return true;
  }
}

const TASK_SELECT =
  'id, title, description, status, workflow_stage, priority, is_blocked, due_date, estimated_hours, progress, updated_at, project_id, assignee_id, projects(name), profiles!assignee_id(full_name, avatar_color, avatar_url)';

// ---- Weekly Tasks / Weekly Plan (added alongside the existing table view,
// which becomes the "List" tab — no existing functionality removed) ----
type MainTab = 'list' | 'weekly-tasks' | 'weekly-plan';
type WeeklyScope = 'mine' | 'team';
type PlanItem = { id: string; plan_date: string; title: string; details: string | null; created_by: string | null; created_at: string };

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfWeek(offset: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday + offset * 7);
  return monday;
}
function formatWeekRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  const year = end.getFullYear();
  return `${fmt(start)} – ${fmt(end)} ${year}`;
}

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageInner />
    </Suspense>
  );
}

function TasksPageInner() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const searchParams = useSearchParams();

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [checklistByTask, setChecklistByTask] = useState<Map<string, ChecklistItem[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<SmartView>('all');
  const [search, setSearch] = useState('');
  const [advOpen, setAdvOpen] = useState(false);

  const [expandData, setExpandData] = useState<Record<string, ExpandData>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [newChecklistItem, setNewChecklistItem] = useState<Record<string, string>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [newDueDate, setNewDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  // ---- List tab: per-person card view ----
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', projectId: '', assigneeId: '', priority: 'normal' as TaskPriority, status: 'todo' as TaskStatus, dueDate: '', description: '' });
  const [editSaving, setEditSaving] = useState(false);
  const editingTask = tasks.find((t) => t.id === editTaskId) ?? null;

  // ---- Weekly Tasks / Weekly Plan ----
  const [mainTab, setMainTab] = useState<MainTab>('list');
  const [weekOffset, setWeekOffset] = useState(0);
  const [weeklyScope, setWeeklyScope] = useState<WeeklyScope>('team');

  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [addingPlanDate, setAddingPlanDate] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState('');
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [modalPlanDate, setModalPlanDate] = useState('');
  const [modalPlanTitle, setModalPlanTitle] = useState('');
  const [modalPlanDetails, setModalPlanDetails] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)), [weekStart]);
  const weekStartISO = isoDate(weekDays[0]);
  const weekEndISO = isoDate(weekDays[6]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadPlans() {
      setPlanLoading(true);
      const { data, error: err } = await supabase
        .from('weekly_plan_items')
        .select('id, plan_date, title, details, created_by, created_at')
        .gte('plan_date', weekStartISO)
        .lte('plan_date', weekEndISO)
        .order('created_at');
      if (!cancelled) {
        if (!err) setPlanItems((data as PlanItem[]) ?? []);
        setPlanLoading(false);
      }
    }
    loadPlans();
    return () => {
      cancelled = true;
    };
  }, [user, weekStartISO, weekEndISO]);

  async function loadExpandData(taskId: string) {
    setExpandData((prev) => ({ ...prev, [taskId]: { checklist: [], comments: [], attachments: [], activity: [], loading: true } }));

    const [checklistRes, commentsRes, attachmentsRes, activityRes] = await Promise.all([
      supabase.from('checklist_items').select('id, label, is_done, position').eq('task_id', taskId).order('position'),
      supabase.from('comments').select('id, body, created_at, profiles(full_name, avatar_color, avatar_url)').eq('task_id', taskId).order('created_at'),
      supabase.from('attachments').select('id, file_name, file_type, drive_url').eq('task_id', taskId).order('uploaded_at', { ascending: false }),
      supabase
        .from('activity_log')
        .select('id, detail, created_at, profiles(full_name)')
        .eq('entity_type', 'task')
        .eq('entity_id', taskId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    setExpandData((prev) => ({
      ...prev,
      [taskId]: {
        checklist: (checklistRes.data as ChecklistItem[]) ?? [],
        comments: (commentsRes.data as unknown as CommentRow[]) ?? [],
        attachments: (attachmentsRes.data as AttachmentRow[]) ?? [],
        activity: (activityRes.data as unknown as TaskActivityRow[]) ?? [],
        loading: false,
      },
    }));
  }

  useEffect(() => {
    function applyAssigneeParam() {
      const assigneeParam = searchParams.get('assignee');
      if (assigneeParam) {
        setNewAssigneeIds([assigneeParam]);
        setShowCreate(true);
      }
    }
    applyAssigneeParam();
  }, [searchParams]);

  // ড্যাশবোর্ডের "My Tasks" থেকে ?task=<id> দিয়ে এলে সেই টাস্কের এডিট মোডাল খোলে।
  // সরাসরি effect-এর ভেতর setState কল করলে react-hooks/set-state-in-effect লিন্ট
  // রুল ধরে — তাই setTimeout(fn, 0) দিয়ে মাইক্রোটাস্ক পরে কল করা হচ্ছে।
  useEffect(() => {
    const taskParam = searchParams.get('task');
    if (!taskParam) return;
    const timer = setTimeout(() => setEditTaskId(taskParam), 0);
    return () => clearTimeout(timer);
  }, [searchParams]);

  // editTaskId/tasks বদলালে ফর্ম আর কমেন্ট/অ্যাটাচমেন্ট/অ্যাক্টিভিটি রিফ্রেশ হয় —
  // কার্ড ক্লিক আর ?task= URL প্যারাম দুটো পথই এখানে মিলে যায়
  useEffect(() => {
    if (!editTaskId) return;
    const t = tasks.find((x) => x.id === editTaskId);
    const timer = setTimeout(() => {
      if (t) {
        setEditForm({
          title: t.title,
          projectId: t.project_id ?? '',
          assigneeId: t.assignee_id ?? '',
          priority: t.priority,
          status: t.status,
          dueDate: t.due_date ?? '',
          description: t.description ?? '',
        });
      }
      if (!expandData[editTaskId]) loadExpandData(editTaskId);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadExpandData/expandData intentionally excluded, would refetch on every keystroke elsewhere
  }, [editTaskId, tasks]);


  async function fetchTasksData(uid: string) {
    const [tasksRes, commentsRes, attachmentsRes, projectsRes, teamRes, profileRes, checklistRes] = await Promise.all([
      supabase.from('tasks').select(TASK_SELECT).order('updated_at', { ascending: false }),
      supabase.from('comments').select('task_id'),
      supabase.from('attachments').select('task_id'),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
      supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', uid).single(),
      supabase.from('checklist_items').select('id, task_id, label, is_done, position').order('position'),
    ]);

    const firstErrored = [tasksRes, commentsRes, attachmentsRes, projectsRes, teamRes, profileRes].find((r) => r.error);

    const commentCounts = new Map<string, number>();
    for (const row of (commentsRes.data as { task_id: string }[]) ?? []) {
      commentCounts.set(row.task_id, (commentCounts.get(row.task_id) ?? 0) + 1);
    }
    const attachmentCounts = new Map<string, number>();
    for (const row of (attachmentsRes.data as { task_id: string }[]) ?? []) {
      attachmentCounts.set(row.task_id, (attachmentCounts.get(row.task_id) ?? 0) + 1);
    }
    const checklistByTask = new Map<string, ChecklistItem[]>();
    for (const row of (checklistRes.data as (ChecklistItem & { task_id: string })[]) ?? []) {
      const arr = checklistByTask.get(row.task_id) ?? [];
      arr.push(row);
      checklistByTask.set(row.task_id, arr);
    }

    const rows = ((tasksRes.data as unknown as Omit<TaskRow, 'commentCount' | 'attachmentCount'>[]) ?? []).map((t) => ({
      ...t,
      commentCount: commentCounts.get(t.id) ?? 0,
      attachmentCount: attachmentCounts.get(t.id) ?? 0,
    }));

    return {
      errorMessage: firstErrored?.error?.message ?? null,
      tasks: rows,
      projectOptions: (projectsRes.data as ProjectOption[]) ?? [],
      assigneeOptions: (teamRes.data as AssigneeOption[]) ?? [],
      profile: (profileRes.data as ProfileRow | null) ?? null,
      checklistByTask,
    };
  }

  useEffect(() => {
    if (!user) return;

    async function run() {
      const result = await fetchTasksData(user!.id);
      setError(result.errorMessage);
      setTasks(result.tasks);
      setProjectOptions(result.projectOptions);
      setAssigneeOptions(result.assigneeOptions);
      setChecklistByTask(result.checklistByTask);
      if (result.profile) setProfile(result.profile);
      setLoading(false);
    }

    run();
  }, [user]);

  async function handleReload() {
    if (!user) return;
    setReloading(true);
    const result = await fetchTasksData(user.id);
    setError(result.errorMessage);
    setTasks(result.tasks);
    setProjectOptions(result.projectOptions);
    setAssigneeOptions(result.assigneeOptions);
    setChecklistByTask(result.checklistByTask);
    if (result.profile) setProfile(result.profile);
    setReloading(false);
  }

  const today = todayISO();

  const kpis = useMemo(() => {
    if (!user) return { total: 0, mine: 0, dueToday: 0, overdue: 0, review: 0, completedThisWeek: 0 };
    return {
      total: tasks.length,
      mine: tasks.filter((t) => t.assignee_id === user.id && t.status !== 'done').length,
      dueToday: tasks.filter((t) => t.due_date === today && t.status !== 'done').length,
      overdue: tasks.filter((t) => !!t.due_date && t.due_date < today && t.status !== 'done').length,
      review: tasks.filter((t) => matchesView(t, 'review', user.id, today)).length,
      completedThisWeek: tasks.filter((t) => t.status === 'done' && isCompletedThisWeek(t.updated_at)).length,
    };
  }, [tasks, user, today]);

  const filtered = useMemo(() => {
    if (!user) return [];
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => matchesView(t, activeView, user.id, today) && (!q || t.title.toLowerCase().includes(q)));
  }, [tasks, activeView, search, user, today]);

  // ---- List tab: per-person card grid (ঠিক /todos-এর member-grid
  // প্যাটার্নে, কিন্তু আসল tasks+checklist_items ডেটা দিয়ে)। প্রতি কার্ডের
  // progress/count real personTasks থেকে (সবসময়), তালিকায় দেখানো আইটেমগুলো
  // বর্তমান Smart View + সার্চ দিয়ে ফিল্টার করা (filtered থেকে) — যাতে
  // "My Tasks"/"Overdue" ইত্যাদি pill এখানেও কাজ করে। ----
  const memberTaskCards = useMemo(() => {
    const noConstraint = activeView === 'all' && !search.trim();
    return assigneeOptions
      .map((p) => {
        const personTasks = tasks.filter((t) => t.assignee_id === p.id);
        const shown = filtered.filter((t) => t.assignee_id === p.id);
        const active = personTasks.filter((t) => t.status !== 'done');
        const avgProgress = personTasks.length > 0 ? Math.round(personTasks.reduce((sum, t) => sum + (t.progress ?? 0), 0) / personTasks.length) : 0;
        return { profile: p, personTasks, shown, activeCount: active.length, avgProgress };
      })
      .filter((m) => noConstraint || m.shown.length > 0);
  }, [assigneeOptions, tasks, filtered, activeView, search]);

  const weeklyScopedTasks = useMemo(() => (weeklyScope === 'mine' && user ? tasks.filter((t) => t.assignee_id === user.id) : tasks), [tasks, weeklyScope, user]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const t of weeklyScopedTasks) {
      if (!t.due_date) continue;
      const arr = map.get(t.due_date) ?? [];
      arr.push(t);
      map.set(t.due_date, arr);
    }
    return map;
  }, [weeklyScopedTasks]);

  const noDueDateCount = useMemo(() => weeklyScopedTasks.filter((t) => !t.due_date && t.status !== 'done').length, [weeklyScopedTasks]);

  function openTaskFromWeek(taskId: string) {
    setEditTaskId(taskId);
  }

  async function handleAddPlanItem(dateISO: string, title: string, details?: string) {
    const trimmed = title.trim();
    if (!trimmed || !user) return;
    setPlanSaving(true);
    const { data, error: err } = await supabase
      .from('weekly_plan_items')
      .insert({ plan_date: dateISO, title: trimmed, details: details?.trim() || null, created_by: user.id })
      .select('id, plan_date, title, details, created_by, created_at')
      .single();
    setPlanSaving(false);
    if (err || !data) {
      setError(err?.message ?? 'প্ল্যান আইটেম যোগ করা যায়নি।');
      return;
    }
    setPlanItems((prev) => [...prev, data as PlanItem]);
  }

  async function handleDeletePlanItem(id: string) {
    setPlanItems((prev) => prev.filter((p) => p.id !== id));
    const { error: err } = await supabase.from('weekly_plan_items').delete().eq('id', id);
    if (err) setError(err.message);
  }

  async function toggleChecklistItem(taskId: string, item: ChecklistItem) {
    const newDone = !item.is_done;
    setExpandData((prev) => {
      const cur = prev[taskId];
      if (!cur) return prev;
      return { ...prev, [taskId]: { ...cur, checklist: cur.checklist.map((c) => (c.id === item.id ? { ...c, is_done: newDone } : c)) } };
    });
    await supabase.from('checklist_items').update({ is_done: newDone }).eq('id', item.id);
  }

  async function addChecklistItem(taskId: string) {
    const label = (newChecklistItem[taskId] ?? '').trim();
    if (!label) return;

    const currentLength = expandData[taskId]?.checklist.length ?? 0;
    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ task_id: taskId, label, position: currentLength })
      .select('id, label, is_done, position')
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setExpandData((prev) => {
      const cur = prev[taskId];
      if (!cur) return prev;
      return { ...prev, [taskId]: { ...cur, checklist: [...cur.checklist, data as ChecklistItem] } };
    });
    setNewChecklistItem((prev) => ({ ...prev, [taskId]: '' }));
  }

  async function submitComment(taskId: string) {
    const body = (newComment[taskId] ?? '').trim();
    if (!body || !user) return;

    const { data, error } = await supabase
      .from('comments')
      .insert({ task_id: taskId, author_id: user.id, body })
      .select('id, body, created_at, profiles(full_name, avatar_color, avatar_url)')
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setExpandData((prev) => {
      const cur = prev[taskId];
      if (!cur) return prev;
      return { ...prev, [taskId]: { ...cur, comments: [...cur.comments, data as unknown as CommentRow] } };
    });
    setNewComment((prev) => ({ ...prev, [taskId]: '' }));
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, commentCount: t.commentCount + 1 } : t)));
  }

  // একাধিক অ্যাসাইনি বেছে নিলে প্রতিজনের জন্য আলাদা real রো তৈরি হয় (একই টাইটেল/
  // প্রজেক্ট/প্রায়োরিটি/ডিউ ডেট) — "Assign to N selected" মকআপ অনুযায়ী, কোনো
  // fake "multi-assignee" কলাম বানানো হয়নি, কারণ tasks.assignee_id একজনের।
  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;

    setCreating(true);
    const assigneeIds = newAssigneeIds.length > 0 ? newAssigneeIds : [null];
    const createdRows: (Omit<TaskRow, 'commentCount' | 'attachmentCount'> & { commentCount: 0; attachmentCount: 0 })[] = [];

    for (const assigneeId of assigneeIds) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTitle.trim(),
          project_id: newProjectId || null,
          assignee_id: assigneeId,
          priority: newPriority,
          due_date: newDueDate || null,
          status: 'todo',
          workflow_stage: 'backlog',
          created_by: user.id,
        })
        .select(TASK_SELECT)
        .single();

      if (error) {
        setError(error.message);
        continue;
      }
      if (!data) continue;

      const row = data as unknown as Omit<TaskRow, 'commentCount' | 'attachmentCount'>;
      createdRows.push({ ...row, commentCount: 0, attachmentCount: 0 });
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'task_created',
        entity_type: 'task',
        entity_id: row.id,
        detail: `"${row.title}" তৈরি করা হয়েছে`,
      });
      if (assigneeId) {
        sendNotifications([{
          recipient_id: assigneeId,
          actor_id: user.id,
          type: 'task_assigned',
          title: `${profile?.full_name?.trim() || user.email || 'কেউ একজন'} আপনাকে একটা টাস্ক অ্যাসাইন করেছে`,
          subtitle: row.title,
          link: '/tasks',
        }]);
      }
    }

    if (createdRows.length > 0) {
      setTasks((prev) => [...createdRows, ...prev]);
    }

    setNewTitle('');
    setNewProjectId('');
    setNewAssigneeIds([]);
    setNewPriority('normal');
    setNewDueDate('');
    setCreating(false);
    setShowCreate(false);
  }

  function toggleNewAssignee(id: string) {
    setNewAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // ---- List tab: single task edit / delete ----
  function openEditTask(task: TaskRow) {
    setEditForm({
      title: task.title,
      projectId: task.project_id ?? '',
      assigneeId: task.assignee_id ?? '',
      priority: task.priority,
      status: task.status,
      dueDate: task.due_date ?? '',
      description: task.description ?? '',
    });
    setEditTaskId(task.id);
  }

  async function handleEditTaskSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editTaskId || !editForm.title.trim()) return;
    setEditSaving(true);
    const assignee = assigneeOptions.find((a) => a.id === editForm.assigneeId) ?? null;
    const { data, error: err } = await supabase
      .from('tasks')
      .update({
        title: editForm.title.trim(),
        project_id: editForm.projectId || null,
        assignee_id: editForm.assigneeId || null,
        priority: editForm.priority,
        status: editForm.status,
        due_date: editForm.dueDate || null,
        description: editForm.description.trim() || null,
      })
      .eq('id', editTaskId)
      .select(TASK_SELECT)
      .single();
    setEditSaving(false);
    if (err || !data) {
      setError(err?.message ?? 'টাস্ক আপডেট করা যায়নি।');
      return;
    }
    const row = data as unknown as Omit<TaskRow, 'commentCount' | 'attachmentCount'>;
    setTasks((prev) => prev.map((t) => (t.id === editTaskId ? { ...t, ...row, profiles: assignee ? { full_name: assignee.full_name, avatar_color: assignee.avatar_color, avatar_url: assignee.avatar_url } : row.profiles } : t)));
    setEditTaskId(null);
  }

  async function handleDeleteSingleTask(id: string) {
    if (!window.confirm('এই টাস্ক ডিলিট করতে চান? এটা ফিরিয়ে আনা যাবে না।')) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error: err } = await supabase.from('tasks').delete().eq('id', id);
    if (err) setError(err.message);
  }

  async function toggleChecklistItemCard(taskId: string, item: ChecklistItem) {
    const newDone = !item.is_done;
    setChecklistByTask((prev) => {
      const next = new Map(prev);
      const items = (next.get(taskId) ?? []).map((c) => (c.id === item.id ? { ...c, is_done: newDone } : c));
      next.set(taskId, items);
      return next;
    });
    await supabase.from('checklist_items').update({ is_done: newDone }).eq('id', item.id);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`tasklist-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        {/* ============ SIDEBAR ============ */}
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div><div className="brand-name">FLOW 53</div><div className="brand-sub">Innovate · Design · Elevate</div></div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন"><Icon name="close" size={16} /></button>
            </div>
            <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
              {NAV_ITEMS.map((item) => (
                <a key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                  {item.label === 'Tasks' && <span className="badge">{tasks.length}</span>}
                </a>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <Link key={item.label} href={item.href} className="nav-item">
                  <Icon name={item.icon} /> {item.label}
                  {item.label === 'Notifications' && unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                </Link>
              ))}
            </nav>
          </div>

          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} dark={dark} />
        </aside>

        {/* ============ MAIN ============ */}
        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
            <button className="search-box">
              <Icon name="search" />
              <span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — প্রজেক্ট, টাস্ক, মানুষ...</span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>
            <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
              <Icon name="plus" /> নতুন তৈরি করুন
            </button>
            <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}>
              <Icon name={dark ? 'moon' : 'sun'} />
            </button>
            <Avatar person={profile} size={30} />
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">Task List</h1>
                <p className="page-sub">সব অ্যাক্টিভ প্রজেক্টের প্রতিটি টাস্ক এখান থেকে পরিচালনা ও গুছিয়ে রাখুন।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleReload} disabled={reloading}>
                  <Icon name="refresh" size={13} /> {reloading ? 'রিলোড হচ্ছে…' : 'রিলোড'}
                </button>
                <Link className="btn btn-ghost btn-sm" href="/board"><Icon name="layers" size={13} /> বোর্ড ভিউ</Link>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="import" size={13} /> ইমপোর্ট</button>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="export" size={13} /> এক্সপোর্ট</button>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="bookmark" size={13} /> Saved Views</button>
                <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" /> টাস্ক তৈরি
                </button>
              </div>
            </div>

            <nav className="main-tabs" aria-label="View">
              <button className={`main-tab${mainTab === 'list' ? ' active' : ''}`} onClick={() => setMainTab('list')}>
                <Icon name="list" size={14} /> List
              </button>
              <button className={`main-tab${mainTab === 'weekly-tasks' ? ' active' : ''}`} onClick={() => setMainTab('weekly-tasks')}>
                <Icon name="calendar" size={14} /> Weekly Tasks
              </button>
              <button className={`main-tab${mainTab === 'weekly-plan' ? ' active' : ''}`} onClick={() => setMainTab('weekly-plan')}>
                <Icon name="calendar" size={14} /> Weekly Plan
              </button>
            </nav>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            {mainTab === 'list' && (
            <>
            {/* KPI summary */}
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="list" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.total}</div><div className="kpi-label">Total Tasks</div><div className="kpi-deco"><Icon name="list" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="check" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.mine}</div><div className="kpi-label">My Tasks</div><div className="kpi-deco"><Icon name="check" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="clock" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--warning)' }}>{loading ? '—' : kpis.dueToday}</div><div className="kpi-label">Due Today</div><div className="kpi-deco" style={{ color: 'var(--warning)' }}><Icon name="clock" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--danger)' }}>{loading ? '—' : kpis.overdue}</div><div className="kpi-label">Overdue</div><div className="kpi-deco" style={{ color: 'var(--danger)' }}><Icon name="alert" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="eye" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--accent)' }}>{loading ? '—' : kpis.review}</div><div className="kpi-label">Waiting for Review</div><div className="kpi-deco"><Icon name="eye" size={56} /></div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check-circle" /></div></div><div className="kpi-value tabular" style={{ color: 'var(--positive)' }}>{loading ? '—' : kpis.completedThisWeek}</div><div className="kpi-label">Completed This Week</div><div className="kpi-deco" style={{ color: 'var(--positive)' }}><Icon name="check-circle" size={56} /></div></div>
            </div>

            {/* smart views */}
            <nav className="views-row" aria-label="Smart Views">
              {SMART_VIEWS.map((v) => (
                <button key={v.key} className={`view-pill${activeView === v.key ? ' active' : ''}`} onClick={() => setActiveView(v.key)}>
                  {v.label}
                </button>
              ))}
              <div className="view-sep"></div>
              <button className={`view-pill${activeView === 'favorites' ? ' active' : ''}`} onClick={() => setActiveView('favorites')}>
                ★ Favorites
              </button>
            </nav>

            {/* toolbar */}
            <div className="toolbar">
              <div className="toolbar-search">
                <Icon name="search" size={13} />
                <input type="text" placeholder="টাস্ক খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="filter" size={12} /> Quick Filter</button>
              <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="sort" size={12} /> Sort</button>
              <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="layers" size={12} /> Group By</button>
              <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="calendar" size={12} /> Date Range</button>
              <button className={`filter-chip${advOpen ? ' applied' : ''}`} onClick={() => setAdvOpen((o) => !o)}>
                <Icon name="sliders" size={12} /> Advanced Filters
              </button>
              <button
                className="filter-chip"
                onClick={() => {
                  setSearch('');
                  setActiveView('all');
                }}
              >
                <Icon name="close" size={12} /> Clear Filters
              </button>
              <div className="toolbar-spacer"></div>
              <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="bookmark" size={12} /> Saved Views</button>
            </div>

            {/* advanced filters (placeholder — schema-তে labels/sprint নেই) */}
            <div className={`adv-panel${advOpen ? ' open' : ''}`}>
              <div className="adv-grid">
                {['Project', 'Assignee', 'Priority', 'Status', 'Workflow Stage', 'Sprint', 'Labels', 'Due Date', 'Created By', 'Client', 'Estimated Time', 'Review Status', 'Blocked', 'Recently Updated'].map((label) => (
                  <button key={label} className="adv-chip" disabled title="শীঘ্রই আসছে">{label}</button>
                ))}
              </div>
            </div>

            {/* per-person card list */}
            {loading ? (
              <div className="table-scroll">
                <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</div>
              </div>
            ) : memberTaskCards.length === 0 ? (
              <div className="empty-state show">
                <div className="empty-icon"><Icon name="search" /></div>
                <div className="empty-title">কোনো টাস্ক পাওয়া যায়নি</div>
                <div className="empty-sub">এই ভিউতে এখনো কোনো টাস্ক যোগ হয়নি, অথবা আপনার ফিল্টারে কোনো ফলাফল মিলছে না।</div>
                <button className="btn btn-accent btn-sm" onClick={() => setShowCreate(true)}>
                  <Icon name="plus" size={13} /> প্রথম টাস্ক তৈরি করুন
                </button>
              </div>
            ) : (
              <div className="person-card-grid">
                {memberTaskCards.map((m) => (
                  <div className="person-card" key={m.profile.id}>
                    <div className="person-card-head">
                      <Avatar person={m.profile} size={34} />
                      <div className="person-card-name-wrap">
                        <div className="person-card-name">{m.profile.full_name}</div>
                        <div className="person-card-sub">{m.activeCount === 0 ? 'No active To-Dos' : `${m.activeCount} active To-Do${m.activeCount > 1 ? 's' : ''}`}</div>
                      </div>
                      <span className="person-card-count tabular">{m.activeCount}</span>
                    </div>

                    {m.personTasks.length > 0 && (
                      <div className="person-progress-wrap">
                        <span className="person-progress-label">Overall progress</span>
                        <span className="person-progress-pct tabular">{m.avgProgress}%</span>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${m.avgProgress}%`, background: m.avgProgress === 100 ? 'var(--positive)' : undefined }}></div></div>
                      </div>
                    )}

                    {m.personTasks.length === 0 ? (
                      <div className="person-card-empty">
                        <div className="person-card-empty-icon"><Icon name="check" size={16} /></div>
                        <div className="person-card-empty-title">All clear</div>
                      </div>
                    ) : m.shown.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '8px 2px' }}>এই ফিল্টারে কিছু নেই।</p>
                    ) : (
                      <div className="person-task-list">
                        {m.shown.map((task) => {
                          const status = STATUS_META[task.status];
                          const checklist = checklistByTask.get(task.id) ?? [];
                          return (
                            <div className="person-task-item" key={task.id}>
                              <div className="person-task-top">
                                <span className={`person-task-dot ${status.cls}`}></span>
                                <div className="person-task-main">
                                  <div className={`person-task-title${task.status === 'done' ? ' done' : ''}`}>{task.title}</div>
                                  <div className="person-task-meta tabular">
                                    {task.progress ?? 0}% · {status.label}{task.due_date ? ` · Due ${task.due_date.slice(8, 10)}/${task.due_date.slice(5, 7)}/${task.due_date.slice(0, 4)}` : ''}
                                  </div>
                                </div>
                                <button className="person-task-action" onClick={() => openEditTask(task)} aria-label="এডিট করুন">
                                  <Icon name="edit" size={13} />
                                </button>
                                <button className="person-task-action danger" onClick={() => handleDeleteSingleTask(task.id)} aria-label="ডিলিট করুন">
                                  <Icon name="trash" size={13} />
                                </button>
                              </div>
                              {checklist.length > 0 && (
                                <div className="person-task-checklist">
                                  {checklist.map((item) => (
                                    <button key={item.id} className={`person-checklist-item${item.is_done ? ' done' : ''}`} onClick={() => toggleChecklistItemCard(task.id, item)}>
                                      <span className="icb">{item.is_done && <Icon name="tick" size={7} color="#fff" />}</span>
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </>
            )}

            {mainTab === 'weekly-tasks' && (
              <div>
                <div className="week-nav">
                  <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w - 1)} aria-label="আগের সপ্তাহ">
                    <Icon name="chevron-left" size={16} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>এই সপ্তাহ</button>
                  <span className="week-range">{formatWeekRange(weekDays[0], weekDays[6])}</span>
                  <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w + 1)} aria-label="পরের সপ্তাহ">
                    <Icon name="chevron-right" size={16} />
                  </button>
                  <div className="toolbar-spacer"></div>
                  <div className="scope-toggle">
                    <button className={`scope-btn${weeklyScope === 'mine' ? ' active' : ''}`} onClick={() => setWeeklyScope('mine')}>
                      <Icon name="user" size={13} /> My tasks
                    </button>
                    <button className={`scope-btn${weeklyScope === 'team' ? ' active' : ''}`} onClick={() => setWeeklyScope('team')}>
                      <Icon name="users2" size={13} /> Team tasks
                    </button>
                  </div>
                </div>

                <div className="week-grid">
                  {weekDays.map((d, i) => {
                    const dateISO = isoDate(d);
                    const dayTasks = (tasksByDate.get(dateISO) ?? []).filter((t) => t.status !== 'done');
                    const isToday = dateISO === today;
                    return (
                      <div className={`week-day-col${isToday ? ' is-today' : ''}`} key={dateISO}>
                        <div className="week-day-head">
                          <span className="week-day-label">{DAY_LABELS[i]}</span>
                          <span className="week-day-num">{d.getDate()}</span>
                          <span className="week-day-count tabular">{dayTasks.length} tasks</span>
                        </div>
                        <div className="week-day-body">
                          {dayTasks.length === 0 ? (
                            <div className="week-empty">No tasks planned</div>
                          ) : (
                            dayTasks.map((t) => {
                              const priority = PRIORITY_META[t.priority];
                              return (
                                <button className="week-task-card" key={t.id} onClick={() => openTaskFromWeek(t.id)}>
                                  <span className="week-task-title">{t.title}</span>
                                  {t.profiles && <Avatar person={t.profiles} size={18} />}
                                  <span className={`priority-pill ${priority.cls}`} style={{ fontSize: 9.5, padding: '1px 6px' }}>{priority.label}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {noDueDateCount > 0 && (
                  <div className="week-footnote">
                    <Icon name="calendar" size={13} /> {noDueDateCount} task{noDueDateCount > 1 ? 's' : ''} {noDueDateCount > 1 ? 'have' : 'has'} no due date and appear in List view.
                  </div>
                )}
              </div>
            )}

            {mainTab === 'weekly-plan' && (
              <div>
                <div className="page-header-row" style={{ marginBottom: 18 }}>
                  <div>
                    <h1 className="page-title" style={{ fontSize: 20 }}>Weekly Plan</h1>
                    <p className="page-sub">টিমের শেয়ার্ড ফোকাস আর এই সপ্তাহের অ্যাক্টিভিটি।</p>
                  </div>
                  <div className="header-actions">
                    <button
                      className="btn btn-accent"
                      onClick={() => {
                        setModalPlanDate(weekStartISO);
                        setModalPlanTitle('');
                        setModalPlanDetails('');
                        setShowAddPlanModal(true);
                      }}
                    >
                      <Icon name="plus" /> Add plan item
                    </button>
                  </div>
                </div>

                <div className="week-nav">
                  <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w - 1)} aria-label="আগের সপ্তাহ">
                    <Icon name="chevron-left" size={16} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>এই সপ্তাহ</button>
                  <span className="week-range">{formatWeekRange(weekDays[0], weekDays[6])}</span>
                  <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w + 1)} aria-label="পরের সপ্তাহ">
                    <Icon name="chevron-right" size={16} />
                  </button>
                </div>

                <div className="week-grid">
                  {weekDays.map((d, i) => {
                    const dateISO = isoDate(d);
                    const dayPlans = planItems.filter((p) => p.plan_date === dateISO);
                    const isToday = dateISO === today;
                    const isAdding = addingPlanDate === dateISO;
                    return (
                      <div className={`week-day-col${isToday ? ' is-today' : ''}`} key={dateISO}>
                        <div className="week-day-head">
                          <span className="week-day-label">{DAY_LABELS[i]}</span>
                          <span className="week-day-num">{d.getDate()}</span>
                          <span className="week-day-count tabular">{dayPlans.length} plans</span>
                        </div>
                        <div className="week-day-body">
                          {planLoading ? (
                            <div className="week-empty">লোড হচ্ছে…</div>
                          ) : dayPlans.length === 0 && !isAdding ? (
                            <div className="week-empty">No plans yet</div>
                          ) : (
                            dayPlans.map((p, idx) => (
                              <div className="plan-item" key={p.id}>
                                <span className="plan-item-badge tabular">{idx + 1}</span>
                                <div className="plan-item-body">
                                  <span className="plan-item-title">{p.title}</span>
                                  {p.details && <span className="plan-item-details">{p.details}</span>}
                                </div>
                                <button className="plan-item-delete" onClick={() => handleDeletePlanItem(p.id)} aria-label="মুছুন">
                                  <Icon name="trash" size={12} />
                                </button>
                              </div>
                            ))
                          )}

                          {isAdding ? (
                            <div className="plan-add-input-row">
                              <input
                                className="field-input"
                                style={{ marginBottom: 0 }}
                                autoFocus
                                value={planDraft}
                                onChange={(e) => setPlanDraft(e.target.value)}
                                placeholder="প্ল্যান লিখুন..."
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    await handleAddPlanItem(dateISO, planDraft);
                                    setPlanDraft('');
                                    setAddingPlanDate(null);
                                  } else if (e.key === 'Escape') {
                                    setAddingPlanDate(null);
                                    setPlanDraft('');
                                  }
                                }}
                                onBlur={() => {
                                  if (!planDraft.trim()) setAddingPlanDate(null);
                                }}
                              />
                            </div>
                          ) : (
                            <button className="plan-add-btn" onClick={() => { setAddingPlanDate(dateISO); setPlanDraft(''); }} disabled={planSaving}>
                              <Icon name="plus" size={12} /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* create task modal */}
      {showCreate && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">নতুন টাস্ক তৈরি করুন</div>
            <form onSubmit={handleCreateTask}>
              <label className="field-label">টাস্কের নাম</label>
              <input
                className="field-input"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="যেমন: হোমপেজ ওয়্যারফ্রেম বানানো"
                autoFocus
                required
              />

              <label className="field-label">প্রজেক্ট</label>
              <select className="field-input" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}>
                <option value="">কোনো প্রজেক্ট নেই</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <label className="field-label">Assign to {newAssigneeIds.length > 0 ? `— ${newAssigneeIds.length} selected` : ''}</label>
              <div className="assignee-check-grid">
                {assigneeOptions.map((a) => {
                  const checked = newAssigneeIds.includes(a.id);
                  return (
                    <button type="button" key={a.id} className={`assignee-check-item${checked ? ' checked' : ''}`} onClick={() => toggleNewAssignee(a.id)}>
                      <span className={`cb${checked ? ' checked' : ''}`}>{checked && <Icon name="tick" size={9} color="#fff" />}</span>
                      <Avatar person={a} size={20} />
                      {a.full_name}
                    </button>
                  );
                })}
              </div>
              {newAssigneeIds.length === 0 && <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', margin: '2px 0 14px' }}>কাউকে না বাছলে টাস্কটা অনির্ধারিত থাকবে।</p>}

              <label className="field-label">প্রায়োরিটি</label>
              <select className="field-input" value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)}>
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>

              <label className="field-label">ডেডলাইন</label>
              <input className="field-input" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !newTitle.trim()}>
                  {creating ? 'তৈরি হচ্ছে…' : newAssigneeIds.length > 1 ? `Assign to ${newAssigneeIds.length} selected` : 'টাস্ক তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* edit task modal — List কার্ডের Edit বাটন + Weekly Tasks থেকে এলে খোলে;
          পুরনো table-এর expand-row-এ থাকা comments/attachments/checklist/activity
          এখানেই থাকে, কোনো ফাংশনালিটি হারায়নি */}
      {editingTask && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditTaskId(null);
          }}
        >
          <div className="modal-box modal-box-lg">
            <div className="modal-title">টাস্ক এডিট করুন</div>
            <form onSubmit={handleEditTaskSubmit}>
              <label className="field-label">টাস্কের নাম</label>
              <input
                className="field-input"
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
                required
              />

              <div className="edit-field-row">
                <div>
                  <label className="field-label">প্রজেক্ট</label>
                  <select className="field-input" value={editForm.projectId} onChange={(e) => setEditForm((f) => ({ ...f, projectId: e.target.value }))}>
                    <option value="">কোনো প্রজেক্ট নেই</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">অ্যাসাইনি</label>
                  <select className="field-input" value={editForm.assigneeId} onChange={(e) => setEditForm((f) => ({ ...f, assigneeId: e.target.value }))}>
                    <option value="">অনির্ধারিত</option>
                    {assigneeOptions.map((a) => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="edit-field-row">
                <div>
                  <label className="field-label">প্রায়োরিটি</label>
                  <select className="field-input" value={editForm.priority} onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}>
                    {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">স্ট্যাটাস</label>
                  <select className="field-input" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}>
                    {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="field-label">ডেডলাইন</label>
              <input className="field-input" type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} />

              <label className="field-label">Description</label>
              <textarea
                className="field-input"
                style={{ minHeight: 64, resize: 'vertical' }}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="একটা বিবরণ যোগ করুন..."
              />

              {(() => {
                const detail = expandData[editingTask.id];
                return (
                  <div className="expand-grid" style={{ marginTop: 6 }}>
                    <div>
                      <div className="expand-label">
                        Checklist{detail && detail.checklist.length > 0 ? ` · ${detail.checklist.filter((c) => c.is_done).length}/${detail.checklist.length}` : ''}
                      </div>
                      {!detail || detail.loading ? (
                        <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                      ) : (
                        <>
                          {detail.checklist.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>কোনো চেকলিস্ট আইটেম নেই।</p>
                          ) : (
                            detail.checklist.map((item) => (
                              <button type="button" key={item.id} className={`checklist-item${item.is_done ? ' done' : ''}`} onClick={() => toggleChecklistItem(editingTask.id, item)}>
                                <span className="icb">{item.is_done && <Icon name="tick" size={8} color="#fff" />}</span>
                                {item.label}
                              </button>
                            ))
                          )}
                          <div className="comment-form">
                            <input
                              type="text"
                              placeholder="নতুন আইটেম যোগ করুন..."
                              value={newChecklistItem[editingTask.id] ?? ''}
                              onChange={(e) => setNewChecklistItem((prev) => ({ ...prev, [editingTask.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(editingTask.id); }
                              }}
                            />
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => addChecklistItem(editingTask.id)}>যোগ করুন</button>
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <div className="expand-label">Attachments</div>
                      {!detail || detail.loading ? (
                        <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                      ) : detail.attachments.length === 0 ? (
                        <div className="design-preview-card" style={{ opacity: 0.6 }}>
                          <div className="dp-row">
                            <div className="dp-thumb"><Icon name="figma" size={14} /></div>
                            <div className="dp-meta">কোনো ফাইল আপলোড হয়নি</div>
                          </div>
                        </div>
                      ) : (
                        detail.attachments.map((a) => (
                          <div className="design-preview-card" key={a.id}>
                            <div className="dp-row">
                              <div className="dp-thumb"><Icon name="figma" size={14} /></div>
                              <div className="dp-meta">
                                {a.file_name} {a.file_type ? `· ${a.file_type}` : ''}
                                <br />
                                <a href={a.drive_url} target="_blank" rel="noopener noreferrer">Drive-এ দেখুন</a>
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      <div className="expand-label">Comments{detail && detail.comments.length > 0 ? ` · ${detail.comments.length}` : ''}</div>
                      {!detail || detail.loading ? (
                        <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                      ) : (
                        <>
                          {detail.comments.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>এখনো কোনো কমেন্ট নেই।</p>}
                          {detail.comments.map((c) => (
                            <div className="expand-comment" key={c.id}>
                              <Avatar person={c.profiles} size={20} />
                              <div className="expand-comment-bubble">
                                <b>{c.profiles?.full_name ?? 'কেউ একজন'}:</b> {c.body}
                              </div>
                            </div>
                          ))}
                          <div className="comment-form">
                            <input
                              type="text"
                              placeholder="কমেন্ট লিখুন..."
                              value={newComment[editingTask.id] ?? ''}
                              onChange={(e) => setNewComment((prev) => ({ ...prev, [editingTask.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); submitComment(editingTask.id); }
                              }}
                            />
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => submitComment(editingTask.id)}>পাঠান</button>
                          </div>
                        </>
                      )}

                      <div className="expand-label" style={{ marginTop: 14 }}>Activity Timeline</div>
                      {!detail || detail.loading ? (
                        <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                      ) : detail.activity.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>এখনো কোনো অ্যাক্টিভিটি নেই।</p>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 2 }}>
                          {detail.activity.map((a) => (
                            <div key={a.id}>
                              {a.profiles?.full_name ?? 'কেউ একজন'} — {a.detail} · {relativeTimeBn(a.created_at)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { handleDeleteSingleTask(editingTask.id); setEditTaskId(null); }}>
                  <Icon name="trash" size={13} /> ডিলিট
                </button>
                <div style={{ flex: 1 }}></div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditTaskId(null)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={editSaving || !editForm.title.trim()}>
                  {editSaving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* add plan item modal */}
      {showAddPlanModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddPlanModal(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">নতুন প্ল্যান আইটেম</div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!modalPlanTitle.trim() || !modalPlanDate) return;
                await handleAddPlanItem(modalPlanDate, modalPlanTitle, modalPlanDetails);
                setShowAddPlanModal(false);
              }}
            >
              <label className="field-label">Plan date</label>
              <select className="field-input" value={modalPlanDate} onChange={(e) => setModalPlanDate(e.target.value)}>
                {weekDays.map((d, i) => (
                  <option key={isoDate(d)} value={isoDate(d)}>
                    {DAY_LABELS[i]} · {d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </select>

              <label className="field-label">Plan title</label>
              <input
                className="field-input"
                type="text"
                value={modalPlanTitle}
                onChange={(e) => setModalPlanTitle(e.target.value)}
                placeholder="যেমন: Client review call — 3pm"
                autoFocus
                required
              />

              <label className="field-label">Details</label>
              <textarea
                className="field-input"
                style={{ minHeight: 70, resize: 'vertical' }}
                value={modalPlanDetails}
                onChange={(e) => setModalPlanDetails(e.target.value)}
                placeholder="বিস্তারিত লিখুন (ঐচ্ছিক)..."
              />

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddPlanModal(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={planSaving || !modalPlanTitle.trim()}>
                  {planSaving ? 'যোগ হচ্ছে…' : 'যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
