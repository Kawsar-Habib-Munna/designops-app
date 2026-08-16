'use client';

// Mission Control — Kanban বোর্ড। schema-র tasks.workflow_stage কলামের ৯টা
// ভ্যালুই বোর্ডের ৯টা কলাম, তাই এটা পুরোপুরি রিয়েল ডেটা দিয়ে বানানো সম্ভব হয়েছে:
//
// - Drag & drop → workflow_stage আপডেট হয় Supabase-এ (completed কলামে গেলে
//   status='done', বের হলে আবার 'todo')
// - ডান পাশের ড্রয়ার — status/priority/assignee/due-date এডিট, checklist টগল,
//   কমেন্ট যোগ, লগড আওয়ার আপডেট — সব রিয়েল Supabase রাইট
// - "লাইভ অ্যাক্টিভিটি" — activity_log টেবিলের realtime INSERT সাবস্ক্রিপশন
// - টপবারের presence avatar-stack — Supabase Realtime Presence (কে এখন এই
//   বোর্ড পেজে আছে, কোনো নতুন টেবিল ছাড়াই)
// - AI প্যানেলের ইনসাইট — rule-based, রিয়েল ডেটা থেকে জেনারেট করা
//
// বাদ দেওয়া হয়েছে: column WIP limit ও "sprint" — schema-তে এই concept-গুলোর
// কোনো টেবিল/কলাম নেই।

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import './board.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDateLong, relativeTimeBn, todayISO } from '@/lib/format';
import { STATUS_META, PRIORITY_META, STAGE_LABEL, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
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
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sort: '<path d="M7 4v16"/><path d="M3 8l4-4 4 4"/><path d="M17 20V4"/><path d="M21 16l-4 4-4-4"/>',
  layers: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.9"/><path d="M8.6 13.4l6.8 3.9"/>',
  filter: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  paperclip: '<path d="M21 11.5l-9.2 9.2a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8.2-8.2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 4h13l3.5 8v8H2v-8z"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  tick: '<path d="M20 6L9 17l-5-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 15, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

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

const COLUMNS: { key: string; label: string; dot: string }[] = [
  { key: 'backlog', label: 'Backlog', dot: '#A3A3AE' },
  { key: 'ready', label: 'Ready', dot: '#4FC3F7' },
  { key: 'wireframing', label: 'Wireframing', dot: '#5B4FE8' },
  { key: 'ui_design', label: 'UI Design', dot: '#8F86FF' },
  { key: 'ux_review', label: 'UX Review', dot: '#F5A524' },
  { key: 'client_review', label: 'Client Review', dot: '#E5484D' },
  { key: 'revision', label: 'Revision', dot: '#FF8A65' },
  { key: 'handoff', label: 'Ready for Handoff', dot: '#3CCB7F' },
  { key: 'completed', label: 'Completed', dot: '#17A34A' },
];

const PROJECT_DOT_COLORS = ['#5B4FE8', '#2DD4BF', '#F5A524', '#FF5A36', '#9B8CFF', '#4FC3F7', '#F06292', '#6EE7B7'];
function projectColor(id: string | null) {
  if (!id) return 'var(--ink-faint)';
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROJECT_DOT_COLORS[hash % PROJECT_DOT_COLORS.length];
}

function dueClass(dueDate: string | null, status: TaskStatus, today: string): '' | 'due-soon' | 'due-late' {
  if (!dueDate || status === 'done') return '';
  if (dueDate < today) return 'due-late';
  if (dueDate === today) return 'due-soon';
  return '';
}

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null };
type ProjectOption = { id: string; name: string };
type AssigneeOption = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };

type RawTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  workflow_stage: string;
  priority: TaskPriority;
  is_blocked: boolean;
  due_date: string | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  progress: number | null;
  updated_at: string;
  project_id: string | null;
  assignee_id: string | null;
};

