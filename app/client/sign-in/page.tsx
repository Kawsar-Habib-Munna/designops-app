'use client';

// Screen 2 — Client Sign In। রিডিজাইন: split-screen লেআউট — বাম পাশে dark brand
// প্যানেল (পাবলিক সাইটের মতো Fraunces italic হেডলাইন + রিয়েল ফিচার লিস্ট, ≥1024px-এ
// দেখা যায়), ডানে ফর্ম (client-shared.css-এর cp-* প্রিমিটিভ, বাকি Screens 3-24-এর
// সাথে সামঞ্জস্যপূর্ণ)। আসল লজিক অপরিবর্তিত: ইমেইল+পাসওয়ার্ড সাইন-ইন,
// resolveClientLandingRoute() দিয়ে সঠিক গন্তব্যে যাওয়া, একই পেজে forgot-password
// (Supabase রিসেট-লিংক hash-এ type=recovery নিয়ে ফেরত আসে) — শুধু নতুন যোগ হলো
// password show/hide টগল।

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, hasSubmittedRequirements, resolveClientLandingRoute } from '@/lib/clientPortal';
import '../client-shared.css';
import './signin.css';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20having%20trouble%20signing%20into%20my%20client%20portal.';

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

export default function ClientSignIn() {
  const router = useRouter();
  const [recoveryMode] = useState(() => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'));
  const [checkingSession, setCheckingSession] = useState(!recoveryMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    if (recoveryMode) return;

    // সেশন থাকলেও সেটা টিম মেম্বারের হতে পারে (একই ব্রাউজারে /dashboard-এ লগইন
    // করা থাকলে) — সেক্ষেত্রে fetchOwnClient() null দেয়, আর তখন এই পেজেই আবার
    // রিডাইরেক্ট করলে সেম-রুট নো-অপ লুপ হয়ে "লোড হচ্ছে…"-তে আটকে যায়। তাই শুধু
    // প্রকৃত ক্লায়েন্ট সেশন পেলেই রিডাইরেক্ট করা হয়, নাহলে সাধারণ সাইন-ইন ফর্ম দেখানো হয়।
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
  }, [router, recoveryMode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'ইমেইল বা পাসওয়ার্ড ভুল।' : signInError.message);
      setSubmitting(false);
      return;
    }

    const dest = await resolveClientLandingRoute();
    router.push(dest);
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotSending(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/client/sign-in` : undefined,
    });
    setForgotSending(false);
    if (resetError) {
      setForgotError(resetError.message);
      return;
    }
    setForgotSent(true);
  }

  async function handleRecoverySubmit(e: FormEvent) {
    e.preventDefault();
    setRecoveryError(null);
    if (newPassword.length < 8) {
      setRecoveryError('পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।');
      return;
    }
    setRecoverySubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setRecoverySubmitting(false);
    if (updateError) {
      setRecoveryError(updateError.message);
      return;
    }
    setRecoveryDone(true);
  }

  if (checkingSession) {
    return (
      <div className="client-portal client-signin-root">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal client-signin-root">
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
              Everything about your project, <span className="accent-word">in one place</span>.
            </h2>
            <p className="brand-panel-sub">Sign in to track progress, review deliverables, and manage payments — without digging through email threads.</p>

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
              {recoveryMode ? (
                recoveryDone ? (
                  <>
                    <div className="auth-head">
                      <h1 className="headline">Password Updated</h1>
                      <p className="subtext">আপনার পাসওয়ার্ড পরিবর্তন হয়ে গেছে। এখন নতুন পাসওয়ার্ড দিয়ে সাইন-ইন করুন।</p>
                    </div>
                    <button type="button" className="cp-btn cp-btn-primary cp-btn-block" onClick={() => (window.location.href = '/client/sign-in')}>
                      সাইন-ইন করুন
                    </button>
                  </>
                ) : (
                  <>
                    <div className="auth-head">
                      <h1 className="headline">Set a New Password</h1>
                      <p className="subtext">আপনার অ্যাকাউন্টের জন্য একটা নতুন পাসওয়ার্ড দিন।</p>
                    </div>
                    <form onSubmit={handleRecoverySubmit}>
                      {recoveryError && <div className="cp-alert cp-alert-error">{recoveryError}</div>}
                      <div className="cp-field">
                        <label className="cp-label" htmlFor="new-password">
                          New Password
                        </label>
                        <input
                          id="new-password"
                          type="password"
                          className="cp-input"
                          required
                          autoFocus
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="কমপক্ষে ৮ ক্যারেক্টার"
                        />
                      </div>
                      <button type="submit" className="cp-btn cp-btn-primary cp-btn-block" disabled={recoverySubmitting}>
                        {recoverySubmitting && <span className="cp-spinner" />}
                        {recoverySubmitting ? 'আপডেট হচ্ছে…' : 'Update Password'}
                      </button>
                    </form>
                  </>
                )
              ) : forgotOpen ? (
                <>
                  <div className="auth-head">
                    <h1 className="headline">Reset Your Password</h1>
                  </div>
                  {forgotSent ? (
                    <>
                      <p className="subtext" style={{ marginBottom: 22 }}>
                        <strong>{forgotEmail}</strong>-এ একটা পাসওয়ার্ড-রিসেট লিংক পাঠানো হয়েছে। ইনবক্স চেক করুন।
                      </p>
                      <button type="button" className="cp-btn cp-btn-secondary cp-btn-block" onClick={() => setForgotOpen(false)}>
                        ফিরে যান
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleForgotSubmit}>
                      <p className="subtext" style={{ marginBottom: 22 }}>
                        আপনার ইমেইল দিন — একটা রিসেট লিংক পাঠানো হবে।
                      </p>
                      {forgotError && <div className="cp-alert cp-alert-error">{forgotError}</div>}
                      <div className="cp-field">
                        <label className="cp-label" htmlFor="forgot-email">
                          Email
                        </label>
                        <input
                          id="forgot-email"
                          type="email"
                          className="cp-input"
                          required
                          autoFocus
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="you@company.com"
                        />
                      </div>
                      <button type="submit" className="cp-btn cp-btn-primary cp-btn-block" disabled={forgotSending}>
                        {forgotSending && <span className="cp-spinner" />}
                        {forgotSending ? 'পাঠানো হচ্ছে…' : 'Send Reset Link'}
                      </button>
                      <button type="button" className="cp-btn cp-btn-ghost cp-btn-block" style={{ marginTop: 8 }} onClick={() => setForgotOpen(false)}>
                        Cancel
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <>
                  <div className="auth-head">
                    <h1 className="headline">Welcome Back</h1>
                    <p className="subtext">Sign in to access your projects, payments and client portal.</p>
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

                    <div className="cp-field">
                      <label className="cp-label" htmlFor="signin-email">
                        Email Address
                      </label>
                      <input id="signin-email" type="email" className="cp-input" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
                    </div>
                    <div className="cp-field">
                      <label className="cp-label" htmlFor="signin-password">
                        Password
                      </label>
                      <div className="field-input-wrap">
                        <input
                          id="signin-password"
                          type={showPassword ? 'text' : 'password'}
                          className="cp-input pw"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          autoComplete="current-password"
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? (
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
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="field-row-between">
                      <label className="remember-wrap">
                        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="remember-native" />
                        <span className={`remember-check${remember ? ' checked' : ''}`} aria-hidden="true"></span>
                        <span className="remember-label">Remember me</span>
                      </label>
                      <button
                        type="button"
                        className="forgot-link"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotOpen(true);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button type="submit" className="cp-btn cp-btn-primary cp-btn-block" disabled={submitting}>
                      {submitting && <span className="cp-spinner" />}
                      {submitting ? 'সাইন-ইন হচ্ছে…' : 'Sign In'}
                    </button>
                  </form>

                  <p className="register-line">
                    Don&apos;t have a client account?{' '}
                    <Link href="/client/register" className="link">
                      Create Client Account
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
                </>
              )}
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
