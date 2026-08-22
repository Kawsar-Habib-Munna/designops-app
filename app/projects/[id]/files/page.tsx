'use client';

// Screen 19 — Files & Documents (admin)। বিদ্যমান client_files টেবিল + Drive
// পাইপলাইন রিইউজ। hidden_from_client টগল করলে ক্লায়েন্টের /files-এ আর দেখা যায় না
// (RLS নিজেই ফিল্টার করে) — এটাই Share/Hide অ্যাকশন। Delete সরাসরি রো মুছে দেয়।

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDate } from '@/lib/format';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import ProfileMenu from '@/app/components/ProfileMenu';

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
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10.5 10.5 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 4.2-5.4M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
};
type IconName = keyof typeof ICON_PATHS;
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const NAV_ITEMS: { icon: IconName; label: string; href: string; active?: boolean }[] = [
  { icon: 'grid', label: 'Dashboard', href: '/dashboard' },
  { icon: 'folder', label: 'Projects', href: '/projects', active: true },
  { icon: 'check', label: 'Tasks', href: '/tasks' },
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

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ProjectBrief = { id: string; name: string; client_id: string | null };
type FileRow = { id: string; name: string; size_bytes: number | null; drive_url: string; category: string; uploaded_by: string; hidden_from_client: boolean; created_at: string };

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminProjectFilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !projectId) return;

    async function run() {
      const [projectRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name, client_id').eq('id', projectId).maybeSingle(),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);
      const p = (projectRes.data as ProjectBrief) ?? null;
      setProject(p);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);

      if (p?.client_id) {
        const { data } = await supabase.from('client_files').select('id, name, size_bytes, drive_url, category, uploaded_by, hidden_from_client, created_at').eq('client_id', p.client_id).order('created_at', { ascending: false });
        setFiles((data as FileRow[]) ?? []);
      }
      setLoading(false);
    }

    run();
  }, [user, projectId, reloadKey]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !project?.client_id || !user) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
      await supabase.from('client_files').insert({
        client_id: project.client_id,
        project_id: project.id,
        name: file.name,
        file_type: guessFileType(file),
        size_bytes: file.size,
        drive_url: result.webViewLink,
        category: 'deliverable',
        uploaded_by: 'team',
        uploaded_by_id: user.id,
      });
      setReloadKey((k) => k + 1);
    } catch {
      // no-op — আপলোড বাটন আবার সক্রিয় হয়ে যাবে
    }
    setUploading(false);
  }

  async function toggleHidden(f: FileRow) {
    await supabase.from('client_files').update({ hidden_from_client: !f.hidden_from_client }).eq('id', f.id);
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(f: FileRow) {
    await supabase.from('client_files').delete().eq('id', f.id);
    setReloadKey((k) => k + 1);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className={`projdetail-root${dark ? ' dark' : ''}`}>
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`} aria-label="প্রধান নেভিগেশন">
          <div>
            <div className="brand">
              <div className="brand-mark"></div>
              <div>
                <div className="brand-name">FLOW 53</div>
                <div className="brand-sub">Innovate · Design · Elevate</div>
              </div>
              <button className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
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
            <button className="menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <div className="topbar-spacer"></div>
            <Link className="icon-btn" href="/notifications" aria-label="নোটিফিকেশন">
              <Icon name="bell" />
              {unreadCount > 0 && <span className="bell-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
            <button className="icon-btn" aria-label="থিম পরিবর্তন" onClick={() => setDark((d) => !d)}>
              <Icon name={dark ? 'moon' : 'sun'} />
            </button>
          </header>

          <main className="content">
            {loading || !project ? (
              <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : (
              <>
                <div className="breadcrumb">
                  <Link href="/projects">Projects</Link>
                  <span className="sep">/</span>
                  <Link href={`/projects/${project.id}`}>{project.name}</Link>
                  <span className="sep">/</span>
                  <span className="current">Files</span>
                </div>

                <div className="proj-header">
                  <span className="proj-title">Client Files</span>
                  <div className="header-actions">
                    <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
                    <button className="btn btn-accent btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Icon name="plus" size={14} /> {uploading ? `${uploadProgress}%` : 'Upload File'}
                    </button>
                  </div>
                </div>

                {!project.client_id ? (
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>এই প্রজেক্টে কোনো ক্লায়েন্ট লিংক করা নেই।</p>
                ) : files.length === 0 ? (
                  <div className="summary-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>এখনো কোনো ফাইল নেই।</p>
                  </div>
                ) : (
                  <div className="summary-card" style={{ padding: 8 }}>
                    {files.map((f) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderBottom: '1px solid var(--border-soft)' }}>
                        <a href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                            {formatBytes(f.size_bytes)} · {f.category} · {f.uploaded_by === 'client' ? 'Client' : 'Team'} · {formatBnDate(f.created_at)}
                          </div>
                        </a>
                        <button className="icon-btn" title={f.hidden_from_client ? 'ক্লায়েন্ট থেকে লুকানো — দেখাতে চাপুন' : 'ক্লায়েন্ট দেখতে পাচ্ছে — লুকাতে চাপুন'} onClick={() => toggleHidden(f)}>
                          <Icon name={f.hidden_from_client ? 'eyeOff' : 'eye'} size={15} />
                        </button>
                        <button className="icon-btn" title="ডিলিট করুন" onClick={() => handleDelete(f)} style={{ color: 'var(--danger)' }}>
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