type BoardTask = RawTaskRow & {
  projects: { name: string } | null;
  profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
  commentCount: number;
  attachmentCount: number;
  checklistDone: number;
  checklistTotal: number;
};

type ChecklistItem = { id: string; label: string; is_done: boolean; position: number };
type CommentRow = { id: string; body: string; created_at: string; profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null };
type AttachmentRow = { id: string; file_name: string; file_type: string | null; drive_url: string };
type TaskActivityRow = { id: string; detail: string | null; created_at: string; profiles: { full_name: string } | null };
type DrawerData = { checklist: ChecklistItem[]; comments: CommentRow[]; attachments: AttachmentRow[]; activity: TaskActivityRow[]; loading: boolean };
type LiveEvent = { id: string; text: string; at: string };
type PresenceMeta = { name: string; avatar_color: string | null; avatar_url: string | null };

const TASK_SELECT =
  'id, title, description, status, workflow_stage, priority, is_blocked, due_date, estimated_hours, logged_hours, progress, updated_at, project_id, assignee_id, projects(name), profiles!assignee_id(full_name, avatar_color, avatar_url)';

async function fetchBoardData() {
  const [tasksRes, commentsRes, attachmentsRes, checklistRes, projectsRes, teamRes] = await Promise.all([
    supabase.from('tasks').select(TASK_SELECT).order('updated_at', { ascending: false }),
    supabase.from('comments').select('task_id'),
    supabase.from('attachments').select('task_id'),
    supabase.from('checklist_items').select('task_id, is_done'),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
  ]);

  const firstErrored = [tasksRes, commentsRes, attachmentsRes, checklistRes, projectsRes, teamRes].find((r) => r.error);

  const commentCounts = new Map<string, number>();
  for (const row of (commentsRes.data as { task_id: string }[]) ?? []) commentCounts.set(row.task_id, (commentCounts.get(row.task_id) ?? 0) + 1);

  const attachmentCounts = new Map<string, number>();
  for (const row of (attachmentsRes.data as { task_id: string }[]) ?? []) attachmentCounts.set(row.task_id, (attachmentCounts.get(row.task_id) ?? 0) + 1);

  const checklistCounts = new Map<string, { done: number; total: number }>();
  for (const row of (checklistRes.data as { task_id: string; is_done: boolean }[]) ?? []) {
    const cur = checklistCounts.get(row.task_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (row.is_done) cur.done += 1;
    checklistCounts.set(row.task_id, cur);
  }

  const rows: BoardTask[] = ((tasksRes.data as unknown as Omit<BoardTask, 'commentCount' | 'attachmentCount' | 'checklistDone' | 'checklistTotal'>[]) ?? []).map((t) => ({
    ...t,
    commentCount: commentCounts.get(t.id) ?? 0,
    attachmentCount: attachmentCounts.get(t.id) ?? 0,
    checklistDone: checklistCounts.get(t.id)?.done ?? 0,
    checklistTotal: checklistCounts.get(t.id)?.total ?? 0,
  }));

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    tasks: rows,
    projectOptions: (projectsRes.data as ProjectOption[]) ?? [],
    assigneeOptions: (teamRes.data as AssigneeOption[]) ?? [],
  };
}

