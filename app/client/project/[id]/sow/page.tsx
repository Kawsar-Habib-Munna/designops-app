'use client';

// Screen 10 — Statement of Work, ক্লায়েন্ট সাইড। রিডিজাইন: এখন এটা একটা
// read-only, sectioned ডকুমেন্ট ভিউ (14টা সেকশন, sticky TOC ডেস্কটপে, dropdown
// মোবাইলে) — সাইন করার UI এখানে নেই। "Review & Sign" বাটন
// /client/project/[id]/sow/sign-এ নিয়ে যায় (Screen 11-এর জায়গা, যেটা এখনো
// আলাদাভাবে তৈরি হয়নি — শুধু বিদ্যমান sign_sow() ফ্লো relocate করা হয়েছে যাতে
// এই বাটন কখনো dead link না হয়)।
//
// RLS-ই draft SOW client-এর কাছ থেকে আটকায় (ফেজ ১১), তাই এখানে আলাদা করে
// draft-hide করার কোনো কোড লাগেনি — sow===null মানে হয় SOW তৈরিই হয়নি অথবা
// এখনো draft। Sent→Viewed ট্রানজিশন real (mark_sow_viewed RPC, sign_sow-এর
// মতোই security-definer)। Expired real হিসেব করা হয় (valid_until পার হয়ে
// গেছে কিনা), fake স্ট্যাটাস স্টোর করা হয়নি।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../client-shared.css';
import './sow.css';

type ProjectBrief = { id: string; name: string; client_id: string; description: string | null; category: string | null; start_date: string | null; due_date: string | null; project_manager: { full_name: string } | { full_name: string }[] | null };
type Sow = {
  id: string;
  version: number;
  sow_number: string | null;
  valid_until: string | null;
  project_value: number | null;
  currency: string | null;
  payment_structure: string | null;
  scope: string | null;
  objectives: string | null;
  deliverables: string | null;
  timeline: string | null;
  payment_terms: string | null;
  revision_policy: string | null;
  client_responsibilities: string | null;
  agency_responsibilities: string | null;
  communication_terms: string | null;
  terms: string | null;
  document_url: string | null;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
};
type Milestone = { id: string; title: string; description: string | null; due_date: string | null; completed_at: string | null };

