'use client';

// Screen 19 — Files & Documents (client)। v2: sidebar shell + rich files hub।
//
// "Folders" real category কলাম থেকেই আসে (নতুন কোনো folders টেবিল না) — শুধু যে
// category-তে আসলেই ফাইল আছে সেটাই একটা "folder"। "New Folder" বাদ দেওয়া হয়েছে
// কারণ এই আর্কিটেকচারে user-created arbitrary folder বলে কিছু নেই (category
// একটা fixed enum) — fake বাটন রাখা হয়নি। "Shared By" এখন real uploaded_by_id
// (ফেজ ১৭, Messages-এর sender_id-এর same প্যাটার্ন) থেকে টিম মেম্বারের real
// নাম/role/avatar দেখায়, কোনো ID না থাকলে (পুরনো রো) জেনেরিক "FLOW 53 Team"।

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';
import { formatBnDateLong } from '@/lib/format';
import '../../../client-shared.css';
import './files.css';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  grid2: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  dots: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ProjectInfo = { id: string; name: string };
type UploaderProfile = { id: string; full_name: string; role: string | null; avatar_url: string | null };
type FileRow = {
  id: string;
  name: string;
  file_type: string | null;
  size_bytes: number | null;
  drive_url: string;
  category: string;
  uploaded_by: string;
  uploaded_by_id: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  requirements: 'Project Requirements',
  sow: 'Statement of Work',
  invoice: 'Invoices',
  receipt: 'Receipts',
  design: 'Design Files',
  deliverable: 'Deliverables',
  other: 'Other',
};
const CATEGORY_ORDER = ['requirements', 'sow', 'invoice', 'receipt', 'design', 'deliverable', 'other'];
const PAGE_SIZE = 5;

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
  return formatBnDateLong(iso);
}
function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ClientFilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, UploaderProfile>>({});
  const [nowIso, setNowIso] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'size' | 'oldest'>('recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

        const { data } = await supabase
          .from('client_files')
          .select('id, name, file_type, size_bytes, drive_url, category, uploaded_by, uploaded_by_id, created_at')
          .eq('client_id', own.client.id)
          .order('created_at', { ascending: false });
        const rows = (data as FileRow[]) ?? [];
        setFiles(rows);

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

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !client) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
      await supabase.from('client_files').insert({
        client_id: client.id,
        project_id: project?.id,
        name: file.name,
        file_type: guessFileType(file),
        size_bytes: file.size,
        drive_url: result.webViewLink,
        category: 'other',
        uploaded_by: 'client',
      });
      setReloadKey((k) => k + 1);
    } catch {
      // no-op — বাটন আবার সক্রিয় হয়ে যাবে
    }
    setUploading(false);
  }

  const typeOptions = useMemo(() => Array.from(new Set(files.map((f) => fileExtension(f.name)))).sort(), [files]);

  const folders = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => {
      const items = files.filter((f) => f.category === cat);
      if (items.length === 0) return null;
      const latest = items[0]; // files already ordered desc by created_at
      return { cat, label: CATEGORY_LABEL[cat] ?? cat, count: items.length, latest };
    }).filter((f): f is { cat: string; label: string; count: number; latest: FileRow } => f !== null);
  }, [files]);
  const visibleFolders = showAllFolders ? folders : folders.slice(0, 4);

  const filteredFiles = useMemo(() => {
    let list = files;
    if (categoryFilter) list = list.filter((f) => f.category === categoryFilter);
    if (typeFilter !== 'all') list = list.filter((f) => fileExtension(f.name) === typeFilter);
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
  }, [files, categoryFilter, typeFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pagedFiles = filteredFiles.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function resetToPage1() {
    setPage(1);
  }

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
            <div className="files-state-title">Unable to load files</div>
            <p className="files-state-sub">Please try again.</p>
            <div className="files-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}`} className="cp-btn cp-btn-secondary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalSize = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  const distinctTeamUploaders = new Set(files.filter((f) => f.uploaded_by === 'team' && f.uploaded_by_id).map((f) => f.uploaded_by_id)).size;
  const lastFile = files[0] ?? null;

  return (
    <div className="client-portal files-root">
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <div>
            <div className="cp-brand" style={{ padding: '6px 10px 22px' }}>
              <div className="cp-brand-mark" aria-hidden="true"></div>
              <div className="cp-brand-text">FLOW 53</div>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
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
              <Link href={`/client/project/${project.id}/files`} className="nav-item active">
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
          <button type="button" className="profile-card" onClick={handleSignOut} title="Sign out">
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </div>
            <div className="profile-meta">
              <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
              <div className="profile-role">{client.company_name}</div>
            </div>
            <Icon name="logout" />
          </button>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">Files</span>
          </header>

          <main className="content">
            <div className="breadcrumb">
              <Link href="/client/dashboard">Client Portal</Link> / Files
            </div>

            <div className="files-top-row">
              <div>
                <h1 className="files-title">Files</h1>
                <p className="files-page-sub">Access and download project files, documents and resources.</p>
              </div>
              <div className="files-top-actions">
                <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Icon name="upload" size={13} /> {uploading ? `${uploadProgress}%` : 'Upload File'}
                </button>
              </div>
            </div>

            {/* ---- stat strip ---- */}
            <div className="files-stat-strip">
              <div className="files-stat">
                <div className="files-stat-icon">
                  <Icon name="folder" size={16} />
                </div>
                <div>
                  <div className="files-stat-label">Total Files</div>
                  <div className="files-stat-value">{files.length}</div>
                  <div className="files-stat-caption">Across all folders</div>
                </div>
              </div>
              <div className="files-stat">
                <div className="files-stat-icon positive">
                  <Icon name="file" size={16} />
                </div>
                <div>
                  <div className="files-stat-label">Total Size</div>
                  <div className="files-stat-value">{formatBytes(totalSize)}</div>
                  <div className="files-stat-caption">Used storage</div>
                </div>
              </div>
              <div className="files-stat">
                <div className="files-stat-icon warning">
                  <Icon name="users" size={16} />
                </div>
                <div>
                  <div className="files-stat-label">Shared By Team</div>
                  <div className="files-stat-value">{distinctTeamUploaders}</div>
                  <div className="files-stat-caption">Team members</div>
                </div>
              </div>
              <div className="files-stat">
                <div className="files-stat-icon accent">
                  <Icon name="clock" size={16} />
                </div>
                <div>
                  <div className="files-stat-label">Last Updated</div>
                  <div className="files-stat-value">{lastFile && nowIso ? dayLabel(lastFile.created_at, nowIso) : '—'}</div>
                  <div className="files-stat-caption files-stat-caption-trunc">{lastFile?.name ?? 'No files yet'}</div>
                </div>
              </div>
            </div>

            {/* ---- toolbar ---- */}
            <div className="files-toolbar">
              <div className="files-search">
                <Icon name="search" size={14} />
                <input
                  type="text"
                  placeholder="Search files and folders…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetToPage1();
                  }}
                />
              </div>
              <select
                className="files-select"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  resetToPage1();
                }}
              >
                <option value="all">All Types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select className="files-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="recent">Recently Updated</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Name (A–Z)</option>
                <option value="size">Largest First</option>
              </select>
              <div className="files-view-toggle">
                <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="List view">
                  <Icon name="list" size={15} />
                </button>
                <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view">
                  <Icon name="grid2" size={15} />
                </button>
              </div>
            </div>

            {/* ---- folders ---- */}
            {folders.length > 0 && (
              <div className="files-section">
                <div className="files-section-head">
                  <span className="files-section-title">Folders</span>
                  {folders.length > 4 && (
                    <button type="button" className="files-view-all" onClick={() => setShowAllFolders((v) => !v)}>
                      {showAllFolders ? 'Show less' : 'View all folders'} →
                    </button>
                  )}
                </div>
                <div className="files-folder-grid">
                  {visibleFolders.map((f) => (
                    <button
                      key={f.cat}
                      type="button"
                      className={`files-folder-card${categoryFilter === f.cat ? ' active' : ''}`}
                      onClick={() => {
                        setCategoryFilter((prev) => (prev === f.cat ? null : f.cat));
                        resetToPage1();
                      }}
                    >
                      <div className="files-folder-icon">
                        <Icon name="folder" size={18} />
                      </div>
                      <div className="files-folder-body">
                        <div className="files-folder-name">{f.label}</div>
                        <div className="files-folder-meta">{f.count} file{f.count === 1 ? '' : 's'}</div>
                        <div className="files-folder-meta">Updated {nowIso ? dayLabel(f.latest.created_at, nowIso) : ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ---- files ---- */}
            <div className="files-section">
              <div className="files-section-head">
                <span className="files-section-title">
                  Files
                  {categoryFilter && (
                    <button type="button" className="files-clear-filter" onClick={() => setCategoryFilter(null)}>
                      {CATEGORY_LABEL[categoryFilter]} <Icon name="close" size={11} />
                    </button>
                  )}
                </span>
              </div>

              {filteredFiles.length === 0 ? (
                <div className="cp-dash-card">
                  <p className="cp-page-empty">{files.length === 0 ? 'No files have been shared yet.' : 'No files match your search.'}</p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="files-table-wrap">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Shared By</th>
                        <th>Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedFiles.map((f) => {
                        const uploader = f.uploaded_by_id ? uploaders[f.uploaded_by_id] : null;
                        const isNew = nowIso ? new Date(nowIso).getTime() - new Date(f.created_at).getTime() < 24 * 3600 * 1000 : false;
                        const ext = fileExtension(f.name);
                        return (
                          <tr key={f.id}>
                            <td>
                              <div className="files-row-name">
                                <div className={`files-row-icon ${fileExtension(f.name).toLowerCase()}`}>
                                  <Icon name="file" size={14} />
                                </div>
                                <span className="files-row-name-text">{f.name}</span>
                                {isNew && <span className="files-new-badge">New</span>}
                              </div>
                            </td>
                            <td>{ext}</td>
                            <td className="tabular">{formatBytes(f.size_bytes)}</td>
                            <td>
                              <div className="files-shared-by">
                                <div className="files-shared-avatar">
                                  {uploader?.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={uploader.avatar_url} alt="" />
                                  ) : (
                                    (uploader?.full_name ?? (f.uploaded_by === 'client' ? (client.primary_contact ?? client.company_name) : 'FLOW 53')).charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div className="files-shared-name">{uploader?.full_name ?? (f.uploaded_by === 'client' ? 'You' : 'FLOW 53 Team')}</div>
                                  <div className="files-shared-role">{uploader?.role ?? (f.uploaded_by === 'client' ? client.company_name : 'Team Member')}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {nowIso ? dayLabel(f.created_at, nowIso) : ''}, {formatClockTime(f.created_at)}
                            </td>
                            <td>
                              <div className="files-actions">
                                <a href={f.drive_url} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label="Download">
                                  <Icon name="download" size={14} />
                                </a>
                                <div className="files-menu-wrap">
                                  <button type="button" className="icon-btn" aria-label="More actions" onClick={() => setOpenMenuId((id) => (id === f.id ? null : f.id))}>
                                    <Icon name="dots" size={14} />
                                  </button>
                                  {openMenuId === f.id && (
                                    <div className="files-menu">
                                      <a href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenuId(null)}>
                                        <Icon name="eye" size={13} /> View
                                      </a>
                                      <a href={f.drive_url} target="_blank" rel="noopener noreferrer" onClick={() => setOpenMenuId(null)}>
                                        <Icon name="download" size={13} /> Download
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="files-grid">
                  {pagedFiles.map((f) => {
                    const uploader = f.uploaded_by_id ? uploaders[f.uploaded_by_id] : null;
                    return (
                      <a key={f.id} href={f.drive_url} target="_blank" rel="noopener noreferrer" className="files-grid-card">
                        <div className={`files-row-icon ${fileExtension(f.name).toLowerCase()}`}>
                          <Icon name="file" size={18} />
                        </div>
                        <div className="files-grid-name">{f.name}</div>
                        <div className="files-grid-meta">
                          {fileExtension(f.name)} · {formatBytes(f.size_bytes)}
                        </div>
                        <div className="files-grid-meta">{uploader?.full_name ?? (f.uploaded_by === 'client' ? 'You' : 'FLOW 53 Team')}</div>
                      </a>
                    );
                  })}
                </div>
              )}

              {filteredFiles.length > 0 && (
                <div className="files-pagination">
                  <span className="files-pagination-info">
                    Showing {(pageSafe - 1) * PAGE_SIZE + 1} to {Math.min(pageSafe * PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length} files
                  </span>
                  <div className="files-pagination-controls">
                    <button type="button" disabled={pageSafe === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                      <Icon name="chevronLeft" size={13} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .slice(0, 5)
                      .map((n) => (
                        <button key={n} type="button" className={pageSafe === n ? 'active' : ''} onClick={() => setPage(n)}>
                          {n}
                        </button>
                      ))}
                    {totalPages > 5 && <span className="files-pagination-ellipsis">…</span>}
                    <button type="button" disabled={pageSafe === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                      <Icon name="chevronRight" size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
