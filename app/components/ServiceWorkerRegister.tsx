'use client';

// রুট layout-এ একবার মাউন্ট হয় — পুরো অ্যাপের জন্য একটাই service worker
// (public/sw.js) রেজিস্টার করে, যেটা push notification দেখানোর জন্য দরকার।
// নিজে কিছু রেন্ডার করে না।

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  }, []);

  return null;
}
