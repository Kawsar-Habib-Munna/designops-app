'use client';

// Screen 18 — Messages (client)। ইন্টারনাল টিম discussions থেকে সম্পূর্ণ আলাদা
// client_messages টেবিল। রিয়েল-টাইম Supabase Realtime subscribe করার বদলে
// (স্কোপ বড় হয়ে যেত এই ব্যাচে) — পাঠানোর পর নিজে থেকে রিফ্রেশ + প্রতি ১৫ সেকেন্ডে
// পোল করে নতুন মেসেজ আছে কিনা দেখে, যাতে টিমের রিপ্লাই মোটামুটি লাইভ মনে হয়।

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { fetchOwnClientProject, type ClientRecord } from '@/lib/clientPortal';
import { uploadFileToDrive } from '@/lib/driveUpload';
import { formatBnDate } from '@/lib/format';
import '../../../client-shared.css';
import './messages.css';

type Message = { id: string; sender: string; message: string | null; attachment_url: string | null; created_at: string };
type ProjectInfo = { id: string; name: string };

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ClientMessagesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadMessages(clientId: string) {
    const { data } = await supabase.from('client_messages').select('id, sender, message, attachment_url, created_at').eq('project_id', projectId).order('created_at', { ascending: true });
    setMessages((data as Message[]) ?? []);
    await supabase.from('client_messages').update({ read_at: new Date().toISOString() }).eq('project_id', projectId).eq('sender', 'team').is('read_at', null);
    void clientId;
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
        await loadMessages(own.client.id);
        setLoading(false);
      } catch {
        router.replace('/client/sign-in');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, projectId]);

  useEffect(() => {
    if (!client) return;
    const interval = setInterval(() => loadMessages(client.id), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !client || !project) return;
    setSending(true);
    await supabase.from('client_messages').insert({ project_id: project.id, client_id: client.id, sender: 'client', message: text.trim() });
    setText('');
    await loadMessages(client.id);
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
      await supabase.from('client_messages').insert({ project_id: project.id, client_id: client.id, sender: 'client', message: null, attachment_url: result.webViewLink });
      await loadMessages(client.id);
    } catch {
      // no-op
    }
    setUploading(false);
  }

  if (loading || !project) {
    return (
      <div className="client-portal">
        <div className="cp-loading-shell">লোড হচ্ছে…</div>
      </div>
    );
  }

  return (
    <div className="client-portal msg-root">
      <div className="msg-shell">
        <Link href={`/client/project/${project.id}`} className="cp-page-back">
          ← {project.name}
        </Link>
        <h1 className="cp-page-title">Messages</h1>

        <div className="msg-thread">
          {messages.length === 0 ? (
            <p className="cp-page-empty" style={{ padding: 20 }}>
              No messages yet. Send the first one below.
            </p>
          ) : (
            messages.map((m) => (
              <div className={`msg-bubble-row ${m.sender === 'client' ? 'msg-mine' : ''}`} key={m.id}>
                <div className="msg-bubble">
                  {m.message && <div className="msg-text">{m.message}</div>}
                  {m.attachment_url && (
                    <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="msg-attachment">
                      📎 Attachment
                    </a>
                  )}
                  <div className="msg-time">
                    {formatBnDate(m.created_at)} {formatClockTime(m.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form className="msg-composer" onSubmit={handleSend}>
          <input ref={fileInputRef} type="file" hidden onChange={handleAttachment} />
          <button type="button" className="msg-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Attach file">
            {uploading ? '…' : '📎'}
          </button>
          <input className="msg-input" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
          <button type="submit" className="cp-btn cp-btn-primary" disabled={sending || !text.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
