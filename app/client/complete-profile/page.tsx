'use client';

// Google OAuth দিয়ে প্রথমবার সাইন-ইন করা client-এর জন্য ছোট্ট একটা
// প্রোফাইল-সম্পূর্ণ ফর্ম — পাসওয়ার্ড লাগে না (OAuth-এই auth user তৈরি হয়ে
// গেছে), শুধু company name/phone নিয়ে /api/client/complete-profile-এ পোস্ট
// করে clients রো বানায়, তারপর onboarding-এ পাঠায়।

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient } from '@/lib/clientPortal';
import '../client-shared.css';

export default function ClientCompleteProfile() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace('/client/sign-in');
        return;
      }
      const existing = await fetchOwnClient();
      if (existing) {
        router.replace('/client/onboarding');
        return;
      }
      const meta = data.user.user_metadata as { full_name?: string; name?: string } | undefined;
      setFullName(meta?.full_name ?? meta?.name ?? '');
      setChecking(false);
    }
    load();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !companyName.trim()) {
      setError('Please fill in your name and company name.');
      return;
    }

    setSubmitting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setSubmitting(false);
      router.replace('/client/sign-in');
      return;
    }

    const res = await fetch('/api/client/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ fullName: fullName.trim(), companyName: companyName.trim(), phone: phone.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Could not finish setting up your account.');
      setSubmitting(false);
      return;
    }

    router.push('/client/onboarding');
  }

  if (checking) {
    return (
      <div className="client-portal">
        <div className="cp-loading-shell">Loading…</div>
      </div>
    );
  }

  return (
    <div className="client-portal">
      <div className="cp-auth-shell">
        <div className="cp-card">
          <span className="cp-eyebrow">One Last Step</span>
          <h1 className="cp-title">Complete Your Account</h1>
          <p className="cp-subtitle">Tell us a bit about your company to finish setting up your client portal.</p>

          <form onSubmit={handleSubmit} noValidate>
            {error && <div className="cp-alert cp-alert-error">{error}</div>}

            <div className="cp-field">
              <label className="cp-label" htmlFor="profile-name">
                Full Name
              </label>
              <input id="profile-name" type="text" className="cp-input" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="cp-field">
              <label className="cp-label" htmlFor="profile-company">
                Company Name
              </label>
              <input id="profile-company" type="text" className="cp-input" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company name" />
            </div>
            <div className="cp-field">
              <label className="cp-label" htmlFor="profile-phone">
                Phone Number <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(optional)</span>
              </label>
              <input id="profile-phone" type="tel" className="cp-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880…" />
            </div>

            <button type="submit" className="cp-btn cp-btn-primary cp-btn-block" disabled={submitting}>
              {submitting && <span className="cp-spinner" />}
              {submitting ? 'Setting up…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
