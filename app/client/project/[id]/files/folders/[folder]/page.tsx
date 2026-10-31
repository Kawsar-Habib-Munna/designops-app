'use client';

// A single folder of the client's files. Reached from the folder tiles on the Files page.
// The URL segment is either a built-in category key (requirements, sow, invoice, receipt, design, deliverable, other)
// or the id of one of the client's own folders (client_folders). Only own folders can be renamed, deleted or uploaded into;
// the built-in ones are managed by the project team.

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType, driveDownloadUrl } from '@/lib/driveUpload';
import MediaPreviewModal, { type MediaPreviewItem } from '@/app/components/MediaPreviewModal';
import ClientBottomNav from '@/app/components/ClientBottomNav';
import ClientSelect from '@/app/components/ClientSelect';
import { formatDateLong } from '@/lib/format';
import '../../../../../client-shared.css';
import '../../files.css';
import '../../files-v2.css';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  grid2: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  move: '<path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"/><path d="M2 13h10"/><path d="m9 16 3-3-3-3"/>',
  dots: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';
const CATEGORY_LABEL: Record<string, string> = {
  requirements: 'Project Requirements',
  sow: 'Statement of Work',
  invoice: 'Invoices',
  receipt: 'Receipts',
  design: 'Design Files',
  deliverable: 'Deliverables',
  other: 'Other',
};
const PAGE_SIZE = 8;

type FileRow = {
  id: string;
  name: string;
  file_type: string | null;
  size_bytes: number | null;
  drive_url: string;
  category: string;
  uploaded_by: string;
  uploaded_by_id: string | null;
  folder_id?: string | null;
  created_at: string;
};
type CustomFolder = { id: string; name: string; created_at: string };
type UploaderProfile = { id: string; full_name: string; role: string | null; avatar_url: string | null };

// one colour per folder, shared by the ring and the little dots on the folder tiles
const FOLDER_COLORS = ['var(--accent)', 'var(--positive)', 'var(--warning)', '#2f6fdb', 'var(--danger)', '#0ea5a4', '#ec4899'];

