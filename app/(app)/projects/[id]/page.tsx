'use client';

// Project Details — lib/supabaseClient.ts দিয়ে রিয়েল Supabase ডেটা:
// projects + clients + profiles (manager/assignee) + tasks + milestones +
// attachments + activity_log + meetings। RLS-এর জন্য sign-in লাগবে।
//
// নোট: schema-তে notes-এর জন্য কোনো টেবিল নেই — তাই ওই সেকশনটা honest
// empty-state দেখায়। Share/More বাটন এবং বেশিরভাগ Quick Actions এখনো
// প্লেসহোল্ডার (disabled)। Client Status আসল clients.status ফিল্ড দেখায় —
// schema-তে পেমেন্ট ট্র্যাকিং নেই বলে ফেক "পরিশোধিত" বসানো হয়নি। Star
// টগল লোকাল-অনলি (persist হয় না) — favorite কলাম যোগ করলে persist করা যাবে।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import './project.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDate, formatTimeBn, relativeTimeBn, todayISO } from '@/lib/format';
import { STATUS_META, PRIORITY_META, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
import SignInScreen from '@/app/components/SignInScreen';
import Avatar from '@/app/components/Avatar';
import DonutChart from '@/app/components/DonutChart';
import OutlookChart from '@/app/components/OutlookChart';
import { dueNextDays, statusCounts } from '@/lib/dashboardCharts';
import { currencySymbol } from '@/lib/currency';
import { sendNotifications } from '@/lib/notify';
import { getProjectCurrency } from '@/lib/projectCurrency';
import RichTextField from '@/app/components/RichTextField';
import RichText from '@/app/components/RichText';
import { useAppShell } from '@/app/components/appShellContext';

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
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  tick: '<path d="M20 6L9 17l-5-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  'check-circle-o': '<circle cx="12" cy="12" r="9"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  'user-plus': '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.9 1.4 7-6.2-3.6-6.2 3.6 1.4-7L2 9.3l7-.8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.9"/><path d="M8.6 13.4l6.8 3.9"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  figma: '<path d="M9 2h6a4 4 0 0 1 0 8H9z"/><path d="M9 10h6a4 4 0 0 1 0 8 4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  note: '<path d="M4 3h12l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h4"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}



const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'চলছে', cls: 's-progress' },
  review: { label: 'রিভিউ', cls: 's-review' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
  on_hold: { label: 'হোল্ডে', cls: 's-todo' },
};

const CLIENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  lead: { label: 'Lead', cls: 's-todo' },
  discussion: { label: 'In Discussion', cls: 's-review' },
  active: { label: 'Active', cls: 's-progress' },
  retainer: { label: 'Retainer', cls: 's-done' },
  completed: { label: 'Completed', cls: 's-done' },
};

const FILE_TYPE_ICON: Record<string, { icon: IconName; bg: string; color: string }> = {
  figma: { icon: 'figma', bg: 'var(--accent-soft)', color: 'var(--accent)' },
  image: { icon: 'image', bg: 'var(--warning-soft)', color: 'var(--warning)' },
  pdf: { icon: 'file', bg: 'var(--danger-soft)', color: 'var(--danger)' },
  zip: { icon: 'file', bg: 'var(--positive-soft)', color: 'var(--positive)' },
  other: { icon: 'file', bg: 'var(--surface-muted)', color: 'var(--ink-soft)' },
};

type ProjectDetail = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  budget: number | null;
  start_date: string | null;
  due_date: string | null;
  description: string | null;
  category: string | null;
  final_delivery_status: string | null;
  final_delivery_notes: string | null;
  completed_at: string | null;
  clients: {
    id: string;
    company_name: string;
    industry: string | null;
    primary_contact: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
  } | null;
  manager: { full_name: string; avatar_color: string | null; avatar_url: string | null } | null;
};

type ProjectTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  workflow_stage: string;
  due_date: string | null;
  progress: number | null;
  estimated_hours: number | null;
  logged_hours: number | null;
  updated_at: string;
  assignee_id: string | null;
  profiles: { full_name: string; avatar_color: string | null; avatar_url: string | null; role: string | null } | null;
};

type ProjectAttachment = { id: string; file_name: string; file_type: string | null; drive_url: string; uploaded_at: string; profiles: { full_name: string } | null };
type ProjectActivity = { id: string; detail: string | null; created_at: string; profiles: { full_name: string } | null };
type NextMeeting = { id: string; title: string; meeting_date: string; meeting_time: string | null };
type TeamEntry = { id: string; name: string; role: string | null; avatar_color: string | null; avatar_url: string | null; activeTasks: number };
type Milestone = { id: string; title: string; due_date: string | null; completed_at: string | null; progress: number | null };

