'use client';

// Settings (admin-only) — Phase 7-এ বানানো হবে (General/Branding/Quote
// defaults/Message templates)। এখন শেল + honest "coming soon" স্টেট, প্লাস
// non-admin গার্ড (RLS আগে থেকেই লেখা ব্লক করে, এটা শুধু UX)।

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';

export default function BudgetSettingsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function run() {
      const { data } = await supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single();
      if (data) setProfile(data as ProfileRow);
      setLoading(false);
    }
    run();
  }, [user]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  if (!loading && !profile?.is_admin) {
    return (
      <BudgetShell active="settings" topbarTitle="Settings" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
        <div className="dcard">
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="settings" />
            </div>
            <div className="empty-title">Admins only</div>
            <p className="empty-sub">Settings are managed by team admins.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push('/budget')}>
              Back to Overview
            </button>
          </div>
        </div>
      </BudgetShell>
    );
  }

  return (
    <BudgetShell active="settings" topbarTitle="Settings" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Team branding, quote defaults, and message templates.</p>
        </div>
      </div>
      <div className="dcard">
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="settings" />
          </div>
          <div className="empty-title">Settings are coming in Phase 7</div>
          <p className="empty-sub">General info, branding, default currency, quote defaults, and editable message templates land here.</p>
        </div>
      </div>
    </BudgetShell>
  );
}
