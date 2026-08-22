'use client';

// Screen 18 — Messages (client)। v2: প্রিমিয়াম multi-conversation inbox লেআউট।
//
// আসল ডেটা মডেল একটাই flat থ্রেড (client_messages, project-স্কোপড) — কোনো
// আলাদা "conversations"/"channels" টেবিল নেই। এখানে বাম প্যানেলের প্রতিটা "রো"
// আসলে একজন real টিম মেম্বার (sender_id, ফেজ ১৬-এ client-কে সেই প্রোফাইল পড়ার
// RLS দেওয়া হয়েছে) যিনি অন্তত একবার রিপ্লাই করেছেন — ক্লিক করলে সেই একই real
// থ্রেড ফিল্টার হয়ে "তার মেসেজ + আমার নিজের মেসেজ" দেখায়। কোনো ভুয়া আলাদা
// conversation তৈরি করা হয়নি (কোনো টিম মেম্বার রিপ্লাই না করলে একটাই জেনেরিক
// "FLOW 53 Team" বাকেটে ক্লায়েন্টের নিজের মেসেজ দেখায়)।
//
// "Starred" localStorage-এ (ডিভাইস-লোকাল) — নতুন কোনো টেবিল ছাড়াই real,
// persistent, কিন্তু সার্ভার-সিঙ্কড নয় বলে claim করা হচ্ছে না। Read-receipt
// (✓✓) real client_messages.read_at থেকে (admin পেজ মেসেজ পড়লে সেট হয়)। Online
// status/call/video বাটন রাখা হয়নি — কোনো presence/calling সিস্টেম এই কোডবেসে
// নেই, fake affordance দেখানো হয়নি। Attachment এখন real filename/size/type সহ।

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive, guessFileType } from '@/lib/driveUpload';
import { formatBnDateLong } from '@/lib/format';
import '../../../client-shared.css';
import './messages.css';

const ICONS: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  doc: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  starFilled: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor"/>',
  paperclip: '<path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L9.42 17.4a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
};
function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type ProjectInfo = { id: string; name: string };
type SenderProfile = { id: string; full_name: string; role: string | null; avatar_url: string | null };
type MessageRow = {
  id: string;
  sender: string;
  sender_id: string | null;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_type: string | null;
  created_at: string;
  read_at: string | null;
};
type Conversation = { key: string; name: string; role: string | null; avatarUrl: string | null; unreadCount: number; lastMessage: MessageRow };

