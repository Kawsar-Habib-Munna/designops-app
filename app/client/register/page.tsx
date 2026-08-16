'use client';

// Screen 3 — Client Registration। /api/client/register কল করে (service-role,
// email_confirm:true, তাই রেট-লিমিটেড কনফার্মেশন ইমেইল পাঠায় না) — সফল হলে
// এখানেই signInWithPassword দিয়ে অটো-লগইন করানো হয় (ইউজার একই টাইপ করা
// পাসওয়ার্ড দিয়ে আলাদা করে আবার সাইন-ইন করতে চাইবে না), তারপর Screen 4-এ পাঠায়।

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClient, hasSubmittedRequirements } from '@/lib/clientPortal';
import '../client-shared.css';
import './register.css';

export default function ClientRegister() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      <div className="cp-auth-shell">
        <div className="cp-card cp-card-wide">
          <div className="cp-brand">
            <div className="cp-brand-mark" aria-hidden="true"></div>
            <div className="cp-brand-text">FLOW 53</div>
          </div>
          <span className="cp-eyebrow">Client Portal</span>
          <h1 className="cp-title">Create Your Client Account</h1>
          <p className="cp-subtitle">আপনার প্রজেক্ট শুরু করতে কয়েক মিনিটে অ্যাকাউন্ট তৈরি করুন।</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="cp-alert cp-alert-error">{error}</div>}

            <div className="cp-field-row">
              <div className="cp-field">
                <label className="cp-label" htmlFor="reg-fullname">
                  Full Name
                </label>
                <input id="reg-fullname" type="text" className="cp-input" required autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="cp-field">
                <label className="cp-label" htmlFor="reg-company">
                  Company Name
                </label>
                <input id="reg-company" type="text" className="cp-input" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." />
              </div>
            </div>

            <div className="cp-field-row">
              <div className="cp-field">
                <label className="cp-label" htmlFor="reg-email">
                  Email
                </label>
                <input id="reg-email" type="email" className="cp-input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="cp-field">
                <label className="cp-label" htmlFor="reg-phone">
                  Phone <span className="cp-label-optional">(optional)</span>
                </label>
                <input id="reg-phone" type="tel" className="cp-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
            </div>

            <div className="cp-field-row">
              <div className="cp-field">
                <label className="cp-label" htmlFor="reg-password">
                  Password
                </label>
                <input id="reg-password" type="password" className="cp-input" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="কমপক্ষে ৮ ক্যারেক্টার" />
              </div>
              <div className="cp-field">
                <label className="cp-label" htmlFor="reg-confirm">
                  Confirm Password
                </label>
                <input id="reg-confirm" type="password" className="cp-input" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="আবার লিখুন" />
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

          <p className="cp-footnote">
            আগে থেকেই অ্যাকাউন্ট আছে? <Link href="/client/sign-in">Sign In</Link>
          </p>
        </div>

        <p className="cp-team-link">
          Part of the FLOW 53 team? <Link href="/dashboard">Sign in here →</Link>
        </p>
      </div>
    </div>
  );
}
