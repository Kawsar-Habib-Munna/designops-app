'use client';

// Screen 10/11 — Statement of Work, ক্লায়েন্ট সাইড (v2, মকআপ অনুযায়ী একটাই
// পাতায় একত্রিত): পুরো ডকুমেন্ট + নিচে সাইন প্যানেল (typed name + single agree
// checkbox + Sign & Accept), আলাদা কোনো /sow/sign সাব-রুট নেই। "Request
// Changes" বিদ্যমান client_feedback টেবিল রিইউজ করে (নতুন কোনো টেবিল লাগেনি)।
//
// sign_sow() RPC-কে এখনো real version-mismatch protection সহ কল করা হয় (client
// যে ভার্সন দেখেছে ঠিক সেটাই সাইন হচ্ছে কিনা) — এটা ইনভিজিবল সিকিউরিটি, UI
// সরলীকরণের সাথে সাংঘর্ষিক না। Draft SOW RLS-এই ফিল্টার হয়ে যায় (ফেজ ১১),
// Sent→Viewed ট্র্যাকিং real (mark_sow_viewed RPC)।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './sow.css';

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
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

function parseBulletList(text: string | null): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .filter((l) => l.trim().startsWith('•'))
    .map((l) => l.replace(/^•\s*/, '').trim());
}

