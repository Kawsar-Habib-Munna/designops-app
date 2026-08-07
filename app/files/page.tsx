'use client';

// Files & Assets — সম্পূর্ণ রিয়েল Supabase ডেটা (attachments টেবিল, Drive-link
// ভিত্তিক — schema.sql-এর কমেন্ট অনুযায়ী এই অ্যাপ ফাইল হোস্ট করে না, শুধু লিংক
// রাখে)। মকআপের কিছু অংশ বাদ দেওয়া হয়েছে যেগুলোর কোনো স্কিমা/ইন্টিগ্রেশন
// ব্যাকিং নেই — সেগুলো fabricate না করে honest ভাবে সরানো/প্লেসহোল্ডার করা হয়েছে:
//   - "Folders" এখন প্রকৃত প্রজেক্ট-ভিত্তিক গ্রুপিং (folder = project, কোনো
//     আলাদা folders টেবিল নেই)
//   - Figma/Drive "Connected · Synced" স্ট্যাটাস — কোনো আসল OAuth ইন্টিগ্রেশন
//     নেই, তাই honest ভাবে "শীঘ্রই আসছে" হিসেবে দেখানো হয়
//   - Version History, Tags, Storage Used (GB) — schema-তে কোনো ব্যাকিং নেই,
//     বাদ দেওয়া হয়েছে
//   - Favorites — লোকাল-অনলি টগল (রিফ্রেশে হারিয়ে যায়), Project Details পেজের
//     "starred" প্যাটার্নের মতোই
// Review-status চিপ (rc-review/rc-handoff/rc-draft) লিংকড টাস্কের workflow_stage
// থেকে ডিরাইভ করা — attachments টেবিলে নিজে কোনো review_status কলাম নেই।

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import './files.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDate, relativeTimeBn } from '@/lib/format';
import { STAGE_LABEL } from '@/lib/taskMeta';
import { canPreviewInline, driveThumbnailUrl, guessFileType, uploadFileToDrive } from '@/lib/driveUpload';
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
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  filter: '<path d="M4 4h16l-6 8v6l-4 2v-8z"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  figma: '<circle cx="12" cy="8" r="3"/><rect x="7" y="11" width="10" height="10" rx="2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  star: '<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
};

type IconName = keyof typeof ICON_PATHS;

function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects' },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
  { icon: 'calendar', label: 'Calendar', href: '/calendar' },
  { icon: 'users', label: 'Team', href: '/team' },
  { icon: 'building', label: 'Clients', href: '#' },
  { icon: 'file', label: 'Files', href: '/files', active: true },
  { icon: 'message', label: 'Discussions', href: '/discussions' },
  { icon: 'bar', label: 'Reports', href: '#' },
];
const NAV_ITEMS_BOTTOM: { icon: IconName; label: string; href: string }[] = [
  { icon: 'bell', label: 'Notifications', href: '#' },
  { icon: 'settings', label: 'Settings', href: '#' },
];

const ASSETS_PAGE_SIZE = 6;

const FILE_TYPES = ['figma', 'pdf', 'image', 'video', 'zip', 'other'] as const;
const FILE_TYPE_META: Record<string, { icon: IconName; label: string; bg: string; color: string }> = {
  figma: { icon: 'figma', label: 'Figma', bg: 'linear-gradient(135deg,var(--accent-soft),var(--accent-soft-2))', color: 'var(--accent)' },
  pdf: { icon: 'file', label: 'PDF', bg: 'linear-gradient(135deg,var(--danger-soft),var(--surface-muted))', color: 'var(--danger)' },
  image: { icon: 'image', label: 'Image', bg: 'linear-gradient(135deg,var(--accent-soft-2),var(--surface-muted))', color: 'var(--accent)' },
  video: { icon: 'video', label: 'Video', bg: 'linear-gradient(135deg,var(--positive-soft),var(--surface-muted))', color: 'var(--positive)' },
  zip: { icon: 'archive', label: 'ZIP', bg: 'linear-gradient(135deg,var(--warning-soft),var(--surface-muted))', color: 'var(--warning)' },
  other: { icon: 'file', label: 'File', bg: 'linear-gradient(135deg,var(--surface-muted),var(--border-soft))', color: 'var(--ink-faint)' },
};
function fileTypeMeta(t: string | null) {
  return FILE_TYPE_META[t ?? 'other'] ?? FILE_TYPE_META.other;
}

function msSinceDaysAgo(days: number) {
  return Date.now() - days * 86400000;
}

function fileReviewChip(stage: string | undefined): { cls: string; label: string } | null {
  if (!stage) return null;
  if (stage === 'client_review' || stage === 'ux_review') return { cls: 'rc-review', label: 'Review' };
  if (stage === 'handoff' || stage === 'completed') return { cls: 'rc-handoff', label: 'Ready' };
  return { cls: 'rc-draft', label: 'Draft' };
}

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null };
type TaskOption = { id: string; title: string; project_id: string | null; status: string };
type ProjectOption = { id: string; name: string; due_date: string | null };
type ClientOption = { id: string; company_name: string };
type FolderRow = { id: string; name: string; parent_id: string | null; project_id: string | null };