const GENERAL_KEY = '__team__';
const AVATAR_PALETTE = ['#7c3aed', '#0ea5a4', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#ec4899'];

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
function dayLabel(iso: string): string {
  const today = new Date();
  const d = new Date(iso);
  if (isSameDay(iso, today.toISOString())) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return 'Yesterday';
  return formatBnDateLong(d.toISOString());
}

export default function ClientMessagesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, SenderProfile>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);

  const [listSearch, setListSearch] = useState('');
  const [listTab, setListTab] = useState<'all' | 'unread' | 'starred'>('all');
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [threadSearch, setThreadSearch] = useState('');
  const [showThreadSearch, setShowThreadSearch] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadMessages() {
    const { data } = await supabase
      .from('client_messages')
      .select('id, sender, sender_id, message, attachment_url, attachment_name, attachment_size, attachment_type, created_at, read_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    const rows = (data as MessageRow[]) ?? [];
    setMessages(rows);

    const senderIds = Array.from(new Set(rows.filter((m) => m.sender === 'team' && m.sender_id).map((m) => m.sender_id as string)));
    if (senderIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, avatar_url').in('id', senderIds);
      const map: Record<string, SenderProfile> = {};
      (profilesData as SenderProfile[] | null)?.forEach((p) => {
        map[p.id] = p;
      });
      setProfilesById(map);
    }
    return rows;
  }

  useEffect(() => {
    (async () => {
      try {
        const own = await fetchOwnClientProject(projectId);
        if (!own) {
          router.replace('/client/dashboard');
          return;
        }
        setProject(own.project);
        setClient(own.client);
        await loadMessages();
        try {
          const raw = window.localStorage.getItem(`flow53-starred-${projectId}`);
          if (raw) setStarred(new Set(JSON.parse(raw) as string[]));
        } catch {
          // localStorage unavailable — starring just won't persist this session
        }
        setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, projectId]);

  useEffect(() => {
    if (!client) return;
    const interval = setInterval(loadMessages, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const conversations = useMemo<Conversation[]>(() => {
    const bySenderId = new Map<string, MessageRow[]>();
    let hasClientMessage = false;
    messages.forEach((m) => {
      if (m.sender === 'client') {
        hasClientMessage = true;
        return;
      }
      const key = m.sender_id ?? GENERAL_KEY;
      if (!bySenderId.has(key)) bySenderId.set(key, []);
      bySenderId.get(key)!.push(m);
    });

    const keys = bySenderId.size > 0 ? Array.from(bySenderId.keys()) : hasClientMessage ? [GENERAL_KEY] : [];

    const list: Conversation[] = keys.map((key) => {
      const profile = key !== GENERAL_KEY ? profilesById[key] : undefined;
      const relevant = messages.filter((m) => m.sender === 'client' || (m.sender_id ?? GENERAL_KEY) === key);
      const last = relevant[relevant.length - 1];
      const unread = (bySenderId.get(key) ?? []).filter((m) => !m.read_at).length;
      return {
        key,
        name: profile?.full_name ?? 'FLOW 53 Team',
        role: profile?.role ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        unreadCount: unread,
        lastMessage: last,
      };
    });

    return list.filter((c) => c.lastMessage).sort((a, b) => b.lastMessage.created_at.localeCompare(a.lastMessage.created_at));
  }, [messages, profilesById]);

  useEffect(() => {
    if (conversations.length === 0) return;
    if (!selectedKey || !conversations.some((c) => c.key === selectedKey)) {
      const firstKey = conversations[0].key;
      const timer = setTimeout(() => setSelectedKey(firstKey), 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    if (!selectedKey || !client) return;
    const target = conversations.find((c) => c.key === selectedKey);
    if (!target || target.unreadCount === 0) return;
    (async () => {
      let q = supabase.from('client_messages').update({ read_at: new Date().toISOString() }).eq('project_id', projectId).eq('sender', 'team').is('read_at', null);
      q = selectedKey === GENERAL_KEY ? q.is('sender_id', null) : q.eq('sender_id', selectedKey);
      await q;
      await loadMessages();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedKey, messages.length]);

  const activeMessages = useMemo(() => {
    if (!selectedKey) return [];
    const base = messages.filter((m) => m.sender === 'client' || (m.sender_id ?? GENERAL_KEY) === selectedKey);
    if (!threadSearch.trim()) return base;
    const q = threadSearch.trim().toLowerCase();
    return base.filter((m) => m.message?.toLowerCase().includes(q));
  }, [messages, selectedKey, threadSearch]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (listTab === 'unread') list = list.filter((c) => c.unreadCount > 0);
    if (listTab === 'starred') list = list.filter((c) => starred.has(c.key));
    if (listSearch.trim()) {
      const q = listSearch.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.lastMessage.message ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [conversations, listTab, listSearch, starred]);

  function toggleStar(key: string) {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(`flow53-starred-${projectId}`, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }

  function openConversation(key: string) {
    setSelectedKey(key);
    setShowThreadOnMobile(true);
    setThreadSearch('');
    setShowThreadSearch(false);
  }

  function handleNewMessage() {
    if (conversations.length > 0) {
      openConversation(conversations[0].key);
    } else {
      setShowThreadOnMobile(true);
    }
    setTimeout(() => composerRef.current?.focus(), 50);
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !client || !project) return;
    setSending(true);
    await supabase.from('client_messages').insert({ project_id: project.id, client_id: client.id, sender: 'client', message: text.trim() });
    setText('');
    await loadMessages();
    setSending(false);
  }

  async function handleAttachment(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !client || !project) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploading(true);
    try {
      const result = await uploadFileToDrive(file, accessToken);
      await supabase.from('client_messages').insert({
        project_id: project.id,
        client_id: client.id,
        sender: 'client',
        message: null,
        attachment_url: result.webViewLink,
        attachment_name: file.name,
        attachment_size: file.size,
        attachment_type: guessFileType(file),
      });
      await loadMessages();
    } catch {
      // no-op — বাটন আবার দেখা যাবে, আবার চেষ্টা করা যাবে
    }
    setUploading(false);
  }

  if (loading) {
    return (
      <div className="client-portal msg-root">
        <div className="shell">
          <aside className="sidebar">
            <div style={{ height: 30 }} />
          </aside>
          <div className="main">
            <main className="content">
              <div className="skel" style={{ height: 60, marginBottom: 18 }} />
              <div className="skel" style={{ height: 480 }} />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !project || !client) {
    return (
      <div className="client-portal msg-root">
        <div className="msg-bare-shell">
          <div className="msg-state-card">
            <div className="msg-state-title">Unable to load messages</div>
            <p className="msg-state-sub">Please try again.</p>
            <div className="msg-state-actions">
              <button type="button" className="cp-btn cp-btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <Link href={`/client/project/${projectId}`} className="cp-btn cp-btn-secondary">
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selected = conversations.find((c) => c.key === selectedKey) ?? null;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="client-portal msg-root">
      <div className="shell">
        <div className={`mobile-backdrop${mobileNavOpen ? ' open' : ''}`} onClick={() => setMobileNavOpen(false)}></div>
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <div>
            <div className="cp-brand" style={{ padding: '6px 10px 22px' }}>
              <div className="cp-brand-mark" aria-hidden="true"></div>
              <div className="cp-brand-text">FLOW 53</div>
              <button type="button" className="sidebar-close-btn" onClick={() => setMobileNavOpen(false)} aria-label="মেনু বন্ধ করুন">
                <Icon name="close" size={16} />
              </button>
            </div>
            <nav className="nav-group">
              <Link href="/client/dashboard" className="nav-item">
                <Icon name="grid" /> Overview
              </Link>
              <Link href={`/client/project/${project.id}`} className="nav-item">
                <Icon name="folder" /> My Project
              </Link>
              <Link href={`/client/project/${project.id}/messages`} className="nav-item active">
                <Icon name="message" /> Messages
                {totalUnread > 0 && <span className="nav-tag-accent">{totalUnread}</span>}
              </Link>
              <Link href={`/client/project/${project.id}/files`} className="nav-item">
                <Icon name="file" /> Files
              </Link>
              <Link href={`/client/project/${project.id}/sow`} className="nav-item">
                <Icon name="doc" /> SOW
              </Link>
              <Link href={`/client/project/${project.id}/payments`} className="nav-item">
                <Icon name="card" /> Payments
              </Link>
            </nav>
          </div>
          <button
            type="button"
            className="profile-card"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/client');
            }}
            title="Sign out"
          >
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
              {(client.primary_contact ?? client.company_name).charAt(0).toUpperCase()}
            </div>
            <div className="profile-meta">
              <div className="profile-name">{client.primary_contact ?? client.company_name}</div>
              <div className="profile-role">{client.company_name}</div>
            </div>
            <Icon name="logout" />
          </button>
        </aside>

        <div className="main">
          <header className="topbar">
            <button type="button" className="icon-btn menu-btn" onClick={() => setMobileNavOpen(true)} aria-label="মেনু খুলুন">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">Messages</span>
          </header>

          <main className="content msg-content">
            <div className="breadcrumb">
              <Link href="/client/dashboard">Client Portal</Link> / Messages
            </div>

            <div className="msg-top-row">
              <div>
                <h1 className="msg-title">Messages</h1>
                <p className="msg-page-sub">Communicate with your project team in one place.</p>
              </div>
              <button type="button" className="cp-btn cp-btn-primary cp-btn-sm" onClick={handleNewMessage}>
                <Icon name="plus" size={13} /> New Message
              </button>
            </div>

            <div className={`msg-panels${showThreadOnMobile ? ' show-thread' : ''}`}>
              {/* ---- conversation list ---- */}
              <div className="msg-list-panel">
                <div className="msg-list-search">
                  <Icon name="search" size={14} />
                  <input type="text" placeholder="Search conversations…" value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
                </div>
                <div className="msg-list-tabs">
                  {(['all', 'unread', 'starred'] as const).map((t) => (
                    <button key={t} type="button" className={`msg-list-tab${listTab === t ? ' active' : ''}`} onClick={() => setListTab(t)}>
                      {t === 'all' ? 'All' : t === 'unread' ? 'Unread' : 'Starred'}
                    </button>
                  ))}
                </div>

                <div className="msg-conv-scroll">
                  {filteredConversations.length === 0 ? (
                    <p className="empty-inline" style={{ padding: '20px 16px' }}>
                      {conversations.length === 0 ? 'No messages yet. Send the first one below.' : 'No conversations match.'}
                    </p>
                  ) : (
                    filteredConversations.map((c) => {
                      const isMine = c.lastMessage.sender === 'client';
                      return (
                        <button key={c.key} type="button" className={`msg-conv-row${selectedKey === c.key ? ' active' : ''}`} onClick={() => openConversation(c.key)}>
                          <div className="msg-conv-avatar" style={{ background: c.avatarUrl ? undefined : colorForKey(c.key) }}>
                            {c.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.avatarUrl} alt={c.name} />
                            ) : (
                              c.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="msg-conv-body">
                            <div className="msg-conv-top">
                              <span className="msg-conv-name">{c.name}</span>
                              <span className="msg-conv-time">{formatClockTime(c.lastMessage.created_at)}</span>
                            </div>
                            <div className="msg-conv-preview-row">
                              <p className="msg-conv-preview">
                                {isMine && <span className="msg-conv-you">You: </span>}
                                {c.lastMessage.message || (c.lastMessage.attachment_name ?? 'Sent an attachment')}
                              </p>
                              {c.unreadCount > 0 ? (
                                <span className="msg-conv-unread">{c.unreadCount}</span>
                              ) : (
                                <span
                                  className={`msg-conv-star${starred.has(c.key) ? ' active' : ''}`}
                                  role="button"
                                  tabIndex={0}
                                  aria-label={starred.has(c.key) ? 'Unstar conversation' : 'Star conversation'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStar(c.key);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleStar(c.key);
                                    }
                                  }}
                                >
                                  <Icon name={starred.has(c.key) ? 'starFilled' : 'star'} size={13} />
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="msg-list-footer">
                  Showing {filteredConversations.length} of {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
                </div>
              </div>

              {/* ---- active thread ---- */}
              <div className="msg-thread-panel">
                {selected ? (
                  <>
                    <div className="msg-thread-header">
                      <button type="button" className="msg-thread-back" onClick={() => setShowThreadOnMobile(false)} aria-label="Back to conversations">
                        ←
                      </button>
                      <div className="msg-thread-avatar" style={{ background: selected.avatarUrl ? undefined : colorForKey(selected.key) }}>
                        {selected.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selected.avatarUrl} alt={selected.name} />
                        ) : (
                          selected.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="msg-thread-who">
                        <div className="msg-thread-name">{selected.name}</div>
                        {selected.role && <div className="msg-thread-role">{selected.role}</div>}
                      </div>
                      <button type="button" className="icon-btn" onClick={() => setShowThreadSearch((v) => !v)} aria-label="Search in conversation">
                        <Icon name="search" size={14} />
                      </button>
                    </div>

                    {showThreadSearch && (
                      <div className="msg-thread-search-row">
                        <Icon name="search" size={13} />
                        <input type="text" placeholder="Search in this conversation…" value={threadSearch} onChange={(e) => setThreadSearch(e.target.value)} autoFocus />
                        {threadSearch && (
                          <button type="button" onClick={() => setThreadSearch('')} aria-label="Clear search">
                            <Icon name="close" size={12} />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="msg-thread-scroll">
                      {activeMessages.length === 0 ? (
                        <p className="empty-inline" style={{ padding: 20 }}>
                          {threadSearch ? 'No messages match your search.' : 'No messages yet. Send the first one below.'}
                        </p>
                      ) : (
                        activeMessages.map((m, i) => {
                          const prev = activeMessages[i - 1];
                          const showDivider = !prev || !isSameDay(prev.created_at, m.created_at);
                          const isMine = m.sender === 'client';
                          const senderProfile = !isMine && m.sender_id ? profilesById[m.sender_id] : null;
                          return (
                            <div key={m.id}>
                              {showDivider && (
                                <div className="msg-date-divider">
                                  <span>{dayLabel(m.created_at)}</span>
                                </div>
                              )}
                              <div className={`msg-bubble-row${isMine ? ' mine' : ''}`}>
                                {!isMine && (
                                  <div className="msg-bubble-avatar" style={{ background: colorForKey(m.sender_id ?? GENERAL_KEY) }}>
                                    {senderProfile?.avatar_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={senderProfile.avatar_url} alt="" />
                                    ) : (
                                      (senderProfile?.full_name ?? 'F').charAt(0).toUpperCase()
                                    )}
                                  </div>
                                )}
                                <div className="msg-bubble">
                                  {m.message && <div className="msg-text">{m.message}</div>}
                                  {m.attachment_url && (
                                    <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="msg-attachment-card">
                                      <span className="msg-attachment-icon">
                                        <Icon name="file" size={14} />
                                      </span>
                                      <span className="msg-attachment-info">
                                        <span className="msg-attachment-name">{m.attachment_name ?? 'Attachment'}</span>
                                        <span className="msg-attachment-meta">
                                          {(m.attachment_type ?? 'file').toUpperCase()}
                                          {m.attachment_size ? ` · ${formatBytes(m.attachment_size)}` : ''}
                                        </span>
                                      </span>
                                      <Icon name="download" size={13} />
                                    </a>
                                  )}
                                  <div className="msg-time">
                                    {formatClockTime(m.created_at)}
                                    {isMine && <Icon name="check" size={11} />}
                                    {isMine && m.read_at && <Icon name="check" size={11} />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={bottomRef} />
                    </div>

                    <form className="msg-composer" onSubmit={handleSend}>
                      <input ref={fileInputRef} type="file" hidden onChange={handleAttachment} />
                      <button type="button" className="msg-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Attach file">
                        {uploading ? <span className="cp-spinner" /> : <Icon name="paperclip" size={15} />}
                      </button>
                      <input ref={composerRef} className="msg-input" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your message…" />
                      <button type="submit" className="msg-send-btn" disabled={sending || !text.trim()} aria-label="Send">
                        <Icon name="send" size={15} />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="msg-thread-empty">
                    <Icon name="message" size={28} />
                    <p>Select a conversation to view messages.</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
