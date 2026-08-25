'use client';

// Generate Quote flow — Phase 3-এ বানানো হবে (service → client info →
// package selection → message → card preview → save)। এখন শুধু শেল +
// honest "coming soon" স্টেট, যাতে sidebar লিঙ্কটা ডেড না থাকে।
//
// useSearchParams() একটা static route-এ (এখানে কোনো [id]-স্টাইল dynamic
// সেগমেন্ট নেই) Suspense boundary ছাড়া ব্যবহার করলে build-time prerender
// এরর দেয় ("should be wrapped in a suspense boundary") — তাই সার্চ-প্যারাম
// পড়া অংশটা আলাদা child কম্পোনেন্টে সরিয়ে <Suspense> দিয়ে মোড়ানো হলো।

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/useSession';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';

function GenerateQuoteBody({ profile, email, onProfileUpdated }: { profile: ProfileRow | null; email: string; onProfileUpdated: (p: ProfileRow) => void }) {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get('service');

  return (
    <BudgetShell active="new" topbarTitle="Generate Quote" profile={profile} email={email} onProfileUpdated={onProfileUpdated}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Generate Quote</h1>
          <p className="page-sub">Search → Select → Generate → Copy, in under a minute.</p>
        </div>
      </div>
      <div className="dcard">
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="plus" />
          </div>
          <div className="empty-title">Quote generator is coming in Phase 3</div>
          <p className="empty-sub">
            {serviceId ? 'The service you picked will be pre-selected once this flow is built.' : 'Service search, client details, package selection, message and card generation land next.'}
          </p>
        </div>
      </div>
    </BudgetShell>
  );
}

export default function GenerateQuotePage() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <Suspense fallback={null}>
      <GenerateQuoteBody profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile} />
    </Suspense>
  );
}
