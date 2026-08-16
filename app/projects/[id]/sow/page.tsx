'use client';

// Screen 10 — SOW (Statement of Work), অ্যাডমিন সাইড। প্রতিটা "Create New Version"
// sows টেবিলে (project_id, version) কম্বিনেশনে নতুন রো ইনসার্ট করে — v1/v2/v3
// ট্যাব হিসেবে দেখা যায়, পুরনো ভার্সন immutable থাকে। Draft অবস্থায় টাইপ করে বা
// (Drive পাইপলাইন দিয়ে) PDF/DOC আপলোড করে কনটেন্ট দেওয়া যায়; "Send to Client"
// চাপলে ক্লায়েন্ট Screen 11 (/client/project/[id]/sow)-এ দেখতে ও সাইন করতে পারবে।

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import './sow.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { useUnreadCount } from '@/lib/useUnreadCount';
import { formatBnDateLong } from '@/lib/format';
import { uploadFileToDrive } from '@/lib/driveUpload';
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
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
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
  draft: { label: 'Draft', cls: 's-todo' },
  sent: { label: 'Awaiting Signature', cls: 's-review' },
  signed: { label: 'Signed ✓', cls: 's-done' },
};

type ProfileRow = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null; behance_url?: string | null; linkedin_url?: string | null };
type ProjectBrief = { id: string; name: string; client_id: string | null; clients: { company_name: string } | { company_name: string }[] | null };
type Sow = {
  id: string;
  project_id: string;
  version: number;
  scope: string | null;
  objectives: string | null;
  deliverables: string | null;
  timeline: string | null;
  payment_terms: string | null;
  revision_policy: string | null;
  client_responsibilities: string | null;
  terms: string | null;
  document_url: string | null;
  status: string;
  notify_client: boolean;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
};

