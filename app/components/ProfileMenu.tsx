'use client';

// সব শেল পেজেই (dashboard/tasks/projects/team) ব্যবহৃত প্রোফাইল কার্ড। ক্লিক
// করলে নাম/রোল/ছবি এডিট করা যায়, আর লগ-আউটও এখান থেকেই।
//
// মোডালটা React portal দিয়ে সরাসরি document.body-তে রেন্ডার হয় — আগে এটা
// সরাসরি JSX-এ (অর্থাৎ .sidebar-এর ভেতরে) রেন্ডার হতো, যেটা mobile-এ ভেঙে
// যাচ্ছিল: মোবাইল ড্রয়ারের জন্য .sidebar-এ transform (translateX) দেওয়া থাকে,
// আর CSS-এর নিয়ম অনুযায়ী কোনো ancestor-এ transform থাকলে সেটা position:fixed
// চাইল্ডদের জন্য নতুন "containing block" হয়ে যায় (পুরো viewport-এর বদলে) —
// ফলে মোডাল পুরো স্ক্রিনের বদলে .sidebar-এর ছোট্ট বক্সের ভেতরে আটকে যাচ্ছিল।
// portal দিয়ে DOM-এ সরিয়ে নিলে .sidebar-এর কোনো ancestor আর মোডালের জন্য
// প্রাসঙ্গিক থাকে না, তাই ডেস্কটপ/মোবাইল দুটোতেই ঠিকভাবে পুরো viewport-এ
// সেন্টার হয়ে বসে। যেহেতু portal-এর কনটেন্ট প্রতিটা পেজের নিজস্ব scoped CSS
// (.dashboard-root .modal-box ইত্যাদি)-এর বাইরে থাকে, তাই এখানে Tailwind
// ইউটিলিটি ক্লাস দিয়ে সেলফ-কন্টেইন্ড স্টাইল করা হয়েছে — কোনো পেজের CSS-এর
// উপর নির্ভর করে না। dark মোড OS-লেভেল না, পেজের নিজস্ব টগল অনুযায়ী দেখানোর
// জন্য `dark` prop টাই ব্যবহার হয় (Tailwind-এর media-query dark: variant না)।
//
// প্রোফাইল ছবি আপলোড হয় Google Drive-এ (Files/Discussions পেজ যেভাবে করে,
// সেই একই resumable upload — lib/driveUpload.ts), আর drive_url সেভ হয়
// profiles.avatar_url কলামে।

import { useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';

type Profile = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url?: string | null };

