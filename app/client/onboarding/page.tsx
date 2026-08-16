'use client';

// Screen 4 — Client Onboarding। ৫-স্টেপ ফর্ম: Personal → Company → Project →
// Requirements → Upload Files। ফাইল সিলেক্ট করার সাথে সাথেই আপলোড শুরু হয় (Drive
// resumable pipeline, lib/driveUpload.ts — team-এর Files ফিচারের সাথে একই পাইপলাইন,
// শুধু ইউজার এখন team-এর বদলে client)। শেষ স্টেপে Submit করলে clients রো আপডেট +
// client_requirements ইনসার্ট + সফল হওয়া client_files ইনসার্ট হয়, তারপর ড্যাশবোর্ডে।

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, hasSubmittedRequirements, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType } from '@/lib/driveUpload';
import '../client-shared.css';
import './onboarding.css';

const INDUSTRY_OPTIONS = ['SaaS / Software', 'E-commerce', 'Healthcare', 'Finance', 'Education', 'Real Estate', 'Marketing / Agency', 'Manufacturing', 'Other'];
const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '500+'];
const PROJECT_TYPE_OPTIONS = ['Web App', 'Mobile App', 'Website / Landing Page', 'Design System', 'Branding', 'Other'];
const TIMELINE_OPTIONS = ['Less than 1 month', '1-3 months', '3-6 months', '6+ months', 'Not sure yet'];
const BUDGET_OPTIONS = ['Under $2,000', '$2,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', '$25,000+', 'Not sure yet'];

const STEP_TITLES = ['Personal Information', 'Company Information', 'Project Information', 'Project Requirements', 'Upload Files'];

type FormState = {
  fullName: string;
  designation: string;
  companyName: string;
  website: string;
  industry: string;
  companySize: string;
  projectName: string;
  projectType: string;
  projectDescription: string;
  goals: string;
  targetAudience: string;
  requiredFeatures: string;
  expectedTimeline: string;
  budgetRange: string;
  referenceNotes: string;
};

