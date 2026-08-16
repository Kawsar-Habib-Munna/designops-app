'use client';

// Screen 21 — Change Request (admin)। ক্লায়েন্টের রিকোয়েস্ট রিভিউ করে
// Additional Cost/Time/Status সেট করা যায়। Approved হলে "Convert to Task" দিয়ে
// বিদ্যমান tasks টেবিলে একটা রিয়েল টাস্ক তৈরি হয়।

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { relativeTimeBn } from '@/lib/format';
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

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 's-todo' },
  under_review: { label: 'Under Review', cls: 's-review' },
  approved: { label: 'Approved', cls: 's-done' },
  rejected: { label: 'Rejected', cls: 's-todo' },
};

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ProjectBrief = { id: string; name: string };
type ChangeRequest = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  attachment_url: string | null;
  status: string;
  additional_cost: number | null;
  additional_time: string | null;
  admin_notes: string | null;
  converted_task_id: string | null;
  created_at: string;
};

export default function AdminChangeRequestsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cost, setCost] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [converting, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) return;

    async function run() {
      const [projectRes, itemsRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle(),
        supabase.from('change_requests').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);
      setProject((projectRes.data as ProjectBrief) ?? null);
      setItems((itemsRes.data as ChangeRequest[]) ?? []);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user, projectId, reloadKey]);

  function startEdit(cr: ChangeRequest) {
    setEditingId(cr.id);
    setCost(cr.additional_cost != null ? String(cr.additional_cost) : '');
    setTime(cr.additional_time ?? '');
    setNotes(cr.admin_notes ?? '');
  }

  async function saveStatus(id: string, status: string) {
    await supabase
      .from('change_requests')
      .update({ status, additional_cost: cost ? Number(cost) : null, additional_time: time.trim() || null, admin_notes: notes.trim() || null, resolved_at: status === 'approved' || status === 'rejected' ? new Date().toISOString() : null })
      .eq('id', id);
    setEditingId(null);
    setReloadKey((k) => k + 1);
  }

  async function convertToTask(cr: ChangeRequest) {
    if (!user) return;
    setConvertingId(cr.id);
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({ title: cr.title, description: cr.description, project_id: projectId, status: 'todo', workflow_stage: 'backlog', created_by: user.id })
      .select('id')
      .single();
    if (!error && task) {
      await supabase.from('change_requests').update({ converted_task_id: task.id }).eq('id', cr.id);
    }
    setConvertingId(null);
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
                  <span className="current">Change Requests</span>
                </div>
                <div className="proj-header">
                  <span className="proj-title">Change Requests</span>
                </div>

                {items.length === 0 ? (
                  <div className="summary-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>এখনো কোনো চেঞ্জ রিকোয়েস্ট আসেনি।</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {items.map((cr) => {
                      const meta = STATUS_META[cr.status] ?? { label: cr.status, cls: 's-todo' };
                      return (
                        <div className="summary-card" key={cr.id} style={{ marginBottom: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>{cr.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{relativeTimeBn(cr.created_at)}</div>
                            </div>
                            <span className={`status-pill ${meta.cls}`}>{meta.label}</span>
                          </div>
                          {cr.description && <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '0 0 6px' }}>{cr.description}</p>}
                          {cr.reason && (
                            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '0 0 10px', fontStyle: 'italic' }}>Reason: {cr.reason}</p>
                          )}
                          {cr.attachment_url && (
                            <a href={cr.attachment_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'block', marginBottom: 10 }}>
                              View attachment ↗
                            </a>
                          )}

                          {editingId === cr.id ? (
                            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
                              <div className="field-row">
                                <div>
                                  <label className="field-label">Additional Cost (৳)</label>
                                  <input className="field-input" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
                                </div>
                                <div>
                                  <label className="field-label">Additional Time</label>
                                  <input className="field-input" type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="যেমন: 3 days" />
                                </div>
                              </div>
                              <label className="field-label">Notes to Client</label>
                              <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                                  বাতিল
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => saveStatus(cr.id, 'under_review')}>
                                  Under Review
                                </button>
                                <button className="btn btn-accent btn-sm" onClick={() => saveStatus(cr.id, 'approved')}>
                                  Approve
                                </button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => saveStatus(cr.id, 'rejected')}>
                                  Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(cr)}>
                                Review
                              </button>
                              {cr.status === 'approved' && !cr.converted_task_id && (
                                <button className="btn btn-accent btn-sm" onClick={() => convertToTask(cr)} disabled={converting === cr.id}>
                                  {converting === cr.id ? 'তৈরি হচ্ছে…' : 'Convert to Task'}
                                </button>
                              )}
                              {cr.converted_task_id && <span style={{ fontSize: 11.5, color: 'var(--positive)', alignSelf: 'center' }}>✓ Converted to task</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
