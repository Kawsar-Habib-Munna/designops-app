'use client';

// Screen 11 — SOW Signature (dedicated route)। Screen 10 (/sow) পুরো ডকুমেন্ট
// দেখায় + স্ট্যাটাস; এই পাতা শুধু সাইনিং-এর জন্য — কম্প্যাক্ট agreement summary +
// confirmation checklist + signature capture (Type/Draw/Upload)। sign_sow() RPC-ই
// একমাত্র সত্যিকারের সোর্স অফ ট্রুথ (security-definer, version-mismatch protection
// সহ) — ক্লায়েন্ট-সাইড বাটন ডিজেবল করাটা শুধু UX, নিরাপত্তা না।
//
// Draw/Upload signature আসলেই Google Drive পাইপলাইনে যায় (lib/driveUpload.ts,
// Files পেজে ক্লায়েন্ট আগে থেকেই এটা ব্যবহার করে) — signature_image_url কলামে
// (ফেজ ১২) রিয়েল URL সেভ হয়, কোনো fake/local-only "preview" না।
//
// signed_at ক্লায়েন্ট ঘড়ি থেকে না — sign_sow() সফল হওয়ার পর sows রো আবার fetch
// করে ডাটাবেজের আসল timestamptz দেখানো হয় (success স্ক্রিনে "Signed On" এটাই)।

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { formatBnDateLong, formatDateTime, todayISO } from '@/lib/format';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';
import '../../../../client-shared.css';
import './sign.css';

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
  payment_terms: string | null;
  revision_policy: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signature_method: string | null;
  signature_image_url: string | null;
  viewed_at: string | null;
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const CURRENCY_SYMBOL: Record<string, string> = { BDT: '৳', USD: '$', GBP: '£' };
const WHATSAPP_URL_BASE = 'https://wa.me/8801804409235';
const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;

const CHECKLIST_ITEMS = [
  'I have reviewed the complete Statement of Work.',
  'I understand the project scope and deliverables.',
  'I understand the project timeline and payment terms.',
  'I understand the revision and additional-work policy.',
  'I confirm that the information in this agreement is correct.',
];

function parseBulletList(text: string | null): string[] {
  if (!text) return [];
  return text.split('\n').filter((l) => l.trim().startsWith('•')).map((l) => l.replace(/^•\s*/, '').trim());
}

type SigMethod = 'typed' | 'drawn' | 'uploaded';

