'use client';

// Screen 2 — Client Sign In। ইমেইল+পাসওয়ার্ড দিয়ে সাইন-ইন করে, সফল হলে
// resolveClientLandingRoute() ঠিক করে দেয় onboarding বাকি না ড্যাশবোর্ডে যাবে।
// একই পেজেই Forgot-password রিকভারি হ্যান্ডল করা হয় (Supabase রিসেট-লিংক এই
// পেজেই ফেরত আসে, hash-এ type=recovery থাকলে পাসওয়ার্ড-বদলের মিনি-ফর্ম দেখায়) —
// স্পেকে আলাদা কোনো "reset password" স্ক্রিন নেই, তাই নতুন স্ক্রিন না বানিয়ে
// এখানেই যুক্তিসঙ্গতভাবে সমাধান করা হলো।

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { resolveClientLandingRoute } from '@/lib/clientPortal';
import '../client-shared.css';
import './signin.css';

export default function ClientSignIn() {
  const router = useRouter();
  // hash-এ Supabase-এর রিকভারি টোকেন আছে কিনা — প্রথম রেন্ডারেই lazy initializer-এ
  // পড়ে নেওয়া হয়, effect-এর ভেতর থেকে synchronous setState এড়াতে (react-hooks
  // lint rule: "set-state-in-effect")।
  const [recoveryMode] = useState(() => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'));
  const [checkingSession, setCheckingSession] = useState(!recoveryMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const dest = await resolveClientLandingRoute();
        router.replace(dest);
        return;
      }
      setCheckingSession(false);
    });
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

  if (recoveryMode) {
    return (
      <div className="client-portal client-signin-root">
        <div className="cp-auth-shell">
          <div className="cp-card">
            <div className="cp-brand">
              <div className="cp-brand-mark" aria-hidden="true"></div>
              <div className="cp-brand-text">FLOW 53</div>
            </div>
            {recoveryDone ? (
              <>
                <h1 className="cp-title">Password Updated</h1>
                <p className="cp-subtitle">আপনার পাসওয়ার্ড পরিবর্তন হয়ে গেছে। এখন নতুন পাসওয়ার্ড দিয়ে সাইন-ইন করুন।</p>
                <button
                  type="button"
                  className="cp-btn cp-btn-primary cp-btn-block"
                  onClick={() => {
                    window.location.href = '/client/sign-in';
                  }}
                >
                  সাইন-ইন করুন
                </button>
              </>
            ) : (
              <>
                <h1 className="cp-title">Set a New Password</h1>
                <p className="cp-subtitle">আপনার অ্যাকাউন্টের জন্য একটা নতুন পাসওয়ার্ড দিন।</p>
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
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="client-portal client-signin-root">
      <div className="cp-auth-shell">
        <div className="cp-card">
          <div className="cp-brand">
            <div className="cp-brand-mark" aria-hidden="true"></div>
            <div className="cp-brand-text">FLOW 53</div>
          </div>

          {forgotOpen ? (
            <>
              <h1 className="cp-title">Reset Your Password</h1>
              {forgotSent ? (
                <>
                  <p className="cp-subtitle">
                    <strong>{forgotEmail}</strong>-এ একটা পাসওয়ার্ড-রিসেট লিংক পাঠানো হয়েছে। ইনবক্স চেক করুন।
                  </p>
                  <button type="button" className="cp-btn cp-btn-secondary cp-btn-block" onClick={() => setForgotOpen(false)}>
                    ফিরে যান
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgotSubmit}>
                  <p className="cp-subtitle">আপনার ইমেইল দিন — একটা রিসেট লিংক পাঠানো হবে।</p>
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
              <span className="cp-eyebrow">Client Portal</span>
              <h1 className="cp-title">Sign In</h1>
              <p className="cp-subtitle">আপনার প্রজেক্ট, পেমেন্ট আর ফাইল দেখতে সাইন-ইন করুন।</p>

              <form onSubmit={handleSubmit}>
                {error && <div className="cp-alert cp-alert-error">{error}</div>}

                <div className="cp-field">
                  <label className="cp-label" htmlFor="signin-email">
                    Email
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    className="cp-input"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label" htmlFor="signin-password">
                    Password
                  </label>
                  <input
                    id="signin-password"
                    type="password"
                    className="cp-input"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="আপনার পাসওয়ার্ড"
                  />
                </div>

                <div className="cp-row">
                  <label className="cp-checkbox-row" style={{ marginBottom: 0 }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="cp-btn cp-btn-ghost"
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

              <p className="cp-footnote">
                অ্যাকাউন্ট নেই? <Link href="/client/register">Create Client Account</Link>
              </p>
            </>
          )}
        </div>

        <p className="cp-team-link">
          Part of the FLOW 53 team? <Link href="/dashboard">Sign in here →</Link>
        </p>
      </div>
    </div>
  );
}
