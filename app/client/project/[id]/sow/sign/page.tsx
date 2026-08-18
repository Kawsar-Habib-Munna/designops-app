'use client';

// Screen 11 — SOW Signature। রিডিজাইন: Screen 10-এর "Review & Sign" থেকে আসা
// এক-পাতার সাইনিং ফ্লো — Agreement Summary → Before You Sign → Confirm Your
// Agreement (৫টা required checkbox) → Your Signature (Type/Draw/Upload, তিনটাই
// লাইভ preview দেখায়) → Legal Confirmation → Sign & Accept (কনফার্মেশন মোডাল)।
//
// Real-data সিদ্ধান্তসমূহ:
// - sign_sow() RPC এখন version snapshot চেক করে (p_expected_version) — client
//   পেজ লোড করার পর admin নতুন ভার্সন পাঠিয়ে দিলে সাইন রিকোয়েস্ট real reject হয়,
//   ফ্রন্টএন্ড শুধু বাটন disable করাই যথেষ্ট না (স্পেকের রিকোয়ারমেন্ট)।
// - Draw/Upload সিগনেচার বিদ্যমান Drive আপলোড পাইপলাইনেই যায় (এই কোডবেসের সব
//   ফাইলের মতোই) — একটা আলাদা "প্রাইভেট সিগনেচার ভল্ট" এই আর্কিটেকচারে নেই,
//   তাই UI-তে মিথ্যা "ব্যাংক-গ্রেড এনক্রিপশন" দাবি করা হয়নি, শুধু generic
//   "Secure electronic signing" লাইন যেটা স্পেকেও উদাহরণ হিসেবে দেওয়া আছে।
// - Confirmation checkbox ৫টাই আলাদাভাবে required, pre-checked না।
// - সাইন করার পরের "Next Step" real: project-এর pending invoice থাকলে Payments
//   পেজে লিংক করে (Screen 12 বানানো হয়নি, কিন্তু Payments পেজ আগে থেকেই আছে),
//   না থাকলে generic honest মেসেজ — কোনো fake payment request দেখানো হয় না।
// - Admin notification আগের established প্যাটার্নেই (activity_log entry,
//   sow_sent-এর মতোই) — নতুন notification আর্কিটেকচার বানানো হয়নি।

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive } from '@/lib/driveUpload';
import { formatBnDateLong, todayISO } from '@/lib/format';
import '../../../../client-shared.css';
import './sign.css';

type ProjectBrief = { id: string; name: string; client_id: string };
type Sow = {
  id: string;
  version: number;
  sow_number: string | null;
  status: string;
  valid_until: string | null;
  project_value: number | null;
  currency: string | null;
  payment_structure: string | null;
  timeline: string | null;
  deliverables: string | null;
  revision_policy: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signature_method: string | null;
  signature_image_url: string | null;
};
type InvoiceBrief = { id: string; status: string };

const CONFIRMATIONS = [
  'I have reviewed the complete Statement of Work.',
  'I understand the project scope and deliverables.',
  'I understand the project timeline and payment terms.',
  'I understand the revision and additional-work policy.',
  'I confirm that the information in this agreement is correct.',
];
const PAYMENT_STRUCTURE_LABEL: Record<string, string> = { full: 'Full Payment', deposit_final: 'Deposit + Final Payment', milestones: 'Milestone Payments', custom: 'Custom' };
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';

type Method = 'typed' | 'drawn' | 'uploaded';
type Point = { x: number; y: number };

