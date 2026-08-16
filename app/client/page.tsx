'use client';

// Screen 1 — Client Portal Entry। আগে static Server Component ছিল, এখন রিডিজাইনের
// সাথে সাথে সেশন-চেকও যোগ হলো: ইতিমধ্যে লগইন করা ক্লায়েন্ট এই এন্ট্রি পেজে এলে
// সরাসরি তার সঠিক গন্তব্যে (dashboard/onboarding) রিডাইরেক্ট হয়ে যায়, যাতে সাইন-ইন
// করা কেউ আবার "Sign In / Create Account" বাটন দেখে আটকে না থাকে। ব্যর্থ হলেও
// (নেটওয়ার্ক এরর ইত্যাদি) fail-open — সাধারণ এন্ট্রি পেজটাই দেখায়, ব্লক করে না।
// Preview কার্ডের ডেটা স্পষ্টভাবে "Preview" ব্যাজ দেওয়া উদাহরণ — কোনো real ফেচ না,
// যেহেতু এই পেজে কেউ লগইন করা নেই তাই দেখানোর মতো real ডেটাও নেই।

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { resolveClientLandingRoute } from '@/lib/clientPortal';
import './client.css';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20having%20trouble%20accessing%20my%20client%20portal.';

const FEATURES = [
  {
    title: 'Project Updates',
    desc: 'Stay up to date with the latest progress and milestones.',
    icon: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  },
  {
    title: 'Files & Documents',
    desc: 'Access project files, deliverables and important documents.',
    icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  },
  {
    title: 'Payments',
    desc: 'View payment requests, payment history and receipts.',
    icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  },
  {
    title: 'Approvals & Feedback',
    desc: 'Review work, provide feedback and approve deliverables.',
    icon: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
  },
  {
    title: 'Messages',
    desc: 'Communicate directly with your project team.',
    icon: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  },
  {
    title: 'SOW & Agreements',
    desc: 'Review and manage your project agreements.',
    icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  },
];

