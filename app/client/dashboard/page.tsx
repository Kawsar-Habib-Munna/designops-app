'use client';

// Screen 5 — Client Empty Dashboard। রিডিজাইন: পূর্ণ sidebar app-shell (mockup যেমন
// দেখিয়েছে, প্লাস মোবাইলের জন্য off-canvas ড্রয়ার যোগ — মকআপে মোবাইলে পুরো সাইডবার
// লুকিয়ে যেত, কোনো নেভিগেশন থাকত না, যেটা "mobile responsive" দাবির সাথে যায় না)।
//
// সব স্টেট real ডেটা থেকে ডেরাইভ করা:
// - প্রজেক্ট থাকলে সরাসরি Screen 9-এ রিডাইরেক্ট (এই পেজ শুধু "প্রজেক্ট তৈরির আগে"-র জন্য)
// - Checklist প্রতিটা আইটেম আসল কলামের presence থেকে (files শুধু সত্যিই থাকলে ✓)
// - "Action Required" স্টেট real: clients.admin_request (এডমিন Screen 7 থেকে সেট করে)
// - Recent Activity বিদ্যমান activity_log টেবিল থেকে (entity_type='client')
// - Messages/Files/SOW/Payments সাইডবার আইটেম ইচ্ছাকৃতভাবে disabled — সবগুলো
//   project_id-নির্ভর (Screens 18/19/10/12), আর এখানে কোনো প্রজেক্ট নেই।

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType } from '@/lib/driveUpload';
import { relativeTimeBn, formatBnDateLong } from '@/lib/format';
import '../client-shared.css';
import './dashboard.css';

const WHATSAPP_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20a%20client%20and%20I%27d%20like%20to%20get%20in%20touch%20about%20my%20project.';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v6h-6"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type Requirements = {
  project_name: string | null;
  project_type: string | null;
  project_description: string | null;
  goals: string | null;
  target_audience: string | null;
  required_features: string | null;
  expected_timeline: string | null;
  budget_range: string | null;
  reference_notes: string | null;
  created_at: string;
};

type ActivityRow = { id: string; action: string; detail: string | null; created_at: string };

