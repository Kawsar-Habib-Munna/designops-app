// The Statement of Work document exactly as the CLIENT sees it. Used by:
//  - the client page (app/client/project/[id]/sow/page.tsx)
//  - the admin editor's live preview (app/projects/[id]/sow/page.tsx)
// Both render this one component with the same styles (./sow-document.css), so the preview cannot drift from
// what the client gets. The scope / timeline / payment columns hold the same "• a || b || c" text the editor
// saves, and are parsed here the same way the client page always did.
import { driveThumbnailUrl } from '@/lib/driveUpload';
import { formatDateLong } from '@/lib/format';
import SowRichText from './SowRichText';
import { CURRENCY_SYMBOL } from '@/lib/currency';
import './sow-document.css';

export type SowDocData = {
  version: number;
  sow_number: string | null;
  status: string;
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

export type SowDocAttachment = { id: string; file_name: string; file_url: string; file_size: number | null };

type ServiceRow = { service: string; deliverable: string; quantity: string };
type MilestoneRow = { label: string; week: string };
type PaymentRow = { description: string; amount: string; dueDate: string };


function parseServiceRows(scope: string | null): ServiceRow[] {
  if (!scope) return [];
  return scope
    .split('\n')
    .map((l) => l.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [service, deliverable, quantity] = line.split(' || ');
      return { service: (service ?? '').trim(), deliverable: (deliverable ?? '').trim(), quantity: (quantity ?? '').trim() };
    });
}
function parseMilestoneRows(timeline: string | null): MilestoneRow[] {
  if (!timeline) return [];
  return timeline
    .split('\n')
    .filter((l) => l.trim().startsWith('•'))
    .map((l) => {
      const clean = l.replace(/^•\s*/, '').trim();
      const [label, week] = clean.split(' — ');
      return { label: (label ?? '').trim(), week: (week ?? '').trim() };
    });
}
function parsePaymentRows(paymentTerms: string | null): PaymentRow[] {
  if (!paymentTerms) return [];
  return paymentTerms
    .split('\n')
    .map((l) => l.replace(/^[•\-]\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [description, amount, dueDate] = line.split(' || ');
      return { description: (description ?? '').trim(), amount: (amount ?? '').trim(), dueDate: (dueDate ?? '').trim() };
    });
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

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

export default function SowDocument({
  sow,
  clientContact,
  companyName,
  projectName,
  manager,
  attachments = [],
  theme = 'auto',
}: {
  sow: SowDocData;
  clientContact: string | null;
  companyName: string;
  projectName: string;
  manager: { full_name: string; role: string | null } | null;
  attachments?: SowDocAttachment[];
  // 'auto' follows the viewer's OS setting (what a real client gets); the editor preview can force light/dark
  theme?: 'auto' | 'light' | 'dark';
}) {
  const deliverableRows = parseServiceRows(sow.scope);
  const milestoneRows = parseMilestoneRows(sow.timeline);
  const paymentRows = parsePaymentRows(sow.payment_terms);
  const isSigned = sow.status === 'signed';
  const sym = CURRENCY_SYMBOL[sow.currency ?? 'BDT'] ?? sow.currency ?? '';
  const ref = sow.sow_number ?? `v${sow.version}`;

  return (
    <div className={`sow-document theme-${theme}`}>
      <div className="sd-card">
        <div className="sd-letterhead-row">
          <div className="sd-letterhead-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flow53-logo.svg" alt="" className="sd-brand-mark" />
            <div>
              <div className="sd-letterhead">FLOW 53</div>
              <div className="sd-letterhead-sub">Innovate-Design-Elevate</div>
            </div>
          </div>
          <div className="sd-letterhead-right">
            <div className="sd-letterhead-doctype">STATEMENT OF WORK</div>
            <div className="sd-letterhead-ref">
              {ref} · v{sow.version}.0
            </div>
          </div>
        </div>
        <hr className="sd-hr" />

        <div className="sd-section sd-section-first" id="sec-parties">
          <div className="sd-section-head">
            <span className="sd-section-title">Parties</span>
          </div>
        </div>

        <div className="sd-parties-row">
          <div>
            <div className="sd-eyebrow">Service Provider</div>
            <div className="sd-kv-value">FLOW 53 Design Studio</div>
            <div className="sd-kv-sub">Dhaka, Bangladesh</div>
          </div>
          <table className="sd-table sd-parties-table">
            <tbody>
              <tr>
                <th>Client</th>
                <td>{clientContact}</td>
              </tr>
              <tr>
                <th>Project</th>
                <td>{projectName}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="sd-section" id="sec-scope">
          <div className="sd-section-head">
            <span className="sd-section-num">01</span>
            <span className="sd-section-title">Scope of Work</span>
          </div>
          {sow.objectives && (
            <>
              <div className="sd-subhead">Project overview</div>
              <div className="sd-p">
                <SowRichText text={sow.objectives} />
              </div>
            </>
          )}
          {deliverableRows.length > 0 && (
            <>
              <div className="sd-subhead">Deliverables</div>
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Deliverable</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {deliverableRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.service}</td>
                      <td>{r.deliverable || '—'}</td>
                      <td>{r.quantity || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="sd-section" id="sec-timeline">
          <div className="sd-section-head">
            <span className="sd-section-num">02</span>
            <span className="sd-section-title">Timeline</span>
          </div>
          {milestoneRows.length > 0 && (
            <>
              <div className="sd-subhead">Project milestones</div>
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    <th>Target date</th>
                  </tr>
                </thead>
                <tbody>
                  {milestoneRows.map((m, i) => (
                    <tr key={i}>
                      <td>{m.label}</td>
                      <td>{m.week || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {(sow.start_date || sow.delivery_date) && (
            <p className="sd-p">
              {sow.start_date && `Start: ${formatDateLong(sow.start_date)}`}
              {sow.start_date && sow.delivery_date && ' · '}
              {sow.delivery_date && `Expected Delivery: ${formatDateLong(sow.delivery_date)}`}
            </p>
          )}
        </div>

        <div className="sd-section" id="sec-payment">
          <div className="sd-section-head">
            <span className="sd-section-num">03</span>
            <span className="sd-section-title">Payment Terms</span>
          </div>
          {sow.project_value != null && (
            <table className="sd-table sd-fee-table">
              <tbody>
                <tr>
                  <th>Project Fee</th>
                  <td>
                    {sym}
                    {sow.project_value.toLocaleString('en-US')}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {paymentRows.length > 0 && (
            <>
              <div className="sd-subhead">Payment schedule</div>
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Due date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.description}</td>
                      <td>{r.amount || '—'}</td>
                      <td>{r.dueDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {sow.revision_policy && <p className="sd-p">{sow.revision_policy}</p>}
        </div>

        <div className="sd-section" id="sec-terms">
          <div className="sd-section-head">
            <span className="sd-section-num">04</span>
            <span className="sd-section-title">Terms &amp; Conditions</span>
          </div>
          {sow.terms && (
            <div className="sd-p">
              <SowRichText text={sow.terms} />
            </div>
          )}
          {sow.document_url && (
            <a href={sow.document_url} target="_blank" rel="noopener noreferrer" className="sd-link">
              📄 View attached document ↗
            </a>
          )}
        </div>

        <div className="sd-section" id="sec-signatures">
          <div className="sd-section-head">
            <span className="sd-section-num">05</span>
            <span className="sd-section-title">Agreement &amp; Signatures</span>
          </div>
          <div className="sd-sig-grid">
            <div className="sd-sig">
              <div className="sd-sig-label">Client</div>
              <div className="sd-sig-name">{clientContact}</div>
              <div className="sd-sig-sub">{companyName}</div>
              <hr className="sd-sig-line" />
              {isSigned ? (
                <>
                  {sow.signature_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="sd-sig-image" src={driveThumbnailUrl(sow.signature_image_url)} alt={`${sow.signed_by_name} signature`} />
                  ) : (
                    <div className="sd-sig-typed">{sow.signed_by_name}</div>
                  )}
                  <div className="sd-sig-caption">{sow.signature_method === 'drawn' ? 'Drawn Signature' : sow.signature_method === 'uploaded' ? 'Uploaded Signature' : 'Typed Signature'}</div>
                  <div className="sd-sig-meta">Signed on {sow.signed_at ? formatDateLong(sow.signed_at) : ''}</div>
                </>
              ) : (
                <div className="sd-sig-pending">Awaiting Signature</div>
              )}
            </div>
            <div className="sd-sig">
              <div className="sd-sig-label">Agency</div>
              <div className="sd-sig-name">{sow.agency_signer_name ?? manager?.full_name ?? 'FLOW 53'}</div>
              <div className="sd-sig-sub">{manager?.role ?? 'Project Manager'} · FLOW 53</div>
              <hr className="sd-sig-line" />
              {sow.agency_signed_at ? (
                <>
                  {sow.agency_signature_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="sd-sig-image" src={driveThumbnailUrl(sow.agency_signature_image_url)} alt={`${sow.agency_signer_name} signature`} />
                  ) : (
                    <div className="sd-sig-typed">{sow.agency_signer_name}</div>
                  )}
                  <div className="sd-sig-caption">{sow.agency_signature_method === 'drawn' ? 'Drawn Signature' : sow.agency_signature_method === 'uploaded' ? 'Uploaded Signature' : 'Typed Signature'}</div>
                  <div className="sd-sig-meta">Signed on {formatDateLong(sow.agency_signed_at)}</div>
                </>
              ) : (
                <div className="sd-sig-pending">Pending Agency Signature</div>
              )}
            </div>
          </div>
          {isSigned && <p className="sd-version-line">SOW Version: v{sow.version}.0 · Status: Signed ✓</p>}
        </div>

        <div className="sd-footer">
          <span>
            {ref} · v{sow.version}.0
          </span>
          <span>Page 1</span>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="sd-card sd-attachments">
          <div className="sd-h2">
            <span className="sd-h2-num">📎</span>Documents &amp; Attachments
          </div>
          <div className="sd-doc-list">
            {attachments.map((d) => (
              <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="sd-doc-item" key={d.id}>
                <span className="sd-doc-ext">{fileExtension(d.file_name)}</span>
                <div className="sd-doc-item-meta">
                  <span className="sd-doc-item-name">{d.file_name}</span>
                  <span className="sd-doc-item-size">{formatBytes(d.file_size)}</span>
                </div>
                <DownloadIcon />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
