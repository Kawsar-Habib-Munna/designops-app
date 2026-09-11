'use client';

// শেয়ার্ড টিম হোয়াইটবোর্ড — একটাই ক্যানভাস (সবার জন্য কমন, প্রজেক্ট/ক্লায়েন্ট-ভিত্তিক
// আলাদা বোর্ড না), ড্রয়িং Excalidraw লাইব্রেরি দিয়ে (shapes/freehand/sticky notes/
// pan-zoom/undo-redo/PNG-SVG export — সবকিছু লাইব্রেরির নিজস্ব)। MIT-লাইসেন্সড,
// কোনো watermark/production license লাগে না — এর আগে tldraw ব্যবহার করা
// হয়েছিল, কিন্তু সেটার প্রোডাকশন ব্যবহারে পেইড লাইসেন্স লাগে বলে এটায় সরানো হয়েছে।
//
// পার্সিস্টেন্স: elements + appState (একটা ছোট, JSON-সেফ সাবসেট) + files (পেস্ট
// করা ছবি, base64 হিসেবে) — একসাথে একটাই JSON অবজেক্ট হিসেবে Supabase DB-তে না,
// Google Drive-এ একটাই JSON ফাইলে থাকে (app/api/whiteboard/route.ts,
// lib/googleDrive.ts-এর একই দেডিকেটেড অ্যাকাউন্ট/ফোল্ডার যেটা avatar/attachment/
// logo-এর জন্য ব্যবহৃত হয়)। এডিট করলে ~1.5 সেকেন্ড ইনঅ্যাক্টিভিটির পর debounced
// অটোসেভ হয়।
//
// সত্যিকারের লাইভ মাল্টি-কার্সার কোলাবোরেশন না — every কয়েক সেকেন্ডে হালকা
// পোলিং (Drive ফাইলের properties মেটাডেটা, কন্টেন্ট ডাউনলোড ছাড়াই) করে অন্য কেউ
// সেভ করেছে কিনা চেক হয়; করলে একটা "রিলোড করুন" ব্যানার দেখায়, silently
// ওভাররাইট করে না। টপবারে কে এখন বোর্ডে আছে সেটা Supabase Realtime Presence
// দিয়ে দেখানো হয় (board.tsx-এর প্যাটার্নের হুবহু কপি — এটা শুধু ephemeral
// "কে এখন দেখছে" সিগন্যাল, বোর্ডের ডেটা এখানে জড়িত না)।

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import '@excalidraw/excalidraw/index.css';

// @excalidraw/excalidraw মডিউল-লোড টাইমেই `window` অ্যাক্সেস করে, তাই Next.js-এর
// সার্ভার-সাইড প্রিরেন্ডারে ইম্পোর্ট করলে বিল্ড ফেইল করে ("window is not defined")।
// next/dynamic দিয়ে ssr:false — Excalidraw নিজে ডকুমেন্টেশনেই এটা সুপারিশ করে।
const Excalidraw = dynamic(() => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw), { ssr: false });
import type { ExcalidrawImperativeAPI, AppState, BinaryFiles, BinaryFileData } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
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

// ক্যানভাস রেন্ডার করতে গিয়ে কোনো এরর হলে পুরো পেজ ক্র্যাশ করে খালি রাখার বদলে
// অন্তত দৃশ্যমান একটা এরর মেসেজ দেখায়।
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('হোয়াইটবোর্ড ক্যানভাস রেন্ডার করতে সমস্যা হয়েছে:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="wb-canvas-error">
          <p>ক্যানভাস লোড করতে সমস্যা হয়েছে।</p>
          <pre>{this.state.error.message}</pre>
          <button className="btn-reload" onClick={() => window.location.reload()}>পেজ রিলোড করুন</button>
        </div>
      );
    }
    return this.props.children;
  }
}

type ProfileRow = { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null };
type PresenceMeta = { name: string; avatar_color: string | null; avatar_url: string | null };
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type WhiteboardMeta = { updatedBy: string | null; updatedAt: string | null };
type SavedAppState = { viewBackgroundColor: string; scrollX: number; scrollY: number; zoom: AppState['zoom'] };
type WhiteboardSnapshot = { elements: readonly ExcalidrawElement[]; appState: SavedAppState; files: BinaryFiles };
type WhiteboardLoadResult = { data: { updatedBy: string; updatedAt: string; snapshot: WhiteboardSnapshot } | null };

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('সেশন পাওয়া যায়নি — আবার লগইন করুন।');
  return { Authorization: `Bearer ${session.access_token}` };
}