export default function SowSignPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sow, setSow] = useState<Sow | null>(null);
  const [hasPendingInvoice, setHasPendingInvoice] = useState(false);

  const [fullName, setFullName] = useState('');
  const [method, setMethod] = useState<Method>('typed');
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<boolean[]>(CONFIRMATIONS.map(() => false));

  const [showConfirm, setShowConfirm] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);
  const [needsLatestVersion, setNeedsLatestVersion] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);

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
        setFullName(own.primary_contact ?? '');

        const { data: sowData } = await supabase
          .from('sows')
          .select('id, version, sow_number, status, valid_until, project_value, currency, payment_structure, timeline, deliverables, revision_policy, signed_at, signed_by_name, signature_method, signature_image_url')
          .eq('project_id', projectId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        setSow((sowData as Sow) ?? null);

        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    }

    load();
  }, [router, projectId]);

  // ---- canvas drawing ----
  function redrawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#14141a';
    ctx.lineWidth = 2.5 * (canvas.width / canvas.clientWidth || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }

  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  useEffect(() => {
    if (method !== 'drawn') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    return { x: (e.clientX - rect.left) * ratio, y: (e.clientY - rect.top) * ratio };
  }
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [pointFromEvent(e)];
  }
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    currentStrokeRef.current = [...currentStrokeRef.current, pointFromEvent(e)];
    setStrokes((prev) => [...prev.slice(0, -1), currentStrokeRef.current]);
  }
  function handlePointerDownCommit(e: React.PointerEvent<HTMLCanvasElement>) {
    handlePointerDown(e);
    setStrokes((prev) => [...prev, currentStrokeRef.current]);
  }
  function handlePointerUp() {
    drawingRef.current = false;
    currentStrokeRef.current = [];
  }
  function handleUndoStroke() {
    setStrokes((prev) => prev.slice(0, -1));
  }
  function handleClearStrokes() {
    setStrokes([]);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setUploadFileError(null);
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setUploadFileError('শুধু PNG বা JPG ফাইল আপলোড করা যাবে।');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadFileError('ফাইল সাইজ ৫MB-এর কম হতে হবে।');
      return;
    }
    setUploadedFile(file);
    setUploadedPreview(URL.createObjectURL(file));
  }
  function handleRemoveUpload() {
    setUploadedFile(null);
    setUploadedPreview(null);
  }

  const hasSignatureInput = method === 'typed' ? fullName.trim().length > 0 : method === 'drawn' ? strokes.some((s) => s.length > 1) : !!uploadedFile;
  const allConfirmed = confirmations.every(Boolean);
  const canSign = allConfirmed && fullName.trim().length > 0 && hasSignatureInput;

  async function handleFinalSign() {
    if (!sow || !client || !canSign) return;
    setSigning(true);
    setSignError(null);

    try {
      let signatureImageUrl: string | null = null;

      if (method !== 'typed') {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          router.replace('/client/sign-in');
          return;
        }

        let fileToUpload: File;
        if (method === 'uploaded') {
          fileToUpload = uploadedFile!;
        } else {
          const canvas = canvasRef.current!;
          const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('সিগনেচার ইমেজ তৈরি করা যায়নি।');
          fileToUpload = new File([blob], 'signature.png', { type: 'image/png' });
        }
        const result = await uploadFileToDrive(fileToUpload, accessToken);
        signatureImageUrl = result.webViewLink;
      }

      const { error } = await supabase.rpc('sign_sow', {
        p_sow_id: sow.id,
        p_full_name: fullName.trim(),
        p_signature: fullName.trim(),
        p_signature_method: method,
        p_signature_image_url: signatureImageUrl,
        p_confirmation_statements: CONFIRMATIONS.join('\n'),
        p_expected_version: sow.version,
      });

      if (error) {
        if (error.message.includes('VERSION_MISMATCH')) {
          setNeedsLatestVersion(true);
          setShowConfirm(false);
          setSigning(false);
          return;
        }
        setSignError(error.message);
        setSigning(false);
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
        const { data: invoiceRows } = await supabase.from('invoices').select('id, status').eq('project_id', project.id).eq('status', 'pending').limit(1);
        setHasPendingInvoice(((invoiceRows as InvoiceBrief[]) ?? []).length > 0);
      }

      setJustSigned(true);
      setShowConfirm(false);
      setSow((prev) => (prev ? { ...prev, status: 'signed', signed_at: new Date().toISOString(), signed_by_name: fullName.trim(), signature_method: method, signature_image_url: signatureImageUrl } : prev));
    } catch (err) {
      setSignError(err instanceof Error ? err.message : 'সাইন করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <div className="sgn-state-card">
            <div className="sgn-state-title">Unable to sign SOW</div>
            <p className="sgn-state-sub">Your signature was not submitted. Please try again.</p>
            <div className="sgn-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}/sow`} className="cp-btn cp-btn-secondary">
                Back to SOW
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sow) {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <Link href={`/client/project/${project.id}/sow`} className="sgn-back">
            ← Statement of Work
          </Link>
          <div className="sgn-state-card">
            <div className="sgn-state-title">This Statement of Work is not available for signing</div>
            <p className="sgn-state-sub">Please open the SOW from your project first.</p>
          </div>
        </div>
      </div>
    );
  }

  if (needsLatestVersion) {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <div className="sgn-state-card">
            <div className="sgn-state-title">This Statement of Work has been updated</div>
            <p className="sgn-state-sub">A newer version is available. Please review the latest version before signing.</p>
            <div className="sgn-state-actions">
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-primary">
                View Latest Version
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'cancelled') {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <Link href={`/client/project/${project.id}`} className="sgn-back">
            ← {project.name}
          </Link>
          <div className="sgn-state-card">
            <div className="sgn-state-title">Signing Unavailable</div>
            <p className="sgn-state-sub">This Statement of Work is no longer active.</p>
            <div className="sgn-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'superseded') {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <Link href={`/client/project/${project.id}`} className="sgn-back">
            ← {project.name}
          </Link>
          <div className="sgn-state-card">
            <div className="sgn-state-title">New Version Available</div>
            <p className="sgn-state-sub">This version has been replaced by a newer Statement of Work.</p>
            <div className="sgn-state-actions">
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-primary">
                View Latest Version
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = sow.status === 'sent' && !!sow.valid_until && sow.valid_until < todayISO();
  if (isExpired) {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <Link href={`/client/project/${project.id}`} className="sgn-back">
            ← {project.name}
          </Link>
          <div className="sgn-state-card">
            <div className="sgn-state-title">Signature Request Expired</div>
            <p className="sgn-state-sub">This Statement of Work is no longer available for signing.</p>
            <div className="sgn-state-actions">
              <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, my SOW for ${project.name} has expired — could you resend it?`)}`} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-primary">
                Contact Project Manager
              </a>
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-secondary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'signed') {
    return (
      <div className="client-portal client-sow-sign-root">
        <div className="sgn-shell">
          <div className="sgn-success">
            <div className="sgn-success-icon">✓</div>
            <h1 className="sgn-success-title">{justSigned ? 'SOW signed successfully' : 'SOW Already Signed'}</h1>
            <p className="sgn-success-sub">Your Statement of Work for {project.name} has been signed and confirmed.</p>

            <div className="sgn-success-card">
              <div className="sgn-success-row">
                <span>Project</span>
                <span>{project.name}</span>
              </div>
              <div className="sgn-success-row">
                <span>SOW</span>
                <span>{sow.sow_number ?? `v${sow.version}`}</span>
              </div>
              <div className="sgn-success-row">
                <span>Version</span>
                <span>v{sow.version}.0</span>
              </div>
              <div className="sgn-success-row">
                <span>Signed By</span>
                <span>{sow.signed_by_name ?? '—'}</span>
              </div>
              <div className="sgn-success-row">
                <span>Signed On</span>
                <span>{sow.signed_at ? formatBnDateLong(sow.signed_at) : '—'}</span>
              </div>
              <div className="sgn-success-row">
                <span>Status</span>
                <span className="sgn-signed-pill">Signed ✓</span>
              </div>
              {sow.signature_image_url && (
                <div className="sgn-success-sig-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sow.signature_image_url} alt="Signature" />
                </div>
              )}
            </div>

            {justSigned && hasPendingInvoice && (
              <div className="sgn-next-step-card">
                <div className="sgn-next-step-label">Next Step</div>
                <div className="sgn-next-step-title">Initial Payment</div>
                <p className="sgn-state-sub">Your initial project payment is now ready.</p>
                <Link href={`/client/project/${project.id}/payments`} className="cp-btn cp-btn-primary">
                  View Payment Request
                </Link>
              </div>
            )}
            {justSigned && !hasPendingInvoice && <p className="sgn-footnote">Your agency will provide the next project step shortly.</p>}

            <div className="sgn-success-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">
                Back to Project
              </Link>
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary">
                View Signed SOW
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- status === 'sent': show the signing form ----
  const durationText = sow.timeline || null;

  return (
    <div className="client-portal client-sow-sign-root">
      <div className="sgn-shell">
        <div className="sgn-header-row">
          <div>
            <div className="sgn-breadcrumb">
              <Link href={`/client/project/${project.id}`}>{project.name}</Link> / <Link href={`/client/project/${project.id}/sow`}>Statement of Work</Link> / Sign
            </div>
            <h1 className="sgn-title">Sign Statement of Work</h1>
            <p className="sgn-header-sub">Confirm the agreement details and provide your signature.</p>
          </div>
          <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">
            View Full SOW
          </Link>
        </div>

        <div className="sgn-progress-row">
          <span className="sgn-progress-step done">1. Review ✓</span>
          <span className="sgn-progress-step active">2. Confirm ●</span>
          <span className="sgn-progress-step">3. Sign ○</span>
        </div>

        <div className="sgn-summary-card">
          <div className="sgn-summary-grid">
            <div>
              <span className="sgn-summary-label">Project</span>
              <span className="sgn-summary-value">{project.name}</span>
            </div>
            <div>
              <span className="sgn-summary-label">Client</span>
              <span className="sgn-summary-value">
                {client.primary_contact ?? client.company_name} / {client.company_name}
              </span>
            </div>
            <div>
              <span className="sgn-summary-label">SOW</span>
              <span className="sgn-summary-value">{sow.sow_number ?? `v${sow.version}`}</span>
            </div>
            <div>
              <span className="sgn-summary-label">Version</span>
              <span className="sgn-summary-value">v{sow.version}.0</span>
            </div>
            {sow.project_value && (
              <div>
                <span className="sgn-summary-label">Project Value</span>
                <span className="sgn-summary-value tabular">৳{sow.project_value.toLocaleString('en-US')}</span>
              </div>
            )}
            {sow.payment_structure && (
              <div>
                <span className="sgn-summary-label">Payment Terms</span>
                <span className="sgn-summary-value">{PAYMENT_STRUCTURE_LABEL[sow.payment_structure] ?? sow.payment_structure}</span>
              </div>
            )}
          </div>
          <span className="cp-badge cp-badge-pending">Awaiting Signature</span>
        </div>

        <section className="sgn-section">
          <h2 className="sgn-section-title">Before You Sign</h2>
          <div className="sgn-before-grid">
            {durationText && (
              <div>
                <span className="sgn-field-label">Timeline</span>
                <span className="sgn-field-value">{durationText}</span>
              </div>
            )}
            {sow.deliverables && (
              <div>
                <span className="sgn-field-label">Deliverables</span>
                <span className="sgn-field-value">{sow.deliverables}</span>
              </div>
            )}
            {sow.revision_policy && (
              <div>
                <span className="sgn-field-label">Revisions</span>
                <span className="sgn-field-value">{sow.revision_policy}</span>
              </div>
            )}
          </div>
          <p className="sgn-footnote">Please review the full Statement of Work before signing.</p>
          <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">
            View Full SOW
          </Link>
        </section>

        <section className="sgn-section">
          <h2 className="sgn-section-title">Confirm Your Agreement</h2>
          <div className="sgn-checklist">
            {CONFIRMATIONS.map((text, i) => (
              <label className="cp-checkbox-row" key={i}>
                <input
                  type="checkbox"
                  checked={confirmations[i]}
                  onChange={(e) =>
                    setConfirmations((prev) => {
                      const next = [...prev];
                      next[i] = e.target.checked;
                      return next;
                    })
                  }
                />
                {text}
              </label>
            ))}
          </div>
        </section>

        <section className="sgn-section">
          <h2 className="sgn-section-title">Your Signature</h2>

          <div className="sgn-method-tabs" role="tablist">
            {(['typed', 'drawn', 'uploaded'] as Method[]).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={method === m} className={`sgn-method-tab${method === m ? ' active' : ''}`} onClick={() => setMethod(m)}>
                {m === 'typed' ? 'Type' : m === 'drawn' ? 'Draw' : 'Upload'}
              </button>
            ))}
          </div>

          {method === 'typed' && (
            <div className="sgn-method-panel">
              <div className="cp-field">
                <label className="cp-label">Full Legal Name</label>
                <input className="cp-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full legal name" required />
              </div>
              <div className="sgn-preview-box">
                <span className="sgn-preview-label">Typed Signature</span>
                {fullName.trim() ? <div className="sgn-typed-preview">{fullName}</div> : <p className="sgn-empty">Your typed signature will appear here.</p>}
              </div>
            </div>
          )}

          {method === 'drawn' && (
            <div className="sgn-method-panel">
              <div className="cp-field">
                <label className="cp-label">Full Legal Name</label>
                <input className="cp-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full legal name" required />
              </div>
              <p className="sgn-canvas-instruction">Draw your signature using your mouse, trackpad, finger or stylus.</p>
              <canvas
                ref={canvasRef}
                className="sgn-canvas"
                onPointerDown={handlePointerDownCommit}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              <div className="sgn-canvas-actions">
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={handleUndoStroke} disabled={strokes.length === 0}>
                  Undo
                </button>
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={handleClearStrokes} disabled={strokes.length === 0}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {method === 'uploaded' && (
            <div className="sgn-method-panel">
              <div className="cp-field">
                <label className="cp-label">Full Legal Name</label>
                <input className="cp-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full legal name" required />
              </div>
              {uploadFileError && <div className="cp-alert cp-alert-error">{uploadFileError}</div>}
              {!uploadedPreview ? (
                <label className="sgn-upload-drop">
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={handleFileSelected} />
                  <span>Upload Signature</span>
                  <span className="sgn-upload-hint">PNG or JPG, up to 5MB</span>
                </label>
              ) : (
                <div className="sgn-preview-box">
                  <span className="sgn-preview-label">Uploaded Signature</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadedPreview} alt="Uploaded signature preview" className="sgn-uploaded-preview" />
                  <div className="sgn-canvas-actions">
                    <label className="cp-btn cp-btn-secondary cp-btn-sm">
                      <input type="file" accept="image/png,image/jpeg" hidden onChange={handleFileSelected} />
                      Replace
                    </label>
                    <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={handleRemoveUpload}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="sgn-legal-text">
          By signing this Statement of Work, you confirm that you have reviewed and agree to the scope, deliverables, timeline, payment terms, responsibilities and other terms described in {sow.sow_number ?? `SOW v${sow.version}`}, version v{sow.version}.0.
        </div>

        <p className="sgn-trust-note">Secure electronic signing — your signature and signing information will be recorded with this SOW.</p>

        {signError && <div className="cp-alert cp-alert-error">{signError}</div>}

        <button type="button" className="cp-btn cp-btn-primary cp-btn-block sgn-submit-btn" disabled={!canSign || signing} onClick={() => setShowConfirm(true)}>
          Sign &amp; Accept SOW
        </button>
      </div>

      <div className="sgn-sticky-cta">
        <button type="button" className="cp-btn cp-btn-primary cp-btn-block" disabled={!canSign || signing} onClick={() => setShowConfirm(true)}>
          Sign &amp; Accept SOW
        </button>
      </div>

      {showConfirm && (
        <div className="cp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div className="cp-modal-box">
            <h3 className="sgn-modal-title">Sign Statement of Work?</h3>
            <p className="sgn-modal-desc">
              You&apos;re about to electronically sign {sow.sow_number ?? `SOW v${sow.version}`} (v{sow.version}.0) for the {project.name} project.
            </p>
            <div className="sgn-modal-grid">
              <div>
                <span className="sgn-field-label">Client</span>
                <span className="sgn-field-value">{client.primary_contact ?? client.company_name}</span>
              </div>
              {sow.project_value && (
                <div>
                  <span className="sgn-field-label">Project Value</span>
                  <span className="sgn-field-value tabular">৳{sow.project_value.toLocaleString('en-US')}</span>
                </div>
              )}
              <div>
                <span className="sgn-field-label">Version</span>
                <span className="sgn-field-value">v{sow.version}.0</span>
              </div>
            </div>
            <p className="sgn-footnote">By continuing, you confirm that you have reviewed and agree to this Statement of Work.</p>
            <div className="sgn-modal-actions">
              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setShowConfirm(false)} disabled={signing}>
                Cancel
              </button>
              <button type="button" className="cp-btn cp-btn-primary" onClick={handleFinalSign} disabled={signing}>
                {signing && <span className="cp-spinner" />}
                {signing ? 'Signing…' : 'Yes, Sign & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
