'use client';

// SOW Version History — ক্লায়েন্ট সাইড, নতুন পাতা। sows টেবিলে প্রতিটা ভার্সন
// আলাদা row (project_id, version) — এখানে সেগুলোই real timeline হিসেবে দেখানো
// হচ্ছে, কোনো নতুন schema/RLS লাগেনি (client can read own project sows পলিসি
// আগে থেকেই status != 'draft' সব ভার্সন রিটার্ন করে, শুধু latest না)। প্রতিটা
// ভার্সনের "View" লিঙ্ক ../sow?v=N -এ যায়, যেটা Screen 10-এ viewVersion সাপোর্ট
// দিয়ে সেই নির্দিষ্ট ভার্সনের পুরো ডকুমেন্ট read-only দেখায়।

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong } from '@/lib/format';
import '../../../../client-shared.css';
import '../sow.css';
import './history.css';

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
  check: '<path d="M20 6 9 17l-5-5"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ProjectBrief = { id: string; name: string; client_id: string };
type SowVersion = {
  id: string;
  version: number;
  sow_number: string | null;
  status: string;
  project_value: number | null;
  currency: string | null;
  created_at: string;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signature_method: string | null;
};

const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  signed: { label: 'Signed', cls: 'hv-signed' },
  sent: { label: 'Awaiting Signature', cls: 'hv-sent' },
  superseded: { label: 'Superseded', cls: 'hv-superseded' },
  cancelled: { label: 'Cancelled', cls: 'hv-cancelled' },
};

function HistoryShell({
  project,
  client,
  mobileNavOpen,
  setMobileNavOpen,
  onSignOut,
  children,
}: {
  project: { id: string; name: string };
  client: ClientRecord;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
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
            <Link href={`/client/project/${project.id}/files`} className="nav-item">
              <Icon name="file" /> Files
            </Link>
            <Link href={`/client/project/${project.id}/sow`} className="nav-item active">
              <Icon name="doc" /> SOW
            </Link>
            <Link href={`/client/project/${project.id}/payments`} className="nav-item">
              <Icon name="card" /> Payments
            </Link>
          </nav>
        </div>
        <button type="button" className="profile-card" onClick={onSignOut} title="Sign out">
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
          <span className="topbar-title">Version History</span>
        </header>

        <main className="content">
          <div className="breadcrumb">
            <Link href="/client/dashboard">Client Portal</Link> / <Link href={`/client/project/${project.id}`}>{project.name}</Link> /{' '}
            <Link href={`/client/project/${project.id}/sow`}>Statement of Work</Link> / Version History
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function SowHistoryPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [versions, setVersions] = useState<SowVersion[]>([]);

  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const { data: projectData } = await supabase.from('projects').select('id, name, client_id').eq('id', projectId).maybeSingle();
        if (!projectData || (projectData as ProjectBrief).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(projectData as ProjectBrief);
        setClient(own);

        const { data: versionData } = await supabase
          .from('sows')
          .select('id, version, sow_number, status, project_value, currency, created_at, sent_at, signed_at, signed_by_name, signature_method')
          .eq('project_id', projectId)
          .order('version', { ascending: false });
        setVersions((versionData as SowVersion[]) ?? []);

        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    load();
  }, [router, projectId]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  if (loading) {
    return (
      <div className="client-portal client-sow-root">
        <div className="shell">
          <aside className="sidebar">
            <div style={{ height: 30 }} />
          </aside>
          <div className="main">
            <main className="content">
              <div className="skel" style={{ height: 60, marginBottom: 18 }} />
              <div className="skel" style={{ height: 320, marginBottom: 18 }} />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-bare-shell">
          <div className="sw-state-card">
            <div className="sw-state-title">Unable to load version history</div>
            <p className="sw-state-sub">We couldn&apos;t retrieve this document right now.</p>
            <div className="sw-state-actions">
              <button type="button" className="btn btn-accent" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}/sow`} className="btn btn-ghost">
                Back to SOW
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const latestVersion = versions.length > 0 ? versions[0].version : null;

  return (
    <div className="client-portal client-sow-root">
      <HistoryShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="sw-doc-wrap">
          <div className="ph-row block">
            <div>
              <h1 className="ph-title">Version History</h1>
              <div className="ph-company">{project.name} — every version of your Statement of Work</div>
            </div>
          </div>

          {versions.length === 0 ? (
            <div className="sw-state-card">
              <div className="sw-state-title">No versions yet</div>
              <p className="sw-state-sub">Once a Statement of Work is sent to you, it will appear here.</p>
            </div>
          ) : (
            <div className="hv-timeline">
              {versions.map((v) => {
                const meta = STATUS_META[v.status] ?? { label: v.status, cls: 'hv-other' };
                const sym = CURRENCY_SYMBOL[v.currency ?? 'BDT'] ?? v.currency ?? '';
                const isLatest = v.version === latestVersion;
                const dateLabel = v.signed_at ?? v.sent_at ?? v.created_at;
                return (
                  <div key={v.id} className={`hv-item ${meta.cls}`}>
                    <div className="hv-dot">{v.status === 'signed' && <Icon name="check" size={11} />}</div>
                    <div className="hv-card">
                      <div className="hv-card-top">
                        <div className="hv-card-title">
                          v{v.version}.0{v.sow_number ? ` · ${v.sow_number}` : ''}
                          {isLatest && <span className="hv-current-tag">Current</span>}
                        </div>
                        <span className={`hv-status-pill ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="hv-card-meta">
                        {dateLabel && formatBnDateLong(dateLabel)}
                        {v.project_value != null && ` · ${sym}${v.project_value.toLocaleString('en-US')}`}
                      </div>
                      {v.status === 'signed' && v.signed_by_name && (
                        <div className="hv-card-signed">
                          Signed by {v.signed_by_name}
                          {v.signature_method ? ` · ${v.signature_method === 'drawn' ? 'Drawn' : v.signature_method === 'uploaded' ? 'Uploaded' : 'Typed'} signature` : ''}
                        </div>
                      )}
                      <Link href={`/client/project/${project.id}/sow${isLatest ? '' : `?v=${v.version}`}`} className="hv-view-link">
                        View Document →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </HistoryShell>
    </div>
  );
}