export default function ProfileMenu({ profile, email, onUpdated, dark = false }: { profile: Profile | null; email: string; onUpdated: (p: Profile) => void; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? '');
  const [role, setRole] = useState(profile?.role ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.full_name?.trim() || email;
  const avatarInitial = Array.from(displayName)[0]?.toUpperCase() ?? '?';
  const avatarImg = profile?.avatar_url ? driveThumbnailUrl(profile.avatar_url) : null;

  function handleOpen() {
    setName(profile?.full_name ?? '');
    setRole(profile?.role ?? '');
    setError(null);
    setNewPassword('');
    setPasswordMsg(null);
    setAvatarError(null);
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
      .select('id, full_name, role, avatar_color, avatar_url')
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

  async function handleAvatarFile(file: File) {
    if (!profile) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('শুধু ছবি ফাইল আপলোড করা যাবে।');
      return;
    }
    setUploadingAvatar(true);
    setAvatarProgress(0);
    setAvatarError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
      const result = await uploadFileToDrive(file, session.access_token, setAvatarProgress);
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: result.webViewLink })
        .eq('id', profile.id)
        .select('id, full_name, role, avatar_color, avatar_url')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'ছবি সেভ করা যায়নি।');
      onUpdated(data as Profile);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'ছবি আপলোড ব্যর্থ হয়েছে।');
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setPasswordMsg({ text: 'পাসওয়ার্ড কমপক্ষে ৮ ক্যারেক্টার হতে হবে।', ok: false });
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setPasswordMsg({ text: error.message, ok: false });
      return;
    }
    setNewPassword('');
    setPasswordMsg({ text: 'পাসওয়ার্ড পরিবর্তন হয়েছে।', ok: true });
  }

  const cardBg = dark ? 'bg-zinc-900 border-zinc-700 text-zinc-50' : 'bg-white border-zinc-200 text-zinc-900';
  const inputCls = dark
    ? 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-[#7C72FF]'
    : 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#5B4FE8]';
  const labelCls = `mb-1.5 block text-xs font-medium ${dark ? 'text-zinc-400' : 'text-zinc-500'}`;

  const modal = open ? (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[8vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className={`w-full max-w-[420px] rounded-2xl border shadow-2xl ${cardBg}`}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: dark ? '#3f3f46' : '#e4e4e7' }}>
          <div className="text-base font-semibold">প্রোফাইল</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="বন্ধ করুন"
            className={`flex h-7 w-7 items-center justify-center rounded-md ${dark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-400 hover:bg-zinc-100'}`}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          {/* avatar */}
          <div className="mb-5 flex flex-col items-center">
            <div className="relative">
              <div
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold text-white"
                style={{ background: avatarImg ? undefined : (profile?.avatar_color ?? '#5B4FE8') }}
              >
                {avatarImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarImg} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  avatarInitial
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="ছবি পরিবর্তন করুন"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs disabled:opacity-60"
                style={{ background: '#5B4FE8', color: '#fff', borderColor: dark ? '#18181b' : '#fff' }}
              >
                ✎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarFile(file);
                  e.target.value = '';
                }}
              />
            </div>
            {uploadingAvatar && <p className="mt-2 text-xs" style={{ color: dark ? '#a1a1aa' : '#71717a' }}>আপলোড হচ্ছে… {avatarProgress}%</p>}
            {avatarError && <p className="mt-2 text-xs text-red-500">{avatarError}</p>}
          </div>

          <form onSubmit={handleSave}>
            <label className={labelCls}>ইমেইল</label>
            <input className={`${inputCls} mb-3 opacity-60`} type="text" value={email} disabled />

            <label className={labelCls}>নাম</label>
            <input className={`${inputCls} mb-3`} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" required autoFocus />

            <label className={labelCls}>রোল</label>
            <input className={`${inputCls} mb-3`} type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="যেমন: UX Designer" />

            {error && <p className="mb-2.5 text-xs text-red-500">{error}</p>}

            <div className="mt-1.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'}`}
              >
                লগ-আউট
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: '#5B4FE8' }}
              >
                {saving ? 'সেভ হচ্ছে…' : 'সেভ করুন'}
              </button>
            </div>
          </form>

          <div className="mt-4 border-t pt-4" style={{ borderColor: dark ? '#3f3f46' : '#e4e4e7' }}>
            <label className={labelCls}>পাসওয়ার্ড পরিবর্তন করুন</label>
            <input
              className={`${inputCls} mb-2.5`}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৮ ক্যারেক্টার)"
              minLength={8}
            />
            {passwordMsg && <p className="mb-2.5 text-xs" style={{ color: passwordMsg.ok ? '#17A34A' : '#ef4444' }}>{passwordMsg.text}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={changingPassword || newPassword.length < 8}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'}`}
              >
                {changingPassword ? 'পরিবর্তন হচ্ছে…' : 'পাসওয়ার্ড আপডেট করুন'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button className="profile-card" onClick={handleOpen} aria-label="প্রোফাইল দেখুন ও এডিট করুন">
        <div className="avatar" style={{ width: 34, height: 34, fontSize: 13, background: avatarImg ? undefined : (profile?.avatar_color ?? undefined), overflow: 'hidden', padding: 0 }}>
          {avatarImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            avatarInitial
          )}
        </div>
        <div className="profile-meta">
          <div className="profile-name">{displayName}</div>
          <div className="profile-role">{profile?.role || email}</div>
        </div>
      </button>

      {typeof document !== 'undefined' && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
