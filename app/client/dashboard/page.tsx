'use client';

// Screen 5 — Client Empty Dashboard। Onboarding (Screen 4) শেষ করা ক্লায়েন্টের
// প্রথম ড্যাশবোর্ড, admin এখনো প্রজেক্ট তৈরি না করা পর্যন্ত। প্রোফাইল-কমপ্লিশন %
// real client_requirements ডেটা থেকে বের করা হয় (fake না)। "Upload Additional
// Files" একই Drive পাইপলাইন রিইউজ করে; "Message Us" এখনো ইন-অ্যাপ Messages
// (Screen 18) তৈরি না হওয়ায় ফাঁকা বাটনের বদলে বিদ্যমান হোয়াটসঅ্যাপ চ্যানেলে পাঠায়।

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType } from '@/lib/driveUpload';
import '../client-shared.css';
import './dashboard.css';

const WHATSAPP_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20a%20client%20and%20I%27d%20like%20to%20get%20in%20touch%20about%20my%20project.';

type Requirements = {
  project_name: string | null;
  project_type: string | null;
  project_description: string | null;
  goals: string | null;
  target_audience: string | null;
  required_features: string | null;
  expected_timeline: string | null;
  budget_range: string | null;
  reference_notes: string | null;
};

type ProjectRow = { id: string; name: string; status: string; progress: number };

type PendingFile = {
  key: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }

        const { data: req } = await supabase
          .from('client_requirements')
          .select('project_name, project_type, project_description, goals, target_audience, required_features, expected_timeline, budget_range, reference_notes')
          .eq('client_id', own.id)
          .maybeSingle();

        if (!req) {
          router.replace('/client/onboarding');
          return;
        }

        const { data: projectRows } = await supabase.from('projects').select('id, name, status, progress').eq('client_id', own.id).order('created_at', { ascending: false }).limit(1);

        setClient(own);
        setRequirements(req as Requirements);
        setProject((projectRows?.[0] as ProjectRow) ?? null);
        setLoading(false);
      } catch {
        // সেশন/নেটওয়ার্ক চেক ব্যর্থ হলেও "লোড হচ্ছে…"-তে আটকে না থেকে সাইন-ইনে পাঠানো হলো।
        router.replace('/client/sign-in');
      }
    })();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/client');
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0 || !client) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      router.replace('/client/sign-in');
      return;
    }

    for (const file of selected) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setFiles((prev) => [...prev, { key, file, progress: 0, status: 'uploading' }]);

      uploadFileToDrive(file, accessToken, (pct) => {
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, progress: pct } : f)));
      })
        .then(async (result) => {
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'done', progress: 100 } : f)));
          await supabase.from('client_files').insert({
            client_id: client.id,
            name: file.name,
            file_type: guessFileType(file),
            size_bytes: file.size,
            drive_url: result.webViewLink,
            category: 'other',
            uploaded_by: 'client',
          });
          setSavedCount((n) => n + 1);
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।';
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error', error: message } : f)));
        });
    }
  }

  if (loading || !client || !requirements) {
    return (
      <div className="client-portal client-dashboard-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  const optionalFields = [
    client.designation,
    client.website,
    client.industry,
    client.company_size,
    requirements.project_type,
    requirements.project_description,
    requirements.goals,
    requirements.target_audience,
    requirements.required_features,
    requirements.expected_timeline,
    requirements.budget_range,
    requirements.reference_notes,
  ];
  const totalFields = optionalFields.length + 3; // + fullName/companyName/projectName, always filled here
  const filledCount = optionalFields.filter((v) => v && v.trim() !== '').length + 3;
  const completion = Math.round((filledCount / totalFields) * 100);

  return (
    <div className="client-portal client-dashboard-root">
      <div className="cp-dash-shell">
        <div className="cp-dash-top">
          <div className="cp-brand" style={{ marginBottom: 0 }}>
            <div className="cp-brand-mark" aria-hidden="true"></div>
            <div className="cp-brand-text">FLOW 53</div>
          </div>
          <button type="button" className="cp-btn cp-btn-ghost" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

        <h1 className="db-welcome">Welcome, {client.primary_contact ?? client.company_name}</h1>
        <p className="db-welcome-sub">{client.company_name}</p>

        <div className="cp-dash-card db-status-card">
          <div className="db-status-row">
            <span className="cp-badge cp-badge-success">✓ Information submitted successfully</span>
            <span className="cp-badge cp-badge-pending">Waiting for Agency Review</span>
          </div>

          <div className="db-progress-row">
            <div className="db-progress-label">
              <span>Profile Completion</span>
              <span>{completion}%</span>
            </div>
            <div className="ob-file-progress" style={{ width: '100%' }}>
              <div className="ob-file-progress-bar" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>

        {project ? (
          <Link href={`/client/project/${project.id}`} className="cp-dash-card db-project-card">
            <div className="db-section-title">Your Project</div>
            <div className="db-project-name">{project.name}</div>
            <div className="db-project-meta">
              <span className="cp-badge cp-badge-pending" style={{ textTransform: 'capitalize' }}>
                {project.status}
              </span>
              <span className="db-project-progress">{project.progress}% complete</span>
              <span className="db-project-arrow">View project →</span>
            </div>
          </Link>
        ) : (
          <div className="cp-dash-card db-empty-card">
            <div className="db-empty-icon" aria-hidden="true">
              ⌛
            </div>
            <div className="db-empty-title">No project yet</div>
            <p className="db-empty-desc">Your project will appear here once our team creates it.</p>
          </div>
        )}

        <div className="db-actions-row">
          <button
            type="button"
            className="cp-btn cp-btn-primary"
            onClick={() => {
              setUploadOpen((v) => !v);
            }}
          >
            Upload Additional Files
          </button>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-secondary">
            Message Us
          </a>
        </div>

        {uploadOpen && (
          <div className="cp-dash-card">
            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
            <button type="button" className="cp-btn cp-btn-secondary cp-btn-block ob-upload-trigger" onClick={() => fileInputRef.current?.click()}>
              + Choose Files
            </button>

            {files.length > 0 && (
              <div className="ob-file-list" style={{ marginTop: 14, marginBottom: 0 }}>
                {files.map((f) => (
                  <div className="ob-file-row" key={f.key}>
                    <div className="ob-file-info">
                      <span className="ob-file-name">{f.file.name}</span>
                      <span className="ob-file-meta">{formatBytes(f.file.size)}</span>
                    </div>
                    {f.status === 'uploading' && (
                      <div className="ob-file-progress">
                        <div className="ob-file-progress-bar" style={{ width: `${f.progress}%` }} />
                      </div>
                    )}
                    {f.status === 'done' && <span className="cp-badge cp-badge-success">Uploaded</span>}
                    {f.status === 'error' && (
                      <span className="cp-badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                        {f.error ?? 'Failed'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {savedCount > 0 && <p className="cp-hint" style={{ marginTop: 10, marginBottom: 0 }}>{savedCount} file(s) shared with your project.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
