'use client';

// Screen 23 — Final Delivery (client)। projects.final_delivery_status admin
// 'ready' করলে এই স্ক্রিন সক্রিয় হয়। Deliverables = client_files
// category='deliverable' (বিদ্যমান ফাইল সিস্টেম রিইউজ)। Approve করলে
// final_delivery_status='approved' — এরপর এডমিন প্রজেক্ট ডিটেইল পেজ থেকে
// "Close Project" চাপলে Screen 24 (completion) আনলক হবে।

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject } from '@/lib/clientPortal';
import { driveThumbnailUrl } from '@/lib/driveUpload';
import '../../../client-shared.css';

type ProjectInfo = { id: string; name: string; status: string; final_delivery_status: string | null };
type FileRow = { id: string; name: string; drive_url: string };

export default function ClientFinalDeliveryPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        const [projectRes, filesRes] = await Promise.all([
          supabase.from('projects').select('id, name, status, final_delivery_status').eq('id', projectId).maybeSingle(),
          supabase.from('client_files').select('id, name, drive_url').eq('client_id', own.client.id).eq('category', 'deliverable').order('created_at', { ascending: false }),
        ]);
        setProject((projectRes.data as ProjectInfo) ?? null);
        setFiles((filesRes.data as FileRow[]) ?? []);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId, reloadKey]);

  async function handleApprove() {
    await supabase.from('projects').update({ final_delivery_status: 'approved' }).eq('id', projectId);
    setReloadKey((k) => k + 1);
  }

  async function handleRequestChanges(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await supabase.from('projects').update({ final_delivery_status: 'changes_requested', final_delivery_notes: notes.trim() || null }).eq('id', projectId);
    setSubmitting(false);
    setShowChangesForm(false);
    setNotes('');
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
        <h1 className="cp-page-title">Final Delivery</h1>

        {!project.final_delivery_status || project.final_delivery_status === null ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">Your project isn&apos;t ready for final review yet.</p>
          </div>
        ) : (
          <>
            {project.final_delivery_status === 'approved' ? (
              <div className="cp-alert cp-alert-success" style={{ marginBottom: 16 }}>
                ✓ You&apos;ve approved the final delivery. Our team will close out the project shortly.
              </div>
            ) : project.final_delivery_status === 'changes_requested' ? (
              <div className="cp-alert cp-alert-error" style={{ marginBottom: 16 }}>
                You requested changes — our team has been notified.
              </div>
            ) : (
              <div className="cp-dash-card" style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Your project is ready for final review.</p>
              </div>
            )}

            <div className="cp-dash-card">
              <div className="cp-item-title" style={{ marginBottom: 12 }}>
                Final Deliverables
              </div>
              {files.length === 0 ? (
                <p className="cp-page-empty">No deliverable files uploaded yet.</p>
              ) : (
                <div className="cp-item-list" style={{ gap: 8 }}>
                  {files.map((f) => (
                    <a key={f.id} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="cp-item-link" style={{ display: 'block' }}>
                      📁 {f.name}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {project.final_delivery_status === 'ready' &&
              (showChangesForm ? (
                <form className="cp-dash-card" onSubmit={handleRequestChanges} style={{ marginTop: 16 }}>
                  <div className="cp-field">
                    <label className="cp-label">What needs to change?</label>
                    <textarea className="cp-input" value={notes} onChange={(e) => setNotes(e.target.value)} required autoFocus />
                  </div>
                  <div className="cp-item-actions">
                    <button type="button" className="cp-btn cp-btn-secondary" onClick={() => setShowChangesForm(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting}>
                      {submitting ? 'পাঠানো হচ্ছে…' : 'Submit'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="cp-item-actions" style={{ marginTop: 16 }}>
                  <button className="cp-btn cp-btn-primary" onClick={handleApprove}>
                    Approve Final Delivery
                  </button>
                  <button className="cp-btn cp-btn-secondary" onClick={() => setShowChangesForm(true)}>
                    Request Changes
                  </button>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