type AttachmentRow = {
  id: string;
  file_name: string;
  file_type: string | null;
  drive_url: string;
  uploaded_at: string;
  task_id: string | null;
  client_id: string | null;
  folder_id: string | null;
  profiles: { full_name: string; avatar_color: string | null } | null;
  tasks: { id: string; title: string; workflow_stage: string; status: string; project_id: string | null; projects: { id: string; name: string; due_date: string | null } | null } | null;
  clients: { id: string; company_name: string } | null;
  folders: { id: string; name: string } | null;
};

const ATTACHMENT_SELECT =
  'id, file_name, file_type, drive_url, uploaded_at, task_id, client_id, folder_id, profiles(full_name, avatar_color), tasks(id, title, workflow_stage, status, project_id, projects(id, name, due_date)), clients(id, company_name), folders(id, name)';

async function fetchFilesData() {
  const [attachmentsRes, projectsRes, tasksRes, clientsRes, teamRes, foldersRes] = await Promise.all([
    supabase.from('attachments').select(ATTACHMENT_SELECT).order('uploaded_at', { ascending: false }),
    supabase.from('projects').select('id, name, due_date').order('name'),
    supabase.from('tasks').select('id, title, project_id, status').order('title'),
    supabase.from('clients').select('id, company_name').order('company_name'),
    supabase.from('profiles').select('id, full_name, avatar_color').order('full_name'),
    supabase.from('folders').select('id, name, parent_id, project_id').order('name'),
  ]);

  const firstErrored = [attachmentsRes, projectsRes, tasksRes, clientsRes, teamRes, foldersRes].find((r) => r.error);

  return {
    errorMessage: firstErrored?.error?.message ?? null,
    attachments: (attachmentsRes.data as unknown as AttachmentRow[]) ?? [],
    projectOptions: (projectsRes.data as ProjectOption[]) ?? [],
    taskOptions: (tasksRes.data as TaskOption[]) ?? [],
    clientOptions: (clientsRes.data as ClientOption[]) ?? [],
    teamOptions: (teamRes.data as { id: string; full_name: string; avatar_color: string | null }[]) ?? [],
    folderOptions: (foldersRes.data as FolderRow[]) ?? [],
  };
}

