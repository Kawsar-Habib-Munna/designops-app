'use client';

// Screen 20 — Approvals (client)। এডমিন যা "Awaiting Approval" হিসেবে পাঠায়
// (দেখুন /projects/[id]/approvals) তার উপর ক্লায়েন্ট Approve বা Request Changes
// করে। সরাসরি client_approvals-এ UPDATE পলিসি দেওয়া আছে (RLS নিজের project-এর
// রো-তেই স্কোপড) — SOW-এর মতো টাকা/লিগ্যাল ঝুঁকি নেই বলে RPC লাগেনি।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject } from '@/lib/clientPortal';
import { relativeTimeBn } from '@/lib/format';
import '../../../client-shared.css';

type Approval = { id: string; item: string; status: string; comment: string | null; created_at: string };
type ProjectInfo = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = { awaiting: 'Awaiting Approval', approved: 'Approved ✓', changes_requested: 'Changes Requested' };
const STATUS_BADGE: Record<string, string> = { awaiting: 'cp-badge-pending', approved: 'cp-badge-success', changes_requested: 'cp-badge-pending' };

export default function ClientApprovalsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [items, setItems] = useState<Approval[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(own.project);
        const { data } = await supabase.from('client_approvals').select('id, item, status, comment, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
        setItems((data as Approval[]) ?? []);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId, reloadKey]);

  async function handleApprove(id: string) {
    await supabase.from('client_approvals').update({ status: 'approved', responded_at: new Date().toISOString() }).eq('id', id);
    setReloadKey((k) => k + 1);
  }

  async function handleRequestChanges(e: FormEvent, id: string) {
    e.preventDefault();
    setSubmitting(true);
    await supabase.from('client_approvals').update({ status: 'changes_requested', comment: comment.trim() || null, responded_at: new Date().toISOString() }).eq('id', id);
    setSubmitting(false);
    setRespondingId(null);
    setComment('');
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
        <h1 className="cp-page-title">Approvals</h1>

        {items.length === 0 ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">No approval requests.</p>
          </div>
        ) : (
          <div className="cp-item-list">
            {items.map((a) => (
              <div className="cp-dash-card" key={a.id}>
                <div className="cp-item-top">
                  <div>
                    <span className="cp-item-title">{a.item}</span>
                    <div className="cp-item-meta">{relativeTimeBn(a.created_at)}</div>
                  </div>
                  <span className={`cp-badge ${STATUS_BADGE[a.status] ?? 'cp-badge-pending'}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
                </div>
                {a.comment && <p className="cp-item-desc">{a.comment}</p>}

                {a.status === 'awaiting' &&
                  (respondingId === a.id ? (
                    <form onSubmit={(e) => handleRequestChanges(e, a.id)} style={{ marginTop: 10 }}>
                      <div className="cp-field">
                        <label className="cp-label">What needs to change?</label>
                        <textarea className="cp-input" value={comment} onChange={(e) => setComment(e.target.value)} required autoFocus />
                      </div>
                      <div className="cp-item-actions">
                        <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setRespondingId(null)}>
                          Cancel
                        </button>
                        <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
                          {submitting ? 'পাঠানো হচ্ছে…' : 'Submit'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="cp-item-actions">
                      <button className="cp-btn cp-btn-primary" onClick={() => handleApprove(a.id)}>
                        Approve
                      </button>
                      <button className="cp-btn cp-btn-secondary" onClick={() => setRespondingId(a.id)}>
                        Request Changes
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
