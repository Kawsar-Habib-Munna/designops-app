'use client';

// ইমেইল+পাসওয়ার্ড দিয়ে সাইন-ইন — আগে magic-link (OTP) ব্যবহার হতো, কিন্তু
// Supabase-এর ফ্রি টায়ারে ঘণ্টায় মাত্র ২টা ইমেইল পাঠানো যায়, যা ৯ জনের টিমের
// জন্য যথেষ্ট না। এখন টিম মেম্বাররা এডমিনের তৈরি করা ইমেইল+পাসওয়ার্ড দিয়ে সরাসরি
// লগইন করে (দেখুন: app/team/page.tsx-এর "টিম মেম্বার যোগ করুন" মোডাল, যেটা
// /api/team/create-member কল করে কোনো ইমেইল না পাঠিয়েই অ্যাকাউন্ট তৈরি করে)।

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSigningIn(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message === 'Invalid login credentials' ? 'ইমেইল বা পাসওয়ার্ড ভুল।' : error.message);
    setSigningIn(false);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">FLOW 53</h1>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">টিম ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন</p>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@studio.com"
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#5B4FE8] dark:border-zinc-700"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="পাসওয়ার্ড"
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#5B4FE8] dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={signingIn || !email || !password}
          className="rounded-lg bg-[#5B4FE8] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {signingIn ? 'সাইন-ইন হচ্ছে…' : 'সাইন-ইন করুন'}
        </button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">অ্যাকাউন্ট নেই? আপনার টিম এডমিনকে বলুন যোগ করে দিতে।</p>
      </form>
    </div>
  );
}
