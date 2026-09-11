'use client';

// শেয়ার্ড টিম হোয়াইটবোর্ড — একটাই ক্যানভাস (সবার জন্য কমন, প্রজেক্ট/ক্লায়েন্ট-ভিত্তিক
// আলাদা বোর্ড না), ড্রয়িং tldraw লাইব্রেরি দিয়ে (shapes/freehand/sticky notes/
// pan-zoom/undo-redo/PNG-SVG export — সবকিছু লাইব্রেরির নিজস্ব)।
//
// পার্সিস্টেন্স: whiteboard_state টেবিলের একটা singleton row-এ পুরো ডকুমেন্ট
// jsonb স্ন্যাপশট হিসেবে সেভ হয় (budget_settings-এর মতোই প্যাটার্ন)। এডিট করলে
// ~1.5 সেকেন্ড ইনঅ্যাক্টিভিটির পর debounced অটোসেভ হয়। সত্যিকারের লাইভ
// মাল্টি-কার্সার কোলাবোরেশন না — অন্য কেউ সেভ করলে একটা "রিলোড করুন" ব্যানার
// দেখায় (Supabase Realtime postgres_changes দিয়ে), যাতে কারও চলমান কাজ
// silently ওভাররাইট না হয়ে যায়। টপবারে কে এখন বোর্ডে আছে সেটা presence
// avatar-stack দিয়ে দেখানো হয় (board.tsx-এর presence প্যাটার্নের হুবহু কপি)।

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Tldraw, getSnapshot, loadSnapshot, type Editor, type TLEditorSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import './whiteboard.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import SignInScreen from '@/app/components/SignInScreen';
import Avatar from '@/app/components/Avatar';

const ICON_PATHS: Record<string, string> = {
  back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
};
type IconName = keyof typeof ICON_PATHS;
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

type ProfileRow = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };
type PresenceMeta = { name: string; avatar_color: string | null; avatar_url: string | null };
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function WhiteboardPage() {
  const { user, loading: sessionLoading } = useSession();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [presentUsers, setPresentUsers] = useState<{ id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>([]);
  const [showReloadBanner, setShowReloadBanner] = useState(false);
  const [pendingRemoteSnapshot, setPendingRemoteSnapshot] = useState<TLEditorSnapshot | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // নিজেরই loadSnapshot() কল (initial load / reload বাটন) যাতে ইমিডিয়েটলি আবার
  // অটোসেভ ট্রিগার না করে — ওই সময়টুকু store.listen ইগনোর করে
  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('id, full_name, avatar_color, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as ProfileRow);
      });
  }, [user]);

  function applyRemoteSnapshot(editor: Editor, snapshot: TLEditorSnapshot) {
    isApplyingRemoteRef.current = true;
    loadSnapshot(editor.store, snapshot);
    setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 50);
  }

  function scheduleSave(editor: Editor) {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      const snapshot = getSnapshot(editor.store);
      const { error } = await supabase
        .from('whiteboard_state')
        .update({ snapshot, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', true);
      setSaveStatus(error ? 'error' : 'saved');
    }, 1500);
  }

  function handleMount(editor: Editor) {
    editorRef.current = editor;

    (async () => {
      const { data } = await supabase.from('whiteboard_state').select('snapshot').eq('id', true).maybeSingle();
      const snapshot = data?.snapshot as TLEditorSnapshot | undefined;
      if (snapshot && Object.keys(snapshot).length > 0) {
        applyRemoteSnapshot(editor, snapshot);
      }
    })();

    const unsubscribe = editor.store.listen(
      () => {
        if (isApplyingRemoteRef.current) return;
        scheduleSave(editor);
      },
      { source: 'user', scope: 'document' }
    );

    return () => {
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }

  function handleReloadClick() {
    if (!editorRef.current || !pendingRemoteSnapshot) return;
    applyRemoteSnapshot(editorRef.current, pendingRemoteSnapshot);
    setShowReloadBanner(false);
    setPendingRemoteSnapshot(null);
  }

  // realtime: টিমের অন্য কেউ বোর্ড সেভ করলে জানায় — silently ওভাররাইট করে না
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('whiteboard-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whiteboard_state' }, (payload) => {
        const row = payload.new as { updated_by: string | null; snapshot: TLEditorSnapshot };
        if (row.updated_by === user.id) return;
        setPendingRemoteSnapshot(row.snapshot);
        setShowReloadBanner(true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // realtime presence: এখন কে কে বোর্ডে আছে (board.tsx-এর হুবহু প্যাটার্ন)
  useEffect(() => {
    if (!user || !profile) return;
    const channel = supabase.channel('whiteboard-presence', { config: { presence: { key: user.id } } });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const others = Object.entries(state)
        .filter(([key]) => key !== user.id)
        .map(([key, metas]) => ({ id: key, name: metas[0]?.name ?? '?', avatar_color: metas[0]?.avatar_color ?? null, avatar_url: metas[0]?.avatar_url ?? null }));
      setPresentUsers(others);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ name: profile.full_name, avatar_color: profile.avatar_color, avatar_url: profile.avatar_url });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <div className="whiteboard-root">
      <header className="wb-topbar">
        <Link href="/dashboard" className="wb-back">
          <Icon name="back" size={15} /> Dashboard
        </Link>
        <span className="wb-title">Team Whiteboard</span>
        <div className="wb-spacer"></div>
        {presentUsers.length > 0 && (
          <div className="presence-row avatar-stack" title="এখন বোর্ডে যারা আছে">
            {presentUsers.slice(0, 6).map((p) => (
              <Avatar key={p.id} person={{ full_name: p.name, avatar_color: p.avatar_color, avatar_url: p.avatar_url }} size={26} title={p.name}>
                <span className="presence-ring"></span>
              </Avatar>
            ))}
          </div>
        )}
        <span className={`wb-save-status${saveStatus === 'error' ? ' error' : ''}`}>
          {saveStatus === 'saving' ? 'সেভ হচ্ছে…' : saveStatus === 'saved' ? 'সেভ হয়েছে' : saveStatus === 'error' ? 'সেভ ব্যর্থ হয়েছে' : ''}
        </span>
      </header>

      {showReloadBanner && (
        <div className="wb-reload-banner">
          <span>টিমের অন্য কেউ বোর্ড আপডেট করেছে।</span>
          <button className="wb-reload-btn" onClick={handleReloadClick}>রিলোড করুন</button>
        </div>
      )}

      <div className="wb-canvas">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
