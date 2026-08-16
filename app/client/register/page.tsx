'use client';

// Screen 3 — Client Registration। রিডিজাইন: Screen 2 (Sign In)-এর একই split-screen
// প্যাটার্ন (dark brand panel + light form) — দুটো auth স্ক্রিন যেন একই ভিজ্যুয়াল
// আইডেন্টিটির অংশ মনে হয়। আসল লজিক অপরিবর্তিত: /api/client/register কল করে
// (service-role, email_confirm:true), সফল হলে অটো সাইন-ইন করিয়ে Screen 4-এ পাঠায়।
// শুধু নতুন যোগ হলো password/confirm-password show-hide টগল।

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, hasSubmittedRequirements } from '@/lib/clientPortal';
import '../client-shared.css';
import './register.css';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20having%20trouble%20creating%20my%20client%20account.';

const FEATURES = [
  {
    title: 'Track project progress',
    desc: 'See exactly where your project stands, always.',
    icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  },
  {
    title: 'Sign SOWs & review files',
    desc: 'Approvals and deliverables, all in your portal.',
    icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  },
  {
    title: 'Pay & track invoices',
    desc: 'Clear payment history and downloadable receipts.',
    icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  },
];

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-6 0-10-8-10-8a18.6 18.6 0 0 1 4.22-5.06" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M2 2l20 20" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
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

export default function ClientRegister() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // সেশন থাকলেও সেটা টিম মেম্বারের হতে পারে (একই ব্রাউজারে /dashboard-এ লগইন করা
    // থাকলে) — fetchOwnClient() তখন null দেয়, আর এই পেজেই রিডাইরেক্ট করলে সেম-রুট
    // নো-অপ লুপে "লোড হচ্ছে…"-তে আটকে যায়। শুধু প্রকৃত ক্লায়েন্ট সেশন পেলেই রিডাইরেক্ট।
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (data.user) {
          const client = await fetchOwnClient();
          if (client) {
            const submitted = await hasSubmittedRequirements(client.id);
            router.replace(submitted ? '/client/dashboard' : '/client/onboarding');
            return;
          }
        }
        setCheckingSession(false);
      })
      .catch(() => setCheckingSession(false));
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !companyName.trim() || !email.trim() || !password) {
      setError('সব আবশ্যক ঘর পূরণ করুন।');
      return;
    }
    if (password.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।');
      return;
    }
    if (password !== confirmPassword) {
      setError('দুটো পাসওয়ার্ড মিলছে না।');
      return;
    }
    if (!agreed) {
      setError('চালিয়ে যেতে Terms & Conditions মেনে নিতে হবে।');
      return;
    }

    setSubmitting(true);

    const res = await fetch('/api/client/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: fullName.trim(), companyName: companyName.trim(), email: email.trim(), phone: phone.trim(), password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'অ্যাকাউন্ট তৈরি করা যায়নি।');
      setSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      // অ্যাকাউন্ট তৈরি সফল হয়েছে, শুধু অটো-লগইন ব্যর্থ — ইউজারকে সাইন-ইন পেজে পাঠানো হলো।
      router.push('/client/sign-in');
      return;
    }

    router.push('/client/onboarding');
  }

  if (checkingSession) {
    return (
      <div className="client-portal client-register-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal client-register-root">
      <div className="split-shell">
        {/* ============ BRAND PANEL (desktop only) ============ */}
        <aside className="brand-panel">
          <div className="brand-panel-grid" aria-hidden="true"></div>
          <div className="brand-panel-top">
            <BrandMark />
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="help-link-light">
              Need help? <span className="link">Contact Support</span>
            </a>
          </div>

          <div className="brand-panel-mid">
            <h2 className="brand-panel-headline">
              Get started <span className="accent-word">in minutes</span>.
            </h2>
            <p className="brand-panel-sub">Create your client account to track progress, review deliverables, and manage payments — all in one secure portal.</p>

            <div className="panel-feature-list">
              {FEATURES.map((f) => (
                <div className="panel-feature" key={f.title}>
                  <div className="panel-feature-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: f.icon }} />
                  </div>
                  <div>
                    <div className="panel-feature-title">{f.title}</div>
                    <div className="panel-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
            <BrandMark />
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="help-link">
              Need help? <span className="link">Contact Support</span>
            </a>
          </header>

          <main className="main">
            <div className="auth-card">
              <div className="auth-head">
                <h1 className="headline">Create Your Client Account</h1>
                <p className="subtext">আপনার প্রজেক্ট শুরু করতে কয়েক মিনিটে অ্যাকাউন্ট তৈরি করুন।</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="form-banner error">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <div className="cp-field-row">
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="reg-fullname">
                      Full Name
                    </label>
                    <input id="reg-fullname" type="text" className="cp-input" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" autoComplete="name" />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="reg-company">
                      Company Name
                    </label>
                    <input id="reg-company" type="text" className="cp-input" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." autoComplete="organization" />
                  </div>
                </div>

                <div className="cp-field-row">
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="reg-email">
                      Email
                    </label>
                    <input id="reg-email" type="email" className="cp-input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="reg-phone">
                      Phone <span className="cp-label-optional">(optional)</span>
                    </label>
                    <input id="reg-phone" type="tel" className="cp-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" autoComplete="tel" />
                  </div>
                </div>

                <div className="cp-field-row">
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="reg-password">
                      Password
                    </label>
                    <div className="field-input-wrap">
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        className="cp-input pw"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="কমপক্ষে ৮ ক্যারেক্টার"
                        autoComplete="new-password"
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                  </div>
                  <div className="cp-field">
                    <label className="cp-label" htmlFor="reg-confirm">
                      Confirm Password
                    </label>
                    <div className="field-input-wrap">
                      <input
                        id="reg-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        className="cp-input pw"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="আবার লিখুন"
                        autoComplete="new-password"
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowConfirm((s) => !s)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                        <EyeIcon open={showConfirm} />
                      </button>
                    </div>
                  </div>
                </div>

                <label className="cp-checkbox-row">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>
                    আমি FLOW 53-এর <strong>Terms &amp; Conditions</strong> এবং <strong>Privacy Policy</strong>-তে সম্মত।
                  </span>
                </label>

                <button type="submit" className="cp-btn cp-btn-primary cp-btn-block" disabled={submitting}>
                  {submitting && <span className="cp-spinner" />}
                  {submitting ? 'অ্যাকাউন্ট তৈরি হচ্ছে…' : 'Create Client Account'}
                </button>
              </form>

              <p className="register-line">
                আগে থেকেই অ্যাকাউন্ট আছে?{' '}
                <Link href="/client/sign-in" className="link">
                  Sign In
                </Link>
              </p>

              <div className="trust-row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Your information is securely protected.
              </div>

              <p className="cp-team-link" style={{ marginTop: 16 }}>
                Part of the FLOW 53 team? <Link href="/dashboard">Sign in here →</Link>
              </p>
            </div>
          </main>

          <footer className="footer">
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              Support
            </a>
            <span className="footer-copy">© {new Date().getFullYear()} FLOW 53 Design Studio</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