export default function BoardPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriority>>(new Set());
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null);
  const [newComment, setNewComment] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [newDueDate, setNewDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [presentUsers, setPresentUsers] = useState<{ id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>([]);

  const projectOptionsRef = useRef<ProjectOption[]>([]);
  const assigneeOptionsRef = useRef<AssigneeOption[]>([]);
  useEffect(() => {
    projectOptionsRef.current = projectOptions;
  }, [projectOptions]);
  useEffect(() => {
    assigneeOptionsRef.current = assigneeOptions;
  }, [assigneeOptions]);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchBoardData(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setTasks(result.tasks);
      setProjectOptions(result.projectOptions);
      setAssigneeOptions(result.assigneeOptions);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user]);

  // realtime: board sync (tasks) + live activity feed (activity_log)
  useEffect(() => {
    if (!user) return;

    function resolveProject(id: string | null) {
      return id ? projectOptionsRef.current.find((p) => p.id === id)?.name ?? null : null;
    }
    function resolveAssignee(id: string | null) {
      const a = id ? assigneeOptionsRef.current.find((x) => x.id === id) : null;
      return a ? { full_name: a.full_name, avatar_color: a.avatar_color, avatar_url: a.avatar_url } : null;
    }

    const channel = supabase
      .channel('board-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const row = payload.new as RawTaskRow;
        setTasks((prev) =>
          prev.some((t) => t.id === row.id)
            ? prev
            : [{ ...row, projects: row.project_id ? { name: resolveProject(row.project_id) ?? '' } : null, profiles: resolveAssignee(row.assignee_id), commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0 }, ...prev]
        );
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const row = payload.new as RawTaskRow;
        setTasks((prev) =>
          prev.map((t) =>
            t.id === row.id
              ? { ...t, ...row, projects: row.project_id ? { name: resolveProject(row.project_id) ?? t.projects?.name ?? '' } : null, profiles: resolveAssignee(row.assignee_id) }
              : t
          )
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        const old = payload.old as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== old.id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
        const row = payload.new as { id: string; actor_id: string | null; detail: string | null; created_at: string };
        const actorName = assigneeOptionsRef.current.find((a) => a.id === row.actor_id)?.full_name ?? 'কেউ একজন';
        setLiveEvents((prev) => [{ id: row.id, text: `${actorName} ${row.detail ?? ''}`, at: row.created_at }, ...prev].slice(0, 6));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // realtime presence: who else is on this board right now
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('board-presence', { config: { presence: { key: user.id } } });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const others = Object.entries(state)
        .filter(([key]) => key !== user.id)
        .map(([key, metas]) => ({ id: key, name: metas[0]?.name ?? '?', avatar_color: metas[0]?.avatar_color ?? null, avatar_url: metas[0]?.avatar_url ?? null }));
      setPresentUsers(others);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ name: profile.full_name, avatar_color: profile.avatar_color, avatar_url: profile.avatar_url ?? null });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  async function moveTask(taskId: string, newStage: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.workflow_stage === newStage || !user) return;

    const newStatus: TaskStatus = newStage === 'completed' ? 'done' : task.status === 'done' ? 'todo' : task.status;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, workflow_stage: newStage, status: newStatus } : t)));

    const { error } = await supabase.from('tasks').update({ workflow_stage: newStage, status: newStatus }).eq('id', taskId);
    if (error) {
      setError(error.message);
      return;
    }

    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'status_changed',
      entity_type: 'task',
      entity_id: taskId,
      detail: `"${task.title}" "${STAGE_LABEL[newStage] ?? newStage}"-এ সরানো হয়েছে`,
    });
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm('এই টাস্কটা ডিলিট করতে চান? এটা ফিরিয়ে আনা যাবে না।')) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) setError(error.message);
  }

  async function openDrawer(taskId: string) {
    setDrawerTaskId(taskId);
    setNewComment('');
    setDrawerData({ checklist: [], comments: [], attachments: [], activity: [], loading: true });

    const [checklistRes, commentsRes, attachmentsRes, activityRes] = await Promise.all([
      supabase.from('checklist_items').select('id, label, is_done, position').eq('task_id', taskId).order('position'),
      supabase.from('comments').select('id, body, created_at, profiles(full_name, avatar_color, avatar_url)').eq('task_id', taskId).order('created_at'),
      supabase.from('attachments').select('id, file_name, file_type, drive_url').eq('task_id', taskId).order('uploaded_at', { ascending: false }),
      supabase.from('activity_log').select('id, detail, created_at, profiles(full_name)').eq('entity_type', 'task').eq('entity_id', taskId).order('created_at', { ascending: false }).limit(10),
    ]);

    setDrawerData({
      checklist: (checklistRes.data as ChecklistItem[]) ?? [],
      comments: (commentsRes.data as unknown as CommentRow[]) ?? [],
      attachments: (attachmentsRes.data as AttachmentRow[]) ?? [],
      activity: (activityRes.data as unknown as TaskActivityRow[]) ?? [],
      loading: false,
    });
  }

  function closeDrawer() {
    setDrawerTaskId(null);
    setDrawerData(null);
  }

  async function updateTaskField(taskId: string, patch: Partial<Pick<BoardTask, 'status' | 'priority' | 'assignee_id' | 'due_date' | 'logged_hours'>>) {
    if (!user) return;
    const assignee = 'assignee_id' in patch ? assigneeOptions.find((a) => a.id === patch.assignee_id) ?? null : undefined;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch, ...(assignee !== undefined ? { profiles: assignee ? { full_name: assignee.full_name, avatar_color: assignee.avatar_color, avatar_url: assignee.avatar_url } : null } : {}) } : t))
    );

    const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
    if (error) setError(error.message);
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    if (!drawerTaskId) return;
    const newDone = !item.is_done;
    setDrawerData((prev) => (prev ? { ...prev, checklist: prev.checklist.map((c) => (c.id === item.id ? { ...c, is_done: newDone } : c)) } : prev));
    setTasks((prev) =>
      prev.map((t) =>
        t.id === drawerTaskId
          ? { ...t, checklistDone: t.checklistDone + (newDone ? 1 : -1) }
          : t
      )
    );
    await supabase.from('checklist_items').update({ is_done: newDone }).eq('id', item.id);
  }

  async function submitComment() {
    if (!drawerTaskId || !user || !newComment.trim()) return;
    const body = newComment.trim();

    const { data, error } = await supabase
      .from('comments')
      .insert({ task_id: drawerTaskId, author_id: user.id, body })
      .select('id, body, created_at, profiles(full_name, avatar_color, avatar_url)')
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setDrawerData((prev) => (prev ? { ...prev, comments: [...prev.comments, data as unknown as CommentRow] } : prev));
    setTasks((prev) => prev.map((t) => (t.id === drawerTaskId ? { ...t, commentCount: t.commentCount + 1 } : t)));
    setNewComment('');
  }

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;

    setCreating(true);
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTitle.trim(),
        project_id: newProjectId || null,
        assignee_id: newAssigneeId || null,
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
      setCreating(false);
      return;
    }

    if (data) {
      const row = data as unknown as Omit<BoardTask, 'commentCount' | 'attachmentCount' | 'checklistDone' | 'checklistTotal'>;
      setTasks((prev) => [{ ...row, commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0 }, ...prev]);
      await supabase.from('activity_log').insert({ actor_id: user.id, action: 'task_created', entity_type: 'task', entity_id: row.id, detail: `"${row.title}" তৈরি করা হয়েছে` });
    }

    setNewTitle('');
    setNewProjectId('');
    setNewAssigneeId('');
    setNewPriority('normal');
    setNewDueDate('');
    setCreating(false);
    setShowCreate(false);
  }

  const today = todayISO();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (priorityFilter.size > 0 && !priorityFilter.has(t.priority)) return false;
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false;
      if (projectFilter && t.project_id !== projectFilter) return false;
      return true;
    });
  }, [tasks, search, priorityFilter, assigneeFilter, projectFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BoardTask[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const t of filtered) {
      const list = map.get(t.workflow_stage);
      if (list) list.push(t);
      else map.set(t.workflow_stage, [t]);
    }
    return map;
  }, [filtered]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const blocked = tasks.filter((t) => t.is_blocked && t.status !== 'done');
    if (blocked.length > 0) list.push(`${blocked.length}টা টাস্ক ব্লকড অবস্থায় আছে।`);

    const nonEmptyCols = COLUMNS.filter((c) => c.key !== 'completed' && c.key !== 'backlog').map((c) => ({ ...c, count: grouped.get(c.key)?.length ?? 0 }));
    const busiest = nonEmptyCols.sort((a, b) => b.count - a.count)[0];
    if (busiest && busiest.count >= 4) list.push(`"${busiest.label}" কলামে কাজ জমে গেছে (${busiest.count}টা) — নজর দেওয়া দরকার।`);

    const loadMap = new Map<string, number>();
    for (const t of tasks) {
      if (!t.assignee_id || t.status === 'done') continue;
      loadMap.set(t.assignee_id, (loadMap.get(t.assignee_id) ?? 0) + 1);
    }
    const topLoad = Array.from(loadMap.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topLoad && topLoad[1] >= 5) {
      const name = assigneeOptions.find((a) => a.id === topLoad[0])?.full_name ?? 'একজন';
      list.push(`${name}-এর workload সীমা ছাড়িয়ে গেছে (${topLoad[1]}টা সক্রিয় টাস্ক)।`);
    }

    const overdue = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'done');
    if (overdue.length > 0) list.push(`${overdue.length}টা টাস্কের ডেডলাইন পার হয়ে গেছে।`);

    if (list.length === 0) list.push('বোর্ড এই মুহূর্তে ভালো অবস্থায় আছে — কোনো জরুরি সতর্কতা নেই।');
    return list;
  }, [tasks, grouped, assigneeOptions, today]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const drawerTask = tasks.find((t) => t.id === drawerTaskId) ?? null;

  return (
    <div className={`kanban-root${dark ? ' dark' : ''}`}>
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
                <a key={item.label} href={item.href} className="nav-item">
                  <Icon name={item.icon} /> {item.label}
                  {item.label === 'Notifications' && unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                </a>
              ))}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} dark={dark} />
        </aside>

        {/* ============ MAIN ============ */}
        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
            <div className="board-title-block">
              <span className="board-title">Mission Control</span>
              <span className="board-sub">সব প্রজেক্টের সব টাস্ক — এক বোর্ডে</span>
            </div>
            <div className="search-box">
              <Icon name="search" size={13} />
              <input type="text" placeholder="টাস্ক খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="kbd">⌘K</span>
            </div>
            <div className="topbar-spacer"></div>

            {presentUsers.length > 0 && (
              <div className="presence-row avatar-stack" title="বর্তমানে এই বোর্ডে সক্রিয়">
                {presentUsers.slice(0, 4).map((p) => (
                  <Avatar key={p.id} person={{ full_name: p.name, avatar_color: p.avatar_color, avatar_url: p.avatar_url }} size={26} title={p.name}>
                    <span className="presence-ring"></span>
                  </Avatar>
                ))}
              </div>
            )}

            <button className="btn btn-accent" onClick={() => setShowCreate(true)}><Icon name="plus" /> টাস্ক</button>
            <a className="icon-btn" href="/tasks" title="টেবিল ভিউ"><Icon name="layers" /></a>
            <button className="icon-btn" disabled title="শীঘ্রই আসছে"><Icon name="sort" /></button>
            <button className="icon-btn" disabled title="শীঘ্রই আসছে"><Icon name="share" /></button>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}><Icon name={dark ? 'moon' : 'sun'} /></button>
          </header>

          {/* FILTER BAR */}
          <div className="filterbar" aria-label="ফিল্টার">
            {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
              <button
                key={p}
                className={`filter-chip${priorityFilter.has(p) ? ' applied' : ''}`}
                onClick={() =>
                  setPriorityFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(p)) next.delete(p);
                    else next.add(p);
                    return next;
                  })
                }
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
            <div className="filter-sep"></div>
            <select className="filter-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">সব অ্যাসাইনি</option>
              {assigneeOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
            <select className="filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">সব প্রজেক্ট</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="filter" size={12} /> Deadline</button>
            <button className="filter-chip" disabled title="শীঘ্রই আসছে">Labels</button>
            <button
              className="filter-chip"
              onClick={() => {
                setSearch('');
                setPriorityFilter(new Set());
                setAssigneeFilter('');
                setProjectFilter('');
              }}
            >
              <Icon name="close" size={12} /> Clear
            </button>
            <button className="filter-chip saved-views" disabled title="শীঘ্রই আসছে"><Icon name="bookmark" size={12} /> Saved Views</button>
          </div>

          {error && (
            <div style={{ margin: '10px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>
          )}

          {/* BOARD */}
          <div className="board-wrap">
            {loading ? (
              <p style={{ padding: 20, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : (
              <div className="board-track">
                {COLUMNS.map((col) => {
                  const colTasks = grouped.get(col.key) ?? [];
                  const doneCount = colTasks.filter((t) => t.status === 'done').length;
                  const fillPct = colTasks.length > 0 ? Math.round((doneCount / colTasks.length) * 100) : 0;
                  return (
                    <div
                      key={col.key}
                      className={`column${dragOverCol === col.key ? ' drag-over' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverCol(col.key);
                      }}
                      onDragLeave={() => setDragOverCol((cur) => (cur === col.key ? null : cur))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverCol(null);
                        if (draggedId) moveTask(draggedId, col.key);
                      }}
                    >
                      <div className="column-head">
                        <div className="column-head-top">
                          <span className="col-dot" style={{ background: col.dot }}></span>
                          <span className="col-title">{col.label}</span>
                          <span className="col-count tabular">{colTasks.length}</span>
                        </div>
                        <div className="col-progress"><div className="col-progress-fill" style={{ width: `${col.key === 'completed' ? 100 : fillPct}%`, background: col.dot }}></div></div>
                      </div>
                      <div className="column-body">
                        {colTasks.length === 0 ? (
                          <div className="col-empty">
                            <div className="col-empty-icon"><Icon name="inbox" size={14} /></div>
                            <div className="col-empty-title">এই ধাপে কোনো টাস্ক নেই</div>
                            <div className="col-empty-sub">টাস্ক ড্র্যাগ করে এখানে আনুন</div>
                          </div>
                        ) : (
                          colTasks.map((task) => {
                            const priority = PRIORITY_META[task.priority];
                            const dc = dueClass(task.due_date, task.status, today);
                            return (
                              <div
                                key={task.id}
                                className={`task-card${draggedId === task.id ? ' dragging' : ''}${task.is_blocked ? ' blocked' : ''}`}
                                draggable
                                onDragStart={() => setDraggedId(task.id)}
                                onDragEnd={() => setDraggedId(null)}
                                onClick={() => openDrawer(task.id)}
                              >
                                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                                  <button className="card-action-btn" title="খুলুন" onClick={() => openDrawer(task.id)}><Icon name="external" size={13} /></button>
                                  <button className="card-action-btn" title="ডিলিট" onClick={() => deleteTask(task.id)}><Icon name="trash" size={13} /></button>
                                </div>
                                <div className="card-top-row">
                                  <span className={`priority-dot-badge ${priority.cls}`}>{priority.label}</span>
                                  {task.is_blocked && <span className="blocked-flag"><Icon name="alert" size={11} />ব্লকড</span>}
                                </div>
                                <div className="card-title">{task.title}</div>
                                {task.projects && (
                                  <div className="card-project"><span className="proj-dot" style={{ background: projectColor(task.project_id) }}></span>{task.projects.name}</div>
                                )}
                                {task.progress !== null && task.progress > 0 && (
                                  <div className="card-progress-track"><div className="card-progress-fill" style={{ width: `${task.progress}%` }}></div></div>
                                )}
                                <div className="card-meta-row">
                                  {task.due_date && (
                                    <span className={`card-meta-item${dc ? ` ${dc}` : ''}`}><Icon name="calendar" size={11} />{formatBnDateLong(task.due_date).split(',')[0]}</span>
                                  )}
                                  {!!task.estimated_hours && <span className="card-meta-item"><Icon name="clock" size={11} />{task.estimated_hours}h</span>}
                                  {task.commentCount > 0 && <span className="card-meta-item"><Icon name="message" size={11} />{task.commentCount}</span>}
                                  {task.attachmentCount > 0 && <span className="card-meta-item"><Icon name="paperclip" size={11} />{task.attachmentCount}</span>}
                                </div>
                                <div className="card-foot">
                                  <span className="checklist-mini">{task.checklistTotal > 0 ? `${task.checklistDone}/${task.checklistTotal}` : '—'}</span>
                                  {task.profiles && (
                                    <Avatar person={task.profiles} size={20} />
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ RIGHT INSPECTOR DRAWER ============ */}
      <div className={`overlay-scrim${drawerTask ? ' open' : ''}`} onClick={closeDrawer}></div>
      <aside className={`drawer${drawerTask ? ' open' : ''}`} aria-label="টাস্ক ইন্সপেক্টর">
        {drawerTask && (
          <>
            <div className="drawer-head">
              <button className="icon-btn" onClick={closeDrawer}><Icon name="close" /></button>
              <span className="drawer-head-title">{drawerTask.title}</span>
              <button className="icon-btn" title="ডিলিট" onClick={() => { deleteTask(drawerTask.id); closeDrawer(); }}><Icon name="trash" /></button>
            </div>
            <div className="drawer-body">
              <div className="drawer-section">
                <div className="drawer-field-grid">
                  <div>
                    <div className="drawer-field-label">Status</div>
                    <select className="drawer-select" value={drawerTask.status} onChange={(e) => updateTaskField(drawerTask.id, { status: e.target.value as TaskStatus })}>
                      {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="drawer-field-label">Priority</div>
                    <select className="drawer-select" value={drawerTask.priority} onChange={(e) => updateTaskField(drawerTask.id, { priority: e.target.value as TaskPriority })}>
                      {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                        <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="drawer-field-label">Assignee</div>
                    <select className="drawer-select" value={drawerTask.assignee_id ?? ''} onChange={(e) => updateTaskField(drawerTask.id, { assignee_id: e.target.value || undefined })}>
                      <option value="">অনির্ধারিত</option>
                      {assigneeOptions.map((a) => (
                        <option key={a.id} value={a.id}>{a.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="drawer-field-label">Due Date</div>
                    <input className="drawer-select" type="date" value={drawerTask.due_date ?? ''} onChange={(e) => updateTaskField(drawerTask.id, { due_date: e.target.value || undefined })} />
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Description</div>
                <p className="drawer-desc">{drawerTask.description || 'কোনো বিবরণ যোগ করা হয়নি।'}</p>
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Project</div>
                <div className="drawer-field-value">{drawerTask.projects?.name ?? '—'}</div>
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Checklist{drawerData && drawerData.checklist.length > 0 ? ` · ${drawerData.checklist.filter((c) => c.is_done).length}/${drawerData.checklist.length}` : ''}</div>
                {!drawerData || drawerData.loading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                ) : drawerData.checklist.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>কোনো চেকলিস্ট আইটেম নেই।</p>
                ) : (
                  drawerData.checklist.map((item) => (
                    <button key={item.id} className={`checklist-item${item.is_done ? ' done' : ''}`} onClick={() => toggleChecklistItem(item)}>
                      <span className="cb">{item.is_done && <Icon name="tick" size={9} color="#fff" />}</span> {item.label}
                    </button>
                  ))
                )}
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Attachments{drawerData && drawerData.attachments.length > 0 ? ` · ${drawerData.attachments.length}` : ''}</div>
                {!drawerData || drawerData.loading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                ) : drawerData.attachments.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>কোনো ফাইল নেই।</p>
                ) : (
                  drawerData.attachments.map((a) => (
                    <a className="attachment-row" key={a.id} href={a.drive_url} target="_blank" rel="noopener noreferrer">
                      <Icon name="paperclip" size={13} /> {a.file_name}
                    </a>
                  ))
                )}
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Time Tracking</div>
                <div className="time-track-bar">
                  <div className="time-track-fill" style={{ width: `${drawerTask.estimated_hours ? Math.min(100, ((drawerTask.logged_hours ?? 0) / drawerTask.estimated_hours) * 100) : 0}%` }}></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: 8 }} className="tabular">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={drawerTask.logged_hours ?? 0}
                    onBlur={(e) => updateTaskField(drawerTask.id, { logged_hours: Number(e.target.value) || 0 })}
                    style={{ width: 56, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit' }}
                  />
                  h logged · {drawerTask.estimated_hours ?? 0}h estimated
                </div>
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Comments{drawerData && drawerData.comments.length > 0 ? ` · ${drawerData.comments.length}` : ''}</div>
                {!drawerData || drawerData.loading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                ) : (
                  <>
                    {drawerData.comments.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>এখনো কোনো কমেন্ট নেই।</p>}
                    {drawerData.comments.map((c) => (
                      <div className="comment-row" key={c.id}>
                        <Avatar person={c.profiles} size={24} />
                        <div className="comment-bubble"><div className="comment-name">{c.profiles?.full_name ?? 'কেউ একজন'}</div>{c.body}</div>
                      </div>
                    ))}
                    <div className="comment-form">
                      <input
                        type="text"
                        placeholder="কমেন্ট লিখুন..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitComment();
                        }}
                      />
                      <button className="btn btn-ghost btn-sm" onClick={submitComment}>পাঠান</button>
                    </div>
                  </>
                )}
              </div>

              <div className="drawer-section">
                <div className="drawer-label">Recent Activity</div>
                {!drawerData || drawerData.loading ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                ) : drawerData.activity.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>এখনো কোনো অ্যাক্টিভিটি নেই।</p>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 2 }}>
                    {drawerData.activity.map((a) => (
                      <div key={a.id}>{a.profiles?.full_name ?? 'কেউ একজন'} — {a.detail} · {relativeTimeBn(a.created_at)}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ============ AI PANEL ============ */}
      <button className="ai-fab" onClick={() => setAiOpen((o) => !o)} aria-label="AI সহকারী"><Icon name="spark" /></button>
      <div className={`ai-panel${aiOpen ? ' open' : ''}`}>
        <div className="ai-panel-head">
          <Icon name="spark" color="var(--accent)" />
          <span className="ai-panel-title">AI সহকারী</span>
          <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => setAiOpen(false)}><Icon name="close" /></button>
        </div>
        <div className="ai-panel-body">
          {insights.map((text, i) => (
            <div className="ai-item" key={i}><span className="dot"></span> {text}</div>
          ))}
          {liveEvents.length > 0 && (
            <>
              <div className="live-divider">লাইভ অ্যাক্টিভিটি</div>
              {liveEvents.map((ev) => (
                <div className="live-row" key={ev.id}><span className="live-pulse"></span> {ev.text}</div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ============ CREATE TASK MODAL ============ */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-box">
            <div className="modal-title">নতুন টাস্ক তৈরি করুন</div>
            <form onSubmit={handleCreateTask}>
              <label className="field-label">টাস্কের নাম</label>
              <input className="field-input" type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="যেমন: হোমপেজ ওয়্যারফ্রেম বানানো" autoFocus required />

              <label className="field-label">প্রজেক্ট</label>
              <select className="field-input" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}>
                <option value="">কোনো প্রজেক্ট নেই</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <label className="field-label">কাকে অ্যাসাইন করবেন</label>
              <select className="field-input" value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)}>
                <option value="">অনির্ধারিত</option>
                {assigneeOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>

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
                <button type="submit" className="btn btn-accent btn-sm" disabled={creating || !newTitle.trim()}>{creating ? 'তৈরি হচ্ছে…' : 'টাস্ক তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
