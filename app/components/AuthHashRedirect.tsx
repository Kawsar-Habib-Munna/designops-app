'use client';

// Google OAuth সাইন-ইনের পর Supabase কখনো কখনো /client/auth/callback-এর বদলে
// প্রজেক্টের Site URL (এই পাবলিক হোমপেজ)-এ রিডাইরেক্ট করে ফেলে — redirect_to
// প্যারামিটার সঠিকভাবে পাঠানো সত্ত্বেও (Redirect URLs allow-list-এ থাকার পরও,
// সম্ভবত Supabase-এর কনফিগ propagation delay/matching quirk)। এই কম্পোনেন্ট
// একটা safety net: যেকোনো পেজে URL hash-এ Supabase-এর সেশন টোকেন
// (#access_token=...) দেখা গেলে, সেটা /client/auth/callback-এ ফরোয়ার্ড করে
// দেয় যাতে স্বাভাবিক callback লজিক (hasClient চেক, onboarding/dashboard
// রাউটিং) চলে।
import { useEffect } from 'react';

export default function AuthHashRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.includes('access_token=')) return;
    if (window.location.pathname === '/client/auth/callback') return;

    window.location.replace(`/client/auth/callback${hash}`);
  }, []);

  return null;
}