const SECTIONS: { id: string; num: string; label: string }[] = [
  { id: 'overview', num: '01', label: 'Project Overview' },
  { id: 'objectives', num: '02', label: 'Objectives' },
  { id: 'scope', num: '03', label: 'Scope of Work' },
  { id: 'deliverables', num: '04', label: 'Deliverables' },
  { id: 'timeline', num: '05', label: 'Timeline' },
  { id: 'milestones', num: '06', label: 'Milestones' },
  { id: 'client-resp', num: '07', label: 'Client Responsibilities' },
  { id: 'agency-resp', num: '08', label: 'Agency Responsibilities' },
  { id: 'revisions', num: '09', label: 'Revision Policy' },
  { id: 'communication', num: '10', label: 'Communication' },
  { id: 'payment', num: '11', label: 'Payment Terms' },
  { id: 'additional-work', num: '12', label: 'Additional Work' },
  { id: 'approval', num: '13', label: 'Approval Process' },
  { id: 'terms', num: '14', label: 'Terms & Conditions' },
];
const PAYMENT_STRUCTURE_LABEL: Record<string, string> = { full: 'Full Payment', deposit_final: 'Deposit + Final Payment', milestones: 'Milestone Payments', custom: 'Custom' };
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
function extractBulletBlock(text: string, heading: string): string[] | null {
  const re = new RegExp(`${heading}:\\s*\\n([\\s\\S]*?)(\\n\\n|$)`);
  const m = text.match(re);
  if (!m) return null;
  const items = m[1]
    .split('\n')
    .map((l) => l.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}
function parseTermsSections(text: string): { heading: string; body: string }[] {
  if (!text.includes('## ')) return [{ heading: 'Terms & Conditions', body: text }];
  const parts = text.split(/\n(?=## )/).map((s) => s.trim()).filter(Boolean);
  return parts.map((p) => {
    const [headingLine, ...rest] = p.split('\n');
    return { heading: headingLine.replace(/^##\s*/, ''), body: rest.join('\n').trim() };
  });
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
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    async function load() {
      setLoadError(false);
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const { data: projectData } = await supabase
          .from('projects')
          .select('id, name, client_id, description, category, start_date, due_date, project_manager:profiles!project_manager_id(full_name)')
          .eq('id', projectId)
          .maybeSingle();
        if (!projectData || (projectData as unknown as ProjectBrief).client_id !== own.id) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(projectData as unknown as ProjectBrief);
        setClient(own);

        const { data: sowData } = await supabase.from('sows').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
        const sowRow = (sowData as Sow) ?? null;
        setSow(sowRow);

        const { data: milestoneData } = await supabase.from('milestones').select('id, title, description, due_date, completed_at').eq('project_id', projectId).order('position');
        setMilestones((milestoneData as Milestone[]) ?? []);

        if (sowRow && sowRow.status === 'sent' && !sowRow.viewed_at) {
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

  const manager = toOne(project.project_manager);

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

  const isExpired = sow.status === 'sent' && !!sow.valid_until && sow.valid_until < todayISO();

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
            <p className="sw-state-sub">This version has been replaced by a newer version of the Statement of Work.</p>
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

  const includedWork = sow.scope ? extractBulletBlock(sow.scope, 'Included Work') : null;
  const excludedWork = sow.scope ? extractBulletBlock(sow.scope, 'Out of Scope') : null;
  const objectivesLines = sow.objectives ? sow.objectives.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const termsSections = sow.terms ? parseTermsSections(sow.terms) : [];
  const isSigned = sow.status === 'signed';

  return (
    <div className="client-portal client-sow-root">
      <div className="sw-shell">
        <Link href={`/client/project/${project.id}`} className="sw-back sw-print-hide">
          ← {project.name}
        </Link>

        <div className="sw-header sw-print-header">
          <div>
            <h1 className="sw-title">Statement of Work</h1>
            <p className="sw-header-sub">Review the agreed scope, deliverables, timeline and project terms.</p>
            <div className="sw-header-meta">
              <span>{sow.sow_number ?? `v${sow.version}`}</span>
              <span className="sw-dot"></span>
              <span>Version v{sow.version}.0</span>
              <span className="sw-dot"></span>
              <span className={`cp-badge ${isSigned ? 'cp-badge-success' : 'cp-badge-pending'}`}>{isSigned ? 'Signed ✓' : 'Awaiting Signature'}</span>
            </div>
          </div>
          <div className="sw-header-actions sw-print-hide">
            <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={() => window.print()}>
              Download / Print
            </button>
            {!isSigned && (
              <Link href={`/client/project/${project.id}/sow/sign`} className="cp-btn cp-btn-primary cp-btn-sm">
                Review &amp; Sign
              </Link>
            )}
          </div>
        </div>

        <div className="sw-summary-banner sw-print-hide">
          <div>
            <span className="sw-summary-label">Client</span>
            <span className="sw-summary-value">
              {client.primary_contact ?? client.company_name} / {client.company_name}
            </span>
          </div>
          <div>
            <span className="sw-summary-label">Project</span>
            <span className="sw-summary-value">{project.name}</span>
          </div>
          {sow.project_value && (
            <div>
              <span className="sw-summary-label">Project Value</span>
              <span className="sw-summary-value tabular">৳{sow.project_value.toLocaleString('en-US')}</span>
            </div>
          )}
          {project.start_date && project.due_date && (
            <div>
              <span className="sw-summary-label">Timeline</span>
              <span className="sw-summary-value">
                {formatBnDateLong(project.start_date)} – {formatBnDateLong(project.due_date)}
              </span>
            </div>
          )}
        </div>

        <div className="sw-body-grid">
          <nav className="sw-toc sw-print-hide" aria-label="Table of contents">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={`sw-toc-item${activeSection === s.id ? ' active' : ''}`} onClick={() => setActiveSection(s.id)}>
                <span className="sw-toc-num">{s.num}</span> {s.label}
              </a>
            ))}
          </nav>

          <div className="sw-toc-mobile sw-print-hide">
            <label className="sw-toc-mobile-label">Contents</label>
            <select
              className="sw-toc-select"
              value={activeSection}
              onChange={(e) => {
                setActiveSection(e.target.value);
                document.getElementById(e.target.value)?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.num} {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sw-document">
            <section id="overview" className="sw-section">
              <h2 className="sw-section-title">01 Project Overview</h2>
              <div className="sw-overview-grid">
                <div>
                  <span className="sw-field-label">Project Name</span>
                  <span className="sw-field-value">{project.name}</span>
                </div>
                <div>
                  <span className="sw-field-label">Client</span>
                  <span className="sw-field-value">{client.company_name}</span>
                </div>
                {project.category && (
                  <div>
                    <span className="sw-field-label">Project Type</span>
                    <span className="sw-field-value">{project.category}</span>
                  </div>
                )}
                {manager && (
                  <div>
                    <span className="sw-field-label">Project Manager</span>
                    <span className="sw-field-value">{manager.full_name}</span>
                  </div>
                )}
                {project.start_date && (
                  <div>
                    <span className="sw-field-label">Start Date</span>
                    <span className="sw-field-value">{formatBnDateLong(project.start_date)}</span>
                  </div>
                )}
                {project.due_date && (
                  <div>
                    <span className="sw-field-label">Expected Completion</span>
                    <span className="sw-field-value">{formatBnDateLong(project.due_date)}</span>
                  </div>
                )}
                {sow.project_value && (
                  <div>
                    <span className="sw-field-label">Project Value</span>
                    <span className="sw-field-value tabular">৳{sow.project_value.toLocaleString('en-US')}</span>
                  </div>
                )}
              </div>
              {project.description && <p className="sw-body-text">{project.description}</p>}
            </section>

            <section id="objectives" className="sw-section">
              <h2 className="sw-section-title">02 Objectives</h2>
              {objectivesLines.length > 0 ? (
                <>
                  <p className="sw-body-text">The objectives of this engagement are to:</p>
                  <ol className="sw-list sw-list-numbered">
                    {objectivesLines.map((line, i) => (
                      <li key={i}>{line.replace(/^\d+[.)]\s*/, '')}</li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="sw-empty">Objectives will be added here.</p>
              )}
            </section>

            <section id="scope" className="sw-section">
              <h2 className="sw-section-title">03 Scope of Work</h2>
              {includedWork || excludedWork ? (
                <div className="sw-scope-grid">
                  {includedWork && (
                    <div>
                      <div className="sw-scope-heading">Included</div>
                      <ul className="sw-list sw-list-check">
                        {includedWork.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {excludedWork && (
                    <div>
                      <div className="sw-scope-heading sw-scope-excluded">Out of Scope</div>
                      <ul className="sw-list sw-list-cross">
                        {excludedWork.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="sw-body-text">{sow.scope || '—'}</p>
              )}
            </section>

            <section id="deliverables" className="sw-section">
              <h2 className="sw-section-title">04 Deliverables</h2>
              {sow.deliverables ? <p className="sw-body-text">{sow.deliverables}</p> : <p className="sw-empty">Deliverables will be added here.</p>}
            </section>

            <section id="timeline" className="sw-section">
              <h2 className="sw-section-title">05 Timeline</h2>
              {project.start_date && project.due_date ? (
                <div className="sw-timeline-row">
                  <div>
                    <span className="sw-field-label">Start Date</span>
                    <span className="sw-field-value">{formatBnDateLong(project.start_date)}</span>
                  </div>
                  <div>
                    <span className="sw-field-label">Expected Completion</span>
                    <span className="sw-field-value">{formatBnDateLong(project.due_date)}</span>
                  </div>
                  <div>
                    <span className="sw-field-label">Duration</span>
                    <span className="sw-field-value">Approx. {Math.max(1, Math.round((new Date(project.due_date).getTime() - new Date(project.start_date).getTime()) / (7 * 86400000)))} Weeks</span>
                  </div>
                </div>
              ) : (
                <p className="sw-body-text">{sow.timeline || '—'}</p>
              )}
            </section>

            <section id="milestones" className="sw-section">
              <h2 className="sw-section-title">06 Milestones</h2>
              {milestones.length === 0 ? (
                <p className="sw-empty">Milestones will be added here.</p>
              ) : (
                <>
                  <div className="sw-milestone-list">
                    {milestones.map((m) => (
                      <div className="sw-milestone-row" key={m.id}>
                        <div className="sw-milestone-dot">{m.completed_at ? '✓' : '○'}</div>
                        <div>
                          <div className="sw-milestone-title">{m.title}</div>
                          {m.description && <div className="sw-milestone-desc">{m.description}</div>}
                          <div className="sw-milestone-date">{m.completed_at ? `Completed ${formatBnDateLong(m.completed_at)}` : m.due_date ? formatBnDateLong(m.due_date) : 'Date to be confirmed'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="sw-footnote">Milestones reflect current project planning and may be refined as work progresses.</p>
                </>
              )}
            </section>

            <section id="client-resp" className="sw-section">
              <h2 className="sw-section-title">07 Client Responsibilities</h2>
              <p className="sw-body-text">{sow.client_responsibilities || '—'}</p>
            </section>

            <section id="agency-resp" className="sw-section">
              <h2 className="sw-section-title">08 Agency Responsibilities</h2>
              <p className="sw-body-text">{sow.agency_responsibilities || '—'}</p>
            </section>

            <section id="revisions" className="sw-section">
              <h2 className="sw-section-title">09 Revision Policy</h2>
              <p className="sw-body-text">{sow.revision_policy || '—'}</p>
            </section>

            <section id="communication" className="sw-section">
              <h2 className="sw-section-title">10 Communication</h2>
              <p className="sw-body-text">{sow.communication_terms || '—'}</p>
            </section>

            <section id="payment" className="sw-section">
              <h2 className="sw-section-title">11 Payment Terms</h2>
              {sow.project_value && (
                <div className="sw-overview-grid" style={{ marginBottom: 14 }}>
                  <div>
                    <span className="sw-field-label">Project Value</span>
                    <span className="sw-field-value tabular">৳{sow.project_value.toLocaleString('en-US')}</span>
                  </div>
                  {sow.payment_structure && (
                    <div>
                      <span className="sw-field-label">Payment Structure</span>
                      <span className="sw-field-value">{PAYMENT_STRUCTURE_LABEL[sow.payment_structure] ?? sow.payment_structure}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="sw-body-text">{sow.payment_terms || '—'}</p>
              <p className="sw-footnote">Final source files may be released after all outstanding payments have been completed, subject to the agreed terms.</p>
            </section>

            <section id="additional-work" className="sw-section">
              <h2 className="sw-section-title">12 Additional Work</h2>
              <p className="sw-body-text">Requests outside the agreed scope will be handled through a Change Request.</p>
              <div className="sw-flow-row">
                <span>Request</span>
                <span className="sw-flow-arrow">→</span>
                <span>Agency Estimate</span>
                <span className="sw-flow-arrow">→</span>
                <span>Client Approval</span>
                <span className="sw-flow-arrow">→</span>
                <span>Work Begins</span>
              </div>
              <Link href={`/client/project/${project.id}/change-requests`} className="sw-inline-link sw-print-hide">
                Submit a Change Request →
              </Link>
            </section>

            <section id="approval" className="sw-section">
              <h2 className="sw-section-title">13 Approval Process</h2>
              <ol className="sw-list sw-list-numbered">
                <li>Agency submits work for review.</li>
                <li>Client reviews the deliverable.</li>
                <li>Client approves or requests changes.</li>
                <li>Approved work moves to the next phase.</li>
              </ol>
              <p className="sw-footnote">Approvals should be submitted through the Client Portal.</p>
              <Link href={`/client/project/${project.id}/approvals`} className="sw-inline-link sw-print-hide">
                View Approvals →
              </Link>
            </section>

            <section id="terms" className="sw-section">
              <h2 className="sw-section-title">14 Terms &amp; Conditions</h2>
              {termsSections.length === 0 ? (
                <p className="sw-empty">—</p>
              ) : (
                termsSections.map((t) => (
                  <details className="sw-terms-item" key={t.heading}>
                    <summary className="sw-terms-heading">{t.heading}</summary>
                    <p className="sw-body-text sw-terms-body">{t.body}</p>
                  </details>
                ))
              )}
            </section>
          </div>
        </div>

        <div className="sw-agreement-card">
          <div className="sw-agreement-label">Agreement Confirmation</div>
          {isSigned ? (
            <>
              <div className="sw-agreement-status sw-agreement-signed">Signed ✓</div>
              {sow.signed_by_name && (
                <p className="sw-body-text">
                  Signed by {sow.signed_by_name} on {formatBnDateLong(sow.signed_at)}.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="sw-agreement-status">Awaiting Signature</div>
              <p className="sw-body-text">Please review the Statement of Work before continuing to electronic signature.</p>
              <Link href={`/client/project/${project.id}/sow/sign`} className="cp-btn cp-btn-primary sw-print-hide">
                Review &amp; Sign SOW
              </Link>
            </>
          )}
        </div>
      </div>

      {!isSigned && (
        <div className="sw-sticky-cta sw-print-hide">
          <Link href={`/client/project/${project.id}/sow/sign`} className="cp-btn cp-btn-primary cp-btn-block">
            Review &amp; Sign
          </Link>
        </div>
      )}
    </div>
  );
}