// fetch() নিজে থেকে কখনো "টাইমআউট" হয় না — নেটওয়ার্ক/সার্ভার সত্যিই আটকে গেলে
// promise-টা অনির্দিষ্টকালের জন্য pending থেকে যেতে পারে, আর UI "সেভ হচ্ছে…"-এ
// চিরকালের জন্য আটকে থাকে। AbortController দিয়ে একটা হার্ড ২০-সেকেন্ড লিমিট
// দেওয়া হলো, যাতে সবসময় একটা নির্দিষ্ট সময়ের মধ্যে হয় সফল, নাহলে স্পষ্ট এরর দেখায়।
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('নেটওয়ার্ক রেসপন্স খুব দেরি করছে — আবার চেষ্টা করুন।');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function loadWhiteboard(): Promise<WhiteboardLoadResult> {
  const headers = await authHeader();
  const res = await fetchWithTimeout('/api/whiteboard', { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'হোয়াইটবোর্ড লোড করা যায়নি।');
  return json;
}

async function saveWhiteboardSnapshot(snapshot: WhiteboardSnapshot): Promise<{ ok: true; updatedAt: string }> {
  const headers = await authHeader();
  const res = await fetchWithTimeout('/api/whiteboard', {
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
  const res = await fetchWithTimeout('/api/whiteboard?meta=1', { headers }, 10000);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'চেক করা যায়নি।');
  return json;
}

export default function WhiteboardPage() {
  const { user, loading: sessionLoading } = useSession();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [presentUsers, setPresentUsers] = useState<{ id: string; name: string; avatar_color: string | null; avatar_url: string | null }[]>([]);
  const [showReloadBanner, setShowReloadBanner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // নিজেরই updateScene() কল (initial load / reload বাটন) যাতে ইমিডিয়েটলি আবার
  // অটোসেভ ট্রিগার না করে — Excalidraw-এর onChange সব ধরনের পরিবর্তনেই ডাকে,
  // প্রোগ্রামেটিক আপডেটও, তাই নিজেদের কলগুলো এই ref দিয়ে আলাদা করা হয়
  const isApplyingRemoteRef = useRef(false);
  const userEditedDuringInitialLoadRef = useRef(false);
  const lastKnownRef = useRef<{ updatedBy: string; updatedAt: string } | null>(null);
  const dismissedUpdatedAtRef = useRef<string | null>(null);

  // সেভ চলাকালীন কেউ রিফ্রেশ/ট্যাব বন্ধ করলে ব্রাউজার নিজে থেকেই সতর্ক করবে —
  // অসময়ে রিফ্রেশ করলে সেভ শেষ হওয়ার আগের (পুরনো) কন্টেন্ট দেখে "সব মুছে গেছে"
  // মনে হতে পারে, তাই এটা আটকানো
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

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

  function scheduleSave(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        const snapshot: WhiteboardSnapshot = {
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor, scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom },
          files,
        };
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

  function handleChange(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) {
    if (isApplyingRemoteRef.current) {
      // initial-load উইন্ডোতে সত্যিই কিছু আঁকা হলে সেটা মনে রাখি (খালি
      // এলিমেন্টের no-op প্রথম onChange-টা বাদ দিয়ে), যাতে fetch শেষ হওয়ার পর
      // পুরনো স্ন্যাপশট প্রয়োগ করে সেটা মুছে না যায়
      if (elements.length > 0) userEditedDuringInitialLoadRef.current = true;
      return;
    }
    scheduleSave(elements, appState, files);
  }

  // প্রথম লোড — excalidrawAPI রেডি হলে একবার চলে
  useEffect(() => {
    if (!excalidrawAPI || !user) return;
    isApplyingRemoteRef.current = true;
    userEditedDuringInitialLoadRef.current = false;

    (async () => {
      try {
        const result = await loadWhiteboard();
        if (result.data?.snapshot && !userEditedDuringInitialLoadRef.current) {
          const snap = result.data.snapshot;
          excalidrawAPI.updateScene({ elements: snap.elements, appState: snap.appState });
          if (snap.files && Object.keys(snap.files).length > 0) {
            excalidrawAPI.addFiles(Object.values(snap.files) as BinaryFileData[]);
          }
        }
        if (result.data) {
          lastKnownRef.current = { updatedBy: result.data.updatedBy, updatedAt: result.data.updatedAt };
        }
      } catch (err) {
        console.error('হোয়াইটবোর্ড লোড করতে সমস্যা হয়েছে:', err);
        setErrorMessage(err instanceof Error ? err.message : 'হোয়াইটবোর্ড লোড করা যায়নি।');
      } finally {
        isApplyingRemoteRef.current = false;
        if (userEditedDuringInitialLoadRef.current) {
          scheduleSave(excalidrawAPI.getSceneElements(), excalidrawAPI.getAppState(), excalidrawAPI.getFiles());
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- শুধু excalidrawAPI প্রথমবার রেডি হলে চলবে, user বদলানোর কথা না সেশন-লাইফটাইমে
  }, [excalidrawAPI]);

  async function handleReloadClick() {
    setShowReloadBanner(false);
    if (!excalidrawAPI) return;
    try {
      const result = await loadWhiteboard();
      if (result.data?.snapshot) {
        isApplyingRemoteRef.current = true;
        const snap = result.data.snapshot;
        excalidrawAPI.updateScene({ elements: snap.elements, appState: snap.appState });
        if (snap.files && Object.keys(snap.files).length > 0) {
          excalidrawAPI.addFiles(Object.values(snap.files) as BinaryFileData[]);
        }
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
        <CanvasErrorBoundary>
          <Excalidraw excalidrawAPI={(api) => setExcalidrawAPI(api)} onChange={handleChange} theme="light" />
        </CanvasErrorBoundary>
      </div>
    </div>
  );
}
