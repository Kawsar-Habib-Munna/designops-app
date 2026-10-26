'use client';

// Google OAuth সাইন-ইনের পর Supabase এখানে ফেরত পাঠায় (supabaseClient.ts-এর
// createClient() ডিফল্টে detectSessionInUrl:true, তাই সেশন ইতিমধ্যেই সেট হয়ে
// যায়)। /api/client/google-callback কল করে ঠিক করা হয় এই ইউজার আগে থেকেই
// client কিনা, নাকি প্রথমবার (তখন প্রোফাইল-সম্পূর্ণ ফর্মে পাঠানো হয়), নাকি
// এই Google অ্যাকাউন্টটা আসলে একটা টিম মেম্বারের (তখন ব্লক করে সাইন-আউট)।

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { resolveClientLandingRoute } from '@/lib/clientPortal';
import '../../client-shared.css';

export default function ClientAuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // detectSessionInUrl হ্যাশ থেকে সেশন পার্স করতে এক টিক সময় নিতে পারে —
      // তাই getSession() একবার না পেলে অল্প অপেক্ষা করে আবার চেষ্টা করা হয়।
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise((r) => setTimeout(r, 500));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;

      if (!session) {
        setError('সাইন-ইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।');
        return;
      }

      try {
        const res = await fetch('/api/client/google-callback', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || data.error) {
          setError(data.error ?? 'সাইন-ইন সম্পন্ন করা যায়নি।');
          return;
        }
        if (data.blocked) {
          await supabase.auth.signOut();
          setError('এই Google অ্যাকাউন্টটা একটা টিম মেম্বার অ্যাকাউন্টের সাথে যুক্ত — client পোর্টালে এটা দিয়ে সাইন-ইন করা যাবে না।');
          return;
        }
        if (!data.hasClient) {
          router.replace('/client/complete-profile');
          return;
        }
        router.replace(await resolveClientLandingRoute());
      } catch {
        if (!cancelled) setError('সাইন-ইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="client-portal">
      <div className="cp-loading-shell">
        {error ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 16 }}>{error}</p>
            <a href="/client/sign-in" className="cp-btn cp-btn-primary">
              Back to Sign In
            </a>
          </div>
        ) : (
          'Signing in…'
        )}
      </div>
    </div>
  );
}
