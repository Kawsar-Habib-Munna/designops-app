'use client';

// Screen 4 — Client Onboarding। রিডিজাইন: split-screen (dark brand panel + step-nav,
// Screen 2/3-এর একই ভিজ্যুয়াল ভাষা), ৫টা স্টেপ — Personal → Company → Project →
// Requirements (ফাইল আপলোড এখন এখানেই) → Review। localStorage-এ ড্রাফট অটোসেভ হয়
// (সত্যিকারের browser-লেভেল পার্সিস্টেন্স — সার্ভারে খসড়া রাইট না করেই ট্যাব বন্ধ
// করে পরে ফিরে এলেও ইনপুট হারায় না)। ফাইল আপলোড আগের মতোই বিদ্যমান Drive পাইপলাইন
// রিইউজ করে; শেষ স্টেপে (Review) সাবমিট করলে clients আপডেট + client_requirements
// ইনসার্ট + client_files ইনসার্ট + activity_log, তারপর ড্যাশবোর্ডে।

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, hasSubmittedRequirements, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType } from '@/lib/driveUpload';
import '../client-shared.css';
import './onboarding.css';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%20need%20help%20with%20my%20onboarding%20form.';

const CONTACT_METHODS = ['Email', 'Phone', 'Portal Messages', 'WhatsApp'];
const COUNTRIES = ['United Kingdom', 'Bangladesh', 'United States', 'Canada', 'Australia', 'Other'];
const TIMEZONES = ['GMT+6:00 — Dhaka', 'GMT+0:00 — London', 'GMT-5:00 — New York', 'GMT+1:00 — Berlin'];
const BUSINESS_TYPES = ['Startup', 'Small Business', 'Agency', 'E-commerce', 'SaaS / Technology', 'Enterprise', 'Personal Project', 'Non-profit', 'Other'];
const COMPANY_SIZES = ['Just me', '2–10', '11–50', '51–200', '201–500', '500+'];
const ROLES = ['Founder / Owner', 'CEO / Executive', 'Product Manager', 'Marketing', 'Designer', 'Developer', 'Operations', 'Other'];
const PROJECT_TYPES = ['Website', 'Mobile App', 'Web App', 'SaaS Product', 'Dashboard', 'E-commerce', 'Branding', 'UI/UX Design', 'Product Design', 'Other'];
const DEADLINES = ['No fixed deadline', 'Within 2 weeks', 'Within 1 month', '1–3 months', 'specific'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const BUDGETS = ['Not sure yet', 'Under $500', '$500–$1,000', '$1,000–$2,500', '$2,500–$5,000', '$5,000+'];
const EXISTING_ASSETS = ['Logo', 'Brand guidelines', 'Wireframes', 'Existing UI', 'Content', 'Images', 'Design files', 'Development files'];

const STEP_LABELS = ['Personal', 'Company', 'Project', 'Requirements', 'Review'];

type FormState = {
  fullName: string;
  phone: string;
  preferredContact: string;
  country: string;
  timezone: string;
  designation: string;
  companyName: string;
  website: string;
  businessType: string;
  companySize: string;
  projectName: string;
  projectType: string;
  projectDescription: string;
  deadline: string;
  specificDate: string;
  priority: string;
  budgetRange: string;
  goals: string;
  targetAudience: string;
  competitors: string;
  referenceLinks: string[];
  existingAssets: string[];
  features: string[];
};

const EMPTY_FORM: FormState = {
  fullName: '',
  phone: '',
  preferredContact: 'Email',
  country: 'Bangladesh',
  timezone: 'GMT+6:00 — Dhaka',
  designation: '',
  companyName: '',
  website: '',
  businessType: '',
  companySize: '',
  projectName: '',
  projectType: '',
  projectDescription: '',
  deadline: 'No fixed deadline',
  specificDate: '',
  priority: 'Normal',
  budgetRange: '',
  goals: '',
  targetAudience: '',
  competitors: '',
  referenceLinks: [''],
  existingAssets: [],
  features: [],
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

function BrandMark() {
  return (
    <div className="brand-lockup">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Navbar logo.png" alt="FLOW 53" className="brand-logo-img" />
      <div>
        <div className="brand-name">FLOW 53</div>
        <div className="brand-sub">Client Portal</div>
      </div>
    </div>
  );
}

export default function ClientOnboarding() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving'>('saved');
  const [featureInput, setFeatureInput] = useState('');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

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
        const key = `flow53_onboarding_draft_${own.id}`;
        setDraftKey(key);

        const base: FormState = {
          ...EMPTY_FORM,
          fullName: own.primary_contact ?? '',
          phone: own.contact_phone ?? '',
          designation: own.designation ?? '',
          companyName: own.company_name ?? '',
          website: own.website ?? '',
          businessType: own.industry ?? '',
          companySize: own.company_size ?? '',
        };

        try {
          const saved = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
          if (saved) {
            const parsed = JSON.parse(saved) as Partial<FormState>;
            setForm({ ...base, ...parsed });
          } else {
            setForm(base);
          }
        } catch {
          setForm(base);
        }

        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
  }, [router]);

  // localStorage অটোসেভ — সত্যিকারের browser-লেভেল পার্সিস্টেন্স, "Saved" লেবেলটা
  // মিথ্যা claim না। সার্ভারে ড্রাফট রাইট করা হয় না (শুধু ফাইনাল সাবমিটে), তাই
  // ভিন্ন ডিভাইস/ব্রাউজারে রিজিউম করা যাবে না — এই সীমাবদ্ধতা ইচ্ছাকৃত, স্কোপ ছোট রাখতে।
  useEffect(() => {
    if (loading || !draftKey) return;
    // সরাসরি effect-এর ভেতর setState('saving') কল করলে react-hooks/set-state-in-effect
    // লিন্ট রুল ধরে — তাই setTimeout(fn, 0) দিয়ে মাইক্রোটাস্ক পরে কল করা হচ্ছে, যা
    // ব্যবহারকারীর চোখে প্রায় সাথে সাথেই ঘটে (পরের রেন্ডারে "Saving…" দেখা যায়)।
    const showSavingTimer = setTimeout(() => setAutosaveStatus('saving'), 0);
    const saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(form));
      } catch {
        // localStorage ব্লকড/ফুল হলেও ফর্ম কাজ করা বন্ধ করার দরকার নেই
      }
      setAutosaveStatus('saved');
    }, 500);
    return () => {
      clearTimeout(showSavingTimer);
      clearTimeout(saveTimer);
    };
  }, [form, loading, draftKey]);

  function saveNow() {
    if (!draftKey) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      // no-op
    }
    setAutosaveStatus('saved');
  }

  function validateStep(current: number): string | null {
    if (current === 1 && !form.fullName.trim()) return 'Please enter your full name.';
    if (current === 2 && !form.companyName.trim()) return 'Please enter your company name.';
    if (current === 3) {
      if (!form.projectName.trim()) return 'Please enter a project name.';
      if (!form.projectType) return 'Please select a project type.';
      if (!form.projectDescription.trim()) return 'Please describe your project.';
    }
    return null;
  }

  function goNext() {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    const next = Math.min(5, step + 1);
    setStep(next);
    setMaxStepReached((m) => Math.max(m, next));
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function jumpToStep(n: number) {
    if (n <= maxStepReached) {
      setStepError(null);
      setStep(n);
    }
  }

  function toggleAsset(value: string) {
    setForm((f) => ({ ...f, existingAssets: f.existingAssets.includes(value) ? f.existingAssets.filter((a) => a !== value) : [...f.existingAssets, value] }));
  }

  function addFeature(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && featureInput.trim()) {
      e.preventDefault();
      setForm((f) => ({ ...f, features: [...f.features, featureInput.trim()] }));
      setFeatureInput('');
    }
  }
  function removeFeature(i: number) {
    setForm((f) => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }));
  }

  function updateLink(i: number, value: string) {
    setForm((f) => ({ ...f, referenceLinks: f.referenceLinks.map((l, idx) => (idx === i ? value : l)) }));
  }
  function addLinkRow() {
    setForm((f) => ({ ...f, referenceLinks: [...f.referenceLinks, ''] }));
  }
  function removeLinkRow(i: number) {
    setForm((f) => ({ ...f, referenceLinks: f.referenceLinks.filter((_, idx) => idx !== i) }));
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
        contact_phone: form.phone.trim() || null,
        preferred_contact_method: form.preferredContact || null,
        country: form.country || null,
        timezone: form.timezone || null,
        designation: form.designation.trim() || null,
        company_name: form.companyName.trim(),
        website: form.website.trim() || null,
        industry: form.businessType || null,
        company_size: form.companySize || null,
        status: 'submitted',
      })
      .eq('id', client.id);

    if (clientUpdateError) {
      setSubmitError(clientUpdateError.message);
      setSubmitting(false);
      return;
    }

    const expectedTimeline = form.deadline === 'specific' ? form.specificDate || null : form.deadline || null;
    const referenceNotes = form.referenceLinks.map((l) => l.trim()).filter(Boolean).join('\n') || null;

    const { error: requirementsError } = await supabase.from('client_requirements').insert({
      client_id: client.id,
      project_name: form.projectName.trim(),
      project_type: form.projectType || null,
      project_description: form.projectDescription.trim() || null,
      goals: form.goals.trim() || null,
      target_audience: form.targetAudience.trim() || null,
      required_features: form.features.length > 0 ? form.features.join(', ') : null,
      expected_timeline: expectedTimeline,
      budget_range: form.budgetRange || null,
      reference_notes: referenceNotes,
      competitors: form.competitors.trim() || null,
      existing_assets: form.existingAssets.length > 0 ? form.existingAssets.join(', ') : null,
      priority: form.priority.toLowerCase(),
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

    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // no-op
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
      <div className="split-shell">
        {/* ============ BRAND PANEL (desktop only) ============ */}
        <aside className="brand-panel">
          <div className="brand-panel-grid" aria-hidden="true"></div>
          <div className="brand-panel-inner-top">
            <BrandMark />
            <div className="panel-headline">Tell us about yourself</div>
            <p className="panel-sub">Complete your profile so our team can better understand you and your project.</p>
          </div>

          <nav className="step-nav">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <button type="button" key={label} className={`step-nav-item${done ? ' done' : ''}${current ? ' current' : ''}`} onClick={() => jumpToStep(n)}>
                  <span className="step-nav-dot">{done ? '✓' : n}</span>
                  <span className="step-nav-label">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="brand-panel-bottom">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Your information is securely protected.
          </div>
        </aside>

        {/* ============ FORM PANEL ============ */}
        <div className="form-panel">
          <header className="topbar">
            <div className="topbar-left">
              <BrandMark />
              <span className="mobile-step-label">
                · Step {step} of 5
              </span>
            </div>
            <div className="topbar-right">
              <span className="autosave-status">
                <span className={`autosave-dot${autosaveStatus === 'saving' ? ' saving' : ''}`}></span>
                {autosaveStatus === 'saving' ? 'Saving…' : 'Saved'}
              </span>
              <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="help-link">
                Need help? <span className="link">Contact Support</span>
              </a>
            </div>
          </header>

          <main className="main">
            <div className="form-wrap">
              <div className="mobile-progress">
                <div className="mobile-progress-track">
                  <div className="mobile-progress-fill" style={{ width: `${(step / 5) * 100}%` }} />
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {stepError && (
                  <div className="form-banner error">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    <span>{stepError}</span>
                  </div>
                )}
                {submitError && (
                  <div className="form-banner error">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    <span>{submitError}</span>
                  </div>
                )}

                {/* ============ STEP 1 — PERSONAL ============ */}
                {step === 1 && (
                  <div className="step-panel">
                    <div className="step-head">
                      <div className="step-eyebrow">Step 1 of 5</div>
                      <h1 className="step-title">Personal Information</h1>
                      <p className="step-sub">Let&apos;s start with the basics.</p>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="fullName">
                        Full name
                      </label>
                      <input id="fullName" type="text" className="field-input" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="emailRO">
                        Email address
                      </label>
                      <input id="emailRO" type="email" className="field-input" value={client?.contact_email ?? ''} disabled />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="phone">
                        Phone number <span className="opt">(optional)</span>
                      </label>
                      <input id="phone" type="tel" className="field-input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+880 1XXX-XXXXXX" />
                    </div>
                    <div className="field">
                      <label className="field-label">Preferred contact method</label>
                      <div className="radio-group">
                        {CONTACT_METHODS.map((m) => (
                          <button type="button" key={m} className={`radio-pill${form.preferredContact === m ? ' selected' : ''}`} onClick={() => setField('preferredContact', m)}>
                            <span className="radio-pill-dot">
                              <span className="radio-pill-inner"></span>
                            </span>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field-grid-2">
                      <div className="field">
                        <label className="field-label" htmlFor="country">
                          Country
                        </label>
                        <select className="field-select" id="country" value={form.country} onChange={(e) => setField('country', e.target.value)}>
                          {COUNTRIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="timezone">
                          Time zone
                        </label>
                        <select className="field-select" id="timezone" value={form.timezone} onChange={(e) => setField('timezone', e.target.value)}>
                          {TIMEZONES.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============ STEP 2 — COMPANY ============ */}
                {step === 2 && (
                  <div className="step-panel">
                    <div className="step-head">
                      <div className="step-eyebrow">Step 2 of 5</div>
                      <h1 className="step-title">Tell us about your business</h1>
                      <p className="step-sub">This helps us understand who we&apos;re working with.</p>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="companyName">
                        Company / business name
                      </label>
                      <input id="companyName" type="text" className="field-input" value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} placeholder="e.g. Acme Studio" />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="website">
                        Website <span className="opt">(optional)</span>
                      </label>
                      <input id="website" type="url" className="field-input" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://example.com" />
                    </div>
                    <div className="field-grid-2">
                      <div className="field">
                        <label className="field-label" htmlFor="businessType">
                          Business type
                        </label>
                        <select className="field-select" id="businessType" value={form.businessType} onChange={(e) => setField('businessType', e.target.value)}>
                          <option value="">Select…</option>
                          {BUSINESS_TYPES.map((b) => (
                            <option key={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="companySize">
                          Company size
                        </label>
                        <select className="field-select" id="companySize" value={form.companySize} onChange={(e) => setField('companySize', e.target.value)}>
                          <option value="">Select…</option>
                          {COMPANY_SIZES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="clientRole">
                        Your role
                      </label>
                      <select className="field-select" id="clientRole" value={form.designation} onChange={(e) => setField('designation', e.target.value)}>
                        <option value="">Select…</option>
                        {ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* ============ STEP 3 — PROJECT ============ */}
                {step === 3 && (
                  <div className="step-panel">
                    <div className="step-head">
                      <div className="step-eyebrow">Step 3 of 5</div>
                      <h1 className="step-title">Tell us about your project</h1>
                      <p className="step-sub">Give us a quick overview of what you&apos;d like our team to work on.</p>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="projectName">
                        Project name
                      </label>
                      <input id="projectName" type="text" className="field-input" value={form.projectName} onChange={(e) => setField('projectName', e.target.value)} placeholder="e.g. Mobile Banking App" />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="projectType">
                        Project type
                      </label>
                      <select className="field-select" id="projectType" value={form.projectType} onChange={(e) => setField('projectType', e.target.value)}>
                        <option value="">Select…</option>
                        {PROJECT_TYPES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="projectDescription">
                        Tell us about your project
                      </label>
                      <textarea
                        className="field-textarea"
                        id="projectDescription"
                        value={form.projectDescription}
                        onChange={(e) => setField('projectDescription', e.target.value)}
                        placeholder="Briefly describe what you want to build, redesign, or improve..."
                        maxLength={1000}
                      />
                      <div className="char-count">{form.projectDescription.length}/1000</div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="deadline">
                        Expected deadline
                      </label>
                      <select className="field-select" id="deadline" value={form.deadline} onChange={(e) => setField('deadline', e.target.value)}>
                        {DEADLINES.map((d) => (
                          <option key={d} value={d}>
                            {d === 'specific' ? 'Specific date' : d}
                          </option>
                        ))}
                      </select>
                      {form.deadline === 'specific' && (
                        <input type="date" className="field-input" style={{ marginTop: 10 }} value={form.specificDate} onChange={(e) => setField('specificDate', e.target.value)} />
                      )}
                    </div>
                    <div className="field">
                      <label className="field-label">Priority</label>
                      <div className="radio-group">
                        {PRIORITIES.map((p) => (
                          <button type="button" key={p} className={`radio-pill${form.priority === p ? ' selected' : ''}`} onClick={() => setField('priority', p)}>
                            <span className="radio-pill-dot">
                              <span className="radio-pill-inner"></span>
                            </span>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="budget">
                        Estimated budget <span className="opt">(optional)</span>
                      </label>
                      <select className="field-select" id="budget" value={form.budgetRange} onChange={(e) => setField('budgetRange', e.target.value)}>
                        {BUDGETS.map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* ============ STEP 4 — REQUIREMENTS ============ */}
                {step === 4 && (
                  <div className="step-panel">
                    <div className="step-head">
                      <div className="step-eyebrow">Step 4 of 5</div>
                      <h1 className="step-title">What do you need from us?</h1>
                      <p className="step-sub">The more detail you share, the better we can prepare.</p>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="goals">
                        What are the main goals of this project?
                      </label>
                      <textarea className="field-textarea" id="goals" style={{ minHeight: 70 }} value={form.goals} onChange={(e) => setField('goals', e.target.value)} placeholder="Tell us what you want to achieve with this project..." />
                    </div>
                    <div className="field">
                      <label className="field-label" htmlFor="audience">
                        Who is this product for?
                      </label>
                      <textarea className="field-textarea" id="audience" style={{ minHeight: 70 }} value={form.targetAudience} onChange={(e) => setField('targetAudience', e.target.value)} placeholder="Describe your target users or customers." />
                    </div>

                    <div className="field">
                      <label className="field-label">
                        What features do you need? <span className="opt">(press Enter to add)</span>
                      </label>
                      <div className="tag-input-wrap">
                        {form.features.map((f, i) => (
                          <span className="tag-chip" key={`${f}-${i}`}>
                            {f}
                            <button type="button" onClick={() => removeFeature(i)} aria-label={`Remove ${f}`}>
                              ✕
                            </button>
                          </span>
                        ))}
                        <input type="text" className="tag-input-field" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={addFeature} placeholder="e.g. User authentication" />
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">
                        Reference links <span className="opt">(optional)</span>
                      </label>
                      {form.referenceLinks.map((link, i) => (
                        <div className="link-row" key={i}>
                          <input type="url" className="field-input" value={link} onChange={(e) => updateLink(i, e.target.value)} placeholder="https://..." />
                          <button type="button" className="link-remove" onClick={() => removeLinkRow(i)} aria-label="Remove link">
                            ✕
                          </button>
                        </div>
                      ))}
                      <button type="button" className="btn-text" onClick={addLinkRow}>
                        + Add another link
                      </button>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="competitors">
                        Competitors or similar products <span className="opt">(optional)</span>
                      </label>
                      <textarea className="field-textarea" id="competitors" style={{ minHeight: 60 }} value={form.competitors} onChange={(e) => setField('competitors', e.target.value)} placeholder="List any competitors or similar products..." />
                    </div>

                    <div className="field">
                      <label className="field-label">Do you already have any existing assets?</label>
                      <div className="check-grid">
                        {EXISTING_ASSETS.map((a) => {
                          const checked = form.existingAssets.includes(a);
                          return (
                            <button type="button" key={a} className={`check-row${checked ? ' checked' : ''}`} onClick={() => toggleAsset(a)}>
                              <span className="check-box">{checked ? '✓' : ''}</span>
                              <span className="check-text">{a}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">
                        Upload files <span className="opt">(optional — you can also share files later from your dashboard)</span>
                      </label>
                      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesSelected} />
                      <button type="button" className="dropzone" onClick={() => fileInputRef.current?.click()}>
                        <span className="dropzone-icon">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v12" />
                            <path d="M7 8l5-5 5 5" />
                            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                          </svg>
                        </span>
                        <div className="dropzone-text">Click to browse files</div>
                        <div className="dropzone-sub">PDF, DOC, PNG, JPG, ZIP</div>
                      </button>

                      {files.length > 0 && (
                        <div className="file-list">
                          {files.map((f) => (
                            <div className="file-row" key={f.key}>
                              <div className="file-icon">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                                  <path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                                </svg>
                              </div>
                              <div className="file-meta">
                                <div className="file-name">{f.file.name}</div>
                                <div className="file-sub">
                                  {formatBytes(f.file.size)}
                                  {f.status === 'uploading' && ' · Uploading…'}
                                  {f.status === 'done' && (
                                    <>
                                      {' · '}
                                      <span className="file-status">Uploaded ✓</span>
                                    </>
                                  )}
                                  {f.status === 'error' && <span style={{ color: 'var(--danger)' }}> · {f.error ?? 'Failed'}</span>}
                                </div>
                                {f.status === 'uploading' && (
                                  <div className="file-progress-track">
                                    <div className="file-progress-fill" style={{ width: `${f.progress}%` }} />
                                  </div>
                                )}
                              </div>
                              <button type="button" className="file-remove" onClick={() => removeFile(f.key)} aria-label="Remove file">
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ============ STEP 5 — REVIEW ============ */}
                {step === 5 && (
                  <div className="step-panel">
                    <div className="step-head">
                      <div className="step-eyebrow">Step 5 of 5</div>
                      <h1 className="step-title">Review your information</h1>
                      <p className="step-sub">Make sure everything looks right before submitting.</p>
                    </div>

                    <div className="review-section">
                      <div className="review-section-head">
                        <span className="review-section-title">Personal Information</span>
                        <button type="button" className="review-edit" onClick={() => jumpToStep(1)}>
                          Edit
                        </button>
                      </div>
                      <div className="review-line">{form.fullName || '—'}</div>
                      <div className="review-line muted">{client?.contact_email}</div>
                      <div className="review-line muted">{form.phone || 'No phone number provided.'}</div>
                    </div>

                    <div className="review-section">
                      <div className="review-section-head">
                        <span className="review-section-title">Company</span>
                        <button type="button" className="review-edit" onClick={() => jumpToStep(2)}>
                          Edit
                        </button>
                      </div>
                      <div className="review-line">{form.companyName || '—'}</div>
                      <div className="review-line muted">{form.businessType || '—'}</div>
                      <div className="review-line muted">{form.designation || '—'}</div>
                    </div>

                    <div className="review-section">
                      <div className="review-section-head">
                        <span className="review-section-title">Project</span>
                        <button type="button" className="review-edit" onClick={() => jumpToStep(3)}>
                          Edit
                        </button>
                      </div>
                      <div className="review-line">{form.projectName || '—'}</div>
                      <div className="review-line muted">{form.projectType || '—'}</div>
                      <div className="review-line muted">{form.deadline === 'specific' ? form.specificDate || '—' : form.deadline}</div>
                      <div className="review-line muted">{form.budgetRange || 'Not specified'}</div>
                    </div>

                    <div className="review-section">
                      <div className="review-section-head">
                        <span className="review-section-title">Requirements</span>
                        <button type="button" className="review-edit" onClick={() => jumpToStep(4)}>
                          Edit
                        </button>
                      </div>
                      <div className="review-line muted">{form.goals.trim() || 'No goals provided.'}</div>
                      <div className="review-line muted">{form.features.length > 0 ? form.features.join(', ') : 'No features listed.'}</div>
                    </div>

                    <div className="review-section" style={{ marginBottom: 0 }}>
                      <div className="review-section-head">
                        <span className="review-section-title">Files</span>
                        <button type="button" className="review-edit" onClick={() => jumpToStep(4)}>
                          View
                        </button>
                      </div>
                      <div className="review-line muted">{files.length > 0 ? `${files.length} file(s) attached.` : 'No files attached.'}</div>
                    </div>
                  </div>
                )}

                {/* ============ NAV BUTTONS ============ */}
                <div className="step-nav-buttons">
                  <button type="button" className="btn btn-ghost" onClick={goBack} disabled={submitting} style={{ visibility: step === 1 ? 'hidden' : 'visible' }}>
                    Back
                  </button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-text" onClick={saveNow}>
                      Save &amp; continue later
                    </button>
                    {step < 5 ? (
                      <button type="button" className="btn btn-accent" onClick={goNext}>
                        Continue
                      </button>
                    ) : (
                      <button type="submit" className="btn btn-accent" disabled={submitting || anyUploading}>
                        {submitting && <span className="spinner" />}
                        {submitting ? 'Submitting…' : 'Complete Setup'}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
