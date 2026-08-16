'use client';

// Screen 17 — Feedback (client)। ক্লায়েন্ট নতুন ফিডব্যাক জমা দিতে পারে (title,
// comment, ঐচ্ছিক attachment — বিদ্যমান Drive পাইপলাইন দিয়ে) আর নিজের আগের
// ফিডব্যাকগুলোর স্ট্যাটাস দেখতে পারে।

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive } from '@/lib/driveUpload';
import { relativeTimeBn } from '@/lib/format';
import '../../../client-shared.css';

type Feedback = { id: string; title: string; description: string | null; attachment_url: string | null; status: string; created_at: string };
type ProjectInfo = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = { new: 'Awaiting Review', in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Not Actioned' };
const STATUS_BADGE: Record<string, string> = { new: 'cp-badge-pending', in_progress: 'cp-badge-pending', resolved: 'cp-badge-success' };

export default function ClientFeedbackPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [items, setItems] = useState<Feedback[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
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
        const { data } = await supabase.from('client_feedback').select('id, title, description, attachment_url, status, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
        setItems((data as Feedback[]) ?? []);
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
    const { error: insertError } = await supabase.from('client_feedback').insert({
      project_id: project.id,
      client_id: client.id,
      title: title.trim(),
      description: comment.trim() || null,
      attachment_url: attachmentUrl,
    });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setTitle('');
    setComment('');
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
        <h1 className="cp-page-title">Feedback</h1>

        {showForm ? (
          <form className="cp-dash-card" onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
            {error && <div className="cp-alert cp-alert-error">{error}</div>}
            <div className="cp-field">
              <label className="cp-label">Title</label>
              <input className="cp-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </div>
            <div className="cp-field">
              <label className="cp-label">Comment</label>
              <textarea className="cp-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="আপনার মতামত বিস্তারিত লিখুন…" />
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
                {submitting ? 'জমা হচ্ছে…' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        ) : (
          <button className="cp-btn cp-btn-primary cp-btn-block" style={{ marginBottom: 20 }} onClick={() => setShowForm(true)}>
            Provide Feedback
          </button>
        )}

        {items.length === 0 ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">No feedback requests yet.</p>
          </div>
        ) : (
          <div className="cp-item-list">
            {items.map((f) => (
              <div className="cp-dash-card" key={f.id}>
                <div className="cp-item-top">
                  <div>
                    <span className="cp-item-title">{f.title}</span>
                    <div className="cp-item-meta">{relativeTimeBn(f.created_at)}</div>
                  </div>
                  <span className={`cp-badge ${STATUS_BADGE[f.status] ?? 'cp-badge-pending'}`}>{STATUS_LABEL[f.status] ?? f.status}</span>
                </div>
                {f.description && <p className="cp-item-desc">{f.description}</p>}
                {f.attachment_url && (
                  <a href={f.attachment_url} target="_blank" rel="noopener noreferrer" className="cp-item-link">
                    View attachment ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
