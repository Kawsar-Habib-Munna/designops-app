'use client';

// Service Library — Phase 2-এ বানানো হবে (সার্চ/ফিল্টার সবার জন্য, Add/Edit/
// Archive শুধু is_admin)। এখন শেল + honest "coming soon" স্টেট।

import { useState } from 'react';
import { useSession } from '@/lib/useSession';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';

export default function BudgetServicesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <BudgetShell active="services" topbarTitle="Services" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-sub">The team&apos;s approved service catalog and pricing.</p>
        </div>
      </div>
      <div className="dcard">
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="layers" />
          </div>
          <div className="empty-title">Service library is coming in Phase 2</div>
          <p className="empty-sub">Categories, search, and admin pricing controls land next — real pricing will be added once the team&apos;s pricing sheet is provided.</p>
        </div>
      </div>
    </BudgetShell>
  );
}
