'use client';

// Screen 10 — Statement of Work, ক্লায়েন্ট সাইড। v3: Screen 9-এর (Client Project
// Dashboard) সাথে হুবহু একই sidebar/topbar app-shell (mobile drawer সহ) — আগে এই
// পাতা একটা bare "back link + centered content" লেআউট ব্যবহার করত (Files/Messages-
// এর মতো), যেটা প্রজেক্ট সেকশনের বাকি পাতাগুলোর সাথে বিচ্ছিন্ন লাগত। এখন নেভিগেশন
// শেল একই, ডকুমেন্ট নিজেও visually polish করা হলো (Parties key-value গ্রিড,
// হাইলাইটেড Payment Value card, নাম্বারড section badges)।
//
// সাইন করা হলে Agreement & Signatures ব্লকে আসল সিগনেচার (typed/drawn/uploaded)
// দেখায়। সাইন করার আসল ফ্লো আলাদা ডেডিকেটেড রুটে (./sign — Screen 11) — এখানে শুধু
// "Review & Sign" CTA যেটা ওখানে নিয়ে যায়। "Request Changes" বিদ্যমান
// client_feedback টেবিল রিইউজ করে। Draft SOW RLS-এই ফিল্টার হয়ে যায় (ফেজ ১১),
// Sent→Viewed ট্র্যাকিং real (mark_sow_viewed RPC, Screen 11 পাতাতেও একই কল হয়)।
//
// v4: ./history (Version History) পাতা থেকে ?v=N দিয়ে নির্দিষ্ট পুরনো ভার্সন
// read-only দেখানোর সাপোর্ট — RLS আগে থেকেই সব non-draft ভার্সন রিটার্ন করত
// (শুধু latest না), তাই নতুন কোনো schema/RLS ছাড়াই এই ফিচার সম্ভব হলো।
//
// v5: Agency sig-block আগে হার্ডকোডেড "Confirmed" ব্যাজ দেখাত (sent হলেই,
// কোনো real action ছাড়াই) — এখন admin পেজ থেকে real "Sign as Agency" একশন
// (Type/Draw/Upload, ফেজ ১৮) থেকে সেভ হওয়া আসল ডেটা দেখায়।
//
// v6: Documents & Attachments (SOW-11) — আগে sows.document_url-এ একটাই MSA
// ফাইল থাকতে পারত। এখন নতুন sow_documents টেবিল (ফেজ ১৯) থেকে একাধিক real
// Drive ফাইল দেখায় (admin পেজ থেকে আপলোড হয়), document_url আলাদাভাবে থেকে যায়।
//
// v7: Sticky-free "Jump to section" TOC (SOW-03) — বিদ্যমান single-scroll
// ডকুমেন্ট লেআউট অক্ষত রেখে (কোনো screenshot/মকআপ ছাড়া বড় tabbed রিডিজাইন করা
// রিস্কি), শুধু anchor-link pill nav যোগ হলো যা প্রতিটা #sec-* সেকশনে জাম্প করে।

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './sow.css';
import SowDocument from '@/app/components/SowDocument';

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
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ProjectBrief = {
  id: string;
  name: string;
  client_id: string;
  project_manager: { full_name: string; role: string | null } | { full_name: string; role: string | null }[] | null;
};
type Sow = {
  id: string;
  version: number;
  sow_number: string | null;
  status: string;
  valid_until: string | null;
  start_date: string | null;
  delivery_date: string | null;
  project_value: number | null;
  currency: string | null;
  scope: string | null;
  objectives: string | null;
  timeline: string | null;
  payment_terms: string | null;
  revision_policy: string | null;
  terms: string | null;
  document_url: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signature_method: string | null;
  signature_image_url: string | null;
  agency_signed_at: string | null;
  agency_signer_name: string | null;
  agency_signature_method: string | null;
  agency_signature_image_url: string | null;
};

type SowAttachmentRow = { id: string; file_name: string; file_url: string; file_size: number | null };

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

