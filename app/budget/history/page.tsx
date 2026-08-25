'use client';

// Quote History — Phase 6-এ বানানো হবে (searchable/filterable টেবিল +
// quote detail পাতা)। এখন শেল + honest "coming soon" স্টেট।

import { useState } from 'react';
import { useSession } from '@/lib/useSession';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';

export default function BudgetHistoryPage() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <BudgetShell active="history" topbarTitle="Quote History" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Quote History</h1>
          <p className="page-sub">Every quotation the team has generated, searchable by client, service, or teammate.</p>
        </div>
      </div>
      <div className="dcard">
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="clock" />
          </div>
          <div className="empty-title">Quote history is coming in Phase 6</div>
          <p className="empty-sub">Once Generate Quote (Phase 3) is live, saved quotes will appear here — searchable and filterable.</p>
        </div>
      </div>
    </BudgetShell>
  );
}