const TRUST_ITEMS = [
  { title: 'Secure Access', desc: 'Project-specific permissions', icon: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>' },
  { title: 'Private Files', desc: 'Only authorized users can access files', icon: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>' },
  { title: 'Protected Information', desc: 'Client data is separated and protected', icon: '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/>' },
];

const STEPS = [
  { num: '01', title: 'Create your account', desc: 'Enter your basic information to create your client profile.' },
  { num: '02', title: 'Connect with your project', desc: 'Your agency will create and connect your project to your account.' },
  { num: '03', title: 'Manage everything in one place', desc: 'Review updates, files, payments, feedback and approvals.' },
];

export default function ClientPortalEntry() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          setCheckingSession(false);
          return;
        }
        const dest = await resolveClientLandingRoute();
        if (dest === '/client/register') {
          // লগইন করা আছে কিন্তু এটা কোনো ক্লায়েন্ট অ্যাকাউন্ট না (যেমন টিম মেম্বার
          // নিজের ব্রাউজারে /dashboard-এ লগইন থাকা অবস্থায় এই পেজে এলে) — এমন
          // ক্ষেত্রে রিডাইরেক্ট না করে সাধারণ এন্ট্রি পেজটাই দেখানো হচ্ছে।
          setCheckingSession(false);
          return;
        }
        setRedirecting(true);
        window.location.href = dest;
      })
      .catch(() => setCheckingSession(false));
  }, []);

  // এই effect আলাদা রাখা হয়েছে কারণ checkingSession=true থাকা অবস্থায় (প্রথম
  // রেন্ডারে) DOM-এ শুধু লোডিং স্পিনার থাকে — .reveal সেকশনগুলো তখনো রেন্ডারই হয়নি।
  // উপরের effect-এর সাথে একসাথে থাকলে querySelectorAll খালি NodeList পেত, আর
  // পরে আসল কনটেন্ট রেন্ডার হলেও (dependency array খালি বলে) আর কখনো re-run হতো
  // না — ফলে .reveal-এর opacity:0 কখনো সরত না, পুরো পেজ ফাঁকা দেখাত।
  useEffect(() => {
    if (checkingSession || redirecting) return;

    const els = document.querySelectorAll('.client-entry-root .reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('in');
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [checkingSession, redirecting]);

  if (checkingSession || redirecting) {
    return (
      <div className="client-entry-root">
        <div className="session-check show">
          <div className="session-spinner"></div>
          <p className="session-text">{redirecting ? 'You are already signed in — redirecting to your dashboard…' : 'Checking your session…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="client-entry-root">
      {/* ============ NAV ============ */}
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="nav-logo">
            <span className="nav-logo-mark" aria-hidden="true"></span> FLOW 53
          </Link>
          <span className="nav-center">Client Portal</span>
          <div className="nav-right">
            <span className="nav-right-text">Already a client?</span>
            <Link href="/client/sign-in" className="btn btn-ghost btn-sm">
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="container hero-grid">
          <div className="reveal">
            <h1 className="hero-title">
              Your project, <span className="accent-word">all in one place</span>.
            </h1>
            <p className="hero-sub">Access your project updates, files, payments, approvals and communication through your secure client portal.</p>
            <div className="hero-ctas">
              <Link href="/client/sign-in" className="btn btn-accent">
                Sign In
              </Link>
              <Link href="/client/register" className="btn btn-ghost">
                Create Client Account
              </Link>
            </div>
          </div>

          <div className="reveal">
            <div className="preview-card" role="img" aria-label="Preview of a client project dashboard showing progress and status">
              <span className="preview-badge">Preview</span>
              <div className="preview-top">
                <div>
                  <div className="preview-proj-name">Fintech Mobile App</div>
                  <div className="preview-proj-sub">Nova Digital</div>
                </div>
                <span className="preview-status-pill">Active</span>
              </div>
              <div className="preview-progress-row">
                <span className="preview-progress-label">Overall Progress</span>
                <span className="preview-progress-value">45%</span>
              </div>
              <div className="preview-track">
                <div className="preview-fill"></div>
              </div>
              <div className="preview-row">
                <span className="preview-row-label">Current Phase</span>
                <span className="preview-row-value">UI Design</span>
              </div>
              <div className="preview-row">
                <span className="preview-row-label">Payment</span>
                <span className="preview-row-value">$3,500 Paid</span>
              </div>
              <div className="preview-update-box">
                <div className="preview-update-title">Latest Update</div>
                <div className="preview-update-text">UI Design Phase Started</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============ ACCESS CARD ============ */}
      <section className="container">
        <div className="access-card reveal">
          <div>
            <div className="access-title">Access your client portal</div>
            <p className="access-desc">Sign in to continue working with your project team.</p>
            <span className="access-secondary-text">
              New to the portal?{' '}
              <Link href="/client/register" className="link">
                Create an Account
              </Link>
            </span>
          </div>
          <div className="access-actions">
            <Link href="/client/sign-in" className="btn btn-accent">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="section">
        <div className="container">
          <h2 className="section-title reveal">Everything you need to manage your project.</h2>
          <div className="feature-grid reveal">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: f.icon }} />
                </div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TRUST ============ */}
      <section className="section">
        <div className="container">
          <h2 className="section-title reveal">Your project information stays private.</h2>
          <p className="section-sub reveal">Only authorized clients and project members can access project information, files and documents.</p>
          <div className="trust-grid reveal">
            {TRUST_ITEMS.map((t) => (
              <div className="trust-item" key={t.title}>
                <div className="trust-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: t.icon }} />
                </div>
                <div className="trust-title">{t.title}</div>
                <div className="trust-desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="section">
        <div className="container">
          <h2 className="section-title reveal">Getting started is simple.</h2>
          <div className="steps-row reveal">
            {STEPS.map((s) => (
              <div className="step-card" key={s.num}>
                <div className="step-num">{s.num}</div>
                <div className="step-title">{s.title}</div>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HELP ============ */}
      <section className="section">
        <div className="container">
          <div className="help-card reveal">
            <div className="help-title">Need help accessing your project?</div>
            <p className="help-desc">If you are already working with our team and haven&apos;t received your portal access, contact your project manager.</p>
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-left">
              FLOW 53 <span>Client Portal</span>
            </div>
            <div className="footer-links">
              <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="footer-link">
                Support
              </a>
              <Link href="/dashboard" className="footer-link">
                Team Login
              </Link>
            </div>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} FLOW 53 Design Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