// ---- shared sidebar/topbar shell (identical structure to Screen 9) ----
function SowShell({
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
          <div className="cp-brand cp-brand-sidebar">
            <span className="cp-brand-art">
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
          <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <span className="topbar-title">Statement of Work</span>
        </header>

        <header className="page-topbar">
          <div className="breadcrumb">
            <Link href="/client/dashboard">Client Portal</Link> / <Link href={`/client/project/${project.id}`}>{project.name}</Link> / Statement of Work
          </div>
          <a
            className="page-help-link"
            href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I need help with the Statement of Work for ${project.name}.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="help" size={13} /> Need help?
          </a>
        </header>

        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ClientSowPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSigned = searchParams.get('signed') === '1';
  const viewVersionParam = searchParams.get('v');
  const viewVersion = viewVersionParam ? Number(viewVersionParam) : null;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sow, setSow] = useState<Sow | null>(null);
  const [documents, setDocuments] = useState<SowAttachmentRow[]>([]);

  const [signError, setSignError] = useState<string | null>(null);

  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [changesText, setChangesText] = useState('');
  const [submittingChanges, setSubmittingChanges] = useState(false);
  const [changesSubmitted, setChangesSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const { data: projectData } = await supabase.from('projects').select('id, name, client_id, project_manager:profiles!project_manager_id(full_name, role)').eq('id', projectId).maybeSingle();
        if (!projectData || (projectData as ProjectBrief).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(projectData as ProjectBrief);
        setClient(own);

        const sowQuery = supabase.from('sows').select('*').eq('project_id', projectId);
        const { data: sowData } = viewVersion
          ? await sowQuery.eq('version', viewVersion).maybeSingle()
          : await sowQuery.order('version', { ascending: false }).limit(1).maybeSingle();
        const sowRow = (sowData as Sow) ?? null;
        setSow(sowRow);

        if (sowRow) {
          const { data: docsData } = await supabase.from('sow_documents').select('id, file_name, file_url, file_size').eq('sow_id', sowRow.id).order('uploaded_at', { ascending: false });
          setDocuments((docsData as SowAttachmentRow[]) ?? []);
        }

        if (sowRow && sowRow.status === 'sent' && !(sowRow as unknown as { viewed_at: string | null }).viewed_at) {
          await supabase.rpc('mark_sow_viewed', { p_sow_id: sowRow.id });
        }

        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    load();
  }, [router, projectId, viewVersion]);

  async function handleSubmitChanges() {
    if (!client || !project || !changesText.trim()) return;
    setSubmittingChanges(true);
    const { error } = await supabase.from('client_feedback').insert({
      project_id: project.id,
      client_id: client.id,
      title: 'SOW Change Request',
      description: changesText.trim(),
    });
    setSubmittingChanges(false);
    if (error) {
      setSignError(error.message);
      return;
    }
    setChangesSubmitted(true);
    setChangesText('');
  }

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
              <div className="skel" style={{ height: 480, marginBottom: 18 }} />
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
            <div className="sw-state-title">Unable to load Statement of Work</div>
            <p className="sw-state-sub">We couldn&apos;t retrieve this document right now.</p>
            <div className="sw-state-actions">
              <button type="button" className="btn btn-accent" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}`} className="btn btn-ghost">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- guard states (project loaded fine — keep the sidebar for navigation) ----
  if (!sow) {
    return (
      <div className="client-portal client-sow-root">
        <SowShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
          <div className="sw-state-card">
            <div className="sw-state-title">{viewVersion ? `Version v${viewVersion} not found` : 'Statement of Work is being prepared'}</div>
            <p className="sw-state-sub">{viewVersion ? 'This version does not exist or is not available to view.' : 'Our team is currently preparing your project agreement.'}</p>
            {viewVersion && (
              <div className="sw-state-actions">
                <Link href={`/client/project/${projectId}/sow`} className="btn btn-accent">
                  View Latest Version
                </Link>
              </div>
            )}
          </div>
        </SowShell>
      </div>
    );
  }

  if (sow.status === 'cancelled') {
    return (
      <div className="client-portal client-sow-root">
        <SowShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
          <div className="sw-state-card">
            <div className="sw-state-title">SOW Cancelled</div>
            <p className="sw-state-sub">This Statement of Work is no longer active.</p>
          </div>
        </SowShell>
      </div>
    );
  }

  if (sow.status === 'superseded' && !viewVersion) {
    return (
      <div className="client-portal client-sow-root">
        <SowShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
          <div className="sw-state-card">
            <div className="sw-state-title">A newer version is available</div>
            <p className="sw-state-sub">This version has been replaced by a newer Statement of Work.</p>
            <div className="sw-state-actions">
              <button type="button" className="btn btn-accent" onClick={() => window.location.reload()}>
                View Latest Version
              </button>
            </div>
          </div>
        </SowShell>
      </div>
    );
  }

  const isExpired = sow.status === 'sent' && !!sow.valid_until && sow.valid_until < todayISO();
  if (isExpired) {
    return (
      <div className="client-portal client-sow-root">
        <SowShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
          <div className="sw-state-card">
            <div className="sw-state-title">This Statement of Work has expired</div>
            <p className="sw-state-sub">The signing period for this document has ended.</p>
            <div className="sw-state-actions">
              <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, my SOW for ${project.name} has expired — could you resend it?`)}`} target="_blank" rel="noopener noreferrer" className="btn btn-accent">
                Contact Project Manager
              </a>
            </div>
          </div>
        </SowShell>
      </div>
    );
  }

  const isSigned = sow.status === 'signed';

  const manager = toOne(project.project_manager);

  return (
    <div className="client-portal client-sow-root">
      <SowShell project={project} client={client} mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} onSignOut={handleSignOut}>
        <div className="sw-doc-wrap">
          <div className="ph-row block">
            <div>
              <div className="ph-title-row">
                <h1 className="ph-title">Statement of Work</h1>
                <span className={`status-badge ${isSigned ? 'b-done' : 'b-hold'}`}>
                  <span className="dot"></span>
                  {isSigned ? 'Signed ✓' : 'Awaiting Your Signature'}
                </span>
              </div>
              <div className="ph-company">
                {sow.sow_number ?? `v${sow.version}`} · {project.name} ·{' '}
                <Link href={`/client/project/${project.id}/sow/history`} className="sw-history-link">
                  Version History
                </Link>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              <Icon name="download" size={13} /> {isSigned ? 'Download Signed PDF' : 'Download PDF'}
            </button>
          </div>
          <p className="welcome-sub">{isSigned ? 'This agreement has been signed.' : 'Please review and sign to begin your project.'}</p>

          {viewVersion && (
            <div className="sw-history-banner">
              You&apos;re viewing v{sow.version} — a previous version of this document.{' '}
              <Link href={`/client/project/${project.id}/sow`}>View the latest version →</Link>
            </div>
          )}

          {justSigned && <div className="sw-just-signed-banner">✓ SOW signed successfully — your signature now appears below.</div>}

          <div className="sw-layout">
          <div className="sw-main">
          <SowDocument
            sow={sow}
            clientContact={client.primary_contact}
            companyName={client.company_name}
            projectName={project.name}
            manager={manager}
            attachments={documents}
          />
          </div>

          <aside className="sw-sidebar">
            <div className="sw-review-card">
              <div className="sw-review-title">Review your agreement</div>
              <span className={`status-badge ${isSigned ? 'b-done' : 'b-hold'}`}>
                <span className="dot"></span>
                {isSigned ? 'Signed ✓' : 'Awaiting your signature'}
              </span>
              <p className="sw-review-desc">
                {isSigned ? 'This agreement has been signed. A copy is available below for your records.' : 'Review the scope, timeline and terms before signing.'}
              </p>

              <div className="sw-review-meta">
                <div className="sw-review-meta-row">
                  <span>Reference</span>
                  <span>{sow.sow_number ?? `v${sow.version}`}</span>
                </div>
                <div className="sw-review-meta-row">
                  <span>Version</span>
                  <span>{sow.version}.0</span>
                </div>
              </div>

              {!viewVersion && !isSigned && sow.status === 'sent' && (
                <>
                  {signError && <div className="cp-alert cp-alert-error">{signError}</div>}
                  <Link href={`/client/project/${project.id}/sow/sign?from=sow`} className="btn btn-accent sw-review-btn">
                    Review &amp; Sign →
                  </Link>
                  <button type="button" className="btn btn-ghost sw-review-btn" onClick={() => setShowRequestChanges((v) => !v)}>
                    Request Changes
                  </button>

                  {showRequestChanges && (
                    <div className="request-changes-box">
                      {changesSubmitted ? (
                        <p className="sw-changes-sent">Thanks — your feedback has been sent to FLOW53.</p>
                      ) : (
                        <>
                          <textarea className="cp-input" rows={3} value={changesText} onChange={(e) => setChangesText(e.target.value)} placeholder="Let FLOW53 know what you'd like changed..." style={{ resize: 'vertical' }} />
                          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={!changesText.trim() || submittingChanges} onClick={handleSubmitChanges}>
                            {submittingChanges ? 'Sending…' : 'Submit Feedback'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              <hr className="sw-review-hr" />
              <button type="button" className="sw-review-download" onClick={() => window.print()}>
                <Icon name="download" size={13} /> You can download a copy for your records.
              </button>
            </div>
          </aside>
          </div>
        </div>
      </SowShell>
    </div>
  );
}