type PendingFile = {
  key: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const NAV_ITEMS = [
  { icon: 'folder', label: 'My Project', tag: 'Awaiting' },
  { icon: 'message', label: 'Messages', tag: 'Unavailable' },
  { icon: 'file', label: 'Files', tag: 'Unavailable' },
  { icon: 'doc', label: 'SOW', tag: 'Unavailable' },
  { icon: 'card', label: 'Payments', tag: 'Unavailable' },
];

export default function ClientDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [filesCount, setFilesCount] = useState(0);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }

        const { data: req } = await supabase
          .from('client_requirements')
          .select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes, created_at')
          .eq('client_id', own.id)
          .maybeSingle();

        if (!req) {
          router.replace('/client/onboarding');
          return;
        }

        const { data: projectRows } = await supabase.from('projects').select('id').eq('client_id', own.id).order('created_at', { ascending: false }).limit(1);
        if (projectRows && projectRows.length > 0) {
          router.replace(`/client/project/${projectRows[0].id}`);
          return;
        }

        const [filesRes, activityRes] = await Promise.all([
          supabase.from('client_files').select('id', { count: 'exact', head: true }).eq('client_id', own.id),
          supabase.from('activity_log').select('id, action, detail, created_at').eq('entity_type', 'client').eq('entity_id', own.id).order('created_at', { ascending: false }).limit(8),
        ]);

        setClient(own);
        setRequirements(req as Requirements);
        setFilesCount(filesRes.count ?? 0);
        setActivity((activityRes.data as ActivityRow[]) ?? []);
        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router, reloadKey]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0 || !client) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      router.replace('/client/sign-in');
      return;
    }

    for (const file of selected) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setFiles((prev) => [...prev, { key, file, progress: 0, status: 'uploading' }]);

      uploadFileToDrive(file, accessToken, (pct) => {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, progress: pct } : f)));
      })
        .then(async (result) => {
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'done', progress: 100 } : f)));
          await supabase.from('client_files').insert({
            client_id: client.id,
            name: file.name,
            file_type: guessFileType(file),
            size_bytes: file.size,
            drive_url: result.webViewLink,
            category: 'other',
            uploaded_by: 'client',
          });
          setSavedCount((n) => n + 1);
          setFilesCount((n) => n + 1);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।';
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error', error: message } : f)));
        });
    }
  }

  if (loading || (!client && !loadError)) {
    return (
      <div className="client-portal client-dashboard-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (loadError || !client || !requirements) {
    return (
      <div className="client-portal client-dashboard-root">
        <div className="state-view">
          <div className="state-icon err">
            <Icon name="alert" size={20} />
          </div>
          <div className="state-title">We couldn&apos;t load your dashboard</div>
          <div className="state-sub">Please try again in a moment.</div>
          <div className="state-actions">
            <button
              type="button"
              className="cp-btn cp-btn-primary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <Icon name="refresh" size={13} /> Try Again
            </button>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-secondary">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  const hasActionRequired = !!client.admin_request;
  const checklist = [
    { label: 'Account created', done: true },
    { label: 'Personal information', done: !!client.primary_contact },
    { label: 'Company information', done: !!client.company_name },
    { label: 'Project requirements', done: true },
    { label: 'Files received', done: filesCount > 0 },
  ];

  return (
    <div className="client-portal client-dashboard-root">
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
              <span className="nav-item active">
                <Icon name="grid" /> Overview
              </span>
              {NAV_ITEMS.map((item) => (
                <span className="nav-item disabled" key={item.label} title="Available once your project is created">
                  <Icon name={item.icon} /> {item.label} <span className="nav-tag">{item.tag}</span>
                </span>
              ))}
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
            <span className="topbar-title">Client Portal</span>
          </header>

          <main className="content">
            <h1 className="welcome-title">Welcome, {client.primary_contact ?? client.company_name} 👋</h1>
            <p className="welcome-sub">
              {hasActionRequired
                ? "We need a bit more information from you before we can move forward with your project."
                : 'Thanks for sharing your project details. Our team is reviewing your information and will create your project shortly.'}
            </p>

            <section className="block">
              <div className="status-card">
                <div className="status-top">
                  <span className="status-title">{hasActionRequired ? 'We need a little more information' : 'Your information has been received'}</span>
                  <span className={`status-badge ${hasActionRequired ? 'b-action' : 'b-review'}`}>
                    <span className="dot"></span>
                    {hasActionRequired ? 'Action Required' : 'Under Review'}
                  </span>
                </div>
                <p className="status-desc">
                  {hasActionRequired
                    ? 'Our team needs some additional information before your project can be created.'
                    : "Our team has received your information, project requirements and uploaded files. We're currently reviewing everything before creating your official project."}
                </p>
                <div className="checklist-row">
                  {checklist.map((c) => (
                    <span className="checklist-item" key={c.label} style={{ opacity: c.done ? 1 : 0.5 }}>
                      <span className="checklist-check">{c.done ? <Icon name="check" size={10} /> : ''}</span>
                      {c.label}
                    </span>
                  ))}
                </div>

                {hasActionRequired && (
                  <div className="admin-request-box show">
                    <div className="admin-request-label">Message from FLOW 53</div>
                    <div className="admin-request-text">&quot;{client.admin_request}&quot;</div>
                  </div>
                )}

                {hasActionRequired && (
                  <div className="status-action-row show">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                      Provide Information
                    </a>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                      Send a Message
                    </a>
                  </div>
                )}
              </div>
            </section>

            <section className="block">
              <div className="lifecycle-card">
                <div className="lc-label">Your Progress</div>
                <div className="lc-row">
                  <div className="lc-step done">
                    <div className="lc-line"></div>
                    <div className="lc-dot">✓</div>
                    <div className="lc-step-label">Account</div>
                  </div>
                  <div className="lc-step done">
                    <div className="lc-line"></div>
                    <div className="lc-dot">✓</div>
                    <div className="lc-step-label">Information</div>
                  </div>
                  <div className="lc-step done">
                    <div className="lc-line"></div>
                    <div className="lc-dot">✓</div>
                    <div className="lc-step-label">Requirements</div>
                  </div>
                  <div className="lc-step current">
                    <div className="lc-line"></div>
                    <div className="lc-dot">●</div>
                    <div className="lc-step-label">Agency Review</div>
                  </div>
                  <div className="lc-step">
                    <div className="lc-dot">○</div>
                    <div className="lc-step-label">Project Creation</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="block">
              <div className="project-empty-card">
                <span className={`pe-badge${hasActionRequired ? ' pe-badge-action' : ''}`}>
                  <span className="dot"></span>
                  {hasActionRequired ? 'Action Required' : 'Waiting for Agency Review'}
                </span>
                <div className="pe-icon-wrap">
                  <Icon name="grid" size={26} />
                </div>
                <div className="pe-title">Your project is being prepared</div>
                <p className="pe-desc">Our team is reviewing your requirements. Once your project is created, it will automatically appear here.</p>

                <div className="whats-next">
                  <div className="whats-next-title">What&apos;s next?</div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">1</span>Our team reviews your requirements.
                  </div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">2</span>We create your official project.
                  </div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">3</span>Your project dashboard becomes available.
                  </div>
                  <div className="whats-next-item">
                    <span className="whats-next-num">4</span>You can review the SOW and next project steps.
                  </div>
                </div>

                <div className="pe-actions">
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                    Send a Message
                  </a>
                  <button type="button" className="btn btn-ghost" onClick={() => setUploadOpen((v) => !v)}>
                    Upload Additional Files
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setReviewOpen((v) => !v)}>
                    Review Submitted Information
                  </button>
                </div>
              </div>
            </section>

            {uploadOpen && (
              <section className="block">
                <div className="summary-card">
                  <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => fileInputRef.current?.click()}>
                    + Choose Files
                  </button>
                  {files.length > 0 && (
                    <div className="ob-file-list" style={{ marginTop: 14 }}>
                      {files.map((f) => (
                        <div className="ob-file-row" key={f.key}>
                          <div className="ob-file-info">
                            <span className="ob-file-name">{f.file.name}</span>
                            <span className="ob-file-meta">{formatBytes(f.file.size)}</span>
                          </div>
                          {f.status === 'uploading' && (
                            <div className="ob-file-progress">
                              <div className="ob-file-progress-bar" style={{ width: `${f.progress}%` }} />
                            </div>
                          )}
                          {f.status === 'done' && <span className="cp-badge cp-badge-success">Uploaded</span>}
                          {f.status === 'error' && (
                            <span className="cp-badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                              {f.error ?? 'Failed'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {savedCount > 0 && (
                    <p className="cp-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                      {savedCount} file(s) shared with your project.
                    </p>
                  )}
                </div>
              </section>
            )}

            {reviewOpen && (
              <section className="block">
                <div className="summary-card">
                  {[
                    ['Project Description', requirements.project_description],
                    ['Goals', requirements.goals],
                    ['Target Audience', requirements.target_audience],
                    ['Required Features', requirements.required_features],
                    ['Timeline', requirements.expected_timeline],
                    ['Budget', requirements.budget_range],
                    ['References', requirements.reference_notes],
                  ].map(([label, value]) => (
                    <div className="summary-row" key={label} style={{ alignItems: 'flex-start' }}>
                      <span>{label}</span>
                      <span style={{ textAlign: 'right', fontWeight: 500, maxWidth: '65%' }}>{value || '—'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="block content-2col">
              <div>
                <div className="section-title">Submitted Information</div>
                <div className="summary-card">
                  <div className="summary-row">
                    <span>Client</span>
                    <span>{client.primary_contact ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span>Company</span>
                    <span>{client.company_name}</span>
                  </div>
                  <div className="summary-row">
                    <span>Requested Project</span>
                    <span>{requirements.project_name ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span>Project Type</span>
                    <span>{requirements.project_type ?? '—'}</span>
                  </div>
                  <div className="summary-row">
                    <span>Submitted</span>
                    <span>{formatBnDateLong(requirements.created_at)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Files</span>
                    <span>{filesCount} file{filesCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="section-title">Recent Activity</div>
                <div className="activity-card">
                  {activity.length === 0 ? (
                    <p className="empty-inline">No activity yet.</p>
                  ) : (
                    activity.map((a, i) => (
                      <div className="timeline-item" key={a.id}>
                        <div className="timeline-dot-wrap">
                          <div className="timeline-dot">
                            <Icon name="check" size={9} />
                          </div>
                          {i < activity.length - 1 && <div className="timeline-line"></div>}
                        </div>
                        <div>
                          <div className="timeline-text">{a.detail ?? a.action}</div>
                          <div className="timeline-time">{relativeTimeBn(a.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="block">
              <div className="support-card">
                <div>
                  <div className="support-title">Need help?</div>
                  <div className="support-desc">If you&apos;d like to add more information or have a question while your project is being reviewed, contact our team.</div>
                </div>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  Contact Support
                </a>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
