'use client';

// Screen 19 — Files & Documents (client)। বিদ্যমান client_files টেবিল রিইউজ
// (onboarding/dashboard-এও এটাই ব্যবহার হয়) — category অনুযায়ী গ্রুপ করে দেখায়।
// hidden_from_client=true ফাইল RLS-এই ফিল্টার হয়ে যায় (দেখুন sql/schema.sql-এর
// ফেজ ৫), তাই এখানে আলাদা করে লুকানোর লজিক লাগেনি।

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';
import { formatBnDate } from '@/lib/format';
import '../../../client-shared.css';

type FileRow = { id: string; name: string; file_type: string | null; size_bytes: number | null; drive_url: string; category: string; uploaded_by: string; created_at: string };
type ProjectInfo = { id: string; name: string };

const CATEGORY_LABEL: Record<string, string> = {
  requirements: 'Project Requirements',
  sow: 'Statement of Work',
  invoice: 'Invoices',
  receipt: 'Receipts',
  design: 'Design Files',
  deliverable: 'Deliverables',
  other: 'Other',
};
const CATEGORY_ORDER = ['requirements', 'sow', 'invoice', 'receipt', 'design', 'deliverable', 'other'];

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientFilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

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
        const { data } = await supabase.from('client_files').select('id, name, file_type, size_bytes, drive_url, category, uploaded_by, created_at').eq('client_id', own.client.id).order('created_at', { ascending: false });
        setFiles((data as FileRow[]) ?? []);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router, projectId, reloadKey]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !client) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFileToDrive(file, accessToken, setUploadProgress);
      await supabase.from('client_files').insert({
        client_id: client.id,
        name: file.name,
        file_type: guessFileType(file),
        size_bytes: file.size,
        drive_url: result.webViewLink,
        category: 'other',
        uploaded_by: 'client',
      });
      setReloadKey((k) => k + 1);
    } catch {
      // silently fail — upload বাটন আবার দেখা যাবে, ইউজার আবার চেষ্টা করতে পারবে
    }
    setUploading(false);
  }

  if (loading || !project) {
    return (
      <div className="client-portal">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({ cat, items: files.filter((f) => f.category === cat) })).filter((g) => g.items.length > 0);

  return (
    <div className="client-portal">
      <div className="cp-page-shell">
        <Link href={`/client/project/${project.id}`} className="cp-page-back">
          ← {project.name}
        </Link>
        <h1 className="cp-page-title">Files & Documents</h1>

        <input ref={fileInputRef} type="file" hidden onChange={handleUpload} />
        <button type="button" className="cp-btn cp-btn-secondary cp-btn-block" style={{ marginBottom: 20 }} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? `আপলোড হচ্ছে… ${uploadProgress}%` : '+ Upload File'}
        </button>

        {files.length === 0 ? (
          <div className="cp-dash-card">
            <p className="cp-page-empty">No files have been shared yet.</p>
          </div>
        ) : (
          grouped.map(({ cat, items }) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 10 }}>{CATEGORY_LABEL[cat] ?? cat}</div>
              <div className="cp-item-list" style={{ gap: 8 }}>
                {items.map((f) => (
                  <a className="cp-dash-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, marginBottom: 0 }} key={f.id} href={driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div className="cp-item-meta">
                        {formatBytes(f.size_bytes)} · {f.uploaded_by === 'client' ? 'You' : 'FLOW 53'} · {formatBnDate(f.created_at)}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