type PendingFile = {
  key: string;
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  result?: { id: string; webViewLink: string };
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientOnboarding() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);

  const [form, setForm] = useState<FormState>({
    fullName: '',
    designation: '',
    companyName: '',
    website: '',
    industry: '',
    companySize: '',
    projectName: '',
    projectType: '',
    projectDescription: '',
    goals: '',
    targetAudience: '',
    requiredFeatures: '',
    expectedTimeline: '',
    budgetRange: '',
    referenceNotes: '',
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClient();
        if (!own) {
          router.replace('/client/sign-in');
          return;
        }
        const submitted = await hasSubmittedRequirements(own.id);
        if (submitted) {
          router.replace('/client/dashboard');
          return;
        }
        setClient(own);
        setForm((f) => ({
          ...f,
          fullName: own.primary_contact ?? '',
          designation: own.designation ?? '',
          companyName: own.company_name ?? '',
          website: own.website ?? '',
          industry: own.industry ?? '',
          companySize: own.company_size ?? '',
        }));
        setLoading(false);
      } catch {
        // সেশন/নেটওয়ার্ক চেক ব্যর্থ হলেও "লোড হচ্ছে…"-তে আটকে না থেকে সাইন-ইনে পাঠানো হলো।
        router.replace('/client/sign-in');
      }
    })();
  }, [router]);

  function validateStep(current: number): string | null {
    if (current === 1 && !form.fullName.trim()) return 'Full Name আবশ্যক।';
    if (current === 2 && !form.companyName.trim()) return 'Company Name আবশ্যক।';
    if (current === 3 && !form.projectName.trim()) return 'Project Name আবশ্যক।';
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;

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
        .then((result) => {
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'done', progress: 100, result } : f)));
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'আপলোড ব্যর্থ হয়েছে।';
          setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, status: 'error', error: message } : f)));
        });
    }
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => f.key !== key));
  }

  const anyUploading = files.some((f) => f.status === 'uploading');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    setSubmitError(null);
    setSubmitting(true);

    const { error: clientUpdateError } = await supabase
      .from('clients')
      .update({
        primary_contact: form.fullName.trim(),
        designation: form.designation.trim() || null,
        company_name: form.companyName.trim(),
        website: form.website.trim() || null,
        industry: form.industry || null,
        company_size: form.companySize || null,
        status: 'submitted',
      })
      .eq('id', client.id);

    if (clientUpdateError) {
      setSubmitError(clientUpdateError.message);
      setSubmitting(false);
      return;
    }

    const { error: requirementsError } = await supabase.from('client_requirements').insert({
      client_id: client.id,
      project_name: form.projectName.trim(),
      project_type: form.projectType || null,
      project_description: form.projectDescription.trim() || null,
      goals: form.goals.trim() || null,
      target_audience: form.targetAudience.trim() || null,
      required_features: form.requiredFeatures.trim() || null,
      expected_timeline: form.expectedTimeline || null,
      budget_range: form.budgetRange || null,
      reference_notes: form.referenceNotes.trim() || null,
    });

    if (requirementsError) {
      setSubmitError(requirementsError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from('activity_log').insert({
      actor_id: null,
      action: 'requirements_submitted',
      entity_type: 'client',
      entity_id: client.id,
      detail: 'ক্লায়েন্ট প্রজেক্ট রিকোয়ারমেন্ট জমা দিয়েছে',
    });

    const doneFiles = files.filter((f) => f.status === 'done' && f.result);
    if (doneFiles.length > 0) {
      const rows = doneFiles.map((f) => ({
        client_id: client.id,
        name: f.file.name,
        file_type: guessFileType(f.file),
        size_bytes: f.file.size,
        drive_url: f.result!.webViewLink,
        category: 'requirements',
        uploaded_by: 'client',
      }));
      const { error: filesError } = await supabase.from('client_files').insert(rows);
      if (filesError) {
        // requirements ইতিমধ্যে জমা হয়ে গেছে — ফাইল-ইনসার্ট ব্যর্থ হলেও ইউজারকে
        // আটকে না রেখে ড্যাশবোর্ডে পাঠানো হচ্ছে, শুধু একটা সতর্কতা দেখিয়ে।
        console.error('client_files insert failed:', filesError.message);
      }
    }

    router.push('/client/dashboard');
  }

  if (loading) {
    return (
      <div className="client-portal client-onboarding-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal client-onboarding-root">
      <div className="cp-auth-shell">
        <div className="cp-card cp-card-wide">
          <div className="cp-brand">
            <div className="cp-brand-mark" aria-hidden="true"></div>
            <div className="cp-brand-text">FLOW 53</div>
          </div>

          <div className="cp-steps">
            {STEP_TITLES.map((_, i) => (
              <div key={i} className={`cp-step-dot ${i + 1 < step ? 'cp-step-done' : ''} ${i + 1 === step ? 'cp-step-active' : ''}`} />
            ))}
          </div>
          <div className="cp-step-label">
            Step {step} of 5 — <strong>{STEP_TITLES[step - 1]}</strong>
          </div>

          <h1 className="cp-title" style={{ textAlign: 'left' }}>
            Tell Us About Your Project
          </h1>
          <p className="cp-subtitle" style={{ textAlign: 'left' }}>
            এই তথ্য আমাদের টিমকে আপনার প্রজেক্ট বুঝতে ও সঠিকভাবে শুরু করতে সাহায্য করবে।
          </p>

          <form onSubmit={handleSubmit}>
            {stepError && <div className="cp-alert cp-alert-error">{stepError}</div>}
            {submitError && <div className="cp-alert cp-alert-error">{submitError}</div>}

            {step === 1 && (
              <>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-fullname">
                    Full Name
                  </label>
                  <input id="ob-fullname" type="text" className="cp-input" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} placeholder="Jane Doe" />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-designation">
                    Designation <span className="cp-label-optional">(optional)</span>
                  </label>
                  <input id="ob-designation" type="text" className="cp-input" value={form.designation} onChange={(e) => setField('designation', e.target.value)} placeholder="Founder, Marketing Lead…" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-company">
                    Company Name
                  </label>
                  <input id="ob-company" type="text" className="cp-input" value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} placeholder="Acme Inc." />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-website">
                    Website <span className="cp-label-optional">(optional)</span>
                  </label>
                  <input id="ob-website" type="text" className="cp-input" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://acme.com" />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="ob-industry">
                      Industry <span className="cp-label-optional">(optional)</span>
                    </label>
                    <select id="ob-industry" className="cp-input" value={form.industry} onChange={(e) => setField('industry', e.target.value)}>
                      <option value="">Select…</option>
                      {INDUSTRY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="ob-size">
                      Company Size <span className="cp-label-optional">(optional)</span>
                    </label>
                    <select id="ob-size" className="cp-input" value={form.companySize} onChange={(e) => setField('companySize', e.target.value)}>
                      <option value="">Select…</option>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-projectname">
                    Project Name
                  </label>
                  <input id="ob-projectname" type="text" className="cp-input" value={form.projectName} onChange={(e) => setField('projectName', e.target.value)} placeholder="Acme Website Redesign" />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-projecttype">
                    Project Type <span className="cp-label-optional">(optional)</span>
                  </label>
                  <select id="ob-projecttype" className="cp-input" value={form.projectType} onChange={(e) => setField('projectType', e.target.value)}>
                    <option value="">Select…</option>
                    {PROJECT_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-projectdesc">
                    Project Description <span className="cp-label-optional">(optional)</span>
                  </label>
                  <textarea id="ob-projectdesc" className="cp-input" value={form.projectDescription} onChange={(e) => setField('projectDescription', e.target.value)} placeholder="একটা সংক্ষিপ্ত বিবরণ দিন…" />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-goals">
                    Goals <span className="cp-label-optional">(optional)</span>
                  </label>
                  <textarea id="ob-goals" className="cp-input" value={form.goals} onChange={(e) => setField('goals', e.target.value)} placeholder="এই প্রজেক্ট দিয়ে কী অর্জন করতে চান?" />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-audience">
                    Target Audience <span className="cp-label-optional">(optional)</span>
                  </label>
                  <input id="ob-audience" type="text" className="cp-input" value={form.targetAudience} onChange={(e) => setField('targetAudience', e.target.value)} placeholder="কারা এটা ব্যবহার করবে?" />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-features">
                    Required Features <span className="cp-label-optional">(optional)</span>
                  </label>
                  <textarea id="ob-features" className="cp-input" value={form.requiredFeatures} onChange={(e) => setField('requiredFeatures', e.target.value)} placeholder="কী কী ফিচার দরকার?" />
                </div>
                <div className="cp-field-row">
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="ob-timeline">
                      Expected Timeline <span className="cp-label-optional">(optional)</span>
                    </label>
                    <select id="ob-timeline" className="cp-input" value={form.expectedTimeline} onChange={(e) => setField('expectedTimeline', e.target.value)}>
                      <option value="">Select…</option>
                      {TIMELINE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="ob-budget">
                      Budget Range <span className="cp-label-optional">(optional)</span>
                    </label>
                    <select id="ob-budget" className="cp-input" value={form.budgetRange} onChange={(e) => setField('budgetRange', e.target.value)}>
                      <option value="">Select…</option>
                      {BUDGET_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="ob-refs">
                    References <span className="cp-label-optional">(optional)</span>
                  </label>
                  <textarea id="ob-refs" className="cp-input" value={form.referenceNotes} onChange={(e) => setField('referenceNotes', e.target.value)} placeholder="পছন্দের ওয়েবসাইট/অ্যাপ, ইনস্পিরেশন লিংক…" />
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
                <button type="button" className="cp-btn cp-btn-secondary cp-btn-block ob-upload-trigger" onClick={() => fileInputRef.current?.click()}>
                  + Add Files
                </button>
                <p className="cp-hint" style={{ marginBottom: 16 }}>
                  ব্র্যান্ড গাইডলাইন, রেফারেন্স, ডকুমেন্ট — যা কিছু প্রাসঙ্গিক। ঐচ্ছিক, পরে ড্যাশবোর্ড থেকেও আপলোড করা যাবে।
                </p>

                {files.length > 0 && (
                  <div className="ob-file-list">
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
                        {f.status === 'error' && <span className="cp-badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>{f.error ?? 'Failed'}</span>}
                        <button type="button" className="cp-btn cp-btn-ghost" onClick={() => removeFile(f.key)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="ob-nav-row">
              {step > 1 ? (
                <button type="button" className="cp-btn cp-btn-secondary" onClick={goBack} disabled={submitting}>
                  Back
                </button>
              ) : (
                <span />
              )}
              {step < 5 ? (
                <button type="button" className="cp-btn cp-btn-primary" onClick={goNext}>
                  Next
                </button>
              ) : (
                <button type="submit" className="cp-btn cp-btn-primary" disabled={submitting || anyUploading}>
                  {submitting && <span className="cp-spinner" />}
                  {submitting ? 'জমা হচ্ছে…' : 'Submit Information'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
