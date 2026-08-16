'use client';

// Calendar — Week/Day/Agenda ভিউ পুরোপুরি রিয়েল ডেটা দিয়ে:
// - মিটিং (meetings টেবিল, এখন meeting_time আসল 'time' টাইপ + duration_minutes +
//   meeting_link কলাম সহ — schema.sql-এ যোগ করা হয়েছে) সময়-গ্রিডে বসে, উপরে-নিচে
//   ড্র্যাগ করলে সময় বদলায়, নিচের হ্যান্ডেল টেনে duration বদলানো যায়
// - টাস্ক/প্রজেক্ট ডেডলাইন (due_date) সারাদিনের চিপ হিসেবে দেখা যায়, এক দিন থেকে
//   আরেক দিনে ড্র্যাগ করলে আসল due_date আপডেট হয়
// - মাইলস্টোন মার্কার (milestones টেবিল)
// - ডান প্যানেলে আজকের সময়সূচি/আপকামিং ডেডলাইন/টিম availability/ইনসাইট/মিটিং/
//   মাইলস্টোন সব রিয়েল; নোট বক্স localStorage-এ পার্সিস্ট হয়
//
// Month ও Timeline ভিউ এখনো বানানো হয়নি (অনেক বড় আলাদা কাজ) — ট্যাব ক্লিক করলে
// honest "শীঘ্রই আসছে" মেসেজ দেখাবে, ভাঙা কিছু দেখাবে না।

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './calendar.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDateLong, formatTimeBn, todayISO } from '@/lib/format';
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
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  filter: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h14l-3 5 3 5H4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-3.9"/><path d="M8.6 13.4l6.8 3.9"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'checklist', label: 'To-Do', href: '/todos' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar', active: true },
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

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_PX = 48;
const DAY_NAMES = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const BN_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function addDaysISO(iso: string, n: number) {
  return isoDate(addDays(new Date(iso), n));
}
function startOfWeekMonday(d: Date) {
  const c = new Date(d);
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  c.setHours(0, 0, 0, 0);
  return c;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type ViewMode = 'day' | 'week' | 'month' | 'timeline' | 'agenda';

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null };
type ProjectOption = { id: string; name: string };
type ClientOption = { id: string; company_name: string };
type AssigneeOption = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };

type DeadlineItem = { kind: 'task' | 'project'; id: string; title: string; date: string; time: string | null; projectName: string | null; assigneeName: string | null };
type MeetingItem = {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string | null;
  duration_minutes: number;
  meeting_link: string | null;
  attendees: string | null;
  notes: string | null;
  client_id: string | null;
  clients: { company_name: string } | null;
};
type MilestoneItem = { id: string; project_id: string; title: string; due_date: string | null; completed_at: string | null; progress: number | null; projects: { name: string } | null };

type SelectedEvent = { kind: 'task' | 'project'; data: DeadlineItem } | { kind: 'meeting'; data: MeetingItem } | { kind: 'milestone'; data: MilestoneItem };

async function fetchCalendarData() {
  const today = todayISO();
  const rangeStart = addDaysISO(today, -14);
  const rangeEnd = addDaysISO(today, 120);

  const [tasksRes, projectsRes, meetingsRes, milestonesRes, clientsRes, teamRes, workloadRes] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date, due_time, status, projects(name), profiles!assignee_id(full_name)').not('due_date', 'is', null).gte('due_date', rangeStart).lte('due_date', rangeEnd).neq('status', 'done'),
    supabase.from('projects').select('id, name, due_date, status').not('due_date', 'is', null).gte('due_date', rangeStart).lte('due_date', rangeEnd).neq('status', 'completed'),
    supabase.from('meetings').select('id, title, meeting_date, meeting_time, duration_minutes, meeting_link, attendees, notes, client_id, clients(company_name)').gte('meeting_date', rangeStart).lte('meeting_date', rangeEnd).order('meeting_date'),
    supabase.from('milestones').select('id, project_id, title, due_date, completed_at, progress, projects(name)').not('due_date', 'is', null).gte('due_date', rangeStart).lte('due_date', rangeEnd),
    supabase.from('clients').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, avatar_color, avatar_url').order('full_name'),
    supabase.from('tasks').select('assignee_id').neq('status', 'done').not('assignee_id', 'is', null),
  ]);

  const firstErrored = [tasksRes, projectsRes, meetingsRes, milestonesRes, clientsRes, teamRes, workloadRes].find((r) => r.error);

  const taskDeadlines: DeadlineItem[] = ((tasksRes.data as unknown as { id: string; title: string; due_date: string; due_time: string | null; projects: { name: string } | null; profiles: { full_name: string } | null }[]) ?? []).map((t) => ({
    kind: 'task',
    id: t.id,
    title: t.title,
    date: t.due_date,
    time: t.due_time,
    projectName: t.projects?.name ?? null,
    assigneeName: t.profiles?.full_name ?? null,
  }));
  const projectDeadlines: DeadlineItem[] = ((projectsRes.data as { id: string; name: string; due_date: string }[]) ?? []).map((p) => ({
    kind: 'project',
    id: p.id,
    title: p.name,
    date: p.due_date,
    time: null,
    projectName: p.name,
    assigneeName: null,
  }));

  const workloadCounts = new Map<string, number>();
  for (const row of (workloadRes.data as { assignee_id: string }[]) ?? []) workloadCounts.set(row.assignee_id, (workloadCounts.get(row.assignee_id) ?? 0) + 1);

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    deadlines: [...taskDeadlines, ...projectDeadlines],
    meetings: (meetingsRes.data as unknown as MeetingItem[]) ?? [],
    milestones: (milestonesRes.data as unknown as MilestoneItem[]) ?? [],
    clientOptions: (clientsRes.data as ClientOption[]) ?? [],
    teamOptions: (teamRes.data as AssigneeOption[]) ?? [],
    workloadCounts,
  };
}

const NOTES_KEY_PREFIX = 'designops-calendar-notes-';