function daysFromNowISO(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

async function fetchProjectData(projectId: string) {
  const today = todayISO();

  const [projectRes, tasksRes, milestonesRes] = await Promise.all([
    supabase
      .from('projects')
      .select(
        'id, name, status, progress, budget, start_date, due_date, description, category, final_delivery_status, final_delivery_notes, completed_at, clients(id, company_name, industry, primary_contact, contact_email, contact_phone, status), manager:profiles!project_manager_id(full_name, avatar_color, avatar_url)'
      )
      .eq('id', projectId)
      .single(),
    supabase
      .from('tasks')
      .select(
        'id, title, status, priority, workflow_stage, due_date, progress, estimated_hours, logged_hours, updated_at, assignee_id, profiles!assignee_id(full_name, avatar_color, avatar_url, role)'
      )
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('milestones')
      .select('id, title, due_date, completed_at, progress')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .order('due_date', { ascending: true }),
  ]);

  const project = (projectRes.data as unknown as ProjectDetail) ?? null;
  const tasks = (tasksRes.data as unknown as ProjectTask[]) ?? [];
  const taskIds = tasks.map((t) => t.id);
  const clientId = project?.clients?.id ?? null;

  const [attachmentsRes, activityRes, meetingRes] = await Promise.all([
    taskIds.length > 0
      ? supabase
          .from('attachments')
          .select('id, file_name, file_type, drive_url, uploaded_at, profiles(full_name)')
          .in('task_id', taskIds)
          .order('uploaded_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length > 0
      ? supabase
          .from('activity_log')
          .select('id, detail, created_at, profiles(full_name)')
          .eq('entity_type', 'task')
          .in('entity_id', taskIds)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
    clientId
      ? supabase
          .from('meetings')
          .select('id, title, meeting_date, meeting_time')
          .eq('client_id', clientId)
          .gte('meeting_date', today)
          .order('meeting_date', { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const firstErrored = [projectRes, tasksRes, milestonesRes, attachmentsRes, activityRes, meetingRes].find((r) => r.error);

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    project,
    tasks,
    milestones: (milestonesRes.data as unknown as Milestone[]) ?? [],
    attachments: (attachmentsRes.data as unknown as ProjectAttachment[]) ?? [],
    activity: (activityRes.data as unknown as ProjectActivity[]) ?? [],
    nextMeeting: ((meetingRes.data as unknown as NextMeeting[]) ?? [])[0] ?? null,
  };
}

// whole days from `fromISO` to `toISO` (both yyyy-mm-dd); negative = already past
function daysBetween(fromISO: string, toISO: string) {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

// every project tool that has its own sub-page; shown as tiles in the Workspace card
const WORKSPACE_TOOLS: { label: string; href: string; icon: IconName }[] = [
  { label: 'SOW', href: 'sow', icon: 'file' },
  { label: 'Payments', href: 'payments', icon: 'wallet' },
  { label: 'Messages', href: 'messages', icon: 'message' },
  { label: 'Feedback', href: 'feedback', icon: 'star' },
  { label: 'Approvals', href: 'approvals', icon: 'check-circle' },
  { label: 'Change Requests', href: 'change-requests', icon: 'refresh' },
  { label: 'Updates', href: 'updates', icon: 'bell' },
  { label: 'Client Files', href: 'files', icon: 'folder' },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, loading: sessionLoading } = useSession();

  const { dark } = useAppShell();
  const [profile, setProfile] = useState<{ id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null } | null>(null);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);
  const [currency, setCurrency] = useState('BDT');
  useEffect(() => {
    if (projectId) getProjectCurrency(projectId).then(setCurrency);
  }, [projectId]);
  const [taskScope, setTaskScope] = useState<'all' | 'mine'>('all');

  // "Assign task" modal: a new task for this project, handed straight to a team member
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url: string | null }[]>([]);
  const [tTitle, setTTitle] = useState('');
  const [tDescription, setTDescription] = useState('');
  const [tAssignee, setTAssignee] = useState<string | null>(null);
  const [tPriority, setTPriority] = useState<TaskPriority>('normal');
  const [tDue, setTDue] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchProjectData(projectId),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setProject(result.project);
      setTasks(result.tasks);
      setMilestones(result.milestones);
      setAttachments(result.attachments);
      setActivity(result.activity);
      setNextMeeting(result.nextMeeting);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    }

    run();
  }, [user, projectId]);

  async function openTaskModal(assigneeId: string | null = null) {
    setTTitle('');
    setTDescription('');
    setTAssignee(assigneeId);
    setTPriority('normal');
    setTDue('');
    setTaskFormError(null);
    setShowTaskModal(true);
    if (members.length === 0) {
      const { data } = await supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url').order('full_name');
      setMembers((data as typeof members) ?? []);
    }
  }

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!tTitle.trim() || !tAssignee || !user) return;

    setCreatingTask(true);
    setTaskFormError(null);
    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({
        title: tTitle.trim(),
        description: tDescription.trim() || null,
        project_id: projectId,
        assignee_id: tAssignee,
        priority: tPriority,
        due_date: tDue || null,
        assigned_date: todayISO(),
        status: 'todo',
        workflow_stage: 'backlog',
        created_by: user.id,
      })
      .select('id, title, status, priority, workflow_stage, due_date, progress, estimated_hours, logged_hours, updated_at, assignee_id, profiles!assignee_id(full_name, avatar_color, avatar_url, role)')
      .single();

    if (insertError || !data) {
      setTaskFormError(insertError?.message ?? 'Could not create the task.');
      setCreatingTask(false);
      return;
    }

    const row = data as unknown as ProjectTask;
    setTasks((prev) => [row, ...prev]);
    await supabase.from('activity_log').insert({
      actor_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      entity_id: row.id,
      detail: `"${row.title}" তৈরি করা হয়েছে`,
    });
    if (tAssignee) {
      sendNotifications([
        {
          recipient_id: tAssignee,
          actor_id: user.id,
          type: 'task_assigned',
          title: `${profile?.full_name?.trim() || user.email || 'কেউ একজন'} আপনাকে একটা টাস্ক অ্যাসাইন করেছে`,
          subtitle: row.title,
          link: '/tasks',
        },
      ]);
    }
    setCreatingTask(false);
    setShowTaskModal(false);
  }

  async function handleCreateMilestone(e: FormEvent) {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;

    setCreatingMilestone(true);
    const { data, error } = await supabase
      .from('milestones')
      .insert({ project_id: projectId, title: newMilestoneTitle.trim(), due_date: newMilestoneDueDate || null, progress: 0 })
      .select('id, title, due_date, completed_at, progress')
      .single();

    if (error) {
      setError(error.message);
    } else if (data) {
      setMilestones((prev) => [...prev, data as Milestone]);
    }

    setNewMilestoneTitle('');
    setNewMilestoneDueDate('');
    setCreatingMilestone(false);
    setShowMilestoneModal(false);
  }

  async function toggleMilestone(m: Milestone) {
    const isDone = !!m.completed_at;
    const patch = isDone ? { completed_at: null, progress: m.progress ?? 0 } : { completed_at: todayISO(), progress: 100 };

    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('milestones').update(patch).eq('id', m.id);
    if (error) setError(error.message);
  }

  // Screen 23/24 — Final Delivery ও Project Completion। ভারী নতুন পেজের বদলে এই
  // বিদ্যমান প্রজেক্ট ডিটেইল পেজেই ছোট দুইটা অ্যাকশন — client-facing ফুল স্ক্রিন
  // /client/project/[id]/final-delivery ও /complete-এ।
  async function markReadyForDelivery() {
    if (!project) return;
    const { error } = await supabase.from('projects').update({ final_delivery_status: 'ready' }).eq('id', project.id);
    if (error) {
      setError(error.message);
      return;
    }
    setProject((prev) => (prev ? { ...prev, final_delivery_status: 'ready' } : prev));
  }

  async function closeProject() {
    if (!project) return;
    const { error } = await supabase.from('projects').update({ status: 'completed', progress: 100, completed_at: new Date().toISOString() }).eq('id', project.id);
    if (error) {
      setError(error.message);
      return;
    }
    setProject((prev) => (prev ? { ...prev, status: 'completed', progress: 100, completed_at: new Date().toISOString() } : prev));
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const doneTaskCount = tasks.filter((t) => t.status === 'done').length;
  const computedProgress = tasks.length > 0 ? Math.round((doneTaskCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className={`projdetail-root${dark ? ' dark' : ''}`}>
        <div style={{ padding: 60, textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={`projdetail-root${dark ? ' dark' : ''}`}>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 12 }}>{error ?? 'এই প্রজেক্ট পাওয়া যায়নি।'}</p>
          <Link href="/projects" className="btn btn-accent btn-sm" style={{ display: 'inline-flex' }}>প্রজেক্ট লিস্টে ফিরে যান</Link>
        </div>
      </div>
    );
  }

  const today = todayISO();
  const sevenDaysFromNow = daysFromNowISO(7);

  const completed = tasks.filter((t) => t.status === 'done').length;
  const remaining = tasks.length - completed;
  const overdue = tasks.filter((t) => !!t.due_date && t.due_date < today && t.status !== 'done').length;
  const upcoming = tasks.filter((t) => !!t.due_date && t.due_date >= today && t.due_date <= sevenDaysFromNow && t.status !== 'done').length;
  const revisionCount = tasks.filter((t) => t.workflow_stage === 'revision').length;

  const estimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const workedHours = tasks.reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);

  const teamMap = new Map<string, TeamEntry>();
  for (const t of tasks) {
    if (!t.assignee_id || !t.profiles) continue;
    const cur = teamMap.get(t.assignee_id);
    const isActive = t.status !== 'done' ? 1 : 0;
    if (cur) cur.activeTasks += isActive;
    else teamMap.set(t.assignee_id, { id: t.assignee_id, name: t.profiles.full_name, role: t.profiles.role, avatar_color: t.profiles.avatar_color, avatar_url: t.profiles.avatar_url, activeTasks: isActive });
  }
  const team = Array.from(teamMap.values()).sort((a, b) => b.activeTasks - a.activeTasks);

  // the signed-in team member's own tasks (for the All / Mine switch)
  const myTasks = tasks.filter((t) => !!profile && t.assignee_id === profile.id);
  const shownTasks = taskScope === 'mine' ? myTasks : tasks;

  // days-left badge next to the due date (hidden once the project is completed)
  const daysLeft = project.due_date && project.status !== 'completed' ? daysBetween(today, project.due_date) : null;
  const deadlineChip =
    daysLeft === null
      ? null
      : daysLeft < 0
        ? { text: `${Math.abs(daysLeft).toLocaleString('bn-BD')} দিন দেরি`, tone: 'danger' }
        : daysLeft === 0
          ? { text: 'আজই ডেডলাইন', tone: 'warn' }
          : { text: `${daysLeft.toLocaleString('bn-BD')} দিন বাকি`, tone: daysLeft <= 7 ? 'warn' : 'ok' };

  // worked vs estimated hours (bar is capped at 100%)
  const hoursPercent = estimatedHours > 0 ? Math.min(100, Math.round((workedHours / estimatedHours) * 100)) : 0;

  const workspaceTools = WORKSPACE_TOOLS;

  const statusMeta = PROJECT_STATUS_META[project.status] ?? { label: project.status, cls: 's-todo' };
  const clientStatusMeta = project.clients ? CLIENT_STATUS_META[project.clients.status] ?? { label: project.clients.status, cls: 's-todo' } : null;

  return (
    <>
      <main className="content">
            <div className="breadcrumb">
              <Link href="/projects">Projects</Link><span className="sep">/</span>
              <Link href={`/projects/${project.id}`}>{project.name}</Link><span className="sep">/</span>
              <span className="current">Project Details</span>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* ===== hero: identity + key facts + progress ===== */}
            <section className="pd-hero">
              <div className="pd-hero-main">
                <div className="pd-hero-top">
                  <div className="proj-icon pd-icon">{project.name.charAt(0).toUpperCase()}</div>
                  <div className="pd-hero-titles">
                    <div className="pd-title-row">
                      <h1 className="pd-title">{project.name}</h1>
                      <span className={`status-pill ${statusMeta.cls}`} style={{ padding: '4px 10px' }}>{statusMeta.label}</span>
                    </div>
                    <div className="pd-meta">
                      {project.category && <span className="pd-meta-item">{project.category}</span>}
                      {project.clients && <span className="pd-meta-item"><Icon name="building" size={13} />{project.clients.company_name}</span>}
                      {project.manager && <span className="pd-meta-item"><Icon name="users" size={13} />PM: {project.manager.full_name}</span>}
                    </div>
                  </div>
                  <div className="header-actions">
                    <button
                      className={`icon-btn star-btn${starred ? ' active' : ''}`}
                      onClick={() => setStarred((s) => !s)}
                      aria-label="ফেভারিট"
                      title="লোকাল টগল — সেভ হয় না"
                    >
                      <Icon name="star" />
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="share" size={14} /> শেয়ার</button>
                    <button className="icon-btn" disabled title="শীঘ্রই আসছে" aria-label="আরও অপশন"><Icon name="more" /></button>
                  </div>
                </div>

                {project.description && <RichText text={project.description} className="pd-desc" />}

                <div className="pd-facts">
                  <div className="pd-fact">
                    <span className="pd-fact-label">Start</span>
                    <span className="pd-fact-value">{formatBnDate(project.start_date) || '—'}</span>
                  </div>
                  <div className="pd-fact">
                    <span className="pd-fact-label">Due</span>
                    <span className="pd-fact-value">{formatBnDate(project.due_date) || '—'}</span>
                    {deadlineChip && <span className={`pd-days ${deadlineChip.tone}`}>{deadlineChip.text}</span>}
                  </div>
                  <div className="pd-fact">
                    <span className="pd-fact-label">Budget</span>
                    <span className="pd-fact-value tabular">{project.budget ? `${currencySymbol(currency)} ${project.budget.toLocaleString('bn-BD')}` : '—'}</span>
                  </div>
                  <div className="pd-fact">
                    <span className="pd-fact-label">Hours (worked / est.)</span>
                    <span className="pd-fact-value tabular">{workedHours}h / {estimatedHours}h</span>
                    <div className="progress-track pd-hours-track"><div className="progress-fill" style={{ width: `${hoursPercent}%`, background: workedHours > estimatedHours && estimatedHours > 0 ? 'var(--danger)' : 'var(--accent)' }}></div></div>
                  </div>
                </div>
              </div>

              <div className="pd-hero-progress">
                <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`${computedProgress}% সম্পন্ন`}>
                  <circle cx="56" cy="56" r="47" fill="none" stroke="var(--border-soft)" strokeWidth="9" />
                  <circle
                    cx="56" cy="56" r="47" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray="295.3" strokeDashoffset={295.3 - (295.3 * computedProgress) / 100}
                    transform="rotate(-90 56 56)"
                  />
                  <text x="56" y="63" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)" fontFamily="Manrope">{computedProgress}%</text>
                </svg>
                <span className="pd-progress-caption">{completed} / {tasks.length} টাস্ক সম্পন্ন</span>
              </div>
            </section>

            {/* ===== needs attention ===== */}
            <div className="pd-attention" role="status">
              <span className="pd-attention-title">Needs attention</span>
              {overdue > 0 && <span className="pd-chip danger"><Icon name="alert" size={13} />{overdue}টা ডেডলাইন পার</span>}
              {revisionCount > 0 && <span className="pd-chip warn"><Icon name="refresh" size={13} />{revisionCount}টা রিভিশনে</span>}
              {upcoming > 0 && <span className="pd-chip accent"><Icon name="clock" size={13} />{upcoming}টা আগামী ৭ দিনে</span>}
              {nextMeeting && (
                <span className="pd-chip"><Icon name="calendar" size={13} />মিটিং {formatBnDate(nextMeeting.meeting_date)}{nextMeeting.meeting_time ? `, ${formatTimeBn(nextMeeting.meeting_time)}` : ''}</span>
              )}
              {overdue === 0 && revisionCount === 0 && upcoming === 0 && (
                <span className="pd-chip ok"><Icon name="check-circle" size={13} />সব ট্র্যাকে আছে — কোনো জরুরি সতর্কতা নেই</span>
              )}
            </div>

            {/* ===== jump bar (this page's own sections; the project tools live in the Workspace card) ===== */}
            <nav className="pd-jump" aria-label="পেজ সেকশন">
              <a href="#recent-tasks">Tasks</a>
              <a href="#milestones">Milestones</a>
              <a href="#files">Files</a>
              <a href="#activity">Activity</a>
              <a href="#team">Team</a>
              <a href="#client">Client</a>
              <a href="#final-delivery">Delivery</a>
            </nav>

            <div className="pd-layout">
              {/* ---------- main column ---------- */}
              <div className="pd-main">
                <div className="pd-kpis">
                  <div className="pd-kpi"><span className="pd-kpi-icon pos"><Icon name="check-circle" size={16} /></span><div><div className="pd-kpi-value tabular">{completed}</div><div className="pd-kpi-label">সম্পন্ন টাস্ক</div></div></div>
                  <div className="pd-kpi"><span className="pd-kpi-icon"><Icon name="checklist" size={16} /></span><div><div className="pd-kpi-value tabular">{remaining}</div><div className="pd-kpi-label">বাকি টাস্ক</div></div></div>
                  <div className="pd-kpi"><span className="pd-kpi-icon neg"><Icon name="alert" size={16} /></span><div><div className="pd-kpi-value tabular" style={overdue > 0 ? { color: 'var(--danger)' } : undefined}>{overdue}</div><div className="pd-kpi-label">ডেডলাইন পার</div></div></div>
                  <div className="pd-kpi"><span className="pd-kpi-icon warn"><Icon name="clock" size={16} /></span><div><div className="pd-kpi-value tabular">{upcoming}</div><div className="pd-kpi-label">৭ দিনের মধ্যে</div></div></div>
                  <div className="pd-kpi"><span className="pd-kpi-icon"><Icon name="refresh" size={16} /></span><div><div className="pd-kpi-value tabular">{revisionCount}</div><div className="pd-kpi-label">রিভিশন</div></div></div>
                </div>

                {/* Tasks */}
                <section className="pd-card" id="recent-tasks">
                  <div className="pd-card-head">
                    <span className="pd-card-title">Tasks <span className="pd-count">{shownTasks.length}</span></span>
                    <div className="pd-card-tools">
                      <div className="pd-seg" role="group" aria-label="টাস্ক ফিল্টার">
                        <button type="button" className={taskScope === 'all' ? 'active' : ''} onClick={() => setTaskScope('all')}>All</button>
                        <button type="button" className={taskScope === 'mine' ? 'active' : ''} onClick={() => setTaskScope('mine')}>Mine · {myTasks.length}</button>
                      </div>
                      <button type="button" className="btn btn-accent btn-sm" onClick={() => openTaskModal()}><Icon name="plus" size={13} /> Assign task</button>
                      <Link className="section-link" href="/tasks">সব টাস্ক <Icon name="chevron-right" /></Link>
                    </div>
                  </div>
                  {shownTasks.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon"><Icon name="check" /></div><div className="empty-title">{taskScope === 'mine' ? 'এই প্রজেক্টে আপনার নামে কোনো টাস্ক নেই' : 'এই প্রজেক্টে এখনো কোনো টাস্ক নেই'}</div></div>
                  ) : (
                    <div className="pd-table-wrap">
                      <table className="task-table pd-task-table">
                        <thead><tr><th>Task Name</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Deadline</th><th>Progress</th></tr></thead>
                        <tbody>
                          {shownTasks.slice(0, 8).map((t) => {
                            const status = STATUS_META[t.status];
                            const priority = PRIORITY_META[t.priority];
                            const isOverdue = !!t.due_date && t.due_date < today && t.status !== 'done';
                            return (
                              <tr key={t.id}>
                                <td className="cell-task">
                                  <Icon name={t.status === 'done' ? 'check-circle' : 'check-circle-o'} color={t.status === 'done' ? 'var(--positive)' : 'var(--ink-faint)'} />
                                  {t.title}
                                </td>
                                <td className="cell-assignee">
                                  {t.profiles ? (
                                    <>
                                      <Avatar person={t.profiles} size={20} />
                                      {t.profiles.full_name}
                                    </>
                                  ) : (
                                    <span style={{ color: 'var(--ink-faint)' }}>অনির্ধারিত</span>
                                  )}
                                </td>
                                <td><span className={`priority-pill ${priority.cls}`}>{priority.label}</span></td>
                                <td><span className={`status-pill ${status.cls}`}>{status.label}</span></td>
                                <td className="tabular" style={isOverdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>{formatBnDate(t.due_date) || '—'}</td>
                                <td><div className="progress-track mini-progress"><div className="progress-fill" style={{ width: `${t.progress ?? 0}%`, ...(t.status === 'done' ? { background: 'var(--positive)' } : {}) }}></div></div></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Milestones */}
                <section className="pd-card" id="milestones">
                  <div className="pd-card-head">
                    <span className="pd-card-title">Milestones <span className="pd-count">{milestones.length}</span></span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowMilestoneModal(true)}><Icon name="plus" size={13} /> মাইলস্টোন যোগ করুন</button>
                  </div>
                  {milestones.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon"><Icon name="layers" /></div><div className="empty-title">এখনো কোনো মাইলস্টোন নেই</div></div>
                  ) : (
                    <div className="pd-milestones">
                      {milestones.map((m) => {
                        const isDone = !!m.completed_at;
                        return (
                          <div className={`milestone-card${isDone ? ' done' : ''}`} key={m.id}>
                            <div className="milestone-top">
                              <span className={`milestone-title${isDone ? ' done' : ''}`}>{m.title}</span>
                              <button className={`milestone-check${isDone ? ' done' : ''}`} onClick={() => toggleMilestone(m)} aria-label="সম্পন্ন হিসেবে চিহ্নিত করুন">
                                {isDone && <Icon name="tick" size={10} color="#fff" />}
                              </button>
                            </div>
                            <div className="milestone-meta">{isDone ? `শেষ হয়েছে · ${formatBnDate(m.completed_at)}` : `ডেডলাইন · ${formatBnDate(m.due_date) || '—'}`}</div>
                            <div className="progress-track"><div className="progress-fill" style={{ width: `${m.progress ?? 0}%`, ...(isDone ? { background: 'var(--positive)' } : {}) }}></div></div>
                            <div className="milestone-foot"><span className="tabular">{m.progress ?? 0}%</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Files */}
                <section className="pd-card" id="files">
                  <div className="pd-card-head">
                    <span className="pd-card-title">Files <span className="pd-count">{attachments.length}</span></span>
                    <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="upload" size={13} /> আপলোড</button>
                  </div>
                  {attachments.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon"><Icon name="file" /></div><div className="empty-title">কোনো ফাইল আপলোড হয়নি</div><div className="empty-sub">টাস্ক এক্সপ্যান্ড করে অ্যাটাচমেন্ট যোগ করা যায়।</div></div>
                  ) : (
                    <div className="file-grid pd-file-grid">
                      {attachments.map((a) => {
                        const meta = FILE_TYPE_ICON[a.file_type ?? 'other'] ?? FILE_TYPE_ICON.other;
                        return (
                          <a className="file-card" key={a.id} href={a.drive_url} target="_blank" rel="noopener noreferrer">
                            <div className="file-icon" style={{ background: meta.bg, color: meta.color }}><Icon name={meta.icon} /></div>
                            <div className="file-name">{a.file_name}</div>
                            <div className="file-meta">{relativeTimeBn(a.uploaded_at)} · {a.profiles?.full_name ?? 'কেউ একজন'}</div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </section>


                {/* Progress at a glance: how this project's tasks split by status, and what falls due in the next 7 days */}
                <section className="pd-card" id="progress">
                  <div className="pd-card-head"><span className="pd-card-title">Progress at a glance</span></div>
                  <div className="pd-progress">
                    <div className="pd-progress-col">
                      <div className="pd-progress-label">Tasks by status</div>
                      <DonutChart segments={statusCounts(tasks)} noun="task" />
                    </div>
                    <div className="pd-progress-col">
                      <div className="pd-progress-label">Due in the next 7 days</div>
                      {(() => {
                        const due = dueNextDays(tasks, todayISO());
                        return <OutlookChart buckets={due.buckets} undated={due.later} caption="Open tasks due per day" periodLabel="Day" showHours={false} />;
                      })()}
                    </div>
                  </div>
                </section>
              </div>

              {/* ---------- side column ---------- */}
              <aside className="pd-side">
                {/* Workspace: every project tool, one click away */}
                <section className="pd-card">
                  <div className="pd-card-head"><span className="pd-card-title">Workspace</span></div>
                  <div className="pd-tools">
                    {workspaceTools.map((tool) => (
                      <Link key={tool.href} href={`/projects/${project.id}/${tool.href}`} className="pd-tool">
                        <span className="pd-tool-icon"><Icon name={tool.icon} size={16} /></span>
                        <span className="pd-tool-label">{tool.label}</span>
                      </Link>
                    ))}
                  </div>
                </section>

                {/* Team */}
                <section className="pd-card" id="team">
                  <div className="pd-card-head">
                    <span className="pd-card-title">Team <span className="pd-count">{team.length}</span></span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openTaskModal()}><Icon name="plus" size={13} /> Assign task</button>
                  </div>
                  {team.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px 16px' }}><div className="empty-title">এখনো কেউ টাস্কে অ্যাসাইন হয়নি</div></div>
                  ) : (
                    <div className="pd-team">
                      {team.map((m) => {
                        const percent = Math.min(100, (m.activeTasks / 5) * 100);
                        const tone = percent >= 90 ? 'full' : percent >= 50 ? 'busy' : '';
                        const toneLabel = percent >= 90 ? 'ফুল লোড' : percent >= 50 ? 'ব্যস্ত' : 'উপলব্ধ';
                        return (
                          <div className="pd-member" key={m.id}>
                            <Avatar person={{ full_name: m.name, avatar_color: m.avatar_color, avatar_url: m.avatar_url }} size={32} />
                            <div className="pd-member-info">
                              <div className="team-card-name">{m.name}</div>
                              <div className="team-card-role">{m.role ?? 'Team Member'}</div>
                              <div className="progress-track" style={{ marginTop: 6 }}><div className="progress-fill" style={{ width: `${percent}%`, background: tone === 'full' ? 'var(--danger)' : tone === 'busy' ? 'var(--warning)' : 'var(--positive)' }}></div></div>
                            </div>
                            <div className="pd-member-stat"><span className="tabular">{m.activeTasks} tasks</span><span><span className={`avail-dot${tone ? ` ${tone}` : ''}`}></span>{toneLabel}</span></div>
                            <button type="button" className="pd-member-assign" onClick={() => openTaskModal(m.id)} title={`Assign a task to ${m.name}`} aria-label={`Assign a task to ${m.name}`}><Icon name="plus" size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Client Info */}
                {project.clients && (
                  <section className="client-info-card pd-client" id="client">
                    <div className="client-info-top">
                      <div className="client-logo">{project.clients.company_name.charAt(0).toUpperCase()}</div>
                      <div><div className="client-info-name">{project.clients.company_name}</div><div className="client-info-sub">{project.clients.industry ?? '—'}</div></div>
                      {clientStatusMeta && <span className={`status-pill ${clientStatusMeta.cls}`} style={{ marginLeft: 'auto' }}>{clientStatusMeta.label}</span>}
                    </div>
                    <div className="client-detail-grid">
                      <div><div className="client-detail-label">Contact Person</div><div className="client-detail-value">{project.clients.primary_contact ?? '—'}</div></div>
                      <div><div className="client-detail-label">Phone</div><div className="client-detail-value tabular">{project.clients.contact_phone ?? '—'}</div></div>
                      <div style={{ gridColumn: '1 / -1' }}><div className="client-detail-label">Email</div><div className="client-detail-value" style={{ overflowWrap: 'anywhere' }}>{project.clients.contact_email ?? '—'}</div></div>
                      <div style={{ gridColumn: '1 / -1' }}><div className="client-detail-label">Next Meeting</div><div className="client-detail-value">{nextMeeting ? `${formatBnDate(nextMeeting.meeting_date)}${nextMeeting.meeting_time ? `, ${formatTimeBn(nextMeeting.meeting_time)}` : ''}` : 'নির্ধারিত নেই'}</div></div>
                    </div>
                  </section>
                )}

                {/* Final Delivery / Completion */}
                <section className="pd-card" id="final-delivery">
                  <div className="pd-card-head"><span className="pd-card-title">Final Delivery &amp; Completion</span></div>
                  <div className="pd-card-body">
                    {project.status === 'completed' ? (
                      <p style={{ fontSize: 13, color: 'var(--positive)', fontWeight: 600 }}>✓ Project completed{project.completed_at ? ` — ${formatBnDate(project.completed_at)}` : ''}</p>
                    ) : (
                      <>
                        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>
                          Status: <strong>{project.final_delivery_status === 'ready' ? 'Ready for client review' : project.final_delivery_status === 'approved' ? 'Approved by client ✓' : project.final_delivery_status === 'changes_requested' ? 'Client requested changes' : 'Not started'}</strong>
                        </p>
                        {project.final_delivery_notes && project.final_delivery_status === 'changes_requested' && (
                          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>&quot;{project.final_delivery_notes}&quot;</p>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {!project.final_delivery_status || project.final_delivery_status === 'changes_requested' ? (
                            <button className="btn btn-accent btn-sm" onClick={markReadyForDelivery}>
                              Mark Ready for Final Review
                            </button>
                          ) : null}
                          {project.final_delivery_status === 'approved' && (
                            <button className="btn btn-accent btn-sm" onClick={closeProject}>
                              Close Project
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* Quick Actions */}
                <section className="pd-card">
                  <div className="pd-card-head"><span className="pd-card-title">Quick Actions</span></div>
                  <div className="qa-grid">
                    <button type="button" className="qa-btn" onClick={() => openTaskModal()}><div className="qa-icon"><Icon name="plus" size={14} /></div><span className="qa-label">টাস্ক তৈরি</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="upload" size={14} /></div><span className="qa-label">ফাইল আপলোড</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="user-plus" size={14} /></div><span className="qa-label">মেম্বার ইনভাইট</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="check-circle" size={14} /></div><span className="qa-label">রিভিউ শুরু</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="share" size={14} /></div><span className="qa-label">প্রজেক্ট শেয়ার</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="bar" size={14} /></div><span className="qa-label">রিপোর্ট বানান</span></button>
                  </div>
                </section>

              </aside>
            </div>

            {/* Recent Activity and Notes sit side by side, one row under the main grid */}
            <div className="pd-pair">
              {/* Recent Activity */}
              <section className="pd-card" id="activity">
                <div className="pd-card-head"><span className="pd-card-title">Recent Activity</span></div>
                <div className="panel-body">
                  {activity.length === 0 ? (
                    <p style={{ padding: 16, fontSize: 13, color: 'var(--ink-faint)' }}>এখনো কোনো অ্যাক্টিভিটি নেই।</p>
                  ) : (
                    activity.map((a) => (
                      <div className="activity-row" key={a.id}>
                        <div className="activity-icon"><Icon name="check-circle" size={14} /></div>
                        <div><div className="activity-text"><b>{a.profiles?.full_name ?? 'কেউ একজন'}</b> {a.detail}</div><div className="activity-time">{relativeTimeBn(a.created_at)}</div></div>
                      </div>
                    ))
                  )}
                </div>
              </section>
              {/* Notes — schema-তে টেবিল নেই */}
              <section className="pd-card" id="notes">
                <div className="pd-card-head"><span className="pd-card-title">Notes</span></div>
                <div className="empty-state">
                  <div className="empty-icon"><Icon name="note" /></div>
                  <div className="empty-title">এখনো কোনো নোট নেই</div>
                  <div className="empty-sub">নোট ফিচার চালু করতে schema-তে একটা টেবিল যোগ করা লাগবে।</div>
                  <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="plus" size={13} /> নোট যোগ করুন</button>
                </div>
              </section>
            </div>
          </main>
      {showTaskModal && (
        <div
          className="modal-overlay pd-task-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creatingTask) setShowTaskModal(false);
          }}
        >
          <div className="modal-box pd-task-modal">
            <div className="modal-title">Assign a task</div>
            <p className="pd-task-modal-sub">New task in <b>{project?.name}</b></p>
            <form onSubmit={handleCreateTask}>
              <label className="field-label">Task title</label>
              <input className="field-input" type="text" value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Design the checkout screens" autoFocus required />

              <label className="field-label">Description <span className="pd-optional">optional</span></label>
              <RichTextField value={tDescription} onChange={setTDescription} textareaClassName="field-input" placeholder="What needs to be done?" rows={3} />

              <label className="field-label">Assign to <span className="pd-optional">choose a team member</span></label>
              <div className="pd-assign-grid" role="radiogroup" aria-label="Assign to">
                {members.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={tAssignee === m.id} className={`pd-assign-opt${tAssignee === m.id ? ' active' : ''}`} onClick={() => setTAssignee(m.id)}>
                    <Avatar person={m} size={26} />
                    <span className="pd-assign-name">{m.full_name}</span>
                  </button>
                ))}
              </div>

              <div className="pd-task-row">
                <div>
                  <label className="field-label">Priority</label>
                  <div className="pd-seg" role="group" aria-label="Priority">
                    {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                      <button key={p} type="button" className={tPriority === p ? 'active' : ''} onClick={() => setTPriority(p)}>{PRIORITY_META[p].label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Deadline</label>
                  <input className="field-input" type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} />
                </div>
              </div>

              {taskFormError && <div className="pd-task-error">{taskFormError}</div>}

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTaskModal(false)} disabled={creatingTask}>Cancel</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creatingTask || !tTitle.trim() || !tAssignee}>
                  {creatingTask ? 'Assigning…' : 'Assign task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showMilestoneModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMilestoneModal(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">নতুন মাইলস্টোন যোগ করুন</div>
            <form onSubmit={handleCreateMilestone}>
              <label className="field-label">শিরোনাম</label>
              <input className="field-input" type="text" value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} placeholder="যেমন: ওয়্যারফ্রেম ও IA" autoFocus required />

              <label className="field-label">ডেডলাইন</label>
              <input className="field-input" type="date" value={newMilestoneDueDate} onChange={(e) => setNewMilestoneDueDate(e.target.value)} />

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMilestoneModal(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creatingMilestone || !newMilestoneTitle.trim()}>
                  {creatingMilestone ? 'তৈরি হচ্ছে…' : 'মাইলস্টোন তৈরি করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
