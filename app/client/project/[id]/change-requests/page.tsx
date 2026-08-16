'use client';

// Screen 21 — Change Request (client)। ক্লায়েন্ট নতুন চেঞ্জ রিকোয়েস্ট জমা দেয়
// (title, description, reason, ঐচ্ছিক attachment) — এডমিন রিভিউ করে cost/time/
// status সেট করে (/projects/[id]/change-requests)। ক্লায়েন্ট শুধু insert+read
// করতে পারে, নিজের জমা দেওয়ার পর admin-সেট ফিল্ড বদলাতে পারবে না (RLS-এ কোনো
// client update পলিসি নেই এই টেবিলে)।

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive } from '@/lib/driveUpload';
import { relativeTimeBn } from '@/lib/format';
import '../../../client-shared.css';

type ChangeRequest = { id: string; title: string; description: string | null; reason: string | null; status: string; additional_cost: number | null; additional_time: string | null; admin_notes: string | null; created_at: string };
type ProjectInfo = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', under_review: 'Under Review', approved: 'Approved', rejected: 'Rejected' };
const STATUS_BADGE: Record<string, string> = { pending: 'cp-badge-pending', under_review: 'cp-badge-pending', approved: 'cp-badge-success' };

export default function ClientChangeRequestsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [items, setItems] = useState<ChangeRequest[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(own.project);
        setClient(own.client);
        const { data } = await supabase.from('change_requests').select('id, title, description, reason, status, additional_cost, additional_time, admin_notes, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
        setItems((data as ChangeRequest[]) ?? []);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId, reloadKey]);

  async function handleAttachment(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    try {
      const result = await uploadFileToDrive(file, accessToken);
      setAttachmentUrl(result.webViewLink);
    } catch {
      // no-op
    }
    setUploading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !client || !project) return;
    setError(null);
    setSubmitting(true);
    const { error: insertError } = await supabase.from('change_requests').insert({
      project_id: project.id,
      client_id: client.id,
      title: title.trim(),
      description: description.trim() || null,
      reason: reason.trim() || null,
      attachment_url: attachmentUrl,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle('');
    setDescription('');
    setReason('');
    setAttachmentUrl(null);
    setShowForm(false);
    setReloadKey((k) => k + 1);
  }

  if (loading || !project) {
    return (
      <div className="client-portal">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal">
      <div className="cp-page-shell">
        <Link href={`/client/project/${project.id}`} className="cp-page-back">
          ← {project.name}
        </Link>
        <h1 className="cp-page-title">Change Requests</h1>

        {showForm ? (
          <form className="cp-dash-card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
            {error && <div className="cp-alert cp-alert-error">{error}</div>}
            <div className="cp-field">
              <label className="cp-label">Title</label>
              <input className="cp-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="যেমন: Add Dark Mode" required autoFocus />
            </div>
            <div className="cp-field">
              <label className="cp-label">Description</label>
              <textarea className="cp-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="কী পরিবর্তন চান?" />
            </div>
            <div className="cp-field">
              <label className="cp-label">Reason</label>
              <textarea className="cp-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="কেন এটা দরকার?" />
            </div>
            <input ref={fileInputRef} type="file" hidden onChange={handleAttachment} />
            <button type="button" className="cp-btn cp-btn-secondary cp-btn-block" style={{ marginBottom: 16 }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'আপলোড হচ্ছে…' : attachmentUrl ? '✓ Attachment added' : '+ Upload Attachment (optional)'}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting || !title.trim()}>
                {submitting ? 'জমা হচ্ছে…' : 'Submit Request'}
              </button>
            </div>
          </form>
        ) : (
          <button className="cp-btn cp-btn-primary cp-btn-block" style={{ marginBottom: 20 }} onClick={() => setShowForm(true)}>
            + New Change Request
          </button>
        )}

        {items.length === 0 ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">No change requests yet.</p>
          </div>
        ) : (
          <div className="cp-item-list">
            {items.map((cr) => (
              <div className="cp-dash-card" key={cr.id}>
                <div className="cp-item-top">
                  <div>
                    <span className="cp-item-title">{cr.title}</span>
                    <div className="cp-item-meta">{relativeTimeBn(cr.created_at)}</div>
                  </div>
                  <span className={`cp-badge ${STATUS_BADGE[cr.status] ?? 'cp-badge-pending'}`}>{STATUS_LABEL[cr.status] ?? cr.status}</span>
                </div>
                {cr.description && <p className="cp-item-desc">{cr.description}</p>}
                {(cr.additional_cost != null || cr.additional_time) && (
                  <div className="cp-item-meta" style={{ marginBottom: 6 }}>
                    {cr.additional_cost != null && <>Additional Cost: ৳{cr.additional_cost.toLocaleString('en-US')} </>}
                    {cr.additional_time && <>· Additional Time: {cr.additional_time}</>}
                  </div>
                )}
                {cr.admin_notes && <p className="cp-item-desc" style={{ fontStyle: 'italic' }}>{cr.admin_notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
