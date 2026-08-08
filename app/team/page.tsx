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

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './team.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDate, relativeTimeBn, todayISO } from '@/lib/format';
import { STAGE_LABEL, type TaskStatus, type TaskPriority } from '@/lib/taskMeta';
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
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  export: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 19h16"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  'user-plus': '<path d="M14 19v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="7" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  gauge: '<path d="M12 15l3.5-5.5"/><circle cx="12" cy="15" r="1.5"/><path d="M4 15a8 8 0 1 1 16 0"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 16, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team', active: true },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files' },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'bar', label: 'Reports', href: '#' },
];

const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '#' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

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

function isThisWeek(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 7 * 86400000;
}

const WEEKLY_CAPACITY_HOURS = 40;

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; is_admin?: boolean };

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

type TeamActivity = { id: string; detail: string | null; created_at: string; profiles: { full_name: string } | null };

type MemberStat = {
  id: string;
  name: string;
  role: string | null;
  avatar_color: string | null;
  is_admin: boolean;
  activeTasks: number;
  projectIds: string[];
  estHours: number;
  nextDeadline: string | null;
  currentStage: string | null;
  primaryProjectId: string | null;
  primaryProjectName: string | null;
  managerName: string | null;
  lastActivityAt: string | null;
  capacityPercent: number;
};

type AllocProject = {
  id: string;
  name: string;
  status: string;
  progress: number | null;
  due_date: string | null;
  assignees: { id: string; name: string; avatar_color: string | null }[];
};

const TEAM_SELECT =
  'id, status, priority, workflow_stage, due_date, estimated_hours, updated_at, assignee_id, projects(id, name, status, progress, due_date, project_manager_id)';

async function fetchTeamData() {
  const [profilesRes, tasksRes, activityRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, avatar_color, is_admin').order('full_name'),
    supabase.from('tasks').select(TEAM_SELECT),
    supabase.from('activity_log').select('id, detail, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(8),
  ]);

  const firstErrored = [profilesRes, tasksRes, activityRes].find((r) => r.error);

  const profiles = (profilesRes.data as ProfileRow[]) ?? [];
  const tasks = (tasksRes.data as unknown as TeamTaskRow[]) ?? [];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // ---- per-member aggregation ----
  const memberAgg = new Map<
    string,
    { activeTasks: number; projectIds: Set<string>; estHours: number; nextDeadline: string | null; lastActivityAt: string | null; stageByProject: Map<string, { stage: string; updatedAt: string }>; projectTaskCount: Map<string, number> }
  >();

  for (const t of tasks) {
    if (!t.assignee_id) continue;
    const cur =
      memberAgg.get(t.assignee_id) ??
      { activeTasks: 0, projectIds: new Set<string>(), estHours: 0, nextDeadline: null, lastActivityAt: null, stageByProject: new Map(), projectTaskCount: new Map() };

    if (t.status !== 'done') {
      cur.activeTasks += 1;
      cur.estHours += t.estimated_hours ?? 0;
      if (t.due_date && (!cur.nextDeadline || t.due_date < cur.nextDeadline)) cur.nextDeadline = t.due_date;
      if (t.projects) {
        cur.projectIds.add(t.projects.id);
        cur.projectTaskCount.set(t.projects.id, (cur.projectTaskCount.get(t.projects.id) ?? 0) + 1);
        const existingStage = cur.stageByProject.get(t.projects.id);
        if (!existingStage || t.updated_at > existingStage.updatedAt) cur.stageByProject.set(t.projects.id, { stage: t.workflow_stage, updatedAt: t.updated_at });
      }
    }
    if (!cur.lastActivityAt || t.updated_at > cur.lastActivityAt) cur.lastActivityAt = t.updated_at;

    memberAgg.set(t.assignee_id, cur);
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

    const capacityPercent = Math.min(100, Math.round((activeTasks / 5) * 100));

    return {
      id: p.id,
      name: p.full_name,
      role: p.role,
      avatar_color: p.avatar_color,
      is_admin: !!p.is_admin,
      activeTasks,
      projectIds,
      estHours,
      nextDeadline: agg?.nextDeadline ?? null,
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
      if (profile) proj.assignees.push({ id: profile.id, name: profile.full_name, avatar_color: profile.avatar_color });
    }
    allocMap.set(t.projects.id, proj);
  }

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    members,
    allocations: Array.from(allocMap.values()),
    activity: (activityRes.data as unknown as TeamActivity[]) ?? [],
    completedThisWeek: tasks.filter((t) => t.status === 'done' && isThisWeek(t.updated_at)).length,
  };
}

