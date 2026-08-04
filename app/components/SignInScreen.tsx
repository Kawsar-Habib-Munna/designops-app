'use client';

// Supabase-এ "Invite User" দিয়ে যোগ করা টিম মেম্বাররা পাসওয়ার্ড ছাড়াই
// ইমেইলে পাঠানো ম্যাজিক-লিংক দিয়ে সাইন-ইন করে — signInWithOtp ব্যবহার করে।

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) setError(error.message);
    else setSent(true);
    setSending(false);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">DesignOps</h1>

      {sent ? (
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          <strong className="text-zinc-800 dark:text-zinc-200">{email}</strong>-এ একটা লগইন লিংক পাঠানো হয়েছে —
          ইমেইল চেক করে লিংকে ক্লিক করুন।
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">টিম ইমেইল দিয়ে সাইন-ইন করুন</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
            className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#5B4FE8] dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={sending || !email}
            className="rounded-lg bg-[#5B4FE8] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? 'পাঠানো হচ্ছে…' : 'লগইন লিংক পাঠান'}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      )}
    </div>
  );
}