export default function SowSignPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [sow, setSow] = useState<Sow | null>(null);

  const [fullName, setFullName] = useState('');
  const [checks, setChecks] = useState<boolean[]>(() => CHECKLIST_ITEMS.map(() => false));
  const [sigMethod, setSigMethod] = useState<SigMethod>('typed');

  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nameError, setNameError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);
  const [versionMismatch, setVersionMismatch] = useState(false);

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
          .select('id, name, client_id, project_manager:profiles!project_manager_id(full_name, role)')
          .eq('id', projectId)
          .maybeSingle();
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

  // ---- draw canvas ----
  const redrawCanvas = useCallback((liveStroke?: { x: number; y: number }[]) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#232128';
    const strokes = liveStroke ? [...strokesRef.current, liveStroke] : strokesRef.current;
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx?.scale(dpr, dpr);
    redrawCanvas();
  }, [sigMethod, redrawCanvas]);

  function canvasPoint(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    currentStrokeRef.current = [canvasPoint(e)];
    setDrawing(true);
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.preventDefault();
    currentStrokeRef.current.push(canvasPoint(e));
    redrawCanvas(currentStrokeRef.current);
  }
  function handlePointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    if (currentStrokeRef.current.length > 1) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current];
      setHasDrawn(true);
      setStrokeCount(strokesRef.current.length);
    }
    currentStrokeRef.current = [];
    setDrawing(false);
    redrawCanvas();
  }
  function undoStroke() {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setHasDrawn(strokesRef.current.length > 0);
    setStrokeCount(strokesRef.current.length);
    redrawCanvas();
  }
  function clearCanvas() {
    strokesRef.current = [];
    setHasDrawn(false);
    setStrokeCount(0);
    redrawCanvas();
  }

  // ---- upload ----
  async function handleUploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setUploadError('Please upload a PNG or JPG image.');
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setUploadError('Image is too large — please upload a file under 5MB.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    try {
      const result = await uploadFileToDrive(file, accessToken);
      setUploadedUrl(result.webViewLink);
    } catch {
      setUploadError('Upload failed — please try again.');
    }
    setUploading(false);
  }

  const allChecked = checks.every(Boolean);
  const hasValidSignature = sigMethod === 'typed' ? fullName.trim().length > 0 : sigMethod === 'drawn' ? hasDrawn : !!uploadedUrl;
  const canSign = allChecked && fullName.trim().length > 0 && hasValidSignature && !signing && !!sow && sow.status === 'sent';

  function openConfirm() {
    if (!fullName.trim()) {
      setNameError('Please enter your full legal name.');
      return;
    }
    setNameError(null);
    setShowConfirmModal(true);
  }

  async function handleConfirmSign() {
    if (!sow || !client) return;
    setSigning(true);
    setSignError(null);

    let signatureImageUrl: string | null = null;
    if (sigMethod === 'drawn') {
      const canvas = canvasRef.current;
      if (!canvas) { setSigning(false); return; }
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (blob) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (accessToken) {
          try {
            const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });
            const result = await uploadFileToDrive(file, accessToken);
            signatureImageUrl = result.webViewLink;
          } catch {
            setSigning(false);
            setShowConfirmModal(false);
            setSignError('Could not save your drawn signature. Please try again.');
            return;
          }
        }
      }
    } else if (sigMethod === 'uploaded') {
      signatureImageUrl = uploadedUrl;
    }

    const confirmationStatements = CHECKLIST_ITEMS.map((t, i) => `${i + 1}. ${t}`).join('\n');

    const { error } = await supabase.rpc('sign_sow', {
      p_sow_id: sow.id,
      p_full_name: fullName.trim(),
      p_signature: fullName.trim(),
      p_signature_method: sigMethod,
      p_signature_image_url: signatureImageUrl,
      p_confirmation_statements: confirmationStatements,
      p_expected_version: sow.version,
    });

    if (error) {
      setSigning(false);
      setShowConfirmModal(false);
      if (error.message.includes('VERSION_MISMATCH')) {
        setVersionMismatch(true);
        return;
      }
      setSignError(error.message);
      return;
    }

    const { data: fresh } = await supabase.from('sows').select('*').eq('id', sow.id).maybeSingle();
    if (fresh) setSow(fresh as Sow);

    await supabase.from('activity_log').insert({
      actor_id: null,
      action: 'sow_signed',
      entity_type: 'client',
      entity_id: client.id,
      detail: `${fullName.trim()} SOW ${sow.sow_number ?? `v${sow.version}`} সাইন করেছেন`,
    });

    setSigning(false);
    setShowConfirmModal(false);
    setJustSigned(true);
  }

  if (loading) {
    return (
      <div className="client-portal client-sign-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <div className="sg-state-card">
            <div className="sg-state-title">Unable to load Statement of Work</div>
            <p className="sg-state-sub">We couldn&apos;t retrieve this document right now.</p>
            <div className="sg-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>Try Again</button>
              <Link href={`/client/project/${projectId}`} className="cp-btn cp-btn-secondary">Back to Project</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!sow) {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <Link href={`/client/project/${project.id}`} className="sg-back">← {project.name}</Link>
          <div className="sg-state-card">
            <div className="sg-state-title">Statement of Work is being prepared</div>
            <p className="sg-state-sub">Our team is currently preparing your project agreement.</p>
          </div>
        </div>
      </div>
    );
  }

  if (versionMismatch) {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <div className="sg-state-card">
            <div className="sg-state-title">This Statement of Work has been updated</div>
            <p className="sg-state-sub">A newer version is available. Please review the latest version before signing.</p>
            <div className="sg-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>View Latest Version</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'cancelled') {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <Link href={`/client/project/${project.id}`} className="sg-back">← {project.name}</Link>
          <div className="sg-state-card">
            <div className="sg-state-title">Signing Unavailable</div>
            <p className="sg-state-sub">This Statement of Work is no longer active.</p>
            <div className="sg-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">Back to Project</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sow.status === 'superseded') {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <Link href={`/client/project/${project.id}`} className="sg-back">← {project.name}</Link>
          <div className="sg-state-card">
            <div className="sg-state-title">New Version Available</div>
            <p className="sg-state-sub">This version has been replaced by a newer Statement of Work.</p>
            <div className="sg-state-actions">
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-primary">View Latest Version</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = sow.status === 'sent' && !!sow.valid_until && sow.valid_until < todayISO();
  if (isExpired) {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <Link href={`/client/project/${project.id}`} className="sg-back">← {project.name}</Link>
          <div className="sg-state-card">
            <div className="sg-state-title">Signature Request Expired</div>
            <p className="sg-state-sub">This Statement of Work is no longer available for signing.</p>
            <div className="sg-state-actions">
              <a href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, my SOW for ${project.name} has expired — could you resend it?`)}`} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-primary">
                Contact Project Manager
              </a>
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-secondary">Back to Project</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const manager = toOne(project.project_manager);
  const sym = CURRENCY_SYMBOL[sow.currency ?? 'BDT'] ?? sow.currency ?? '';
  const services = parseBulletList(sow.scope);
  const fromSignInParam = searchParams.get('from');

  // ---- already signed / just signed ----
  if (sow.status === 'signed') {
    return (
      <div className="client-portal client-sign-root">
        <div className="sg-shell">
          <div className="sg-success-card">
            <div className="sg-success-icon">✓</div>
            <h1 className="sg-success-title">{justSigned ? 'SOW signed successfully' : 'SOW Already Signed'}</h1>
            <p className="sg-success-sub">
              {justSigned
                ? `Your Statement of Work for ${project.name} has been signed and confirmed.`
                : `This Statement of Work for ${project.name} was already signed.`}
            </p>

            <div className="sg-success-grid">
              <div><span className="sg-success-label">Project</span><p>{project.name}</p></div>
              <div><span className="sg-success-label">SOW</span><p>{sow.sow_number ?? `v${sow.version}`}</p></div>
              <div><span className="sg-success-label">Version</span><p>v{sow.version}.0</p></div>
              <div><span className="sg-success-label">Signed By</span><p>{sow.signed_by_name}</p></div>
              <div className="sg-success-full"><span className="sg-success-label">Signed On</span><p>{sow.signed_at ? formatDateTime(sow.signed_at) : ''}</p></div>
            </div>

            {sow.signature_image_url && (
              <div className="sg-success-sig-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={driveThumbnailUrl(sow.signature_image_url)} alt="Signature" />
              </div>
            )}

            <span className="cp-badge cp-badge-success sg-success-badge">Signed ✓</span>

            <div className="sg-success-next">
              <div className="sg-success-next-title">Next Step</div>
              <p>Your agency will provide the next project step shortly.</p>
            </div>

            <div className="sg-state-actions">
              <Link href={`/client/project/${project.id}`} className="cp-btn cp-btn-primary">Back to Project</Link>
              <Link href={`/client/project/${project.id}/sow${justSigned ? '?signed=1' : ''}`} className="cp-btn cp-btn-secondary">View Signed SOW</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- signing form ----
  return (
    <div className="client-portal client-sign-root">
      <div className="sg-shell">
        <Link href={fromSignInParam === 'sow' ? `/client/project/${project.id}/sow` : `/client/project/${project.id}`} className="sg-back">
          ← {fromSignInParam === 'sow' ? 'Statement of Work' : project.name}
        </Link>

        <div className="sg-breadcrumb">My Project / Statement of Work / Sign</div>
        <div className="sg-header-row">
          <div>
            <h1 className="sg-title">Sign Statement of Work</h1>
            <p className="sg-sub">Confirm the agreement details and provide your signature.</p>
          </div>
          <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">View Full SOW</Link>
        </div>

        <div className="sg-progress">
          <span className="sg-progress-step sg-done">1. Review ✓</span>
          <span className="sg-progress-line" />
          <span className={`sg-progress-step ${allChecked ? 'sg-done' : 'sg-active'}`}>2. Confirm {allChecked ? '✓' : '●'}</span>
          <span className="sg-progress-line" />
          <span className="sg-progress-step">3. Sign ○</span>
        </div>

        <div className="sg-summary-card">
          <div className="sg-summary-top">
            <div>
              <div className="sg-summary-project">{project.name}</div>
              <div className="sg-summary-client">{client.primary_contact} · {client.company_name}</div>
            </div>
            <span className="cp-badge cp-badge-pending">Awaiting Signature</span>
          </div>
          <div className="sg-summary-grid">
            <div><span className="sg-summary-label">SOW</span><p>{sow.sow_number ?? `v${sow.version}`}</p></div>
            <div><span className="sg-summary-label">Version</span><p>v{sow.version}.0</p></div>
            {sow.project_value != null && <div><span className="sg-summary-label">Project Value</span><p>{sym}{sow.project_value.toLocaleString('en-US')}</p></div>}
            {(sow.start_date || sow.delivery_date) && (
              <div>
                <span className="sg-summary-label">Timeline</span>
                <p>{sow.start_date ? formatBnDateLong(sow.start_date) : '—'} – {sow.delivery_date ? formatBnDateLong(sow.delivery_date) : '—'}</p>
              </div>
            )}
          </div>
          <Link href={`/client/project/${project.id}/sow`} className="sg-view-full-link">View Full SOW →</Link>
        </div>

        <div className="sg-panel">
          <div className="sg-panel-title">Before You Sign</div>
          {services.length > 0 && (
            <div className="sg-before-block">
              <span className="sg-before-label">Deliverables</span>
              <ul className="sg-before-list">{services.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          )}
          {sow.payment_terms && (
            <div className="sg-before-block">
              <span className="sg-before-label">Payment</span>
              <p className="sg-before-text">{sow.payment_terms.replace(/^Total project value:.*?\.\s*/, '')}</p>
            </div>
          )}
          {sow.revision_policy && (
            <div className="sg-before-block">
              <span className="sg-before-label">Revisions</span>
              <p className="sg-before-text">{sow.revision_policy}</p>
            </div>
          )}
          <p className="sg-before-note">Please review the full Statement of Work before signing.</p>
          <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">View Full SOW</Link>
        </div>

        <div className="sg-panel">
          <div className="sg-panel-title">Confirm Your Agreement</div>
          {CHECKLIST_ITEMS.map((label, i) => (
            <label className="sg-check-row" key={label}>
              <span
                className={`sg-check${checks[i] ? ' checked' : ''}`}
                role="checkbox"
                aria-checked={checks[i]}
                tabIndex={0}
                onClick={() => setChecks((prev) => prev.map((c, idx) => (idx === i ? !c : c)))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChecks((prev) => prev.map((c, idx) => (idx === i ? !c : c))); } }}
              >
                {checks[i] ? '✓' : ''}
              </span>
              <span className="sg-check-label">{label}</span>
            </label>
          ))}
          <p className="sg-legal-text">
            By signing this Statement of Work, you confirm that you have reviewed and agree to the scope, deliverables, timeline, payment terms, responsibilities and other terms described in {sow.sow_number ?? `SOW v${sow.version}`}, version v{sow.version}.0.
          </p>
        </div>

        <div className="sg-panel">
          <div className="sg-panel-title">Your Signature</div>

          <div className="cp-field">
            <label className="cp-label">Full Legal Name</label>
            <input className={`cp-input${nameError ? ' cp-input-error' : ''}`} type="text" value={fullName} onChange={(e) => { setFullName(e.target.value); setNameError(null); }} placeholder="Your full legal name" />
            {nameError && <div className="cp-error-text">{nameError}</div>}
          </div>

          <div className="sg-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={sigMethod === 'typed'} className={`sg-tab${sigMethod === 'typed' ? ' active' : ''}`} onClick={() => setSigMethod('typed')}>Type</button>
            <button type="button" role="tab" aria-selected={sigMethod === 'drawn'} className={`sg-tab${sigMethod === 'drawn' ? ' active' : ''}`} onClick={() => setSigMethod('drawn')}>Draw</button>
            <button type="button" role="tab" aria-selected={sigMethod === 'uploaded'} className={`sg-tab${sigMethod === 'uploaded' ? ' active' : ''}`} onClick={() => setSigMethod('uploaded')}>Upload</button>
          </div>

          {sigMethod === 'typed' && (
            <div className="sg-sig-interface">
              <div className="sg-typed-preview">{fullName.trim() || 'Your Signature'}</div>
              <div className="sg-sig-caption">Typed Signature — a visual representation only, not a cryptographic signature.</div>
            </div>
          )}

          {sigMethod === 'drawn' && (
            <div className="sg-sig-interface">
              <p className="sg-canvas-instruction">Draw your signature using your mouse, trackpad, finger or stylus.</p>
              <canvas
                ref={canvasRef}
                className="sg-canvas"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                aria-label="Signature drawing area"
              />
              <div className="sg-canvas-actions">
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={undoStroke} disabled={strokeCount === 0}>Undo</button>
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={clearCanvas} disabled={strokeCount === 0}>Clear</button>
              </div>
            </div>
          )}

          {sigMethod === 'uploaded' && (
            <div className="sg-sig-interface">
              {uploadError && <div className="cp-alert cp-alert-error">{uploadError}</div>}
              {uploadedUrl ? (
                <div className="sg-upload-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={driveThumbnailUrl(uploadedUrl)} alt="Uploaded signature" />
                  <div className="sg-canvas-actions">
                    <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={() => fileInputRef.current?.click()}>Replace</button>
                    <button type="button" className="cp-btn cp-btn-secondary cp-btn-sm" onClick={() => setUploadedUrl(null)}>Remove</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-block" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading && <span className="cp-spinner" />}
                  {uploading ? 'Uploading…' : 'Upload Signature'}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="sg-file-input" onChange={handleUploadFile} />
              <div className="sg-sig-caption">PNG or JPG, up to 5MB.</div>
            </div>
          )}

          <div className="sg-preview-card">
            <span className="sg-panel-title-sm">Signature Preview</span>
            <div className="sg-preview-row"><span>Signed by</span><p>{fullName.trim() || '—'}</p></div>
            <div className="sg-preview-row"><span>Company</span><p>{client.company_name}</p></div>
            <div className="sg-preview-row"><span>Method</span><p>{sigMethod === 'typed' ? 'Typed Signature' : sigMethod === 'drawn' ? 'Drawn Signature' : 'Uploaded Signature'}</p></div>
            <div className="sg-preview-row"><span>Signing Date</span><p>Will be recorded when submitted</p></div>
          </div>
        </div>

        {signError && (
          <div className="sg-panel">
            <div className="cp-alert cp-alert-error">Your signature was not submitted. Please try again.</div>
            <div className="sg-canvas-actions">
              <button type="button" className="cp-btn cp-btn-primary cp-btn-sm" onClick={() => { setSignError(null); openConfirm(); }}>Try Again</button>
              <Link href={`/client/project/${project.id}/sow`} className="cp-btn cp-btn-secondary cp-btn-sm">Back to SOW</Link>
            </div>
          </div>
        )}

        <div className="sg-trust-note">
          <strong>Secure electronic signing.</strong> Your signature and signing information will be recorded with this SOW.
        </div>

        <div className="sg-sticky-cta">
          <button type="button" className="cp-btn cp-btn-primary cp-btn-block" disabled={!canSign} onClick={openConfirm}>
            Sign &amp; Accept SOW
          </button>
          <a
            href={`${WHATSAPP_URL_BASE}?text=${encodeURIComponent(`Hi FLOW53, I have a question about my SOW for ${project.name} (${sow.sow_number ?? `v${sow.version}`}).`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sg-question-link"
          >
            Have a question about this SOW? Message Project Manager
          </a>
        </div>
      </div>

      {showConfirmModal && (
        <div className="sg-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !signing) setShowConfirmModal(false); }}>
          <div className="sg-modal-box" role="dialog" aria-modal="true" aria-labelledby="sg-modal-title">
            <h3 id="sg-modal-title" className="sg-modal-title">Sign Statement of Work?</h3>
            <p className="sg-modal-desc">
              You&apos;re about to electronically sign {sow.sow_number ?? `SOW v${sow.version}`} (v{sow.version}.0) for the {project.name} project.
            </p>
            <div className="sg-modal-grid">
              <div><span className="sg-summary-label">Client</span><p>{fullName.trim()}</p></div>
              {sow.project_value != null && <div><span className="sg-summary-label">Project Value</span><p>{sym}{sow.project_value.toLocaleString('en-US')}</p></div>}
              <div><span className="sg-summary-label">Version</span><p>v{sow.version}.0</p></div>
              <div><span className="sg-summary-label">Manager</span><p>{manager?.full_name ?? 'FLOW 53'}</p></div>
            </div>
            <p className="sg-modal-note">By continuing, you confirm that you have reviewed and agree to this Statement of Work.</p>
            <div className="sg-modal-actions">
              <button type="button" className="cp-btn cp-btn-secondary" disabled={signing} onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button type="button" className="cp-btn cp-btn-primary" disabled={signing} onClick={handleConfirmSign}>
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