export default function TeamWorkloadPage() {
  const { user, loading: sessionLoading } = useSession();

  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [members, setMembers] = useState<MemberStat[]>([]);
  const [allocations, setAllocations] = useState<AllocProject[]>([]);
  const [activity, setActivity] = useState<TeamActivity[]>([]);
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
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

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchTeamData(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, is_admin').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setMembers(result.members);
      setAllocations(result.allocations);
      setActivity(result.activity);
      setCompletedThisWeek(result.completedThisWeek);
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
    setActivity(result.activity);
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

  const displayName = profile?.full_name ?? user.email ?? 'ব্যবহারকারী';
  const avatarInitial = Array.from(displayName)[0]?.toUpperCase() ?? '?';
  const today = todayISO();

  return (
    <div className={`teamworkload-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        {/* ============ SIDEBAR ============ */}
        <aside className="sidebar" aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div><div className="brand-name">FLOW 53</div><div className="brand-sub">Innovate · Design · Elevate</div></div>
            </div>
            <nav className="nav-group" aria-label="Sidebar">
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
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
              <span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — মেম্বার, প্রজেক্ট...</span>
              <span className="kbd">⌘K</span>
            </button>
            <div className="topbar-spacer"></div>
            <Link className="btn btn-accent" href="/tasks"><Icon name="plus" /> নতুন তৈরি করুন</Link>
            <button className="icon-btn" aria-label="নোটিফিকেশন"><Icon name="bell" /><span className="dot-indicator"></span></button>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}><Icon name={dark ? 'moon' : 'sun'} /></button>
            <div className="avatar" style={{ width: 30, height: 30, fontSize: 12, background: profile?.avatar_color ?? undefined }}>{avatarInitial}</div>
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">Team Workload</h1>
                <p className="page-sub">টিমের ক্যাপাসিটি মনিটর করুন, workload ব্যালেন্স করুন, প্রজেক্ট এগিয়ে রাখুন।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleReload} disabled={reloading}><Icon name="refresh" size={13} /> {reloading ? 'রিলোড হচ্ছে…' : 'রিলোড'}</button>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="export" size={13} /> Export</button>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="bookmark" size={13} /> Saved Views</button>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে"><Icon name="bar" size={13} /> Generate Report</button>
                {profile?.is_admin && <button className="btn btn-accent" onClick={() => setShowAddMember(true)}><Icon name="user-plus" /> টিম মেম্বার যোগ করুন</button>}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>
            )}

            {/* KPI overview */}
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="users" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.total}</div><div className="kpi-label">Total Team Members</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="activity" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.active}</div><div className="kpi-label">Active Members</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check-circle" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.available}</div><div className="kpi-label">Available Members</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.overloaded}</div><div className="kpi-label">Overloaded Members</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="gauge" /></div></div><div className="kpi-value tabular">{loading ? '—' : `${kpis.avgCapacity}%`}</div><div className="kpi-label">Average Capacity</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check" /></div></div><div className="kpi-value tabular">{loading ? '—' : completedThisWeek}</div><div className="kpi-label">Completed This Week</div></div>
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
                    return (
                      <div className="member-card" key={m.id}>
                        <div className="member-top">
                          <div className="avatar" style={{ width: 38, height: 38, fontSize: 14, background: m.avatar_color ?? undefined }}>{Array.from(m.name)[0]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="member-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {m.name}
                              {m.is_admin && <span className="state-chip st-balanced" style={{ fontSize: 9.5 }}>Admin</span>}
                            </div>
                            <div className="member-role">{m.role ?? 'Team Member'}</div>
                          </div>
                        </div>
                        {profile?.is_admin && (
                          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ flex: 1 }}
                              disabled={busyMemberId === m.id}
                              title="পাসওয়ার্ড রিসেট করুন"
                              onClick={() => { setResetTarget({ id: m.id, name: m.name }); setResetPassword(''); setResetError(null); }}
                            >
                              পাসওয়ার্ড
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ flex: 1 }}
                              disabled={busyMemberId === m.id || m.id === profile.id}
                              title={m.id === profile.id ? 'নিজের এডমিন স্ট্যাটাস এখান থেকে বদলানো যাবে না' : ''}
                              onClick={() => handleToggleAdmin(m.id, !m.is_admin)}
                            >
                              {m.is_admin ? 'এডমিন বাদ দিন' : 'এডমিন করুন'}
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ flex: 1, color: 'var(--danger)' }}
                              disabled={busyMemberId === m.id || m.id === profile.id}
                              title={m.id === profile.id ? 'নিজেকে রিমুভ করা যাবে না' : 'রিমুভ করুন'}
                              onClick={() => handleRemoveMember(m.id, m.name)}
                            >
                              রিমুভ
                            </button>
                          </div>
                        )}
                        <div className="capacity-row"><span className="capacity-pct tabular">{m.capacityPercent}%</span><span className={`state-chip ${state.cls}`}>{state.label}</span></div>
                        <div className="cap-track"><div className="cap-fill" style={{ width: `${m.capacityPercent}%`, background: state.color }}></div></div>
                        <div className="member-stat-grid">
                          <div><div className="mstat-label">Active Tasks</div><div className="mstat-value tabular">{m.activeTasks}</div></div>
                          <div><div className="mstat-label">Projects</div><div className="mstat-value tabular">{m.projectIds.length}</div></div>
                          <div><div className="mstat-label">Est. Hours</div><div className="mstat-value tabular">{m.estHours}h</div></div>
                          <div><div className="mstat-label">Available</div><div className="mstat-value tabular">{availableHours}h</div></div>
                        </div>
                        <div className="stage-tag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>{m.primaryProjectName ? `${m.primaryProjectName} · ${STAGE_LABEL[m.currentStage ?? ''] ?? m.currentStage ?? '—'}` : 'কোনো অ্যাক্টিভ প্রজেক্ট নেই'}</span>
                          <Link href={`/tasks?assignee=${m.id}`} style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>টাস্ক দিন</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Workload Distribution */}
            <section className="block">
              <div className="section-title-row">
                <span className="section-title">Workload Distribution</span>
                <div className="sort-row">
                  {SORT_OPTIONS.map((s) => (
                    <button key={s.key} className={`sort-chip${sortKey === s.key ? ' active' : ''}`} onClick={() => setSortKey(s.key)}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="dist-list">
                {sortedMembers.map((m) => {
                  const state = capacityState(m.capacityPercent);
                  return (
                    <div className="dist-row" key={m.id}>
                      <span className="dist-name">{m.name}</span>
                      <div className="dist-bar-track"><div className="dist-bar-fill" style={{ width: `${m.capacityPercent}%`, background: state.color }}></div></div>
                      <span className="dist-value tabular">{m.capacityPercent}% · {m.activeTasks} tasks</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid-2col">
              <div>
                {/* Today's Availability — schema-তে attendance/presence টেবিল নেই */}
                <section className="block">
                  <div className="section-title-row"><span className="section-title">Today&apos;s Availability</span></div>
                  <div className="panel">
                    <div className="empty-state">
                      <div className="empty-icon"><Icon name="calendar" /></div>
                      <div className="empty-title">এই ফিচার এখনো যোগ করা হয়নি</div>
                      <div className="empty-sub">লাইভ উপস্থিতি/শিডিউল দেখাতে হলে একটা attendance টেবিল ও আপডেট ফ্লো লাগবে।</div>
                    </div>
                  </div>
                </section>

                {/* Current Assignments */}
                <section className="block">
                  <div className="section-title-row"><span className="section-title">Current Assignments</span></div>
                  {members.filter((m) => m.activeTasks > 0).length === 0 ? (
                    <div className="panel"><div className="empty-state"><div className="empty-icon"><Icon name="check" /></div><div className="empty-title">এখন কারো নামে অ্যাক্টিভ টাস্ক নেই</div></div></div>
                  ) : (
                    <div className="table-scroll">
                      <table className="assign-table">
                        <thead><tr><th>Member</th><th>Projects</th><th>Tasks</th><th>Current Stage</th><th>Next Deadline</th><th>Capacity</th><th>Manager</th><th></th></tr></thead>
                        <tbody>
                          {sortedMembers.filter((m) => m.activeTasks > 0).map((m) => {
                            const projectNames = m.projectIds.map((pid) => allocations.find((a) => a.id === pid)?.name).filter(Boolean);
                            const isOverdue = m.nextDeadline ? m.nextDeadline < today : false;
                            const isSoon = m.nextDeadline ? m.nextDeadline >= today && m.nextDeadline <= todayISO() : false;
                            const state = capacityState(m.capacityPercent);
                            return (
                              <tr key={m.id}>
                                <td><div className="assignee-cell"><div className="avatar" style={{ width: 22, height: 22, fontSize: 9, background: m.avatar_color ?? undefined }}>{Array.from(m.name)[0]}</div>{m.name}</div></td>
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

                {/* Workload Heatmap — schema-তে সময়ভিত্তিক (দিন/ঘণ্টা) লগ নেই */}
                <section className="block">
                  <div className="section-title-row"><span className="section-title">Workload Heatmap</span></div>
                  <div className="panel">
                    <div className="empty-state">
                      <div className="empty-icon"><Icon name="bar" /></div>
                      <div className="empty-title">এই ফিচার এখনো যোগ করা হয়নি</div>
                      <div className="empty-sub">দিন/সময় অনুযায়ী হিটম্যাপ দেখাতে হলে টাস্কে টাইমস্ট্যাম্পড time-log লাগবে — এখন শুধু মোট estimated/logged hours আছে।</div>
                    </div>
                  </div>
                </section>

                {/* Project Allocation */}
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
                                  <div className="avatar" key={m.id} style={{ width: 24, height: 24, fontSize: 9, background: m.avatar_color ?? undefined }}>{Array.from(m.name)[0]}</div>
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

              <div>
                {/* AI Workload Insights */}
                <section className="ai-card block">
                  <div className="ai-head"><div className="ai-badge"><Icon name="spark" color="#fff" /></div><div className="ai-title">AI ইনসাইট</div></div>
                  <div className="ai-list">{insights.map((text, i) => (<div className="ai-item" key={i}><span className="dot"></span> {text}</div>))}</div>
                </section>

                {/* Recent Activity */}
                <section className="panel block">
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
        </div>
      </div>

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
    </div>
  );
}