// donut of how the files are split across folders, with the total in the middle
function FilesRing({ segments, total }: { segments: { key: string; label: string; value: number; color: string }[]; total: number }) {
  const size = 132;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const innerR = r - stroke / 2 - 11; // the thin circle inside the thick ring
  const circ = 2 * Math.PI * r;
  const sum = segments.reduce((n, seg) => n + seg.value, 0);
  const gap = segments.length > 1 ? stroke + 4 : 0; // round caps stick out by half the stroke at each end
  return (
    <div className="ff-ring" role="img" aria-label={`${total} files in this folder`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={innerR} fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.7" />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg, i) => {
            const before = segments.slice(0, i).reduce((n, v) => n + v.value, 0);
            const len = sum > 0 ? (seg.value / sum) * circ : 0;
            const dash = Math.max(len - gap, 0.1);
            const start = (before / sum) * circ + gap / 2;
            return <circle key={seg.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-start} />;
          })}
        </g>
      </svg>
      <div className="ff-ring-center">
        <strong>{total}</strong>
        <span>{total === 1 ? 'file' : 'files'}</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function fileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? (parts.pop() as string).toUpperCase() : 'FILE';
}
// what the preview window should treat this file as: decided by the extension first, so images and documents open
// even when the stored type is just "other"
function previewType(f: { name: string; file_type: string | null }): string | null {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  const map: Record<string, string> = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', heic: 'image',
    pdf: 'pdf', mp4: 'video', mov: 'video', webm: 'video', mkv: 'video', mp3: 'audio', wav: 'audio', m4a: 'audio',
    doc: 'doc', docx: 'doc', rtf: 'doc', odt: 'doc', xls: 'sheet', xlsx: 'sheet', csv: 'sheet', ods: 'sheet', ppt: 'slides', pptx: 'slides', odp: 'slides', txt: 'text',
  };
  return map[ext] ?? f.file_type;
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function dayLabel(iso: string, nowIso: string): string {
  if (isSameDay(iso, nowIso)) return 'Today';
  const yesterday = new Date(nowIso);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return 'Yesterday';
  return formatDateLong(iso);
}
function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ClientFolderPage() {
  const params = useParams();
  const projectId = params.id as string;
  const folderParam = decodeURIComponent(params.folder as string);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<{ id: string; name: string } | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [allRows, setAllRows] = useState<FileRow[]>([]);
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, UploaderProfile>>({});
  const [nowIso, setNowIso] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size' | 'oldest'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<MediaPreviewItem | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null); // the row whose actions menu is open (phones)

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadInfo, setUploadInfo] = useState<{ index: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [modal, setModal] = useState<'rename' | 'delete' | 'move' | null>(null);
  const [moveFile, setMoveFile] = useState<FileRow | null>(null);
  const [folderName, setFolderName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(own.project);
        setClient(own.client);
        setNowIso(new Date().toISOString());

        const baseCols = 'id, name, file_type, size_bytes, drive_url, category, uploaded_by, uploaded_by_id, created_at';
        let filesRes: { data: unknown; error: unknown } = await supabase.from('client_files').select(`${baseCols}, folder_id`).eq('client_id', own.client.id).order('created_at', { ascending: false });
        let hasFolderColumn = true;
        if (filesRes.error) {
          hasFolderColumn = false;
          filesRes = await supabase.from('client_files').select(baseCols).eq('client_id', own.client.id).order('created_at', { ascending: false });
        }
        const rows = (filesRes.data as unknown as FileRow[]) ?? [];
        setAllRows(rows);
        const foldersRes = hasFolderColumn ? await supabase.from('client_folders').select('id, name, created_at').eq('client_id', own.client.id).order('created_at', { ascending: true }) : null;
        setCustomFolders(foldersRes && !foldersRes.error ? ((foldersRes.data as CustomFolder[]) ?? []) : []);

        const uploaderIds = Array.from(new Set(rows.filter((f) => f.uploaded_by_id).map((f) => f.uploaded_by_id as string)));
        if (uploaderIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, avatar_url').in('id', uploaderIds);
          const map: Record<string, UploaderProfile> = {};
          (profilesData as UploaderProfile[] | null)?.forEach((p) => {
            map[p.id] = p;
          });
          setUploaders(map);
        }
        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    })();
  }, [router, projectId, reloadKey]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  // which folder is this?
  const builtinLabel = CATEGORY_LABEL[folderParam] ?? null;
  const custom = customFolders.find((cf) => cf.id === folderParam) ?? null;
  const folderLabel = custom?.name ?? builtinLabel;

  const rows = useMemo(() => {
    const files = allRows.filter((x) => x.file_type !== 'link');
    if (custom) return files.filter((x) => x.folder_id === custom.id);
    if (builtinLabel) return files.filter((x) => !x.folder_id && x.category === folderParam);
    return [];
  }, [allRows, custom, builtinLabel, folderParam]);

  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    const sorted = [...list];
    if (sortBy === 'recent') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortBy === 'oldest') sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'size') sorted.sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
    return sorted;
  }, [rows, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  async function uploadFiles(list: File[]) {
    if (list.length === 0 || !client || !custom) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setUploadError('Your session has expired. Please sign in again.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setUploadInfo({ index: i + 1, total: list.length });
      setUploadProgress(0);
      try {
        const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
        const { error } = await supabase.from('client_files').insert({
          client_id: client.id,
          project_id: project?.id,
          name: file.name,
          file_type: guessFileType(file),
          size_bytes: file.size,
          drive_url: result.webViewLink,
          category: 'other',
          uploaded_by: 'client',
          folder_id: custom.id,
        });
        if (error) throw new Error(error.message);
      } catch (err) {
        failed.push(`${file.name}${err instanceof Error && err.message ? ` (${err.message})` : ''}`);
      }
    }
    if (failed.length > 0) setUploadError(`Couldn't upload: ${failed.join(', ')}`);
    setUploadInfo(null);
    setUploading(false);
    setReloadKey((k) => k + 1);
  }

  function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadFiles(list);
  }

  async function saveRename(e: FormEvent) {
    e.preventDefault();
    if (!custom) return;
    const name = folderName.trim();
    if (!name) {
      setModalError('Please give the folder a name.');
      return;
    }
    if (name.length > 40) {
      setModalError('Keep the name under 40 characters.');
      return;
    }
    if (customFolders.some((cf) => cf.name.toLowerCase() === name.toLowerCase() && cf.id !== custom.id)) {
      setModalError('You already have a folder with this name.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('client_folders').update({ name }).eq('id', custom.id);
    setSaving(false);
    if (error) {
      setModalError(error.message);
      return;
    }
    setModal(null);
    setReloadKey((k) => k + 1);
  }

  async function deleteFolder() {
    if (!custom) return;
    setSaving(true);
    const { error } = await supabase.from('client_folders').delete().eq('id', custom.id);
    setSaving(false);
    if (error) {
      setModalError(error.message);
      return;
    }
    router.push(`/client/project/${projectId}/files`);
  }

  async function moveTo(file: FileRow, folderId: string | null) {
    setSaving(true);
    const { error } = await supabase.rpc('move_client_file', { p_file_id: file.id, p_folder_id: folderId });
    setSaving(false);
    if (error) {
      setModalError(error.message);
      return;
    }
    setModal(null);
    setMoveFile(null);
    setReloadKey((k) => k + 1);
  }

  const filesHref = `/client/project/${projectId}/files`;

  if (loading) {
    return (
      <div className="client-portal files-root">
        <div className="shell">
          <aside className="sidebar">
            <div style={{ height: 30 }} />
          </aside>
          <div className="main">
            <main className="content">
              <div className="skel" style={{ height: 60, marginBottom: 18 }} />
              <div className="skel" style={{ height: 400 }} />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal files-root">
        <div className="files-bare-shell">
          <div className="files-state-card">
            <div className="files-state-title">Unable to load this folder</div>
            <p className="files-state-sub">Please try again.</p>
            <div className="files-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={filesHref} className="cp-btn cp-btn-secondary">
                Back to Files
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalSize = rows.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  const lastFile = rows[0] ?? null;
  const typeCounts = new Map<string, number>();
  rows.forEach((x) => typeCounts.set(fileExtension(x.name), (typeCounts.get(fileExtension(x.name)) ?? 0) + 1));
  const typeSorted = Array.from(typeCounts.entries()).sort((p, q) => q[1] - p[1]);
  const typeSegments = typeSorted.slice(0, 4).map(([label, value], i) => ({ key: label, label, value, color: FOLDER_COLORS[i % FOLDER_COLORS.length] }));
  const restCount = typeSorted.slice(4).reduce((n, [, v]) => n + v, 0);
  if (restCount > 0) typeSegments.push({ key: '__rest', label: 'Other types', value: restCount, color: FOLDER_COLORS[4 % FOLDER_COLORS.length] });

  return (
    <div className="client-portal files-root">
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <div>
            <div className="cp-brand cp-brand-sidebar">
              <span className="cp-brand-art">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sidebar-logo.webp" alt="FLOW 53 - Innovate-Design-Elevate" className="cp-brand-logo-combined" />
              </span>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="nav-group">
              <Link href="/client/dashboard" className="nav-item">
                <Icon name="grid" /> Overview
              </Link>
              <Link href={`/client/project/${project.id}`} className="nav-item">
                <Icon name="folder" /> My Project
              </Link>
              <Link href={`/client/project/${project.id}/messages`} className="nav-item">
                <Icon name="message" /> Messages
              </Link>
              <Link href={filesHref} className="nav-item active">
                <Icon name="file" /> Files
              </Link>
              <Link href={`/client/project/${project.id}/sow`} className="nav-item">
                <Icon name="doc" /> SOW
              </Link>
              <Link href={`/client/project/${project.id}/payments`} className="nav-item">
                <Icon name="card" /> Payments
              </Link>
            </nav>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">{folderLabel ?? 'Folder'}</span>
            <button type="button" className="topbar-avatar" aria-label="Sign out" onClick={() => { if (window.confirm('Sign out of your account?')) void handleSignOut(); }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </button>
          </header>

          <header className="page-topbar">
            <div className="breadcrumb">
              <Link href="/client/dashboard">Client Portal</Link> / <Link href={filesHref}>Files</Link> / {folderLabel ?? 'Folder'}
            </div>
            <a className="page-help-link" href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I need help with files for ${project.name}.`)}`} target="_blank" rel="noopener noreferrer">
              <Icon name="help" size={13} /> Need help?
            </a>
            <button type="button" className="profile-card topbar-profile" onClick={handleSignOut} title="Sign out">
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
              </div>
              <div className="profile-meta">
                <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
                <div className="profile-role">{client.company_name}</div>
              </div>
            </button>
          </header>

          <main className="content">
            <div className="dx">
              {!folderLabel ? (
                <section className="dx-card">
                  <div className="ff-empty">
                    <span className="dx-kpi-icon dx-tone-accent"><Icon name="folder" size={20} /></span>
                    <div className="ff-empty-title">Folder not found</div>
                    <p className="ff-empty-sub">This folder doesn&apos;t exist any more. It may have been deleted.</p>
                    <Link href={filesHref} className="btn btn-accent">
                      <Icon name="chevronLeft" size={14} /> Back to Files
                    </Link>
                  </div>
                </section>
              ) : (
                <>
                  {/* ---- hero ---- */}
                  <section
                    className={`dx-hero${dragging ? ' ff-dragging' : ''}`}
                    onDragOver={(e) => { if (custom) { e.preventDefault(); setDragging(true); } }}
                    onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
                    onDrop={(e) => { if (!custom) return; e.preventDefault(); setDragging(false); void uploadFiles(Array.from(e.dataTransfer.files)); }}
                  >
                    <div className="dx-hero-text">
                      <Link href={filesHref} className="ff-back">
                        <Icon name="chevronLeft" size={14} /> All files
                      </Link>
                      <h1 className="dx-title">{folderLabel}</h1>
                      <p className="dx-sub">
                        {rows.length} file{rows.length === 1 ? '' : 's'} · {formatBytes(totalSize)}{lastFile && nowIso ? ` · last added ${dayLabel(lastFile.created_at, nowIso).toLowerCase()}` : ''}
                        {!custom && ' · managed by your project team'}
                      </p>
                      {custom && (
                        <div className="dx-hero-actions ff-actions-one">
                          <input ref={fileInputRef} type="file" multiple hidden onChange={handleUpload} />
                          <button type="button" className="btn btn-accent" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                            <Icon name="upload" size={14} /> {uploading ? (uploadInfo && uploadInfo.total > 1 ? `Uploading ${uploadInfo.index} of ${uploadInfo.total} · ${uploadProgress}%` : `Uploading ${uploadProgress}%`) : 'Upload files'}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => { setFolderName(custom.name); setModalError(null); setModal('rename'); }} aria-label="Rename folder">
                            <Icon name="edit" size={14} /> <span className="ff-btn-text">Rename</span>
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => { setModalError(null); setModal('delete'); }} aria-label="Delete folder">
                            <Icon name="trash" size={14} /> <span className="ff-btn-text">Delete</span>
                          </button>
                        </div>
                      )}
                      {uploadError && <p className="ff-upload-error">{uploadError}</p>}
                    </div>
                    <div className="dx-hero-progress">
                      <FilesRing segments={typeSegments} total={rows.length} />
                      <ul className="ff-legend">
                        {typeSegments.map((seg) => (
                          <li key={seg.key}>
                            <span className="ff-legend-dot" style={{ background: seg.color }} />
                            <span className="ff-legend-label">{seg.label}</span>
                            <span className="ff-legend-leader" aria-hidden="true" />
                            <b>{seg.value}</b>
                          </li>
                        ))}
                        {typeSegments.length === 0 && <li className="ff-legend-more">No files yet</li>}
                      </ul>
                    </div>
                  </section>

                  {/* ---- files ---- */}
                  <section className="dx-card">
                    <div className="dx-card-head">
                      <h2 className="dx-card-title">Files in {folderLabel}</h2>
                    </div>
                    <div className="ff-toolbar">
                      <div className="ff-search">
                        <Icon name="search" size={15} />
                        <input type="text" placeholder="Search in this folder…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                      </div>
                      <ClientSelect className="ff-sort" ariaLabel="Sort files" value={sortBy} onChange={(v) => setSortBy(v as typeof sortBy)} options={[{ value: 'recent', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name (A–Z)' }, { value: 'size', label: 'Largest first' }]} />
                      <div className="ff-toggle">
                        <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="List view">
                          <Icon name="list" size={15} />
                        </button>
                        <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view">
                          <Icon name="grid2" size={15} />
                        </button>
                      </div>
                    </div>

                    {filtered.length === 0 ? (
                      <div className="ff-empty">
                        <span className="dx-kpi-icon dx-tone-accent"><Icon name="file" size={20} /></span>
                        <div className="ff-empty-title">{rows.length === 0 ? 'This folder is empty' : 'No files found'}</div>
                        <p className="ff-empty-sub">{rows.length === 0 ? (custom ? 'Upload files here, or move files into this folder from the Files page.' : 'Files your project team adds to this folder will show up here.') : 'Try a different search.'}</p>
                      </div>
                    ) : viewMode === 'list' ? (
                      <ul className="ff-list">
                        {paged.map((f) => {
                          const uploader = f.uploaded_by_id ? uploaders[f.uploaded_by_id] : null;
                          const sharedBy = uploader?.full_name ?? (f.uploaded_by === 'client' ? 'You' : 'FLOW 53 Team');
                          const isNew = nowIso ? new Date(nowIso).getTime() - new Date(f.created_at).getTime() < 24 * 3600 * 1000 : false;
                          return (
                            <li className="ff-item" key={f.id}>
                              <span className="dx-row-icon"><Icon name="file" size={15} /></span>
                              <div className="ff-item-body">
                                <div className="ff-item-name">
                                  <span className="ff-item-name-text">{f.name}</span>
                                  {isNew && <span className="ff-new">New</span>}
                                  <span className="ff-name-who">{sharedBy} · {nowIso ? dayLabel(f.created_at, nowIso) : ''}</span>
                                </div>
                                <div className="ff-item-meta">
                                  <span className="ff-meta-group">
                                    <span className="ff-ext">{fileExtension(f.name)}</span>
                                    <span>{formatBytes(f.size_bytes)}</span>
                                  </span>
                                  <span className="ff-meta-group">
                                    <span>{sharedBy}</span>
                                    <span>{nowIso ? dayLabel(f.created_at, nowIso) : ''}, {formatClockTime(f.created_at)}</span>
                                  </span>
                                </div>
                              </div>
                              <div className={`ff-item-actions${menuId === f.id ? ' open' : ''}`}>
                                <button type="button" className="ff-more-btn" aria-label="More actions" aria-expanded={menuId === f.id} onClick={() => setMenuId((id) => (id === f.id ? null : f.id))}>
                                  <Icon name="dots" size={16} />
                                </button>
                                <div className="ff-actions-pop" onClick={() => setMenuId(null)}>
                                  {custom && (
                                    <button type="button" className="ff-icon-btn" aria-label={`Move ${f.name}`} title="Move to another folder" onClick={() => { setMoveFile(f); setModalError(null); setModal('move'); }}>
                                      <Icon name="move" size={15} /><span className="ff-act-label">Move</span>
                                    </button>
                                  )}
                                  <button type="button" className="ff-icon-btn" aria-label={`View ${f.name}`} onClick={() => setPreviewItem({ name: f.name, url: f.drive_url, fileType: previewType(f) })}>
                                    <Icon name="eye" size={15} /><span className="ff-act-label">View</span>
                                  </button>
                                  <a href={driveDownloadUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="ff-icon-btn" aria-label={`Download ${f.name}`}>
                                    <Icon name="download" size={15} /><span className="ff-act-label">Download</span>
                                  </a>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="ff-grid">
                        {paged.map((f) => (
                          <button type="button" key={f.id} className="ff-card" onClick={() => setPreviewItem({ name: f.name, url: f.drive_url, fileType: previewType(f) })}>
                            <span className="dx-kpi-icon dx-tone-accent"><Icon name="file" size={20} /></span>
                            <span className="ff-card-name">{f.name}</span>
                            <span className="ff-card-meta">{fileExtension(f.name)} · {formatBytes(f.size_bytes)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {filtered.length > 0 && (
                      <div className="ff-pager">
                        <span className="ff-pager-info">
                          {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, filtered.length)} of {filtered.length} files
                        </span>
                        <div className="ff-pager-controls">
                          <button type="button" disabled={pageSafe === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                            <Icon name="chevronLeft" size={14} />
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .slice(0, 5)
                            .map((n) => (
                              <button key={n} type="button" className={pageSafe === n ? 'active' : ''} onClick={() => setPage(n)}>
                                {n}
                              </button>
                            ))}
                          {totalPages > 5 && <span className="ff-pager-dots">…</span>}
                          <button type="button" disabled={pageSafe === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                            <Icon name="chevronRight" size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      <ClientBottomNav projectId={project.id} active="files" />

      {menuId && <div className="ff-menu-backdrop" onClick={() => setMenuId(null)} />}

      {modal && custom && (
        <div className="ff-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) setModal(null); }}>
          {modal === 'rename' ? (
            <form className="ff-modal" onSubmit={saveRename}>
              <div className="ff-modal-head">
                <span className="dx-kpi-icon dx-tone-accent"><Icon name="folder" size={20} /></span>
                <div>
                  <h2 className="ff-modal-title">Rename folder</h2>
                  <p className="ff-modal-sub">The files inside stay where they are.</p>
                </div>
                <button type="button" className="ff-icon-btn" aria-label="Close" onClick={() => setModal(null)}>
                  <Icon name="close" size={15} />
                </button>
              </div>
              <label className="ff-field">
                <span>Folder name</span>
                <input type="text" autoFocus maxLength={40} value={folderName} onChange={(e) => { setFolderName(e.target.value); setModalError(null); }} />
              </label>
              {modalError && <p className="ff-upload-error">{modalError}</p>}
              <div className="ff-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-accent" disabled={saving || !folderName.trim()}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          ) : modal === 'delete' ? (
            <div className="ff-modal">
              <div className="ff-modal-head">
                <span className="dx-kpi-icon dx-tone-accent"><Icon name="trash" size={20} /></span>
                <div>
                  <h2 className="ff-modal-title">Delete &ldquo;{custom.name}&rdquo;?</h2>
                  <p className="ff-modal-sub">Only the folder is removed. Its files are kept and go back to where they were before.</p>
                </div>
              </div>
              {modalError && <p className="ff-upload-error">{modalError}</p>}
              <div className="ff-modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="button" className="btn btn-accent" disabled={saving} onClick={deleteFolder}>{saving ? 'Deleting…' : 'Delete folder'}</button>
              </div>
            </div>
          ) : moveFile ? (
            <div className="ff-modal">
              <div className="ff-modal-head">
                <span className="dx-kpi-icon dx-tone-accent"><Icon name="move" size={20} /></span>
                <div>
                  <h2 className="ff-modal-title">Move to a folder</h2>
                  <p className="ff-modal-sub ff-trunc">{moveFile.name}</p>
                </div>
                <button type="button" className="ff-icon-btn" aria-label="Close" onClick={() => setModal(null)}>
                  <Icon name="close" size={15} />
                </button>
              </div>
              <div className="ff-move-list">
                {customFolders.filter((cf) => cf.id !== custom.id).map((cf) => (
                  <button key={cf.id} type="button" className="ff-move-item" disabled={saving} onClick={() => moveTo(moveFile, cf.id)}>
                    <Icon name="folder" size={16} /> <span>{cf.name}</span>
                  </button>
                ))}
                <button type="button" className="ff-move-item" disabled={saving} onClick={() => moveTo(moveFile, null)}>
                  <Icon name="file" size={16} /> <span>No folder</span>
                </button>
              </div>
              {modalError && <p className="ff-upload-error">{modalError}</p>}
            </div>
          ) : null}
        </div>
      )}

      <MediaPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
