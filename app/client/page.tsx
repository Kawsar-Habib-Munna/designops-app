'use client';

// Screen 1 — Client Portal Entry। Figma "Client" ফ্রেম (fileKey 4Thf3ZwakADG9M3x75Fedt,
// node 1339:812) অনুযায়ী রিডিজাইন করা হয়েছে — আগের elaborate ভার্সনে (hero+preview
// card, access card, feature grid, trust, how-it-works, help section) যা ছিল তার
// বদলে এখন শুধু এই ফ্রেমে যা আছে তাই: nav, একটা single hero (heading/desc/CTA/
// sign-in লাইন + প্রিভিউ ছবি), আর একটা মিনিমাল footer (কপিরাইট + পেমেন্ট আইকন)।
//
// সেশন-চেক: ইতিমধ্যে লগইন করা ক্লায়েন্ট এই এন্ট্রি পেজে এলে সরাসরি dashboard/
// onboarding-এ রিডাইরেক্ট হয়। ব্যর্থ হলেও (নেটওয়ার্ক এরর) fail-open।

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { resolveClientLandingRoute } from '@/lib/clientPortal';
import './client.css';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/8801804409235?text=Hi%20FLOW53,%20I%27m%20having%20trouble%20accessing%20my%20client%20portal.';

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
      <div className="client-bg" aria-hidden="true"></div>

      {/* ============ NAV ============ */}
      <nav className="client-nav">
        <div className="client-nav-inner">
          <Link href="/" className="client-nav-logo">
            <img src="/nav-logo-mark.svg" alt="" className="client-nav-logo-mark" />
            <img src="/nav-logo-text.svg" alt="FLOW 53" className="client-nav-logo-text" />
            <span className="client-nav-logo-tagline">Innovate-Design-Elevate</span>
          </Link>
          <span className="client-nav-center">
            <span className="client-nav-dot"></span>
            Client Portal
          </span>
          <div className="client-nav-right">
            <a href={WHATSAPP_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="client-nav-help">
              Need help ?
            </a>
            <Link href="/client/sign-in" className="client-nav-signin">
              <span className="client-nav-signin-inner">Sign In</span>
              <img src="/client-portal/icon-arrow-flat.svg" alt="" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="client-hero">
        <div className="client-hero-inner">
          <div className="client-hero-copy">
            <h1 className="client-hero-title">Your project, all in one place.</h1>
            <p className="client-hero-desc">Access your project updates, files, payments, approvals and communication through our secure client portal.</p>
            <Link href="/client/register" className="client-hero-cta">
              <span className="client-hero-cta-inner">Create Client Account</span>
              <img src="/cta/icon-arrow.svg" alt="" />
            </Link>
            <p className="client-hero-signin-line">
              Already working with Flow53?{' '}
              <Link href="/client/sign-in" className="client-hero-signin-link">
                Sign in using your registered email.
              </Link>
            </p>
          </div>
          <div className="client-hero-photo">
            <img src="/client-portal/hero-photo.webp" alt="Preview of the Flow 53 client dashboard" />
          </div>
        </div>
      </header>

      {/* ============ FOOTER ============ */}
      <footer className="client-footer">
        <div className="client-footer-inner">
          <div className="client-footer-line"></div>
          <div className="client-footer-row">
            <span className="client-footer-copy">
              <img src="/client-portal/icon-copyright.svg" alt="" />
              {new Date().getFullYear()} Flow 53. All Rights Reserved.
            </span>
            <div className="client-footer-payments">
              <img src="/client-portal/pay-generic.svg" alt="" className="client-pay client-pay-generic" />
              <img src="/client-portal/pay-paypal.svg" alt="PayPal" className="client-pay" />
              <img src="/client-portal/pay-visa.svg" alt="Visa" className="client-pay" />
              <img src="/client-portal/pay-mastercard.svg" alt="Mastercard" className="client-pay" />
              <img src="/client-portal/pay-amex.svg" alt="American Express" className="client-pay" />
            </div>
          </div>
          <div className="client-footer-line"></div>
        </div>
      </footer>
    </div>
  );
}