type FormState = Pick<Sow, 'scope' | 'objectives' | 'deliverables' | 'timeline' | 'payment_terms' | 'revision_policy' | 'client_responsibilities' | 'terms'>;
const EMPTY_FORM: FormState = { scope: '', objectives: '', deliverables: '', timeline: '', payment_terms: '', revision_policy: '', client_responsibilities: '', terms: '' };

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function AdminSowPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: sessionLoading } = useSession();
  const unreadCount = useUnreadCount(user);
  const [dark, setDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [versions, setVersions] = useState<Sow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !projectId) return;

    async function run() {
      const [projectRes, sowsRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name, client_id, clients(company_name)').eq('id', projectId).maybeSingle(),
        supabase.from('sows').select('*').eq('project_id', projectId).order('version', { ascending: false }),
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url').eq('id', user!.id).single(),
      ]);

      if (projectRes.error) setError(projectRes.error.message);
      setProject((projectRes.data as unknown as ProjectBrief) ?? null);
      const rows = (sowsRes.data as Sow[]) ?? [];
      setVersions(rows);
      if (rows.length > 0) {
        setSelectedId(rows[0].id);
        setForm({
          scope: rows[0].scope ?? '',
          objectives: rows[0].objectives ?? '',
          deliverables: rows[0].deliverables ?? '',
          timeline: rows[0].timeline ?? '',
          payment_terms: rows[0].payment_terms ?? '',
          revision_policy: rows[0].revision_policy ?? '',
          client_responsibilities: rows[0].client_responsibilities ?? '',
          terms: rows[0].terms ?? '',
        });
        setNotify(rows[0].notify_client);
        setDocumentUrl(rows[0].document_url);
      }
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setLoading(false);
    }

    run();
  }, [user, projectId, reloadKey]);

  function selectVersion(sow: Sow) {
    setSelectedId(sow.id);
    setForm({
      scope: sow.scope ?? '',
      objectives: sow.objectives ?? '',
      deliverables: sow.deliverables ?? '',
      timeline: sow.timeline ?? '',
      payment_terms: sow.payment_terms ?? '',
      revision_policy: sow.revision_policy ?? '',
      client_responsibilities: sow.client_responsibilities ?? '',
      terms: sow.terms ?? '',
    });
    setNotify(sow.notify_client);
    setDocumentUrl(sow.document_url);
  }

  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const isDraft = selected ? selected.status === 'draft' : true;

  async function handleCreateFirst() {
    if (!user) return;
    const { data, error: createError } = await supabase.from('sows').insert({ project_id: projectId, version: 1, created_by: user.id }).select('*').single();
    if (createError) {
      setError(createError.message);
      return;
    }
    setVersions([data as Sow]);
    setSelectedId((data as Sow).id);
    setForm(EMPTY_FORM);
  }

  async function handleCreateNewVersion() {
    if (!user) return;
    const nextVersion = (versions[0]?.version ?? 0) + 1;
    const { data, error: createError } = await supabase
      .from('sows')
      .insert({
        project_id: projectId,
        version: nextVersion,
        created_by: user.id,
        scope: selected?.scope,
        objectives: selected?.objectives,
        deliverables: selected?.deliverables,
        timeline: selected?.timeline,
        payment_terms: selected?.payment_terms,
        revision_policy: selected?.revision_policy,
        client_responsibilities: selected?.client_responsibilities,
        terms: selected?.terms,
        document_url: selected?.document_url,
      })
      .select('*')
      .single();
    if (createError) {
      setError(createError.message);
      return;
    }
    setVersions((prev) => [data as Sow, ...prev]);
    selectVersion(data as Sow);
  }

  async function handleSaveDraft(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    const { error: updateError } = await supabase.from('sows').update({ ...form, document_url: documentUrl }).eq('id', selected.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setReloadKey((k) => k + 1);
  }

  async function handleSend() {
    if (!selected || !user) return;
    setSending(true);
    const { error: updateError } = await supabase
      .from('sows')
      .update({ ...form, document_url: documentUrl, status: 'sent', sent_at: new Date().toISOString(), notify_client: notify })
      .eq('id', selected.id);
    setSending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (project?.client_id) {
      await supabase.from('activity_log').insert({ actor_id: user.id, action: 'sow_sent', entity_type: 'client', entity_id: project.client_id, detail: `SOW v${selected.version} ক্লায়েন্টকে পাঠানো হয়েছে` });
    }
    setReloadKey((k) => k + 1);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
      setDocumentUrl(result.webViewLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।');
    }
    setUploading(false);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const client = project ? toOne(project.clients) : null;

  return (
    <div className={`projdetail-root sow-admin-root${dark ? ' dark' : ''}`}>
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
                  <span className="current">SOW</span>
                </div>

                {error && <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

                <div className="proj-header">
                  <div>
                    <span className="proj-title">Statement of Work</span>
                    <div className="proj-sub-row">
                      {client && (
                        <>
                          <span>{client.company_name}</span>
                          <span className="dividerdot"></span>
                        </>
                      )}
                      <span>{project.name}</span>
                    </div>
                  </div>
                </div>

                {versions.length === 0 ? (
                  <div className="summary-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14 }}>এই প্রজেক্টের জন্য এখনো কোনো SOW তৈরি হয়নি।</p>
                    <button className="btn btn-accent btn-sm" onClick={handleCreateFirst}>
                      <Icon name="plus" size={14} /> Create SOW
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="sow-version-tabs">
                      {versions.map((v) => (
                        <button key={v.id} className={`sow-version-tab${v.id === selectedId ? ' active' : ''}`} onClick={() => selectVersion(v)}>
                          v{v.version} <span className={`status-pill ${STATUS_META[v.status]?.cls ?? 's-todo'}`}>{STATUS_META[v.status]?.label ?? v.status}</span>
                        </button>
                      ))}
                      {selected && selected.status !== 'draft' && (
                        <button className="btn btn-ghost btn-sm" onClick={handleCreateNewVersion}>
                          <Icon name="plus" size={12} /> New Version
                        </button>
                      )}
                    </div>

                    {selected && (
                      <div className="summary-card">
                        {selected.status === 'signed' && selected.signed_by_name && (
                          <div className="sow-signed-banner">
                            ✓ Signed by <strong>{selected.signed_by_name}</strong> on {formatBnDateLong(selected.signed_at)}
                          </div>
                        )}

                        <form onSubmit={handleSaveDraft}>
                          <div className="sow-doc-row">
                            <input ref={fileInputRef} type="file" hidden onChange={handleUpload} disabled={!isDraft} />
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={!isDraft || uploading}>
                              <Icon name="upload" size={13} /> {uploading ? `আপলোড হচ্ছে… ${uploadProgress}%` : documentUrl ? 'Replace Document' : 'Upload Document (PDF/DOC)'}
                            </button>
                            {documentUrl && (
                              <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="sow-doc-link">
                                View uploaded document ↗
                              </a>
                            )}
                          </div>

                          {(
                            [
                              ['scope', 'Scope'],
                              ['objectives', 'Objectives'],
                              ['deliverables', 'Deliverables'],
                              ['timeline', 'Timeline'],
                              ['payment_terms', 'Payment Terms'],
                              ['revision_policy', 'Revision Policy'],
                              ['client_responsibilities', 'Client Responsibilities'],
                              ['terms', 'Terms & Conditions'],
                            ] as [keyof FormState, string][]
                          ).map(([key, label]) => (
                            <div className="sow-field" key={key}>
                              <label className="field-label">{label}</label>
                              {isDraft ? (
                                <textarea className="field-input" rows={3} value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                              ) : (
                                <p className="sow-readonly-text">{form[key] || '—'}</p>
                              )}
                            </div>
                          ))}

                          {isDraft && (
                            <div className="sow-actions">
                              <label className="sow-notify-row">
                                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify Client
                              </label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="submit" className="btn btn-ghost btn-sm" disabled={saving}>
                                  {saving ? 'সেভ হচ্ছে…' : 'Save Draft'}
                                </button>
                                <button type="button" className="btn btn-accent btn-sm" disabled={sending} onClick={handleSend}>
                                  {sending ? 'পাঠানো হচ্ছে…' : 'Send to Client'}
                                </button>
                              </div>
                            </div>
                          )}
                        </form>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
