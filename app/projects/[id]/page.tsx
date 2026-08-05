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
import { formatBnDate, formatBnDateLong, formatTimeBn, relativeTimeBn, todayISO } from '@/lib/format';
import { STATUS_META, PRIORITY_META, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';

const ICON_PATHS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  check: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
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
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  'check-circle-o': '<circle cx="12" cy="12" r="9"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  'user-plus': '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.9 1.4 7-6.2-3.6-6.2 3.6 1.4-7L2 9.3l7-.8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.9"/><path d="M8.6 13.4l6.8 3.9"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  figma: '<path d="M9 2h6a4 4 0 0 1 0 8H9z"/><path d="M9 10h6a4 4 0 0 1 0 8 4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  note: '<path d="M4 3h12l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 9h8"/><path d="M8 13h8"/><path d="M8 17h4"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects', active: true },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'bar', label: 'Reports', href: '#' },
];

const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '#' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

const PROJECT_STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: 'চলছে', cls: 's-progress' },
  review: { label: 'রিভিউ', cls: 's-review' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
  on_hold: { label: 'হোল্ডে', cls: 's-todo' },
};

const CLIENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  lead: { label: 'লিড', cls: 's-todo' },
  discussion: { label: 'আলোচনা চলছে', cls: 's-review' },
  active: { label: 'অ্যাক্টিভ', cls: 's-progress' },
  retainer: { label: 'রিটেইনার', cls: 's-done' },
  completed: { label: 'সম্পন্ন', cls: 's-done' },
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
  clients: {
    id: string;
    company_name: string;
    industry: string | null;
    primary_contact: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    status: string;
  } | null;
  manager: { full_name: string; avatar_color: string | null } | null;
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
  profiles: { full_name: string; avatar_color: string | null; role: string | null } | null;
};

