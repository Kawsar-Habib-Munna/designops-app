'use client';

// সব শেল পেজেই (dashboard/tasks/projects/team) ব্যবহৃত প্রোফাইল কার্ড।
// ক্লিক করলে নাম/রোল এডিট করা যায় (ম্যাজিক-লিংক সাইন-আপে নাম না দিলে
// প্রোফাইলের full_name ডিফল্টভাবে ইমেইল হয়ে যায় — এখান থেকে ঠিক করা যাবে),
// আর লগ-আউটও এখান থেকেই। প্রতিটা পেজের scoped CSS-এ .profile-card/.modal-*
// ক্লাসগুলো একই নামে ডিফাইন করা আছে, তাই এই কম্পোনেন্ট কোনো এক্সট্রা CSS ছাড়াই
// যেকোনো পেজের শেলের ভেতরে বসে যায়।

import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = { id: string; full_name: string; role: string | null; avatar_color: string | null };

export default function ProfileMenu({ profile, email, onUpdated }: { profile: Profile | null; email: string; onUpdated: (p: Profile) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [role, setRole] = useState(profile?.role ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = profile?.full_name?.trim() || email;
  const avatarInitial = Array.from(displayName)[0]?.toUpperCase() ?? '?';

  function handleOpen() {
    setName(profile?.full_name ?? '');
    setRole(profile?.role ?? '');
    setError(null);
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim()) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), role: role.trim() || null })
      .eq('id', profile.id)
      .select('id, full_name, role, avatar_color')
      .single();
    setSaving(false);

    if (error) {
      // RLS-এ update পলিসি না থাকলে/না মিললে PostgREST এখানে ঠিক এই এরর দেয়
      // (০ রো আপডেট হয়ে .single()-এ কিছু ফেরত না আসায়), যেটা আগে চুপচাপ চাপা পড়ে যেত।
      setError(error.message.includes('multiple (or no) rows') ? 'সেভ হয়নি — পারমিশন সমস্যা (RLS update policy চেক করুন)।' : error.message);
      return;
    }

    onUpdated(data as Profile);
    setOpen(false);
  }

  return (
    <>
      <button className="profile-card" onClick={handleOpen} aria-label="প্রোফাইল দেখুন ও এডিট করুন">
        <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: profile?.avatar_color ?? undefined }}>
          {avatarInitial}
        </div>
        <div className="profile-meta">
          <div className="profile-name">{displayName}</div>
          <div className="profile-role">{profile?.role || email}</div>
        </div>
      </button>

      {open && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-title">প্রোফাইল</div>
            <form onSubmit={handleSave}>
              <label className="field-label">ইমেইল</label>
              <input className="field-input" type="text" value={email} disabled style={{ opacity: 0.6 }} />

              <label className="field-label">নাম</label>
              <input className="field-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" required autoFocus />

              <label className="field-label">রোল</label>
              <input className="field-input" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="যেমন: UX Designer" />

              {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</p>}

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>লগ-আউট</button>
                <button type="submit" className="btn btn-accent btn-sm" disabled={saving || !name.trim()}>
                  {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
