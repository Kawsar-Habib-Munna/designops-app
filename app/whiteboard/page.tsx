'use client';

// শেয়ার্ড টিম হোয়াইটবোর্ড — একটাই ক্যানভাস (সবার জন্য কমন, প্রজেক্ট/ক্লায়েন্ট-ভিত্তিক
// আলাদা বোর্ড না), ড্রয়িং tldraw লাইব্রেরি দিয়ে (shapes/freehand/sticky notes/
// pan-zoom/undo-redo/PNG-SVG export — সবকিছু লাইব্রেরির নিজস্ব)।
//
// পার্সিস্টেন্স: পুরো ডকুমেন্ট state (আঁকা সহ, পেস্ট করা ছবিও — tldraw ডিফল্টে
// ছবি base64 হিসেবে স্ন্যাপশটের ভেতরেই এম্বেড করে) Supabase DB-তে না, Google
// Drive-এ একটাই JSON ফাইলে থাকে (app/api/whiteboard/route.ts, lib/googleDrive.ts-এর
// একই দেডিকেটেড অ্যাকাউন্ট/ফোল্ডার যেটা avatar/attachment/logo-এর জন্য ব্যবহৃত হয়)।
// এডিট করলে ~1.5 সেকেন্ড ইনঅ্যাক্টিভিটির পর debounced অটোসেভ হয়।
//
// সত্যিকারের লাইভ মাল্টি-কার্সার কোলাবোরেশন না — every কয়েক সেকেন্ডে হালকা
// পোলিং (Drive ফাইলের properties মেটাডেটা, কন্টেন্ট ডাউনলোড ছাড়াই) করে অন্য কেউ
// সেভ করেছে কিনা চেক হয়; করলে একটা "রিলোড করুন" ব্যানার দেখায়, silently
// ওভাররাইট করে না। টপবারে কে এখন বোর্ডে আছে সেটা Supabase Realtime Presence
// দিয়ে দেখানো হয় (board.tsx-এর প্যাটার্নের হুবহু কপি — এটা শুধু ephemeral
// "কে এখন দেখছে" সিগন্যাল, বোর্ডের ডেটা এখানে জড়িত না)।

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
type WhiteboardMeta = { updatedBy: string | null; updatedAt: string | null };
type WhiteboardLoadResult = { data: { updatedBy: string; updatedAt: string; snapshot: TLEditorSnapshot } | null };

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function loadWhiteboard(): Promise<WhiteboardLoadResult> {
  const headers = await authHeader();
  const res = await fetch('/api/whiteboard', { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'হোয়াইটবোর্ড লোড করা যায়নি।');
  return json;
}

async function saveWhiteboardSnapshot(snapshot: TLEditorSnapshot): Promise<{ ok: true; updatedAt: string }> {
  const headers = await authHeader();
  const res = await fetch('/api/whiteboard', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'হোয়াইটবোর্ড সেভ করা যায়নি।');
  return json;
}

async function pollWhiteboardMeta(): Promise<WhiteboardMeta> {
  const headers = await authHeader();
  const res = await fetch('/api/whiteboard?meta=1', { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'চেক করা যায়নি।');
  return json;
}

export default function WhiteboardPage() {
  const { user, loading: sessionLoading } = useSession();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [presentUsers, setPresentUsers] = useState<{ id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>([]);
  const [showReloadBanner, setShowReloadBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // নিজেরই loadSnapshot() কল (initial load / reload বাটন) যাতে ইমিডিয়েটলি আবার
  // অটোসেভ ট্রিগার না করে — ওই সময়টুকু store.listen ইগনোর করে
  const isApplyingRemoteRef = useRef(false);
  const lastKnownRef = useRef<{ updatedBy: string; updatedAt: string } | null>(null);
  const dismissedUpdatedAtRef = useRef<string | null>(null);

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

  function scheduleSave(editor: Editor) {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        const snapshot = getSnapshot(editor.store);
        const result = await saveWhiteboardSnapshot(snapshot);
        lastKnownRef.current = { updatedBy: user.id, updatedAt: result.updatedAt };
        setSaveStatus('saved');
        setErrorMessage(null);
      } catch (err) {
        console.error('হোয়াইটবোর্ড সেভ করতে সমস্যা হয়েছে:', err);
        setSaveStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'হোয়াইটবোর্ড সেভ করা যায়নি।');
      }
    }, 1500);
  }

  function handleMount(editor: Editor) {
    editorRef.current = editor;
    // পুরো initial-load উইন্ডো জুড়ে গার্ড — এডিটরের নিজস্ব bootstrap (blank
    // ডকুমেন্ট তৈরি) থেকে যেন ভুলবশত autosave ট্রিগার না হয়
    isApplyingRemoteRef.current = true;
    let userEditedDuringInitialLoad = false;

    const unsubscribe = editor.store.listen(
      () => {
        if (isApplyingRemoteRef.current) {
          userEditedDuringInitialLoad = true;
          return;
        }
        scheduleSave(editor);
      },
      { source: 'user', scope: 'document' }
    );

    (async () => {
      try {
        const result = await loadWhiteboard();
        // fetch শেষ হওয়ার আগেই ব্যবহারকারী আঁকা শুরু করলে পুরনো স্ন্যাপশট
        // প্রয়োগ করে সেটা মুছে ফেলা হবে না — এটাই এই ফাংশনের মূল বাগ-ফিক্স
        if (result.data?.snapshot && !userEditedDuringInitialLoad) {
          loadSnapshot(editor.store, result.data.snapshot);
        }
        if (result.data) {
          lastKnownRef.current = { updatedBy: result.data.updatedBy, updatedAt: result.data.updatedAt };
        }
      } catch (err) {
        console.error('হোয়াইটবোর্ড লোড করতে সমস্যা হয়েছে:', err);
        setErrorMessage(err instanceof Error ? err.message : 'হোয়াইটবোর্ড লোড করা যায়নি।');
      } finally {
        isApplyingRemoteRef.current = false;
        if (userEditedDuringInitialLoad) scheduleSave(editor);
      }
    })();

    return () => {
      unsubscribe();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }

  async function handleReloadClick() {
    setShowReloadBanner(false);
    if (!editorRef.current) return;
    try {
      const result = await loadWhiteboard();
      if (result.data?.snapshot) {
        isApplyingRemoteRef.current = true;
        loadSnapshot(editorRef.current.store, result.data.snapshot);
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 50);
        lastKnownRef.current = { updatedBy: result.data.updatedBy, updatedAt: result.data.updatedAt };
        dismissedUpdatedAtRef.current = result.data.updatedAt;
      }
    } catch (err) {
      console.error('রিলোড করতে সমস্যা হয়েছে:', err);
    }
  }

  function handleDismissBanner() {
    setShowReloadBanner(false);
  }

  // পোলিং: প্রতি ৮ সেকেন্ডে হালকা মেটাডেটা-চেক (Drive-এর properties, কন্টেন্ট
  // ডাউনলোড ছাড়াই) — টিমের অন্য কেউ সেভ করলে জানায়, silently ওভাররাইট করে না
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const meta = await pollWhiteboardMeta();
        if (cancelled || !meta.updatedBy || !meta.updatedAt) return;
        if (meta.updatedBy === user.id) return;
        if (lastKnownRef.current?.updatedAt === meta.updatedAt) return;
        if (dismissedUpdatedAtRef.current === meta.updatedAt) return;
        setShowReloadBanner(true);
      } catch {
        // পোলিং ব্যর্থ হলে চুপচাপ পরের সাইকেলে আবার চেষ্টা — ব্যবহারকারীকে বিরক্ত করার দরকার নেই
      }
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  // realtime presence: এখন কে কে বোর্ডে আছে (board.tsx-এর হুবহু প্যাটার্ন) — শুধু
  // ephemeral "কে দেখছে" সিগন্যাল, বোর্ডের ডেটা এখানে জড়িত না
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
          <button className="wb-dismiss-btn" onClick={handleDismissBanner} aria-label="বন্ধ করুন">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="wb-error-banner">
          <span>{errorMessage}</span>
          <button className="wb-dismiss-btn" onClick={() => setErrorMessage(null)} aria-label="বন্ধ করুন">✕</button>
        </div>
      )}

      <div className="wb-canvas">
        <Tldraw onMount={handleMount} />
      </div>
    </div>
  );
}