type ProjectAttachment = { id: string; file_name: string; file_type: string | null; drive_url: string; uploaded_at: string; profiles: { full_name: string } | null };
type ProjectActivity = { id: string; detail: string | null; created_at: string; profiles: { full_name: string } | null };
type NextMeeting = { id: string; title: string; meeting_date: string; meeting_time: string | null };
type TeamEntry = { id: string; name: string; role: string | null; avatar_color: string | null; activeTasks: number };
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
        'id, name, status, progress, budget, start_date, due_date, description, category, clients(id, company_name, industry, primary_contact, contact_email, contact_phone, status), manager:profiles!project_manager_id(full_name, avatar_color)'
      )
      .eq('id', projectId)
      .single(),
    supabase
      .from('tasks')
      .select(
        'id, title, status, priority, workflow_stage, due_date, progress, estimated_hours, logged_hours, updated_at, assignee_id, profiles!assignee_id(full_name, avatar_color, role)'
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

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { user, loading: sessionLoading } = useSession();

  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState<{ id: string; full_name: string; role: string | null; avatar_color: string | null } | null>(null);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starred, setStarred] = useState(false);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchProjectData(projectId),
        supabase.from('profiles').select('id, full_name, role, avatar_color').eq('id', user!.id).single(),
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

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const displayName = profile?.full_name ?? user.email ?? 'ব্যবহারকারী';
  const avatarInitial = Array.from(displayName)[0]?.toUpperCase() ?? '?';
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
  const approvalRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const estimatedHours = tasks.reduce((sum, t) => sum + (t.estimated_hours ?? 0), 0);
  const workedHours = tasks.reduce((sum, t) => sum + (t.logged_hours ?? 0), 0);

  const teamMap = new Map<string, TeamEntry>();
  for (const t of tasks) {
    if (!t.assignee_id || !t.profiles) continue;
    const cur = teamMap.get(t.assignee_id);
    const isActive = t.status !== 'done' ? 1 : 0;
    if (cur) cur.activeTasks += isActive;
    else teamMap.set(t.assignee_id, { id: t.assignee_id, name: t.profiles.full_name, role: t.profiles.role, avatar_color: t.profiles.avatar_color, activeTasks: isActive });
  }
  const team = Array.from(teamMap.values()).sort((a, b) => b.activeTasks - a.activeTasks);

  const insights: string[] = [];
  if (overdue > 0) insights.push(`${overdue}টা টাস্ক ডেডলাইন পার হয়ে গেছে — আগে এগুলো সারান।`);
  if (revisionCount > 0) insights.push(`${revisionCount}টা টাস্ক রিভিশনে আছে।`);
  if (nextMeeting) insights.push(`পরবর্তী ক্লায়েন্ট মিটিং ${formatBnDate(nextMeeting.meeting_date)}${nextMeeting.meeting_time ? `, ${formatTimeBn(nextMeeting.meeting_time)}` : ''}।`);
  if (upcoming > 0) insights.push(`${upcoming}টা টাস্কের ডেডলাইন আগামী ৭ দিনের মধ্যে।`);
  if (insights.length === 0) insights.push('এই মুহূর্তে কোনো জরুরি সতর্কতা নেই — সব ট্র্যাকে আছে।');

  const statusMeta = PROJECT_STATUS_META[project.status] ?? { label: project.status, cls: 's-todo' };
  const clientStatusMeta = project.clients ? CLIENT_STATUS_META[project.clients.status] ?? { label: project.clients.status, cls: 's-todo' } : null;

  return (
    <div className={`projdetail-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar" aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark">DS</div>
              <div><div className="brand-name">DesignOps</div><div className="brand-sub">Studio Nine</div></div>
            </div>
            <nav className="nav-group" aria-label="Sidebar">
              {NAV_ITEMS.map((item) => (
                <a key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </a>
              ))}
              <div className="nav-divider"></div>
              {NAV_ITEMS_BOTTOM.map((item) => (
                <a key={item.label} href={item.href} className="nav-item"><Icon name={item.icon} /> {item.label}</a>
              ))}
            </nav>
          </div>
          <ProfileMenu profile={profile} email={user.email ?? ''} onUpdated={setProfile} />
        </aside>

        {/* ============ MAIN ============ */}
        <div className="main">
          <header className="topbar">
            <button className="search-box">
              <Icon name="search" />
              <span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — প্রজেক্ট, টাস্ক, মানুষ...</span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>
            <Link className="btn btn-accent" href="/tasks"><Icon name="plus" /> নতুন তৈরি করুন</Link>
            <button className="icon-btn" aria-label="নোটিফিকেশন"><Icon name="bell" /><span className="dot-indicator"></span></button>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}><Icon name={dark ? 'moon' : 'sun'} /></button>
            <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, background: profile?.avatar_color ?? undefined }}>{avatarInitial}</div>
          </header>

          <main className="content">
            <div className="breadcrumb">
              <Link href="/projects">Projects</Link><span className="sep">/</span>
              <Link href={`/projects/${project.id}`}>{project.name}</Link><span className="sep">/</span>
              <span className="current">Project Details</span>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* project header */}
            <div className="proj-header">
              <div className="proj-title-row" style={{ alignItems: 'flex-start' }}>
                <div className="proj-icon">{project.name.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="proj-title-row">
                    <span className="proj-title">{project.name}</span>
                    <span className={`status-pill ${statusMeta.cls}`} style={{ padding: '4px 10px' }}>{statusMeta.label}</span>
                  </div>
                  <div className="proj-sub-row">
                    {project.category && <><span>{project.category}</span><span className="dividerdot"></span></>}
                    {project.clients && <><span>ক্লায়েন্ট: {project.clients.company_name}</span><span className="dividerdot"></span></>}
                    {project.manager && <><span>PM: {project.manager.full_name}</span><span className="dividerdot"></span></>}
                    <span>ডেডলাইন: {formatBnDateLong(project.due_date) || '—'}</span>
                    <span className="dividerdot"></span>
                    <span className="tabular" style={{ fontWeight: 600, color: 'var(--accent)' }}>{computedProgress}% সম্পন্ন</span>
                  </div>
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

            {/* summary card */}
            <div className="summary-card">
              {project.description && <p className="proj-description">{project.description}</p>}
              <div className="summary-grid">
                <div><div className="summary-stat-label">Start Date</div><div className="summary-stat-value">{formatBnDate(project.start_date) || '—'}</div></div>
                <div><div className="summary-stat-label">Due Date</div><div className="summary-stat-value">{formatBnDate(project.due_date) || '—'}</div></div>
                <div><div className="summary-stat-label">Budget</div><div className="summary-stat-value tabular">{project.budget ? `৳ ${project.budget.toLocaleString('bn-BD')}` : '—'}</div></div>
                <div><div className="summary-stat-label">Estimated Hours</div><div className="summary-stat-value tabular">{estimatedHours}h</div></div>
                <div><div className="summary-stat-label">Worked Hours</div><div className="summary-stat-value tabular">{workedHours}h</div></div>
                <div className="summary-ring-wrap">
                  <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border-soft)" strokeWidth="5" />
                    <circle
                      cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray="113" strokeDashoffset={113 - (113 * computedProgress) / 100}
                      transform="rotate(-90 22 22)"
                    />
                    <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)" fontFamily="Inter">{computedProgress}%</text>
                  </svg>
                  <span className="ring-label">Overall Progress</span>
                </div>
              </div>
            </div>

            {/* tabs — এক পেজেই সব সেকশন; যেগুলোর ম্যাচিং সেকশন আছে সেগুলো অ্যাঙ্কর-স্ক্রল করে,
                বাকিগুলো (Timeline/Settings) এখনো কোনো আলাদা কনটেন্ট নেই বলে ভিজ্যুয়াল-অনলি */}
            <nav className="tabs" aria-label="প্রজেক্ট ট্যাব">
              <span className="tab active">Overview</span>
              <a href="#recent-tasks" className="tab">Tasks</a>
              <span className="tab" style={{ opacity: 0.5, cursor: 'default' }}>Timeline</span>
              <a href="#files" className="tab">Files</a>
              <a href="#team" className="tab">Team</a>
              <a href="#activity" className="tab">Activity</a>
              <a href="#notes" className="tab">Notes</a>
              <a href="#client" className="tab">Client</a>
              <span className="tab" style={{ opacity: 0.5, cursor: 'default' }}>Settings</span>
            </nav>

            {/* Project Health */}
            <section className="block">
              <div className="section-title-row"><span className="section-title">Project Health</span></div>
              <div className="health-grid">
                <div className="health-card"><div className="health-value tabular" style={{ color: 'var(--accent)' }}>{computedProgress}%</div><div className="health-label">Overall Progress</div></div>
                <div className="health-card"><div className="health-value tabular" style={{ color: 'var(--positive)' }}>{completed}</div><div className="health-label">Tasks Completed</div></div>
                <div className="health-card"><div className="health-value tabular">{remaining}</div><div className="health-label">Tasks Remaining</div></div>
                <div className="health-card"><div className="health-value tabular" style={{ color: 'var(--danger)' }}>{overdue}</div><div className="health-label">Overdue Tasks</div></div>
                <div className="health-card"><div className="health-value tabular" style={{ color: 'var(--warning)' }}>{upcoming}</div><div className="health-label">Upcoming Deadlines</div></div>
                <div className="health-card"><div className="health-value tabular">{revisionCount}</div><div className="health-label">Revision Count</div></div>
                <div className="health-card"><div className="health-value tabular" style={{ color: 'var(--positive)' }}>{approvalRate}%</div><div className="health-label">Approval Rate</div></div>
              </div>
            </section>

            {/* Milestones */}
            <section className="block">
              <div className="section-title-row"><span className="section-title">Milestones</span></div>
              <div className="milestone-row">
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
                <button className="add-milestone-card" onClick={() => setShowMilestoneModal(true)}>
                  <Icon name="plus" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>মাইলস্টোন যোগ করুন</span>
                </button>
              </div>
            </section>

            {/* Team Members */}
            <section className="block" id="team">
              <div className="section-title-row"><span className="section-title">Team Members <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>· {team.length}</span></span></div>
              <div className="team-grid">
                  {team.map((m) => {
                    const percent = Math.min(100, (m.activeTasks / 5) * 100);
                    const tone = percent >= 90 ? 'full' : percent >= 50 ? 'busy' : '';
                    const toneLabel = percent >= 90 ? 'ফুল লোড' : percent >= 50 ? 'ব্যস্ত' : 'উপলব্ধ';
                    return (
                      <div className="team-card" key={m.id}>
                        <div className="team-card-top">
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: m.avatar_color ?? undefined }}>{Array.from(m.name)[0]}</div>
                          <div><div className="team-card-name">{m.name}</div><div className="team-card-role">{m.role ?? 'Team Member'}</div></div>
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%`, background: tone === 'full' ? 'var(--danger)' : tone === 'busy' ? 'var(--warning)' : 'var(--positive)' }}></div></div>
                        <div className="team-card-stat"><span><span className={`avail-dot${tone ? ` ${tone}` : ''}`}></span>{toneLabel}</span><span className="tabular">{m.activeTasks} tasks</span></div>
                      </div>
                    );
                  })}
                <button className="add-member-card" disabled title="শীঘ্রই আসছে">
                  <Icon name="user-plus" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Add Member</span>
                </button>
              </div>
            </section>

            {/* Recent Tasks */}
            <section className="block" id="recent-tasks">
              <div className="section-title-row">
                <span className="section-title">Recent Tasks</span>
                <Link className="section-link" href="/tasks">সব টাস্ক <Icon name="chevron-right" /></Link>
              </div>
              {tasks.length === 0 ? (
                <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="check" /></div><div className="empty-title">এই প্রজেক্টে এখনো কোনো টাস্ক নেই</div></div></div>
              ) : (
                <table className="task-table">
                  <thead><tr><th>Task Name</th><th>Assignee</th><th>Priority</th><th>Status</th><th>Deadline</th><th>Progress</th></tr></thead>
                  <tbody>
                    {tasks.slice(0, 8).map((t) => {
                      const status = STATUS_META[t.status];
                      const priority = PRIORITY_META[t.priority];
                      return (
                        <tr key={t.id}>
                          <td className="cell-task">
                            <Icon name={t.status === 'done' ? 'check-circle' : 'check-circle-o'} color={t.status === 'done' ? 'var(--positive)' : 'var(--ink-faint)'} />
                            {t.title}
                          </td>
                          <td className="cell-assignee">
                            {t.profiles ? (
                              <>
                                <div className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: t.profiles.avatar_color ?? undefined }}>{Array.from(t.profiles.full_name)[0]}</div>
                                {t.profiles.full_name}
                              </>
                            ) : (
                              <span style={{ color: 'var(--ink-faint)' }}>অনির্ধারিত</span>
                            )}
                          </td>
                          <td><span className={`priority-pill ${priority.cls}`}>{priority.label}</span></td>
                          <td><span className={`status-pill ${status.cls}`}>{status.label}</span></td>
                          <td className="tabular">{formatBnDate(t.due_date) || '—'}</td>
                          <td><div className="progress-track mini-progress"><div className="progress-fill" style={{ width: `${t.progress ?? 0}%`, ...(t.status === 'done' ? { background: 'var(--positive)' } : {}) }}></div></div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            <div className="grid-2col stack-gap">
              <div>
                {/* Files */}
                <section className="block" id="files">
                  <div className="section-title-row">
                    <span className="section-title">File Overview</span>
                    <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="upload" size={13} /> আপলোড</button>
                  </div>
                  {attachments.length === 0 ? (
                    <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="file" /></div><div className="empty-title">কোনো ফাইল আপলোড হয়নি</div><div className="empty-sub">টাস্ক এক্সপ্যান্ড করে অ্যাটাচমেন্ট যোগ করা যায়।</div></div></div>
                  ) : (
                    <div className="file-grid">
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

                {/* Recent Activity */}
                <section className="panel block" id="activity">
                  <div className="panel-head"><span className="panel-title">Recent Activity</span></div>
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
              </div>

              <div>
                {/* Insights */}
                <section className="ai-card block">
                  <div className="ai-head"><div className="ai-badge"><Icon name="spark" color="#fff" /></div><div className="ai-title">AI ইনসাইট</div></div>
                  <div className="ai-list">{insights.map((text, i) => (<div className="ai-item" key={i}><span className="dot"></span> {text}</div>))}</div>
                </section>

                {/* Client Info */}
                {project.clients && (
                  <section className="client-info-card block" id="client">
                    <div className="client-info-top">
                      <div className="client-logo">{project.clients.company_name.charAt(0).toUpperCase()}</div>
                      <div><div className="client-info-name">{project.clients.company_name}</div><div className="client-info-sub">{project.clients.industry ?? '—'}</div></div>
                    </div>
                    <div className="client-detail-grid">
                      <div><div className="client-detail-label">Contact Person</div><div className="client-detail-value">{project.clients.primary_contact ?? '—'}</div></div>
                      <div><div className="client-detail-label">Email</div><div className="client-detail-value">{project.clients.contact_email ?? '—'}</div></div>
                      <div><div className="client-detail-label">Phone</div><div className="client-detail-value tabular">{project.clients.contact_phone ?? '—'}</div></div>
                      <div><div className="client-detail-label">Next Meeting</div><div className="client-detail-value">{nextMeeting ? `${formatBnDate(nextMeeting.meeting_date)}${nextMeeting.meeting_time ? `, ${formatTimeBn(nextMeeting.meeting_time)}` : ''}` : 'নির্ধারিত নেই'}</div></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div><div className="client-detail-label">Client Status</div>{clientStatusMeta && <span className={`status-pill ${clientStatusMeta.cls}`}>{clientStatusMeta.label}</span>}</div>
                    </div>
                  </section>
                )}

                {/* Quick Actions */}
                <section className="panel block">
                  <div className="panel-head"><span className="panel-title">Quick Actions</span></div>
                  <div className="qa-grid">
                    <Link className="qa-btn" href="/tasks"><div className="qa-icon"><Icon name="plus" size={14} /></div><span className="qa-label">টাস্ক তৈরি</span></Link>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="upload" size={14} /></div><span className="qa-label">ফাইল আপলোড</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="user-plus" size={14} /></div><span className="qa-label">মেম্বার ইনভাইট</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="check-circle" size={14} /></div><span className="qa-label">রিভিউ শুরু</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="share" size={14} /></div><span className="qa-label">প্রজেক্ট শেয়ার</span></button>
                    <button className="qa-btn" disabled title="শীঘ্রই আসছে"><div className="qa-icon"><Icon name="bar" size={14} /></div><span className="qa-label">রিপোর্ট বানান</span></button>
                  </div>
                </section>

                {/* Notes — schema-তে টেবিল নেই */}
                <section className="panel" id="notes">
                  <div className="panel-head"><span className="panel-title">Notes</span></div>
                  <div className="empty-state">
                    <div className="empty-icon"><Icon name="note" /></div>
                    <div className="empty-title">এখনো কোনো নোট নেই</div>
                    <div className="empty-sub">নোট ফিচার চালু করতে schema-তে একটা টেবিল যোগ করা লাগবে।</div>
                    <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="plus" size={13} /> নোট যোগ করুন</button>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>

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
    </div>
  );
}