export default function FilesPage() {
  const { user, loading: sessionLoading } = useSession();

  const [dark, setDark] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<{ id: string; full_name: string; avatar_color: string | null }[]>([]);
  const [folderOptions, setFolderOptions] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [newFileName, setNewFileName] = useState('');
  const [newDriveUrl, setNewDriveUrl] = useState('');
  const [newFileType, setNewFileType] = useState<string>('figma');
  const [attachMode, setAttachMode] = useState<'task' | 'client' | 'none'>('task');
  const [newTaskId, setNewTaskId] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [uploadFolderId, setUploadFolderId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState('');
  const [newFolderProjectId, setNewFolderProjectId] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function run() {
      const [result, profileRes] = await Promise.all([
        fetchFilesData(),
        supabase.from('profiles').select('id, full_name, role, avatar_color').eq('id', user!.id).single(),
      ]);
      setError(result.errorMessage);
      setAttachments(result.attachments);
      setProjectOptions(result.projectOptions);
      setTaskOptions(result.taskOptions);
      setClientOptions(result.clientOptions);
      setTeamOptions(result.teamOptions);
      setFolderOptions(result.folderOptions);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user]);

  async function handleReload() {
    setReloading(true);
    const result = await fetchFilesData();
    setError(result.errorMessage);
    setAttachments(result.attachments);
    setProjectOptions(result.projectOptions);
    setTaskOptions(result.taskOptions);
    setClientOptions(result.clientOptions);
    setTeamOptions(result.teamOptions);
    setFolderOptions(result.folderOptions);
    setReloading(false);
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  }

  async function deleteAttachment(id: string) {
    if (!window.confirm('এই ফাইলটা লিস্ট থেকে সরাতে চান? (আসল ফাইল Drive-এ থেকে যাবে, শুধু লিংক রিমুভ হবে)')) return;
    setBusyId(id);
    // .select() যোগ করা আছে যাতে RLS delete পলিসি না থাকলে (০ রো ডিলিট হয়ে চুপচাপ
    // পাস হয়ে যাওয়া) সেটা ধরা যায় — নাহলে UI থেকে অপটিমিস্টিকালি সরিয়ে ফেললেও
    // আসলে ডাটাবেজে থেকে যেত, আর রিফ্রেশ করলে ফাইলটা আবার ফিরে আসত।
    const { data, error } = await supabase.from('attachments').delete().eq('id', id).select('id');
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setError('ফাইলটা ডিলিট করা যায়নি — পারমিশন সমস্যা হতে পারে (attachments-এর RLS delete পলিসি চেক করুন)।');
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function closeUploadModal() {
    setShowUpload(false);
    setUploadMode('file');
    setNewFileName('');
    setNewDriveUrl('');
    setNewFileType('figma');
    setAttachMode('task');
    setNewTaskId('');
    setNewClientId('');
    setUploadFolderId('');
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError(null);
  }

  // কোনো ফোল্ডার সিলেক্ট করা অবস্থায় (যেমন খালি ফোল্ডার থেকে) "ফাইল যোগ করুন" চাপলে
  // সেই ফোল্ডারটাই মোডালে আগে থেকে বেছে রাখে।
  function openUploadModal() {
    if (folderFilter?.startsWith('folder:')) setUploadFolderId(folderFilter.replace('folder:', ''));
    setShowUpload(true);
  }

  function closeNewFolderModal() {
    setShowNewFolder(false);
    setNewFolderName('');
    setNewFolderParentId('');
    setNewFolderProjectId('');
    setNewFolderError(null);
  }

  async function handleCreateFolder(e: FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;
    setCreatingFolder(true);
    setNewFolderError(null);

    const { data, error } = await supabase
      .from('folders')
      .insert({ name: newFolderName.trim(), parent_id: newFolderParentId || null, project_id: newFolderProjectId || null, created_by: user.id })
      .select('id, name, parent_id, project_id')
      .single();

    setCreatingFolder(false);
    if (error) {
      setNewFolderError(error.message);
      return;
    }

    setFolderOptions((prev) => [...prev, data as FolderRow].sort((a, b) => a.name.localeCompare(b.name)));
    closeNewFolderModal();
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      let fileName = newFileName.trim();
      let driveUrl = newDriveUrl.trim();

      if (uploadMode === 'file') {
        if (!selectedFile) throw new Error('একটা ফাইল বেছে নিন।');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
        fileName = fileName || selectedFile.name;
        const result = await uploadFileToDrive(selectedFile, session.access_token, setUploadProgress);
        driveUrl = result.webViewLink;
      }

      if (!fileName || !driveUrl) throw new Error('ফাইলের নাম ও লিংক আবশ্যক।');

      const { data, error } = await supabase
        .from('attachments')
        .insert({
          file_name: fileName,
          drive_url: driveUrl,
          file_type: newFileType,
          task_id: attachMode === 'task' ? newTaskId || null : null,
          client_id: attachMode === 'client' ? newClientId || null : null,
          folder_id: uploadFolderId || null,
          uploaded_by: user.id,
        })
        .select(ATTACHMENT_SELECT)
        .single();

      if (error) throw new Error(error.message);

      const row = data as unknown as AttachmentRow;
      setAttachments((prev) => [row, ...prev]);
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'file_uploaded',
        entity_type: 'attachment',
        entity_id: row.id,
        detail: `"${row.file_name}" যোগ করা হয়েছে`,
      });

      closeUploadModal();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setUploading(false);
    }
  }

  // ---- derived: project grouping ("folders"), progress stats, KPIs, filters ----
  const projectProgress = useMemo(() => {
    const stats = new Map<string, { done: number; total: number }>();
    for (const t of taskOptions) {
      if (!t.project_id) continue;
      const cur = stats.get(t.project_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === 'done') cur.done += 1;
      stats.set(t.project_id, cur);
    }
    const out = new Map<string, number>();
    for (const [pid, s] of stats) out.set(pid, s.total > 0 ? Math.round((s.done / s.total) * 100) : 0);
    return out;
  }, [taskOptions]);

  // ফোল্ডার গ্রুপিং — একটা ফাইল কাস্টম ফোল্ডারে (ম্যানুয়ালি তৈরি) থাকলে সেটাই
  // প্রাধান্য পায়, নাহলে লিংকড প্রজেক্ট/ক্লায়েন্ট থেকে অটো-বাকেট হয়।
  function groupKeyOf(a: AttachmentRow) {
    if (a.folder_id) return `folder:${a.folder_id}`;
    if (a.tasks?.project_id) return `project:${a.tasks.project_id}`;
    if (a.client_id) return 'client';
    return 'other';
  }

  const folderCards = useMemo(() => {
    const counts = new Map<string, { count: number; lastAt: string }>();
    for (const a of attachments) {
      const key = groupKeyOf(a);
      const cur = counts.get(key);
      if (!cur) counts.set(key, { count: 1, lastAt: a.uploaded_at });
      else counts.set(key, { count: cur.count + 1, lastAt: a.uploaded_at > cur.lastAt ? a.uploaded_at : cur.lastAt });
    }

    const projectById = new Map(projectOptions.map((p) => [p.id, p]));
    const folderById = new Map(folderOptions.map((f) => [f.id, f]));

    // কাস্টম ফোল্ডার — ফাইল না থাকলেও (count 0) দেখাবে, যেহেতু ইচ্ছাকৃতভাবে তৈরি করা
    const customCards = folderOptions.map((f) => {
      const stat = counts.get(`folder:${f.id}`);
      const parentName = f.parent_id ? folderById.get(f.parent_id)?.name : null;
      const projectName = f.project_id ? projectById.get(f.project_id)?.name : null;
      return {
        key: `folder:${f.id}`,
        name: f.name,
        icon: 'folder' as IconName,
        count: stat?.count ?? 0,
        lastAt: stat?.lastAt ?? null,
        parentName,
        projectName,
      };
    });

    // প্রজেক্ট/ক্লায়েন্ট/অন্যান্য — অটো-ডিরাইভড, শুধু ফাইল থাকলেই দেখাবে
    const autoCards = Array.from(counts.entries())
      .filter(([key]) => !key.startsWith('folder:'))
      .map(([key, stat]) => ({
        key,
        name: key === 'client' ? 'ক্লায়েন্ট ফাইল' : key === 'other' ? 'অন্যান্য' : projectById.get(key.replace('project:', ''))?.name ?? 'অজানা প্রজেক্ট',
        icon: (key === 'client' ? 'building' : key === 'other' ? 'file' : 'folder') as IconName,
        count: stat.count,
        lastAt: stat.lastAt as string | null,
        parentName: null as string | null,
        projectName: null as string | null,
      }));

    return [...customCards, ...autoCards].sort((a, b) => b.count - a.count);
  }, [attachments, projectOptions, folderOptions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attachments.filter((a) => {
      if (q && !a.file_name.toLowerCase().includes(q)) return false;
      if (typeFilter && (a.file_type ?? 'other') !== typeFilter) return false;
      if (uploaderFilter) {
        const uploaderId = teamOptions.find((t) => t.full_name === a.profiles?.full_name)?.id;
        if (!a.profiles || uploaderId !== uploaderFilter) return false;
      }
      if (folderFilter && groupKeyOf(a) !== folderFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments, search, typeFilter, uploaderFilter, folderFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ASSETS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAssets = filtered.slice((currentPage - 1) * ASSETS_PAGE_SIZE, currentPage * ASSETS_PAGE_SIZE);

  const kpis = useMemo(() => {
    const sevenDaysAgoMs = msSinceDaysAgo(7);
    const recentlyUpdated = attachments.filter((a) => new Date(a.uploaded_at).getTime() >= sevenDaysAgoMs).length;
    const clientFiles = attachments.filter((a) => a.client_id).length;
    const readyForHandoff = attachments.filter((a) => a.tasks && ['handoff', 'completed'].includes(a.tasks.workflow_stage)).length;
    const pendingReview = attachments.filter((a) => a.tasks && ['client_review', 'ux_review'].includes(a.tasks.workflow_stage)).length;
    return { total: attachments.length, recentlyUpdated, clientFiles, readyForHandoff, pendingReview };
  }, [attachments]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const thirtyDaysAgoMs = msSinceDaysAgo(30);
    const stale = attachments.filter((a) => new Date(a.uploaded_at).getTime() < thirtyDaysAgoMs).length;
    if (stale > 0) list.push(`${stale}টা ফাইল ৩০+ দিন ধরে আপডেট হয়নি।`);
    if (kpis.pendingReview > 0) list.push(`${kpis.pendingReview}টা ফাইল রিভিউ-তে আটকে আছে।`);
    const topFolder = folderCards.find((f) => f.key !== 'client' && f.key !== 'other' && f.count > 0);
    if (topFolder) list.push(`"${topFolder.name}"-এ সবচেয়ে বেশি (${topFolder.count}টা) ফাইল আছে।`);
    if (kpis.clientFiles > 0) list.push(`${kpis.clientFiles}টা ফাইল সরাসরি ক্লায়েন্টের সাথে যুক্ত।`);
    if (list.length === 0) list.push('এই মুহূর্তে ফাইল নিয়ে কোনো বিশেষ সতর্কতা নেই।');
    return list;
  }, [attachments, kpis, folderCards]);

  const selected = attachments.find((a) => a.id === selectedId) ?? null;

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`files-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <aside className="sidebar" aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark">DS</div>
              <div><div className="brand-name">DesignOps</div><div className="brand-sub">Studio Nine</div></div>
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

        <div className="main">
          <header className="topbar">
            <button className="search-box"><Icon name="search" /><span style={{ flex: 1, textAlign: 'left' }}>খুঁজুন — ফাইল, প্রজেক্ট...</span></button>
            <div className="topbar-spacer"></div>
            <button className="icon-btn" onClick={() => setDark((d) => !d)} aria-label="থিম"><Icon name={dark ? 'moon' : 'sun'} /></button>
          </header>

          <main className="content">
            <div className="page-header-row">
              <div>
                <h1 className="page-title">Files & Assets</h1>
                <p className="page-sub">প্রতিটা ডিজাইন ফাইল, ডকুমেন্ট আর অ্যাসেট এক জায়গা থেকে সামলান।</p>
              </div>
              <div className="header-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleReload} disabled={reloading}><Icon name="refresh" size={13} /> {reloading ? 'রিলোড হচ্ছে…' : 'রিলোড'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNewFolder(true)}><Icon name="folder" size={13} /> নতুন ফোল্ডার</button>
                <button className="btn btn-accent btn-sm" onClick={openUploadModal}><Icon name="upload" size={13} /> ফাইল যোগ করুন</button>
                <button className="btn btn-ghost btn-sm" disabled title="শীঘ্রই আসছে">Figma-এর সাথে যুক্ত করুন</button>
              </div>
            </div>

            {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

            {/* KPIs */}
            <div className="kpi-grid">
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="file" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.total}</div><div className="kpi-label">Total Assets</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon"><Icon name="clock" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.recentlyUpdated}</div><div className="kpi-label">গত ৭ দিনে যোগ হয়েছে</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="building" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.clientFiles}</div><div className="kpi-label">Client Files</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="check-circle" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.readyForHandoff}</div><div className="kpi-label">Ready for Handoff</div></div>
              <div className="kpi-card"><div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}><Icon name="eye" /></div></div><div className="kpi-value tabular">{loading ? '—' : kpis.pendingReview}</div><div className="kpi-label">Pending Review</div></div>
            </div>

            {/* toolbar */}
            <div className="toolbar">
              <div className="toolbar-search"><Icon name="search" size={13} /><input placeholder="ফাইলের নাম..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
              <select className="filter-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                <option value="">সব টাইপ</option>
                {FILE_TYPES.map((t) => <option key={t} value={t}>{FILE_TYPE_META[t].label}</option>)}
              </select>
              <select className="filter-select" value={uploaderFilter} onChange={(e) => { setUploaderFilter(e.target.value); setPage(1); }}>
                <option value="">সব আপলোডার</option>
                {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              {(search || typeFilter || uploaderFilter || folderFilter) && (
                <button className="filter-chip" onClick={() => { setSearch(''); setTypeFilter(''); setUploaderFilter(''); setFolderFilter(null); setPage(1); }}><Icon name="close" size={12} /> Clear Filters</button>
              )}
              <div className="toolbar-spacer"></div>
              <div className="view-toggle">
                <button className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} aria-label="গ্রিড ভিউ"><Icon name="grid" size={14} /></button>
                <button className={`view-toggle-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} aria-label="লিস্ট ভিউ"><Icon name="list" size={14} /></button>
              </div>
            </div>

            {/* folders — কাস্টম ফোল্ডার (সবসময় দেখায়) + প্রজেক্ট/ক্লায়েন্ট অটো-বাকেট */}
            {folderCards.length > 0 && (
              <section className="block">
                <div className="section-title-row"><span className="section-title">Folders</span></div>
                <div className="folder-grid">
                  {folderCards.map((f) => (
                    <button key={f.key} className={`folder-card${folderFilter === f.key ? ' active' : ''}`} onClick={() => { setFolderFilter((cur) => (cur === f.key ? null : f.key)); setPage(1); }}>
                      <div className="folder-icon"><Icon name={f.icon} /></div>
                      <div>
                        <div className="folder-name">{f.name}</div>
                        <div className="folder-meta">{f.count} · {f.lastAt ? relativeTimeBn(f.lastAt) : 'কোনো ফাইল নেই'}{f.parentName ? ` · ${f.parentName}-এর ভেতরে` : ''}{f.projectName ? ` · ${f.projectName}` : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* asset grid + inspector */}
            <div className="assets-layout">
              <div>
                <section className="block">
                  <div className="section-title-row"><span className="section-title">সব অ্যাসেট <span style={{ color: 'var(--ink-faint)', fontWeight: 500 }}>· {filtered.length}</span></span></div>

                  {loading ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
                  ) : filtered.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><Icon name="file" /></div>
                      <div className="empty-title">কোনো ফাইল পাওয়া যায়নি</div>
                      <div className="empty-sub">
                        {folderFilter?.startsWith('folder:')
                          ? 'এই ফোল্ডারে এখনো কোনো ফাইল নেই — এখান থেকেই একটা যোগ করুন।'
                          : 'এই ফিল্টারে কোনো অ্যাসেট নেই, অথবা এখনো কোনো ফাইল যোগ করা হয়নি।'}
                      </div>
                      <button className="btn btn-accent btn-sm" onClick={openUploadModal}><Icon name="upload" size={13} /> ফাইল যোগ করুন</button>
                    </div>
                  ) : (
                    <div className={`asset-grid${viewMode === 'list' ? ' list-view' : ''}`}>
                      {paginatedAssets.map((a) => {
                        const meta = fileTypeMeta(a.file_type);
                        const chip = fileReviewChip(a.tasks?.workflow_stage);
                        const isFav = favorites.has(a.id);
                        return (
                          <div key={a.id} className={`asset-card${selectedId === a.id ? ' selected' : ''}`} onClick={() => setSelectedId(a.id)}>
                            <div className="asset-thumb" style={canPreviewInline(a.file_type, a.drive_url) ? undefined : { background: meta.bg }}>
                              {canPreviewInline(a.file_type, a.drive_url) ? (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img className="asset-thumb-img" src={driveThumbnailUrl(a.drive_url)} alt={a.file_name} />
                                  {a.file_type === 'video' && <span className="asset-play-badge"><Icon name="play" size={16} /></span>}
                                </>
                              ) : (
                                <Icon name={meta.icon} size={viewMode === 'list' ? 18 : 26} />
                              )}
                              <button className={`asset-fav${isFav ? ' active' : ''}`} title="লোকাল ফেভারিট — সেভ হয় না" onClick={(e) => { e.stopPropagation(); toggleFavorite(a.id); }}>
                                <Icon name="star" size={13} />
                              </button>
                              <span className="asset-type-badge">{meta.label}</span>
                            </div>
                            <div className="asset-body">
                              <div className="asset-name">{a.file_name}</div>
                              <div className="asset-project">{a.tasks?.projects?.name ?? a.clients?.company_name ?? 'কোনো প্রজেক্ট নেই'}</div>
                              <div className="asset-meta-row">
                                <div className="asset-owner">
                                  <div className="avatar" style={{ width: 18, height: 18, fontSize: 8, background: a.profiles?.avatar_color ?? undefined }}>{Array.from(a.profiles?.full_name ?? '?')[0]}</div>
                                  <span className="asset-size">{a.profiles?.full_name ?? 'অজানা'}</span>
                                </div>
                                <span className="asset-size">{relativeTimeBn(a.uploaded_at)}</span>
                              </div>
                              {chip && <span className={`review-chip ${chip.cls}`}>{chip.label}</span>}
                            </div>
                            <div className="asset-hover-actions">
                              <a className="ah-btn" href={a.drive_url} target="_blank" rel="noopener noreferrer" title="লিংক খুলুন"><Icon name="link" size={14} /></a>
                              <button className="ah-btn" title={copiedId === a.id ? 'কপি হয়েছে!' : 'লিংক কপি করুন'} onClick={() => copyLink(a.drive_url, a.id)}><Icon name={copiedId === a.id ? 'check-circle' : 'copy'} size={14} /></button>
                              <button className="ah-btn" title="ডিলিট করুন" disabled={busyId === a.id} onClick={(e) => { e.stopPropagation(); deleteAttachment(a.id); }}><Icon name="trash" size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!loading && filtered.length > ASSETS_PAGE_SIZE && (
                    <div className="pagination-row">
                      <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>আগের</button>
                      <span className="pagination-label tabular">পেজ {currentPage} / {totalPages}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>পরের</button>
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT INSPECTOR */}
              <aside className="inspector">
                {!selected ? (
                  <div className="insp-empty">
                    <div className="insp-empty-icon"><Icon name="eye" /></div>
                    <div className="insp-empty-title">কোনো ফাইল সিলেক্ট করা নেই</div>
                    <div className="insp-empty-sub">ডিটেইল দেখতে একটা অ্যাসেট কার্ডে ক্লিক করুন।</div>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const meta = fileTypeMeta(selected.file_type);
                      const chip = fileReviewChip(selected.tasks?.workflow_stage);
                      const linkedProject = selected.tasks?.projects;
                      const progress = linkedProject ? projectProgress.get(linkedProject.id) ?? 0 : 0;
                      return (
                        <>
                          <div className="insp-preview" style={canPreviewInline(selected.file_type, selected.drive_url) ? undefined : { background: meta.bg }}>
                            {canPreviewInline(selected.file_type, selected.drive_url) ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img className="insp-preview-img" src={driveThumbnailUrl(selected.drive_url)} alt={selected.file_name} />
                                {selected.file_type === 'video' && <span className="asset-play-badge"><Icon name="play" size={20} /></span>}
                              </>
                            ) : (
                              <Icon name={meta.icon} size={36} />
                            )}
                          </div>
                          <div className="insp-title">{selected.file_name}</div>
                          <div className="insp-project">{selected.tasks?.projects?.name ?? selected.clients?.company_name ?? 'কোনো প্রজেক্ট নেই'} · {selected.profiles?.full_name ?? 'অজানা'}</div>

                          <div className="insp-section">
                            <div className="insp-field-grid">
                              <div><div className="insp-field-label">Type</div><div className="insp-field-value">{meta.label}</div></div>
                              <div><div className="insp-field-label">Uploaded</div><div className="insp-field-value">{formatBnDate(selected.uploaded_at) || '—'}</div></div>
                              <div><div className="insp-field-label">Uploader</div><div className="insp-field-value">{selected.profiles?.full_name ?? '—'}</div></div>
                              <div><div className="insp-field-label">Review Status</div><div className="insp-field-value" style={{ color: chip ? undefined : 'var(--ink-faint)' }}>{chip?.label ?? '—'}</div></div>
                              <div><div className="insp-field-label">Folder</div><div className="insp-field-value" style={{ color: selected.folders ? undefined : 'var(--ink-faint)' }}>{selected.folders?.name ?? '—'}</div></div>
                            </div>
                          </div>

                          <div className="insp-section">
                            <div className="insp-label">Link</div>
                            <div className="insp-link-row">
                              <input readOnly value={selected.drive_url} onClick={(e) => (e.target as HTMLInputElement).select()} />
                              <a className="btn btn-ghost btn-sm" href={selected.drive_url} target="_blank" rel="noopener noreferrer">খুলুন</a>
                            </div>
                          </div>

                          {linkedProject ? (
                            <div className="insp-section">
                              <div className="insp-label">Linked Project</div>
                              <div className="linked-proj-card">
                                <div className="lp-top"><span className="lp-name">{linkedProject.name}</span><span className="tabular" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{progress}%</span></div>
                                <div className="lp-track"><div className="lp-fill" style={{ width: `${progress}%` }}></div></div>
                                <div className="lp-meta"><span>{STAGE_LABEL[selected.tasks?.workflow_stage ?? ''] ?? '—'} স্টেজ</span><span>ডেডলাইন {formatBnDate(linkedProject.due_date) || '—'}</span></div>
                                <Link className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} href={`/projects/${linkedProject.id}`}>Open Project</Link>
                              </div>
                            </div>
                          ) : selected.clients ? (
                            <div className="insp-section">
                              <div className="insp-label">Linked Client</div>
                              <div className="linked-proj-card"><span className="lp-name">{selected.clients.company_name}</span></div>
                            </div>
                          ) : null}

                          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)' }} disabled={busyId === selected.id} onClick={() => deleteAttachment(selected.id)}>
                            <Icon name="trash" size={13} /> ফাইল রিমুভ করুন
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </aside>
            </div>

            {/* Google Drive + AI Insights */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 6 }}>
              <section className="block">
                <div className="section-title-row"><span className="section-title">Google Drive</span></div>
                <div className="integration-card">
                  <div className="integ-top">
                    <div className="integ-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}><Icon name="archive" /></div>
                    <div style={{ flex: 1 }}><div className="integ-name">Studio Nine Drive</div><div className="integ-status"><span className="status-dot" style={{ background: 'var(--positive)' }}></span>Connected</div></div>
                  </div>
                  <div className="integ-meta">&ldquo;ফাইল যোগ করুন&rdquo; থেকে আপলোড করা ফাইল সরাসরি একটা dedicated Google অ্যাকাউন্টের Drive ফোল্ডারে জমা হয় — এই অ্যাপ নিজে কোনো ফাইল হোস্ট করে না, শুধু লিংক রাখে।</div>
                  <div className="integ-actions">
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} disabled title="শীঘ্রই আসছে">Auto-Sync (শীঘ্রই)</button>
                  </div>
                </div>
              </section>

              <section className="block">
                <div className="section-title-row"><span className="section-title">AI Asset Insights</span></div>
                <div className="ai-card-mini">
                  {insights.map((text, i) => (<div className="ai-item-mini" key={i}><span className="dot"></span> {text}</div>))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !uploading) closeUploadModal(); }}>
          <div className="modal-box">
            <div className="modal-title">ফাইল যোগ করুন</div>
            <div className="tab-row">
              <button type="button" className={`tab-btn${uploadMode === 'file' ? ' active' : ''}`} onClick={() => setUploadMode('file')} disabled={uploading}>ফাইল আপলোড</button>
              <button type="button" className={`tab-btn${uploadMode === 'link' ? ' active' : ''}`} onClick={() => setUploadMode('link')} disabled={uploading}>লিংক পেস্ট করুন</button>
            </div>
            <form onSubmit={handleUpload}>
              {uploadMode === 'file' ? (
                <>
                  <div
                    className={`dropzone${dragOver ? ' dragover' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f) { setSelectedFile(f); setNewFileType(guessFileType(f)); }
                    }}
                    onClick={() => document.getElementById('files-page-file-input')?.click()}
                  >
                    <input
                      id="files-page-file-input"
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setSelectedFile(f);
                        if (f) setNewFileType(guessFileType(f));
                      }}
                    />
                    <div className="dropzone-icon"><Icon name="upload" size={16} /></div>
                    <div className="dropzone-text">{selectedFile ? selectedFile.name : 'ফাইল টেনে আনুন বা ক্লিক করে বেছে নিন'}</div>
                    <div className="dropzone-sub">{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : 'যেকোনো সাইজ — সরাসরি Google Drive-এ যাবে'}</div>
                  </div>

                  {uploading && (
                    <div className="upload-progress-wrap">
                      <div className="upload-progress-track"><div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div></div>
                      <div className="upload-progress-label">{uploadProgress}% আপলোড হয়েছে</div>
                    </div>
                  )}

                  <label className="field-label">ফাইলের নাম (ঐচ্ছিক)</label>
                  <input className="field-input" type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder={selectedFile?.name ?? 'আসল ফাইলের নাম ব্যবহার হবে'} disabled={uploading} />
                </>
              ) : (
                <>
                  <label className="field-label">ফাইলের নাম</label>
                  <input className="field-input" type="text" value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="যেমন: Homepage — Master File" autoFocus required />

                  <label className="field-label">Drive / Figma লিংক</label>
                  <input className="field-input" type="url" value={newDriveUrl} onChange={(e) => setNewDriveUrl(e.target.value)} placeholder="https://..." required />
                </>
              )}

              <label className="field-label">ফাইলের ধরন</label>
              <select className="field-input" value={newFileType} onChange={(e) => setNewFileType(e.target.value)} disabled={uploading}>
                {FILE_TYPES.map((t) => <option key={t} value={t}>{FILE_TYPE_META[t].label}</option>)}
              </select>

              <label className="field-label">যুক্ত করুন</label>
              <select className="field-input" value={attachMode} onChange={(e) => setAttachMode(e.target.value as 'task' | 'client' | 'none')} disabled={uploading}>
                <option value="task">টাস্কের সাথে</option>
                <option value="client">ক্লায়েন্টের সাথে</option>
                <option value="none">কোনোটাই না</option>
              </select>

              {attachMode === 'task' && (
                <select className="field-input" value={newTaskId} onChange={(e) => setNewTaskId(e.target.value)} disabled={uploading}>
                  <option value="">টাস্ক বেছে নিন</option>
                  {taskOptions.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              )}
              {attachMode === 'client' && (
                <select className="field-input" value={newClientId} onChange={(e) => setNewClientId(e.target.value)} disabled={uploading}>
                  <option value="">ক্লায়েন্ট বেছে নিন</option>
                  {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              )}

              <label className="field-label">ফোল্ডার (ঐচ্ছিক)</label>
              <select className="field-input" value={uploadFolderId} onChange={(e) => setUploadFolderId(e.target.value)} disabled={uploading}>
                <option value="">কোনো ফোল্ডারে না</option>
                {folderOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>

              {uploadError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{uploadError}</p>}

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeUploadModal} disabled={uploading}>বাতিল</button>
                <button
                  type="submit"
                  className="btn btn-accent btn-sm"
                  disabled={uploading || (uploadMode === 'file' ? !selectedFile : !newFileName.trim() || !newDriveUrl.trim())}
                >
                  {uploading ? (uploadMode === 'file' ? `আপলোড হচ্ছে… ${uploadProgress}%` : 'যোগ হচ্ছে…') : 'যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showNewFolder && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeNewFolderModal(); }}>
          <div className="modal-box">
            <div className="modal-title">নতুন ফোল্ডার</div>
            <form onSubmit={handleCreateFolder}>
              <label className="field-label">ফোল্ডারের নাম</label>
              <input className="field-input" type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="যেমন: Brand Assets" autoFocus required />

              <label className="field-label">প্রজেক্ট (ঐচ্ছিক)</label>
              <select className="field-input" value={newFolderProjectId} onChange={(e) => setNewFolderProjectId(e.target.value)}>
                <option value="">কোনো প্রজেক্টের সাথে না</option>
                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label className="field-label">কোথায় রাখবেন (ঐচ্ছিক)</label>
              <select className="field-input" value={newFolderParentId} onChange={(e) => setNewFolderParentId(e.target.value)}>
                <option value="">রুট (সব ফোল্ডারের বাইরে)</option>
                {folderOptions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <p style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: -6, marginBottom: 12 }}>একটা ফোল্ডার বেছে নিলে নতুনটা তার ভেতরে নেস্টেড হবে, নাহলে আলাদা টপ-লেভেল ফোল্ডার হবে।</p>

              {newFolderError && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{newFolderError}</p>}

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={closeNewFolderModal}>বাতিল</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={creatingFolder || !newFolderName.trim()}>{creatingFolder ? 'তৈরি হচ্ছে…' : 'তৈরি করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