export default function CalendarPage() {
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);

  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<AssigneeOption[]>([]);
  const [workloadCounts, setWorkloadCounts] = useState<Map<string, number>>(new Map());
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SelectedEvent | null>(null);
  const [notes, setNotes] = useState('');

  const [draggedDeadline, setDraggedDeadline] = useState<DeadlineItem | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ meetingId: string; top: number; height: number } | null>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; meetingId: string; startY: number; startTop: number; startHeight: number; moved: boolean; lastY: number } | null>(null);
  const justDraggedRef = useRef(false);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [mTitle, setMTitle] = useState('');
  const [mClientId, setMClientId] = useState('');
  const [mDate, setMDate] = useState('');
  const [mTime, setMTime] = useState('10:00');
  const [mDuration, setMDuration] = useState(60);
  const [mLink, setMLink] = useState('');
  const [mAttendees, setMAttendees] = useState('');
  const [savingMeeting, setSavingMeeting] = useState(false);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [msProjectId, setMsProjectId] = useState('');
  const [msTitle, setMsTitle] = useState('');
  const [msDueDate, setMsDueDate] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchCalendarData(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setDeadlines(result.deadlines);
      setMeetings(result.meetings);
      setMilestones(result.milestones);
      setClientOptions(result.clientOptions);
      setTeamOptions(result.teamOptions);
      setWorkloadCounts(result.workloadCounts);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

      const { data: projRes } = await supabase.from('projects').select('id, name').order('name');
      setProjectOptions((projRes as ProjectOption[]) ?? []);
      setLoading(false);
    }

    run();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    function run() {
      setNotes(localStorage.getItem(NOTES_KEY_PREFIX + user!.id) ?? '');
    }
    run();
  }, [user]);

  function saveNotes(value: string) {
    setNotes(value);
    if (user) localStorage.setItem(NOTES_KEY_PREFIX + user.id, value);
  }

  function computeMeetingPos(m: MeetingItem) {
    if (!m.meeting_time) return null;
    const [h, mi] = m.meeting_time.split(':').map(Number);
    const hourDecimal = h + mi / 60;
    const top = (hourDecimal - START_HOUR) * HOUR_PX;
    const height = Math.max(20, (m.duration_minutes / 60) * HOUR_PX - 2);
    return { top, height };
  }

  function computeDeadlinePos(dl: DeadlineItem) {
    if (!dl.time) return null;
    const [h, mi] = dl.time.split(':').map(Number);
    const hourDecimal = h + mi / 60;
    const top = (hourDecimal - START_HOUR) * HOUR_PX;
    return { top, height: 34 };
  }

  async function updateMeetingField(id: string, patch: Partial<Pick<MeetingItem, 'meeting_time' | 'duration_minutes' | 'meeting_date' | 'title' | 'client_id' | 'meeting_link' | 'attendees' | 'notes'>>) {
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    const { error } = await supabase.from('meetings').update(patch).eq('id', id);
    if (error) setError(error.message);
  }

  // meeting drag (vertical move / resize) — registered once, reads from refs to avoid stale closures
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      d.lastY = e.clientY;
      const delta = e.clientY - d.startY;
      if (Math.abs(delta) > 3) d.moved = true;
      if (d.mode === 'move') {
        let newTop = Math.round((d.startTop + delta) / 12) * 12;
        newTop = Math.max(0, Math.min(newTop, (END_HOUR - START_HOUR) * HOUR_PX - d.startHeight));
        setDragPreview({ meetingId: d.meetingId, top: newTop, height: d.startHeight });
      } else {
        const newHeight = Math.max(24, Math.round((d.startHeight + delta) / 12) * 12);
        setDragPreview({ meetingId: d.meetingId, top: d.startTop, height: newHeight });
      }
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      if (!d.moved) {
        setDragPreview(null);
        return;
      }
      justDraggedRef.current = true;
      const delta = d.lastY - d.startY;
      if (d.mode === 'move') {
        let newTop = Math.round((d.startTop + delta) / 12) * 12;
        newTop = Math.max(0, Math.min(newTop, (END_HOUR - START_HOUR) * HOUR_PX - d.startHeight));
        const totalMinutes = Math.round((newTop / HOUR_PX + START_HOUR) * 60);
        const hh = Math.floor(totalMinutes / 60);
        const mm = totalMinutes % 60;
        updateMeetingField(d.meetingId, { meeting_time: `${pad2(hh)}:${pad2(mm)}:00` });
      } else {
        const newHeight = Math.max(24, Math.round((d.startHeight + delta) / 12) * 12);
        const newDuration = Math.max(15, Math.round(((newHeight + 2) / HOUR_PX) * 60 / 15) * 15);
        updateMeetingField(d.meetingId, { duration_minutes: newDuration });
      }
      setDragPreview(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  function startMeetingDrag(e: React.MouseEvent, m: MeetingItem, mode: 'move' | 'resize') {
    e.stopPropagation();
    const pos = computeMeetingPos(m);
    if (!pos) return;
    dragRef.current = { mode, meetingId: m.id, startY: e.clientY, startTop: pos.top, startHeight: pos.height, moved: false, lastY: e.clientY };
    setDragPreview({ meetingId: m.id, top: pos.top, height: pos.height });
  }

  async function deleteMeeting(id: string) {
    if (!window.confirm('এই মিটিং ডিলিট করতে চান?')) return;
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    await supabase.from('meetings').delete().eq('id', id);
    setSelected(null);
  }

  async function updateDeadlineDate(item: DeadlineItem, newDate: string) {
    const table = item.kind === 'task' ? 'tasks' : 'projects';
    setDeadlines((prev) => prev.map((d) => (d.kind === item.kind && d.id === item.id ? { ...d, date: newDate } : d)));
    await supabase.from(table).update({ due_date: newDate }).eq('id', item.id);
  }

  async function updateTaskDeadlineTime(item: DeadlineItem, newTime: string) {
    if (item.kind !== 'task') return;
    const value = newTime ? `${newTime}:00` : null;
    setDeadlines((prev) => prev.map((d) => (d.kind === 'task' && d.id === item.id ? { ...d, time: value } : d)));
    await supabase.from('tasks').update({ due_time: value }).eq('id', item.id);
  }

  async function toggleMilestoneComplete(m: MilestoneItem) {
    const isDone = !!m.completed_at;
    const patch = isDone ? { completed_at: null } : { completed_at: todayISO(), progress: 100 };
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    await supabase.from('milestones').update(patch).eq('id', m.id);
  }

  function openMeetingModal(existing?: MeetingItem, defaultDate?: string) {
    if (existing) {
      setEditingMeetingId(existing.id);
      setMTitle(existing.title);
      setMClientId(existing.client_id ?? '');
      setMDate(existing.meeting_date);
      setMTime(existing.meeting_time ? existing.meeting_time.slice(0, 5) : '10:00');
      setMDuration(existing.duration_minutes);
      setMLink(existing.meeting_link ?? '');
      setMAttendees(existing.attendees ?? '');
    } else {
      setEditingMeetingId(null);
      setMTitle('');
      setMClientId('');
      setMDate(defaultDate ?? todayISO());
      setMTime('10:00');
      setMDuration(60);
      setMLink('');
      setMAttendees('');
    }
    setShowMeetingModal(true);
  }

  async function handleSaveMeeting(e: FormEvent) {
    e.preventDefault();
    if (!mTitle.trim() || !mDate) return;
    setSavingMeeting(true);

    const payload = {
      title: mTitle.trim(),
      client_id: mClientId || null,
      meeting_date: mDate,
      meeting_time: `${mTime}:00`,
      duration_minutes: mDuration,
      meeting_link: mLink.trim() || null,
      attendees: mAttendees.trim() || null,
    };

    if (editingMeetingId) {
      const { error } = await supabase.from('meetings').update(payload).eq('id', editingMeetingId);
      if (error) {
        setError(error.message);
      } else {
        const client = clientOptions.find((c) => c.id === mClientId) ?? null;
        setMeetings((prev) => prev.map((m) => (m.id === editingMeetingId ? { ...m, ...payload, clients: client ? { company_name: client.company_name } : null } : m)));
        if (selected?.kind === 'meeting' && selected.data.id === editingMeetingId) setSelected(null);
      }
    } else {
      const { data, error } = await supabase.from('meetings').insert(payload).select('id, title, meeting_date, meeting_time, duration_minutes, meeting_link, attendees, notes, client_id, clients(company_name)').single();
      if (error) setError(error.message);
      else if (data) setMeetings((prev) => [...prev, data as unknown as MeetingItem]);
    }

    setSavingMeeting(false);
    setShowMeetingModal(false);
  }

  async function handleCreateMilestone(e: FormEvent) {
    e.preventDefault();
    if (!msProjectId || !msTitle.trim()) return;
    setSavingMilestone(true);
    const { data, error } = await supabase.from('milestones').insert({ project_id: msProjectId, title: msTitle.trim(), due_date: msDueDate || null, progress: 0 }).select('id, project_id, title, due_date, completed_at, progress, projects(name)').single();
    setSavingMilestone(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setMilestones((prev) => [...prev, data as unknown as MilestoneItem]);
    setMsProjectId('');
    setMsTitle('');
    setMsDueDate('');
    setShowMilestoneModal(false);
  }

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    setCreatingTask(true);
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: newTitle.trim(), project_id: newProjectId || null, assignee_id: newAssigneeId || null, due_date: newDueDate || null, due_time: newDueTime ? `${newDueTime}:00` : null, status: 'todo', workflow_stage: 'backlog', created_by: user.id })
      .select('id, title, due_date, due_time, projects(name), profiles!assignee_id(full_name)')
      .single();
    setCreatingTask(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      const row = data as unknown as { id: string; title: string; due_date: string | null; due_time: string | null; projects: { name: string } | null; profiles: { full_name: string } | null };
      if (row.due_date) setDeadlines((prev) => [...prev, { kind: 'task', id: row.id, title: row.title, date: row.due_date as string, time: row.due_time, projectName: row.projects?.name ?? null, assigneeName: row.profiles?.full_name ?? null }]);
    }
    setNewTitle('');
    setNewProjectId('');
    setNewAssigneeId('');
    setNewDueDate('');
    setNewDueTime('');
    setShowCreateTask(false);
  }

  const today = todayISO();

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') return [new Date(anchorDate)];
    const start = startOfWeekMonday(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [viewMode, anchorDate]);

  const visibleDaysISO = useMemo(() => visibleDays.map(isoDate), [visibleDays]);

  const filteredMeetings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings.filter((m) => !q || m.title.toLowerCase().includes(q));
  }, [meetings, search]);
  const filteredDeadlines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deadlines.filter((d) => !q || d.title.toLowerCase().includes(q));
  }, [deadlines, search]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, MeetingItem[]>();
    for (const m of filteredMeetings) {
      const list = map.get(m.meeting_date) ?? [];
      list.push(m);
      map.set(m.meeting_date, list);
    }
    return map;
  }, [filteredMeetings]);
  const deadlinesByDay = useMemo(() => {
    const map = new Map<string, DeadlineItem[]>();
    for (const d of filteredDeadlines) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return map;
  }, [filteredDeadlines]);
  const milestonesByDay = useMemo(() => {
    const map = new Map<string, MilestoneItem[]>();
    for (const m of milestones) {
      if (!m.due_date) continue;
      const list = map.get(m.due_date) ?? [];
      list.push(m);
      map.set(m.due_date, list);
    }
    return map;
  }, [milestones]);

  // মিনিমাম কলাম-প্রস্থ (minmax) দেওয়া আছে যাতে ছোট স্ক্রিনে কলাম একদম চেপে না
  // যায় — .cal-scroll তখন হরাইজন্টালি স্ক্রল করে (দেখুন calendar.css-এর
  // ৮৬০px মিডিয়া কোয়েরি)।
  const gridCols = `56px repeat(${visibleDays.length}, minmax(90px, 1fr))`;

  const weekLabel = useMemo(() => {
    if (visibleDays.length === 0) return '';
    const s = visibleDays[0];
    const e = visibleDays[visibleDays.length - 1];
    if (visibleDays.length === 1) return `${s.getDate()} ${BN_MONTHS[s.getMonth()]}, ${s.getFullYear()}`;
    return `${s.getDate()}–${e.getDate()} ${BN_MONTHS[e.getMonth()]}, ${e.getFullYear()}`;
  }, [visibleDays]);

  function navigate(dir: 1 | -1) {
    setAnchorDate((prev) => addDays(prev, viewMode === 'day' ? dir : dir * 7));
  }
  function goToday() {
    setAnchorDate(new Date());
  }

  const todaysMeetings = useMemo(() => (meetingsByDay.get(today) ?? []).slice().sort((a, b) => (a.meeting_time ?? '').localeCompare(b.meeting_time ?? '')), [meetingsByDay, today]);
  const todaysDeadlines = useMemo(() => deadlinesByDay.get(today) ?? [], [deadlinesByDay, today]);

  const upcomingGrouped = useMemo(() => {
    const tomorrow = addDaysISO(today, 1);
    const weekEnd = addDaysISO(today, 7);
    const todayList = deadlines.filter((d) => d.date === today);
    const tomorrowList = deadlines.filter((d) => d.date === tomorrow);
    const weekList = deadlines.filter((d) => d.date > tomorrow && d.date <= weekEnd);
    return { todayList, tomorrowList, weekList };
  }, [deadlines, today]);

  const upcomingMeetings = useMemo(() => meetings.filter((m) => m.meeting_date >= today).sort((a, b) => (a.meeting_date + (a.meeting_time ?? '')).localeCompare(b.meeting_date + (b.meeting_time ?? ''))).slice(0, 4), [meetings, today]);
  const upcomingMilestones = useMemo(() => milestones.filter((m) => !m.completed_at).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 4), [milestones]);

  const teamAvailability = useMemo(
    () =>
      teamOptions.map((t) => {
        const count = workloadCounts.get(t.id) ?? 0;
        const label = count >= 4 ? 'Full' : count >= 2 ? 'Busy' : 'Free';
        const cls = count >= 4 ? 'ab-full' : count >= 2 ? 'ab-busy' : 'ab-free';
        return { ...t, count, label, cls };
      }),
    [teamOptions, workloadCounts]
  );

  const insights = useMemo(() => {
    const list: string[] = [];
    const totalTodayMinutes = todaysMeetings.reduce((s, m) => s + m.duration_minutes, 0);
    if (totalTodayMinutes > 0) list.push(`আজ আপনার প্রায় ${(totalTodayMinutes / 60).toFixed(1)} ঘণ্টার মিটিং শিডিউল করা আছে।`);
    if (upcomingGrouped.tomorrowList.length >= 3) list.push(`আগামীকাল ${upcomingGrouped.tomorrowList.length}টা ডেডলাইন একসাথে পড়েছে।`);
    const overbooked = teamAvailability.find((t) => t.label === 'Full');
    if (overbooked) list.push(`${overbooked.full_name} আজ ওভারবুকড (${overbooked.count}টা সক্রিয় টাস্ক)।`);
    if (list.length === 0) list.push('শিডিউল এই মুহূর্তে ভারসাম্যপূর্ণ।');
    return list;
  }, [todaysMeetings, upcomingGrouped, teamAvailability]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`calendar-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div><div className="brand-name">FLOW 53</div><div className="brand-sub">Innovate · Design · Elevate</div></div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন"><Icon name="close" size={16} /></button>
            </div>
            <nav className="nav-group" aria-label="Sidebar" onClick={() => setMobileNavOpen(false)}>
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} href={item.href} className={`nav-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
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

        <div className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন"><Icon name="menu" /></button>
            <div className="page-title-block">
              <div className="page-title">Calendar</div>
              <div className="page-sub">প্রজেক্ট প্ল্যান করুন, ডেডলাইন সামলান, টিমকে সিঙ্কড রাখুন।</div>
            </div>
            <div className="topbar-spacer"></div>
            <button className="btn btn-ghost" onClick={goToday}><Icon name="target" size={13} /> <span className="btn-label">আজ</span></button>
            <button className="btn btn-ghost" onClick={() => openMeetingModal()}><Icon name="plus" size={13} /> <span className="btn-label">Meeting</span></button>
            <button className="btn btn-accent" onClick={() => setShowCreateTask(true)}><Icon name="plus" size={13} /> <span className="btn-label">Task</span></button>
            <button className="icon-btn" onClick={() => setDark((d) => !d)} aria-label="থিম"><Icon name={dark ? 'moon' : 'sun'} /></button>
          </header>

          <div className="toolbar">
            <div className="search-mini"><Icon name="search" size={12} /><input placeholder="খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="nav-arrows">
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => navigate(-1)}><Icon name="chevron-left" size={13} /></button>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => navigate(1)}><Icon name="chevron-right" size={13} /></button>
            </div>
            <span className="week-label tabular">{weekLabel}</span>
            <div className="view-tabs">
              {(['day', 'week', 'month', 'timeline', 'agenda'] as ViewMode[]).map((v) => (
                <button key={v} className={`view-tab${viewMode === v ? ' active' : ''}`} onClick={() => setViewMode(v)}>
                  {v === 'day' ? 'Day' : v === 'week' ? 'Week' : v === 'month' ? 'Month' : v === 'timeline' ? 'Timeline' : 'Agenda'}
                </button>
              ))}
            </div>
            <div className="toolbar-spacer"></div>
            <button className="filter-chip" disabled title="শীঘ্রই আসছে"><Icon name="filter" size={12} /> Filter</button>
          </div>

          {error && <div style={{ margin: '10px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}

          <div className="cal-body">
            {loading ? (
              <p style={{ padding: 20, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : viewMode === 'month' || viewMode === 'timeline' ? (
              <div className="placeholder-view">
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6 }}>{viewMode === 'month' ? 'Month View' : 'Timeline View'}</div>
                <div style={{ fontSize: 12, maxWidth: 260 }}>এই ভিউটা শীঘ্রই আসছে — আপাতত Week/Day/Agenda ভিউ ব্যবহার করুন।</div>
              </div>
            ) : viewMode === 'agenda' ? (
              <div className="cal-scroll">
                <div className="agenda-wrap">
                  {visibleDaysISO.every((iso) => (meetingsByDay.get(iso) ?? []).length === 0 && (deadlinesByDay.get(iso) ?? []).length === 0) ? (
                    <div className="agenda-empty">এই সপ্তাহে কোনো ইভেন্ট নেই।</div>
                  ) : (
                    visibleDays.map((d) => {
                      const iso = isoDate(d);
                      const dayMeetings = (meetingsByDay.get(iso) ?? []).slice().sort((a, b) => (a.meeting_time ?? '').localeCompare(b.meeting_time ?? ''));
                      const dayDeadlines = deadlinesByDay.get(iso) ?? [];
                      if (dayMeetings.length === 0 && dayDeadlines.length === 0) return null;
                      return (
                        <div className="agenda-day" key={iso}>
                          <div className="agenda-day-label">{DAY_NAMES[d.getDay()]}, {d.getDate()} {BN_MONTHS[d.getMonth()]}</div>
                          {dayMeetings.map((m) => (
                            <div className="agenda-item" key={m.id} onClick={() => setSelected({ kind: 'meeting', data: m })}>
                              <span className="agenda-dot" style={{ background: 'var(--positive)' }}></span>
                              <span className="agenda-time tabular">{formatTimeBn(m.meeting_time) || '—'}</span>
                              <span className="agenda-title">{m.title}</span>
                            </div>
                          ))}
                          {dayDeadlines.map((dl) => (
                            <div className="agenda-item" key={`${dl.kind}-${dl.id}`} onClick={() => setSelected({ kind: dl.kind, data: dl })}>
                              <span className="agenda-dot" style={{ background: dl.kind === 'project' ? 'var(--danger)' : 'var(--warning)' }}></span>
                              <span className="agenda-time tabular">{formatTimeBn(dl.time) || 'সারাদিন'}</span>
                              <span className="agenda-title">{dl.title}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="cal-scroll">
                <div className="day-header-row" style={{ gridTemplateColumns: gridCols }}>
                  <div></div>
                  {visibleDays.map((d) => (
                    <div key={isoDate(d)} className={`day-header${isSameDay(d, new Date()) ? ' today' : ''}`}>
                      <div className="day-name">{DAY_NAMES[d.getDay()]}</div>
                      <div className="day-num tabular">{d.getDate()}</div>
                    </div>
                  ))}
                </div>

                <div className="time-grid" style={{ gridTemplateColumns: gridCols }}>
                  <div className="time-gutter">
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map((h) => (
                      <div key={h} className="time-slot-label tabular">{h > 12 ? h - 12 : h}{h >= 12 ? ' PM' : ' AM'}</div>
                    ))}
                  </div>
                  {visibleDays.map((d) => {
                    const iso = isoDate(d);
                    const dayMeetings = meetingsByDay.get(iso) ?? [];
                    const dayMilestones = milestonesByDay.get(iso) ?? [];
                    const dayDeadlines = deadlinesByDay.get(iso) ?? [];
                    const isToday = isSameDay(d, new Date());
                    const now = new Date();
                    const nowHourDecimal = now.getHours() + now.getMinutes() / 60;
                    const DEADLINE_BLOCK_HEIGHT = 30;
                    const DEADLINE_GAP = 4;
                    return (
                      <div
                        key={iso}
                        className={`day-col${dragOverDay === iso ? ' drag-over' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverDay(iso);
                        }}
                        onDragLeave={() => setDragOverDay((c) => (c === iso ? null : c))}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverDay(null);
                          if (draggedDeadline) updateDeadlineDate(draggedDeadline, iso);
                        }}
                      >
                        {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => <div key={i} className="hour-line"></div>)}
                        {isToday && nowHourDecimal >= START_HOUR && nowHourDecimal <= END_HOUR && <div className="now-line" style={{ top: (nowHourDecimal - START_HOUR) * HOUR_PX }}></div>}
                        {dayMilestones.map((ms) => (
                          <div key={ms.id} className="milestone-marker" style={{ left: 6 }} onClick={() => setSelected({ kind: 'milestone', data: ms })}>
                            <span className="milestone-dot"></span>{ms.title}
                          </div>
                        ))}
                        {dayDeadlines.filter((dl) => !dl.time).map((dl, i) => (
                          <div
                            key={`${dl.kind}-${dl.id}`}
                            className={`cal-event ev-deadline-${dl.kind}`}
                            style={{ top: i * (DEADLINE_BLOCK_HEIGHT + DEADLINE_GAP), height: DEADLINE_BLOCK_HEIGHT }}
                            draggable
                            onDragStart={() => setDraggedDeadline(dl)}
                            onDragEnd={() => setDraggedDeadline(null)}
                            onClick={() => setSelected({ kind: dl.kind, data: dl })}
                          >
                            <div className="ev-title">{dl.kind === 'project' ? 'ডেডলাইন: ' : ''}{dl.title}</div>
                          </div>
                        ))}
                        {dayDeadlines.filter((dl) => dl.time).map((dl) => {
                          const pos = computeDeadlinePos(dl);
                          if (!pos) return null;
                          return (
                            <div
                              key={`${dl.kind}-${dl.id}`}
                              className={`cal-event ev-deadline-${dl.kind}`}
                              style={{ top: pos.top, height: pos.height }}
                              draggable
                              onDragStart={() => setDraggedDeadline(dl)}
                              onDragEnd={() => setDraggedDeadline(null)}
                              onClick={() => setSelected({ kind: dl.kind, data: dl })}
                            >
                              <div className="ev-title">{dl.kind === 'project' ? 'ডেডলাইন: ' : ''}{dl.title}</div>
                              <div className="ev-time tabular">{formatTimeBn(dl.time)}</div>
                            </div>
                          );
                        })}
                        {dayMeetings.map((m) => {
                          const basePos = computeMeetingPos(m);
                          if (!basePos) return null;
                          const pos = dragPreview && dragPreview.meetingId === m.id ? dragPreview : basePos;
                          const endMinutes = m.meeting_time ? (() => { const [h, mi] = m.meeting_time!.split(':').map(Number); return h * 60 + mi + m.duration_minutes; })() : 0;
                          const endLabel = `${Math.floor(endMinutes / 60) % 24}:${pad2(endMinutes % 60)}`;
                          return (
                            <div
                              key={m.id}
                              className={`cal-event${dragPreview?.meetingId === m.id ? ' dragging' : ''}`}
                              style={{ top: pos.top, height: pos.height }}
                              onMouseDown={(e) => startMeetingDrag(e, m, 'move')}
                              onClick={() => {
                                if (justDraggedRef.current) {
                                  justDraggedRef.current = false;
                                  return;
                                }
                                setSelected({ kind: 'meeting', data: m });
                              }}
                            >
                              <div className="ev-title">{m.title}</div>
                              <div className="ev-time tabular">{formatTimeBn(m.meeting_time)}–{formatTimeBn(endLabel)}</div>
                              <div className="ev-resize-handle" onMouseDown={(e) => startMeetingDrag(e, m, 'resize')}></div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RIGHT PANEL */}
            <aside className="right-panel">
              {!selected ? (
                <div>
                  <div className="rp-section">
                    <div className="rp-title">আজকের সময়সূচি <span className="rp-sub">{formatBnDateLong(today)}</span></div>
                    {todaysMeetings.length === 0 && todaysDeadlines.length === 0 ? (
                      <div className="empty-mini">আজ কিছু শিডিউল করা নেই।</div>
                    ) : (
                      <>
                        {todaysMeetings.map((m) => (
                          <div className="sched-row" key={m.id} onClick={() => setSelected({ kind: 'meeting', data: m })}>
                            <span className="sched-time tabular">{formatTimeBn(m.meeting_time)}</span>
                            <span className="sched-dot" style={{ background: 'var(--positive)' }}></span>
                            <span className="sched-title">{m.title}</span>
                          </div>
                        ))}
                        {todaysDeadlines.map((dl) => (
                          <div className="sched-row" key={`${dl.kind}-${dl.id}`} onClick={() => setSelected({ kind: dl.kind, data: dl })}>
                            <span className="sched-time tabular">{formatTimeBn(dl.time) || 'সারাদিন'}</span>
                            <span className="sched-dot" style={{ background: dl.kind === 'project' ? 'var(--danger)' : 'var(--warning)' }}></span>
                            <span className="sched-title">{dl.title}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Upcoming Deadlines</div>
                    {upcomingGrouped.todayList.length === 0 && upcomingGrouped.tomorrowList.length === 0 && upcomingGrouped.weekList.length === 0 ? (
                      <div className="empty-mini">সামনে কোনো ডেডলাইন নেই।</div>
                    ) : (
                      <>
                        {upcomingGrouped.todayList.length > 0 && (
                          <>
                            <div className="deadline-group-label">আজ</div>
                            {upcomingGrouped.todayList.map((dl) => (
                              <div className="deadline-item" key={`${dl.kind}-${dl.id}`} onClick={() => setSelected({ kind: dl.kind, data: dl })}>
                                <div className="deadline-main"><div className="deadline-task">{dl.title}</div><div className="deadline-proj">{dl.projectName ?? '—'}{dl.assigneeName ? ` · ${dl.assigneeName}` : ''}</div></div>
                                <span className="deadline-time" style={{ color: 'var(--danger)' }}>আজ</span>
                              </div>
                            ))}
                          </>
                        )}
                        {upcomingGrouped.tomorrowList.length > 0 && (
                          <>
                            <div className="deadline-group-label">আগামীকাল</div>
                            {upcomingGrouped.tomorrowList.map((dl) => (
                              <div className="deadline-item" key={`${dl.kind}-${dl.id}`} onClick={() => setSelected({ kind: dl.kind, data: dl })}>
                                <div className="deadline-main"><div className="deadline-task">{dl.title}</div><div className="deadline-proj">{dl.projectName ?? '—'}{dl.assigneeName ? ` · ${dl.assigneeName}` : ''}</div></div>
                                <span className="deadline-time" style={{ color: 'var(--warning)' }}>1d</span>
                              </div>
                            ))}
                          </>
                        )}
                        {upcomingGrouped.weekList.length > 0 && (
                          <>
                            <div className="deadline-group-label">এই সপ্তাহে</div>
                            {upcomingGrouped.weekList.map((dl) => (
                              <div className="deadline-item" key={`${dl.kind}-${dl.id}`} onClick={() => setSelected({ kind: dl.kind, data: dl })}>
                                <div className="deadline-main"><div className="deadline-task">{dl.title}</div><div className="deadline-proj">{dl.projectName ?? '—'}{dl.assigneeName ? ` · ${dl.assigneeName}` : ''}</div></div>
                                <span className="deadline-time" style={{ color: 'var(--ink-faint)' }}>{Math.round((new Date(dl.date).getTime() - new Date(today).getTime()) / 86400000)}d</span>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Team Availability <span className="rp-sub">এখন</span></div>
                    {teamAvailability.length === 0 ? (
                      <div className="empty-mini">কোনো টিম মেম্বার নেই।</div>
                    ) : (
                      teamAvailability.slice(0, 6).map((t) => (
                        <div className="team-avail-row" key={t.id}>
                          <Avatar person={t} size={22} />
                          <span className="team-avail-name">{t.full_name}</span>
                          <span className={`avail-badge ${t.cls}`}>{t.label}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Planning ইনসাইট</div>
                    <div className="ai-mini-card">
                      {insights.map((text, i) => (
                        <div className="ai-mini-item" key={i}><span className="dot"></span> {text}</div>
                      ))}
                      <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled title="শীঘ্রই আসছে">Optimize Schedule</button>
                    </div>
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Meetings</div>
                    {upcomingMeetings.length === 0 ? (
                      <div className="empty-mini">সামনে কোনো মিটিং নেই।</div>
                    ) : (
                      upcomingMeetings.map((m) => (
                        <div className="meeting-mini" key={m.id}>
                          <div className="avatar" style={{ width: 20, height: 20, fontSize: 9 }}>{Array.from(m.title)[0]}</div>
                          <div style={{ flex: 1, minWidth: 0 }} onClick={() => setSelected({ kind: 'meeting', data: m })}>
                            <div className="meeting-mini-title">{m.title}</div>
                            <div className="meeting-mini-sub">{formatBnDateLong(m.meeting_date).split(',')[0]} · {formatTimeBn(m.meeting_time)}</div>
                          </div>
                          {m.meeting_link ? (
                            <a className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 10.5 }} href={m.meeting_link} target="_blank" rel="noopener noreferrer">Join</a>
                          ) : (
                            <button className="btn btn-ghost" style={{ padding: '4px 9px', fontSize: 10.5 }} disabled title="কোনো লিংক নেই">Join</button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Milestones</div>
                    {upcomingMilestones.length === 0 ? (
                      <div className="empty-mini">কোনো আপকামিং মাইলস্টোন নেই।</div>
                    ) : (
                      upcomingMilestones.map((m) => (
                        <div className="milestone-mini" key={m.id} onClick={() => setSelected({ kind: 'milestone', data: m })}>
                          <div className="mm-top"><span className="mm-name">{m.title}</span><span className="tabular" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{m.progress ?? 0}%</span></div>
                          <div className="mm-track"><div className="mm-fill" style={{ width: `${m.progress ?? 0}%` }}></div></div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Quick Actions</div>
                    <div className="qa-mini-grid">
                      <button className="qa-mini-btn" onClick={() => setShowCreateTask(true)}><Icon name="plus" size={14} />Create Task</button>
                      <button className="qa-mini-btn" onClick={() => openMeetingModal()}><Icon name="video" size={14} />Book Meeting</button>
                      <button className="qa-mini-btn" onClick={() => setShowMilestoneModal(true)}><Icon name="flag" size={14} />Add Milestone</button>
                      <button className="qa-mini-btn" disabled title="শীঘ্রই আসছে"><Icon name="share" size={14} />Share Calendar</button>
                    </div>
                  </div>

                  <div className="rp-section">
                    <div className="rp-title">Quick Notes</div>
                    <textarea className="notes-box" placeholder="এই সপ্তাহের জন্য কিছু মনে রাখতে চান?" value={notes} onChange={(e) => saveNotes(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div>
                  <button className="detail-back" onClick={() => setSelected(null)}><Icon name="chevron-left" size={14} /> ক্যালেন্ডারে ফিরুন</button>

                  {(selected.kind === 'task' || selected.kind === 'project') && (
                    <>
                      <div className="detail-title">{selected.data.title}</div>
                      <span className="detail-type-chip" style={{ background: selected.kind === 'project' ? 'var(--danger-soft)' : 'var(--warning-soft)', color: selected.kind === 'project' ? 'var(--danger)' : 'var(--warning)' }}>
                        {selected.kind === 'project' ? 'Project Deadline' : 'Task Deadline'}
                      </span>
                      <div className="detail-field-grid">
                        <div><div className="detail-field-label">Project</div><div className="detail-field-value">{selected.data.projectName ?? '—'}</div></div>
                        {selected.data.assigneeName && <div><div className="detail-field-label">Assignee</div><div className="detail-field-value">{selected.data.assigneeName}</div></div>}
                        <div>
                          <div className="detail-field-label">Due Date</div>
                          <input className="detail-input" type="date" value={selected.data.date} onChange={(e) => { updateDeadlineDate(selected.data, e.target.value); setSelected({ ...selected, data: { ...selected.data, date: e.target.value } } as SelectedEvent); }} />
                        </div>
                        {selected.kind === 'task' && (
                          <div>
                            <div className="detail-field-label">সময়সীমা (ঐচ্ছিক)</div>
                            <input className="detail-input" type="time" value={selected.data.time ? selected.data.time.slice(0, 5) : ''} onChange={(e) => { updateTaskDeadlineTime(selected.data, e.target.value); setSelected({ ...selected, data: { ...selected.data, time: e.target.value ? `${e.target.value}:00` : null } } as SelectedEvent); }} />
                          </div>
                        )}
                      </div>
                      {selected.kind === 'project' ? (
                        <Link className="btn btn-ghost btn-sm" href={`/projects/${selected.data.id}`}>প্রজেক্টে দেখুন</Link>
                      ) : (
                        <Link className="btn btn-ghost btn-sm" href="/tasks">টাস্ক লিস্টে দেখুন</Link>
                      )}
                    </>
                  )}

                  {selected.kind === 'meeting' && (
                    <>
                      <div className="detail-title">{selected.data.title}</div>
                      <span className="detail-type-chip" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}>Meeting</span>
                      <div className="detail-field-grid">
                        <div><div className="detail-field-label">Client</div><div className="detail-field-value">{selected.data.clients?.company_name ?? '—'}</div></div>
                        <div><div className="detail-field-label">Date</div><div className="detail-field-value">{formatBnDateLong(selected.data.meeting_date)}</div></div>
                        <div><div className="detail-field-label">Time</div><div className="detail-field-value">{formatTimeBn(selected.data.meeting_time)}</div></div>
                        <div><div className="detail-field-label">Duration</div><div className="detail-field-value">{selected.data.duration_minutes} মিনিট</div></div>
                      </div>
                      {selected.data.attendees && <p className="detail-desc">উপস্থিত: {selected.data.attendees}</p>}
                      <div className="detail-qa-grid">
                        <button className="qa-mini-btn" onClick={() => openMeetingModal(selected.data)}>এডিট</button>
                        {selected.data.meeting_link ? (
                          <a className="qa-mini-btn" href={selected.data.meeting_link} target="_blank" rel="noopener noreferrer"><Icon name="video" size={14} />Join Call</a>
                        ) : (
                          <button className="qa-mini-btn" disabled title="কোনো লিংক নেই"><Icon name="video" size={14} />Join Call</button>
                        )}
                        <button className="qa-mini-btn btn-danger" onClick={() => deleteMeeting(selected.data.id)}><Icon name="close" size={14} />Cancel</button>
                      </div>
                    </>
                  )}

                  {selected.kind === 'milestone' && (
                    <>
                      <div className="detail-title">{selected.data.title}</div>
                      <span className="detail-type-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Milestone</span>
                      <div className="detail-field-grid">
                        <div><div className="detail-field-label">Project</div><div className="detail-field-value">{selected.data.projects?.name ?? '—'}</div></div>
                        <div><div className="detail-field-label">Progress</div><div className="detail-field-value tabular">{selected.data.progress ?? 0}%</div></div>
                        <div><div className="detail-field-label">Due Date</div><div className="detail-field-value">{formatBnDateLong(selected.data.due_date)}</div></div>
                        <div><div className="detail-field-label">Status</div><div className="detail-field-value">{selected.data.completed_at ? 'সম্পন্ন' : 'চলমান'}</div></div>
                      </div>
                      <div className="detail-qa-grid">
                        <button className="qa-mini-btn" onClick={() => toggleMilestoneComplete(selected.data as MilestoneItem)}>{(selected.data as MilestoneItem).completed_at ? 'আবার খুলুন' : 'সম্পন্ন করুন'}</button>
                        <Link className="qa-mini-btn" href={`/projects/${(selected.data as MilestoneItem).project_id}`}>প্রজেক্টে দেখুন</Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {showCreateTask && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateTask(false); }}>
          <div className="modal-box">
            <div className="modal-title">নতুন টাস্ক তৈরি করুন</div>
            <form onSubmit={handleCreateTask}>
              <label className="field-label">টাস্কের নাম</label>
              <input className="field-input" type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="যেমন: হোমপেজ ওয়্যারফ্রেম" autoFocus required />
              <label className="field-label">প্রজেক্ট</label>
              <select className="field-input" value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}>
                <option value="">কোনো প্রজেক্ট নেই</option>
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label className="field-label">কাকে অ্যাসাইন করবেন</label>
              <select className="field-input" value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)}>
                <option value="">অনির্ধারিত</option>
                {teamOptions.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
              <div className="field-row">
                <div>
                  <label className="field-label">ডেডলাইন</label>
                  <input className="field-input" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">সময় (ঐচ্ছিক)</label>
                  <input className="field-input" type="time" value={newDueTime} onChange={(e) => setNewDueTime(e.target.value)} disabled={!newDueDate} />
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreateTask(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creatingTask || !newTitle.trim()}>{creatingTask ? 'তৈরি হচ্ছে…' : 'তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEETING MODAL (create / edit) */}
      {showMeetingModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowMeetingModal(false); }}>
          <div className="modal-box">
            <div className="modal-title">{editingMeetingId ? 'মিটিং এডিট করুন' : 'নতুন মিটিং'}</div>
            <form onSubmit={handleSaveMeeting}>
              <label className="field-label">শিরোনাম</label>
              <input className="field-input" type="text" value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="যেমন: ক্লায়েন্ট কল — Nilkantha" autoFocus required />
              <label className="field-label">ক্লায়েন্ট</label>
              <select className="field-input" value={mClientId} onChange={(e) => setMClientId(e.target.value)}>
                <option value="">কোনো ক্লায়েন্ট নেই</option>
                {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <div className="field-row">
                <div><label className="field-label">তারিখ</label><input className="field-input" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} required /></div>
                <div><label className="field-label">সময়</label><input className="field-input" type="time" value={mTime} onChange={(e) => setMTime(e.target.value)} required /></div>
              </div>
              <label className="field-label">Duration (মিনিট)</label>
              <select className="field-input" value={mDuration} onChange={(e) => setMDuration(Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} মিনিট</option>)}
              </select>
              <label className="field-label">মিটিং লিংক (ঐচ্ছিক)</label>
              <input className="field-input" type="url" value={mLink} onChange={(e) => setMLink(e.target.value)} placeholder="https://meet.google.com/..." />
              <label className="field-label">উপস্থিত (ঐচ্ছিক)</label>
              <input className="field-input" type="text" value={mAttendees} onChange={(e) => setMAttendees(e.target.value)} placeholder="যেমন: রাফি, তানভীর" />
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMeetingModal(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={savingMeeting || !mTitle.trim()}>{savingMeeting ? 'সেভ হচ্ছে…' : editingMeetingId ? 'আপডেট করুন' : 'মিটিং তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MILESTONE MODAL */}
      {showMilestoneModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowMilestoneModal(false); }}>
          <div className="modal-box">
            <div className="modal-title">নতুন মাইলস্টোন</div>
            <form onSubmit={handleCreateMilestone}>
              <label className="field-label">প্রজেক্ট</label>
              <select className="field-input" value={msProjectId} onChange={(e) => setMsProjectId(e.target.value)} required>
                <option value="">প্রজেক্ট বেছে নিন</option>
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label className="field-label">শিরোনাম</label>
              <input className="field-input" type="text" value={msTitle} onChange={(e) => setMsTitle(e.target.value)} placeholder="যেমন: ওয়্যারফ্রেম ও IA" autoFocus required />
              <label className="field-label">ডেডলাইন</label>
              <input className="field-input" type="date" value={msDueDate} onChange={(e) => setMsDueDate(e.target.value)} />
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMilestoneModal(false)}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={savingMilestone || !msProjectId || !msTitle.trim()}>{savingMilestone ? 'তৈরি হচ্ছে…' : 'তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