export default function ClientSowPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sow, setSow] = useState<Sow | null>(null);

  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);
  const [needsLatestVersion, setNeedsLatestVersion] = useState(false);

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
        setFullName(own.primary_contact ?? '');

        const { data: sowData } = await supabase.from('sows').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
        const sowRow = (sowData as Sow) ?? null;
        setSow(sowRow);

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
  }, [router, projectId]);

  async function handleSign() {
    if (!sow || !client || !fullName.trim() || !agreed) return;
    setSigning(true);
    setSignError(null);

    const { error } = await supabase.rpc('sign_sow', {
      p_sow_id: sow.id,
      p_full_name: fullName.trim(),
      p_signature: fullName.trim(),
      p_signature_method: 'typed',
      p_signature_image_url: null,
      p_confirmation_statements: `I, ${fullName.trim()}, have reviewed this Statement of Work and agree to its scope, timeline, and payment terms on behalf of ${client.company_name}.`,
      p_expected_version: sow.version,
    });

    if (error) {
      setSigning(false);
      if (error.message.includes('VERSION_MISMATCH')) {
        setNeedsLatestVersion(true);
        return;
      }
      setSignError(error.message);
      return;
    }

    if (project) {
      await supabase.from('activity_log').insert({
        actor_id: null,
        action: 'sow_signed',
        entity_type: 'client',
        entity_id: client.id,
        detail: `${fullName.trim()} SOW ${sow.sow_number ?? `v${sow.version}`} সাইন করেছেন`,
      });
    }

    setJustSigned(true);
    setSigning(false);
    setSow((prev) => (prev ? { ...prev, status: 'signed', signed_at: new Date().toISOString(), signed_by_name: fullName.trim() } : prev));
  }

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

  if (loading) {
    return (
      <div className="client-portal client-sow-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-shell">
          <div className="sw-state-card">
            <div className="sw-state-title">Unable to load Statement of Work</div>
            <p className="sw-state-sub">We couldn&apos;t retrieve this document right now.</p>
            <div className="sw-state-actions">
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

  if (!sow) {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-shell">
          <Link href={`/client/project/${project.id}`} className="sw-back">
            ← {project.name}
          </Link>
          <div className="sw-state-card">
            <div className="sw-state-title">Statement of Work is being prepared</div>
            <p className="sw-state-sub">Our team is currently preparing your project agreement.</p>
          </div>
        </div>
      </div>
    );
  }

  if (needsLatestVersion) {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-shell">
          <div className="sw-state-card">
            <div className="sw-state-title">This Statement of Work has been updated</div>
            <p className="sw-state-sub">A newer version is available. Please review the latest version before signing.</p>
            <div className="sw-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                View Latest Version
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'cancelled') {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-shell">
          <Link href={`/client/project/${project.id}`} className="sw-back">
            ← {project.name}
          </Link>
          <div className="sw-state-card">
            <div className="sw-state-title">SOW Cancelled</div>
            <p className="sw-state-sub">This Statement of Work is no longer active.</p>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'superseded') {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-shell">
          <Link href={`/client/project/${project.id}`} className="sw-back">
            ← {project.name}
          </Link>
          <div className="sw-state-card">
            <div className="sw-state-title">A newer version is available</div>
            <p className="sw-state-sub">This version has been replaced by a newer Statement of Work.</p>
            <div className="sw-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                View Latest Version
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = sow.status === 'sent' && !!sow.valid_until && sow.valid_until < todayISO();
  if (isExpired) {
    return (
      <div className="client-portal client-sow-root">
        <div className="sw-shell">
          <Link href={`/client/project/${project.id}`} className="sw-back">
            ← {project.name}
          </Link>
          <div className="sw-state-card">
            <div className="sw-state-title">This Statement of Work has expired</div>
            <p className="sw-state-sub">The signing period for this document has ended.</p>
            <div className="sw-state-actions">
              <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, my SOW for ${project.name} has expired — could you resend it?`)}`} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-primary">
                Contact Project Manager
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const services = parseBulletList(sow.scope);
  const milestones = parseBulletList(sow.timeline);
  const isSigned = sow.status === 'signed';
  const sym = CURRENCY_SYMBOL[sow.currency ?? 'BDT'] ?? sow.currency ?? '';

  const manager = toOne(project.project_manager);

  return (
    <div className="client-portal client-sow-root">
      <div className="sw-shell">
        <Link href={`/client/project/${project.id}`} className="sw-back">
          ← {project.name}
        </Link>

        <div className="page-header-row">
          <div>
            <h1 className="sw-title">Statement of Work</h1>
            <p className="sw-page-sub">{isSigned ? 'This agreement has been signed.' : 'Please review and sign to begin your project.'}</p>
          </div>
          <div className="sw-header-actions">
            <span className={`cp-badge ${isSigned ? 'cp-badge-success' : 'cp-badge-pending'}`}>{isSigned ? 'Signed ✓' : 'Awaiting Your Signature'}</span>
            {isSigned && (
              <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={() => window.print()}>
                Download Signed PDF
              </button>
            )}
          </div>
        </div>

        {justSigned && (
          <div className="sw-just-signed-banner">✓ SOW signed successfully — FLOW53 has been notified. Your signature now appears below.</div>
        )}

        <div className="doc-card">
          <div className="doc-letterhead">FLOW 53</div>
          <div className="doc-letterhead-sub">Product Design Studio · Dhaka, Bangladesh</div>
          <div className="doc-title">STATEMENT OF WORK</div>
          <div className="doc-subtitle">
            {project.name} — {client.company_name}
          </div>

          <div className="doc-h2">1. Parties</div>
          <p className="doc-field-line">
            <b>Service Provider:</b> FLOW 53 Design Studio
          </p>
          <p className="doc-field-line">
            <b>Client:</b> {client.primary_contact}, {client.company_name}
          </p>
          {sow.sow_number && (
            <p className="doc-field-line">
              <b>SOW:</b> {sow.sow_number} · v{sow.version}.0
            </p>
          )}

          <div className="doc-h2">2. Scope of Work</div>
          {sow.objectives && <p className="doc-p">{sow.objectives}</p>}
          {services.length > 0 && (
            <ul className="doc-list">
              {services.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}

          <div className="doc-h2">3. Timeline</div>
          {milestones.length > 0 && (
            <ul className="doc-list">
              {milestones.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {(sow.start_date || sow.delivery_date) && (
            <p className="doc-p">
              {sow.start_date && `Start: ${formatBnDateLong(sow.start_date)}`}
              {sow.start_date && sow.delivery_date && ' · '}
              {sow.delivery_date && `Expected Delivery: ${formatBnDateLong(sow.delivery_date)}`}
            </p>
          )}

          <div className="doc-h2">4. Payment Terms</div>
          {sow.project_value && (
            <p className="doc-p">
              Total project value: {sym}
              {sow.project_value.toLocaleString('en-US')}.
            </p>
          )}
          {sow.payment_terms && <p className="doc-p">{sow.payment_terms.replace(/^Total project value:.*?\.\s*/, '')}</p>}
          {sow.revision_policy && <p className="doc-p">{sow.revision_policy}</p>}

          <div className="doc-h2">5. Terms &amp; Conditions</div>
          {sow.terms && <p className="doc-p" style={{ whiteSpace: 'pre-wrap' }}>{sow.terms}</p>}

          {sow.document_url && (
            <a href={sow.document_url} target="_blank" rel="noopener noreferrer" className="sw-doc-link">
              📄 View attached document ↗
            </a>
          )}

          <div className="doc-h2">Agreement &amp; Signatures</div>
          <div className="sig-block-grid">
            <div className="sig-block">
              <div className="sig-block-label">Client</div>
              <div className="sig-block-name">{client.primary_contact}</div>
              <div className="sig-block-sub">{client.company_name}</div>
              {isSigned ? (
                <>
                  <div className="sig-block-typed">{sow.signed_by_name}</div>
                  <div className="sig-block-caption">Typed Signature</div>
                  <div className="sig-block-meta">Signed on {sow.signed_at ? formatBnDateLong(sow.signed_at) : ''}</div>
                </>
              ) : (
                <div className="sig-block-pending">Awaiting Signature</div>
              )}
            </div>
            <div className="sig-block">
              <div className="sig-block-label">Agency</div>
              <div className="sig-block-name">{manager?.full_name ?? 'FLOW 53'}</div>
              <div className="sig-block-sub">{manager?.role ?? 'Project Manager'} · FLOW 53</div>
              <div className="sig-block-confirmed">Confirmed</div>
            </div>
          </div>
          {isSigned && (
            <p className="sig-version-line">
              SOW Version: v{sow.version}.0 · Status: Signed ✓
            </p>
          )}
        </div>

        {!isSigned && (
          <div className="sign-panel">
            <div className="sign-panel-title">Sign this Statement of Work</div>

            {signError && <div className="cp-alert cp-alert-error">{signError}</div>}

            <div className="cp-field">
              <label className="cp-label">Type your full name to sign</label>
              <input className="cp-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={client.primary_contact ?? 'Your full name'} />
              <div className="sw-sig-preview">{fullName}</div>
            </div>

            <label className={`agree-row${agreed ? ' agreed' : ''}`}>
              <span className={`agree-check${agreed ? ' checked' : ''}`} onClick={() => setAgreed((v) => !v)}>
                {agreed ? '✓' : ''}
              </span>
              <span className="agree-label">
                I, {fullName || '____________'}, have reviewed this Statement of Work and agree to its scope, timeline, and payment terms on behalf of {client.company_name}.
              </span>
            </label>

            <div className="sign-actions">
              <button type="button" className="cp-btn cp-btn-primary" disabled={!fullName.trim() || !agreed || signing} onClick={handleSign}>
                {signing && <span className="cp-spinner" />}
                {signing ? 'Signing…' : 'Sign & Accept'}
              </button>
              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setShowRequestChanges((v) => !v)}>
                Request Changes
              </button>
            </div>

            {showRequestChanges && (
              <div className="request-changes-box">
                {changesSubmitted ? (
                  <p className="sw-changes-sent">Thanks — your feedback has been sent to FLOW53.</p>
                ) : (
                  <>
                    <textarea className="cp-input" rows={3} value={changesText} onChange={(e) => setChangesText(e.target.value)} placeholder="Let FLOW53 know what you'd like changed..." style={{ resize: 'vertical' }} />
                    <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" style={{ marginTop: 8 }} disabled={!changesText.trim() || submittingChanges} onClick={handleSubmitChanges}>
                      {submittingChanges ? 'পাঠানো হচ্ছে…' : 'Submit Feedback'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
