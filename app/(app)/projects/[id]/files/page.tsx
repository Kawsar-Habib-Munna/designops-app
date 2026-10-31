'use client';

// Client files, team side. The team can add several files at once (pick them or drop them on the page), save links of any
// kind, choose the folder (category) they appear in on the client's Files page, decide whether the client can see them
// (and until when), and send the client a message about them with a link into the client portal.
// Messages go through the existing project chat (client_messages), so the client sees them in Messages with an unread
// badge, and the link in the message opens straight into their Files page.

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import '../project.css';
import './files.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatDate } from '@/lib/format';
import { uploadFileToDrive, guessFileType, driveThumbnailUrl } from '@/lib/driveUpload';
import SignInScreen from '@/app/components/SignInScreen';
import ClientSelect from '@/app/components/ClientSelect';

const ICON_PATHS: Record<string, string> = {
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.9 17.9A10.5 10.5 0 0 1 12 20c-7 0-11-8-11-8a19.6 19.6 0 0 1 4.2-5.4M9.9 4.2A10 10 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-2.2 3.2"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  upload: '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 1 1 21 11.5z"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
};
type IconName = keyof typeof ICON_PATHS;
function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

type ProjectBrief = { id: string; name: string; client_id: string | null };
type ClientBrief = { id: string; company_name: string; primary_contact: string | null; contact_email: string | null; contact_phone: string | null };
type FileRow = {
  id: string;
  name: string;
  file_type: string | null;
  size_bytes: number | null;
  drive_url: string;
  category: string;
  uploaded_by: string;
  hidden_from_client: boolean;
  expires_at?: string | null;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  requirements: 'Project Requirements',
  sow: 'Statement of Work',
  invoice: 'Invoices',
  receipt: 'Receipts',
  design: 'Design Files',
  deliverable: 'Deliverables',
  other: 'Other',
};
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }));

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
// accepts "figma.com/file/x", "https://…" and returns a clean http(s) address, or null when it is not a link
function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
function isExpired(f: FileRow): boolean {
  return !!f.expires_at && new Date(f.expires_at).getTime() <= Date.now();
}
// a date input value ("2026-11-05") to the end of that day
function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
}

// "Tell the client": which ways to reach them, the message, and the link they will get
function ChannelPicker({
  client,
  chat,
  email,
  whatsapp,
  onChat,
  onEmail,
  onWhatsApp,
  message,
  onMessage,
  link,
}: {
  client: ClientBrief | null;
  chat: boolean;
  email: boolean;
  whatsapp: boolean;
  onChat: (v: boolean) => void;
  onEmail: (v: boolean) => void;
  onWhatsApp: (v: boolean) => void;
  message: string;
  onMessage: (v: string) => void;
  link: string;
}) {
  const any = chat || email || whatsapp;
  return (
    <div className="tf-channels">
      <div className="tf-channels-title">Tell the client</div>
      <div className="tf-channel-grid">
        <label className={`tf-channel${chat ? ' on' : ''}`}>
          <input type="checkbox" checked={chat} onChange={(e) => onChat(e.target.checked)} />
          <Icon name="message" size={15} />
          <span><strong>Portal message</strong><small>In their project chat</small></span>
        </label>
        <label className={`tf-channel${email ? ' on' : ''}${client?.contact_email ? '' : ' off'}`}>
          <input type="checkbox" checked={email} disabled={!client?.contact_email} onChange={(e) => onEmail(e.target.checked)} />
          <Icon name="mail" size={15} />
          <span><strong>Email</strong><small>{client?.contact_email ?? 'No email on file'}</small></span>
        </label>
        <label className={`tf-channel${whatsapp ? ' on' : ''}${client?.contact_phone ? '' : ' off'}`}>
          <input type="checkbox" checked={whatsapp} disabled={!client?.contact_phone} onChange={(e) => onWhatsApp(e.target.checked)} />
          <Icon name="phone" size={15} />
          <span><strong>WhatsApp</strong><small>{client?.contact_phone ?? 'No phone on file'}</small></span>
        </label>
      </div>
      {any && (
        <>
          <textarea className="field-input tf-message" rows={3} value={message} onChange={(e) => onMessage(e.target.value)} aria-label="Message to the client" />
          <div className="tf-linkpreview"><Icon name="link" size={13} /> {link}</div>
        </>
      )}
    </div>
  );
}

export default function AdminProjectFilesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user, loading: sessionLoading } = useSession();

  const [project, setProject] = useState<ProjectBrief | null>(null);
  const [client, setClient] = useState<ClientBrief | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [expiryReady, setExpiryReady] = useState(true); // false until the expires_at column exists in the database
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // the "add to the client" window
  const [addKind, setAddKind] = useState<'files' | 'link' | null>(null);
  const [pending, setPending] = useState<File[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [category, setCategory] = useState('deliverable');
  const [visible, setVisible] = useState(true);
  const [expires, setExpires] = useState('');
  const [notify, setNotify] = useState(true); // message in the client's portal chat
  const [viaEmail, setViaEmail] = useState(false);
  const [viaWhatsApp, setViaWhatsApp] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "share this with the client" for something already added, and "visible until"
  const [shareFor, setShareFor] = useState<FileRow | null>(null);
  const [shareText, setShareText] = useState('');
  const [expiryFor, setExpiryFor] = useState<FileRow | null>(null);
  const [expiryValue, setExpiryValue] = useState('');

  useEffect(() => {
    if (!user || !projectId) return;
    async function run() {
      const { data: projectData } = await supabase.from('projects').select('id, name, client_id').eq('id', projectId).maybeSingle();
      const p = (projectData as ProjectBrief) ?? null;
      setProject(p);
      if (p?.client_id) {
        const base = 'id, name, file_type, size_bytes, drive_url, category, uploaded_by, hidden_from_client, created_at';
        let res: { data: unknown; error: unknown } = await supabase.from('client_files').select(`${base}, expires_at`).eq('client_id', p.client_id).order('created_at', { ascending: false });
        let hasExpiry = true;
        if (res.error) {
          hasExpiry = false;
          res = await supabase.from('client_files').select(base).eq('client_id', p.client_id).order('created_at', { ascending: false });
        }
        setExpiryReady(hasExpiry);
        setFiles((res.data as FileRow[]) ?? []);
        const { data: clientData } = await supabase.from('clients').select('id, company_name, primary_contact, contact_email, contact_phone').eq('id', p.client_id).maybeSingle();
        setClient((clientData as ClientBrief) ?? null);
      }
      setLoading(false);
    }
    run();
  }, [user, projectId, reloadKey]);

  const firstName = (client?.primary_contact ?? client?.company_name ?? 'there').split(' ')[0];
  const portalUrl = (anchor: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/client/project/${projectId}/files${anchor}`;

  function defaultMessage(kind: 'files' | 'link', n: number): string {
    if (kind === 'link') return `Hi ${firstName}, I've added a new link to your project. You can open it here:`;
    return `Hi ${firstName}, I've added ${n === 1 ? 'a new file' : `${n} new files`} to your project. You can open ${n === 1 ? 'it' : 'them'} here:`;
  }

  function openAdd(kind: 'files' | 'link', dropped: File[] = []) {
    setAddKind(kind);
    setPending(dropped);
    setLinkUrl('');
    setLinkTitle('');
    setCategory(kind === 'link' ? 'other' : 'deliverable');
    setVisible(true);
    setExpires('');
    setNotify(true);
    setViaEmail(false);
    setViaWhatsApp(false);
    setMessage(defaultMessage(kind, dropped.length || 1));
    setError(null);
    setProgress(null);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length > 0) openAdd('files', list);
  }

  // a message in the project chat, with the portal link added at the end
  async function sendMessage(text: string, anchor: string): Promise<string | null> {
    if (!project?.client_id || !user) return 'No client is linked to this project.';
    const body = `${text.trim()}\n${portalUrl(anchor)}`;
    const { error: err } = await supabase.from('client_messages').insert({ project_id: project.id, client_id: project.client_id, sender: 'team', sender_id: user.id, message: body });
    return err ? err.message : null;
  }

  type Via = { chat: boolean; email: boolean; whatsapp: boolean };
  async function notifyClient(text: string, anchor: string, via: Via): Promise<{ sent: string[]; problems: string[] }> {
    const sent: string[] = [];
    const problems: string[] = [];
    if (via.chat) {
      const err = await sendMessage(text, anchor);
      if (err) problems.push(`Portal message: ${err}`);
      else sent.push('portal message');
    }
    if (via.email || via.whatsapp) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const res = await fetch('/api/client-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` },
          body: JSON.stringify({ projectId, message: text, anchor, email: via.email, whatsapp: via.whatsapp }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; email?: string; whatsapp?: string };
        if (!res.ok) {
          problems.push(json.error ?? 'Email / WhatsApp could not be sent.');
        } else {
          if (via.email) (json.email === 'sent' ? sent : problems).push(json.email === 'sent' ? 'email' : `Email: ${json.email ?? 'not sent'}`);
          if (via.whatsapp) (json.whatsapp === 'sent' ? sent : problems).push(json.whatsapp === 'sent' ? 'WhatsApp' : `WhatsApp: ${json.whatsapp ?? 'not sent'}`);
        }
      } catch {
        problems.push('Email / WhatsApp could not be sent.');
      }
    }
    return { sent, problems };
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault();
    if (!project?.client_id || !user || !addKind) return;
    setError(null);
    let href: string | null = null;
    if (addKind === 'link') {
      href = normalizeUrl(linkUrl);
      if (!href) {
        setError('Please enter a valid link, for example https://figma.com/file/…');
        return;
      }
    } else if (pending.length === 0) {
      setError('Choose at least one file.');
      return;
    }
    if (expires && !expiryReady) {
      setError('"Visible until" needs a one-time database update first. Run the SQL for it, or clear the date.');
      return;
    }
    setBusy(true);
    const common = {
      client_id: project.client_id,
      project_id: project.id,
      category,
      uploaded_by: 'team',
      uploaded_by_id: user.id,
      hidden_from_client: !visible,
      ...(expires ? { expires_at: endOfDay(expires) } : {}),
    };
    let added = 0;
    const failed: string[] = [];
    try {
      if (addKind === 'link' && href) {
        const { error: err } = await supabase.from('client_files').insert({ ...common, name: linkTitle.trim() || domainOf(href), file_type: 'link', size_bytes: null, drive_url: href });
        if (err) throw new Error(err.message);
        added = 1;
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Your session has expired. Please sign in again.');
        for (let i = 0; i < pending.length; i++) {
          const file = pending[i];
          setProgress({ index: i + 1, total: pending.length, pct: 0 });
          try {
            const result = await uploadFileToDrive(file, accessToken, (pct) => setProgress({ index: i + 1, total: pending.length, pct }));
            const { error: err } = await supabase.from('client_files').insert({ ...common, name: file.name, file_type: guessFileType(file), size_bytes: file.size, drive_url: result.webViewLink });
            if (err) throw new Error(err.message);
            added++;
          } catch (err) {
            failed.push(`${file.name}${err instanceof Error && err.message ? ` (${err.message})` : ''}`);
          }
        }
      }
    } catch (err) {
      setBusy(false);
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      return;
    }
    // tell the client, if asked to and if they can see it
    let notifiedVia: string[] = [];
    let notifyProblems: string[] = [];
    if (added > 0 && visible && message.trim() && (notify || viaEmail || viaWhatsApp)) {
      const r = await notifyClient(message, addKind === 'link' ? '#links' : '#all-files', { chat: notify, email: viaEmail, whatsapp: viaWhatsApp });
      notifiedVia = r.sent;
      notifyProblems = r.problems;
    }
    setBusy(false);
    setProgress(null);
    if (failed.length > 0 || notifyProblems.length > 0) {
      setError([failed.length > 0 ? `Couldn't upload: ${failed.join(', ')}.` : '', notifyProblems.length > 0 ? `Not sent: ${notifyProblems.join('; ')}.` : '', notifiedVia.length > 0 ? `Sent by ${notifiedVia.join(' and ')}.` : ''].filter(Boolean).join(' '));
      if (added > 0) setReloadKey((k) => k + 1);
      return;
    }
    setAddKind(null);
    setNotice(`${added} ${addKind === 'link' ? 'link' : added === 1 ? 'file' : 'files'} added${notifiedVia.length > 0 ? ` and the client was told by ${notifiedVia.join(' and ')}` : ''}.`);
    setTimeout(() => setNotice(null), 5000);
    setReloadKey((k) => k + 1);
  }

  async function sendShare(e: FormEvent) {
    e.preventDefault();
    if (!shareFor) return;
    setBusy(true);
    setError(null);
    const r = await notifyClient(shareText, shareFor.file_type === 'link' ? '#links' : '#all-files', { chat: notify, email: viaEmail, whatsapp: viaWhatsApp });
    setBusy(false);
    if (r.problems.length > 0) {
      setError(`Not sent: ${r.problems.join('; ')}.${r.sent.length > 0 ? ` Sent by ${r.sent.join(' and ')}.` : ''}`);
      return;
    }
    setShareFor(null);
    setNotice(`The client was told by ${r.sent.join(' and ')}.`);
    setTimeout(() => setNotice(null), 5000);
  }

  async function saveExpiry(e: FormEvent) {
    e.preventDefault();
    if (!expiryFor) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('client_files').update({ expires_at: expiryValue ? endOfDay(expiryValue) : null }).eq('id', expiryFor.id);
    setBusy(false);
    if (err) {
      setError(expiryReady ? err.message : 'This needs a one-time database update first. Run the SQL for it.');
      return;
    }
    setExpiryFor(null);
    setReloadKey((k) => k + 1);
  }

  async function toggleHidden(f: FileRow) {
    await supabase.from('client_files').update({ hidden_from_client: !f.hidden_from_client }).eq('id', f.id);
    setReloadKey((k) => k + 1);
  }

  async function handleDelete(f: FileRow) {
    if (!window.confirm(`Delete "${f.name}"? The client will no longer see it.`)) return;
    await supabase.from('client_files').delete().eq('id', f.id);
    setReloadKey((k) => k + 1);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const allowNotify = visible;
  const tells = allowNotify && (notify || viaEmail || viaWhatsApp);

  return (
    <>
      <main className="content">
        {loading || !project ? (
          <p style={{ padding: 24, fontSize: 13, color: 'var(--ink-faint)' }}>Loading…</p>
        ) : (
          <>
            <div className="breadcrumb">
              <Link href="/projects">Projects</Link>
              <span className="sep">/</span>
              <Link href={`/projects/${project.id}`}>{project.name}</Link>
              <span className="sep">/</span>
              <span className="current">Files</span>
            </div>

            <div className="proj-header">
              <span className="proj-title">Client Files</span>
            </div>

            {notice && <div className="tf-notice">{notice}</div>}

            {!project.client_id ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>No client is linked to this project.</p>
            ) : (
              <>
                {/* ---- add files / links ---- */}
                <div
                  className={`tf-drop${dragging ? ' dragging' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); const dropped = Array.from(e.dataTransfer.files); if (dropped.length > 0) openAdd('files', dropped); }}
                >
                  <div className="tf-drop-icon"><Icon name="upload" size={22} /></div>
                  <div className="tf-drop-text">
                    <strong>Drop files here to share them with {client?.company_name ?? 'the client'}</strong>
                    <span>Any file type, as many as you like, or save a link instead.</span>
                  </div>
                  <div className="tf-drop-actions">
                    <input ref={fileInputRef} type="file" multiple hidden onChange={onPick} />
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => fileInputRef.current?.click()}>
                      <Icon name="upload" size={14} /> Upload files
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openAdd('link')}>
                      <Icon name="link" size={14} /> Add a link
                    </button>
                  </div>
                </div>

                {/* ---- everything shared so far ---- */}
                {files.length === 0 ? (
                  <div className="summary-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Nothing has been shared yet.</p>
                  </div>
                ) : (
                  <div className="summary-card" style={{ padding: 8 }}>
                    {files.map((f) => {
                      const expired = isExpired(f);
                      const isLink = f.file_type === 'link';
                      return (
                        <div key={f.id} className="tf-row">
                          <span className="tf-row-icon"><Icon name={isLink ? 'link' : 'file'} size={15} /></span>
                          <a href={isLink ? f.drive_url : driveThumbnailUrl(f.drive_url)} target="_blank" rel="noopener noreferrer" className="tf-row-main">
                            <div className="tf-row-name">{f.name}</div>
                            <div className="tf-row-meta">
                              {isLink ? domainOf(f.drive_url) : formatBytes(f.size_bytes)}
                              {' · '}
                              {isLink ? 'Link' : CATEGORY_LABEL[f.category] ?? f.category}
                              {' · '}
                              {f.uploaded_by === 'client' ? 'Client' : 'Team'}
                              {' · '}
                              {formatDate(f.created_at)}
                            </div>
                          </a>
                          {f.hidden_from_client && <span className="tf-tag hidden">Hidden</span>}
                          {f.expires_at && <span className={`tf-tag ${expired ? 'expired' : 'expires'}`}>{expired ? 'Expired' : `Until ${formatDate(f.expires_at)}`}</span>}
                          <button className="icon-btn" title="Message the client about this" onClick={() => { setNotify(true); setViaEmail(false); setViaWhatsApp(false); setShareFor(f); setShareText(`Hi ${firstName}, I've shared ${isLink ? 'a link' : 'a file'} with you: "${f.name}". You can open it here:`); setError(null); }}>
                            <Icon name="message" size={15} />
                          </button>
                          <button className="icon-btn" title="Visible until…" onClick={() => { setExpiryFor(f); setExpiryValue(f.expires_at ? f.expires_at.slice(0, 10) : ''); setError(null); }}>
                            <Icon name="calendar" size={15} />
                          </button>
                          <button className="icon-btn" title={f.hidden_from_client ? 'Hidden from the client. Press to show' : 'Visible to the client. Press to hide'} onClick={() => toggleHidden(f)}>
                            <Icon name={f.hidden_from_client ? 'eyeOff' : 'eye'} size={15} />
                          </button>
                          <button className="icon-btn" title="Delete" onClick={() => handleDelete(f)} style={{ color: 'var(--danger)' }}>
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ---- add window ---- */}
      {addKind && (
        <div className="modal-overlay tf-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setAddKind(null); }}>
          <form className="modal-box tf-modal" onSubmit={submitAdd}>
            <div className="tf-modal-head">
              <h2 className="tf-modal-title">{addKind === 'link' ? 'Add a link' : `Share ${pending.length} file${pending.length === 1 ? '' : 's'}`}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setAddKind(null)} disabled={busy}>
                <Icon name="close" size={15} />
              </button>
            </div>

            {addKind === 'files' ? (
              <ul className="tf-filelist">
                {pending.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <Icon name="file" size={14} /> <span>{f.name}</span> <em>{formatBytes(f.size)}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <label className="field-label">Link</label>
                <input className="field-input" type="text" inputMode="url" autoFocus placeholder="https://" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                <label className="field-label">Name (optional)</label>
                <input className="field-input" type="text" placeholder="e.g. Homepage design in Figma" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
              </>
            )}

            {addKind === 'files' && (
              <>
                <label className="field-label">Folder on the client&apos;s Files page</label>
                <ClientSelect className="cs-block tf-select" ariaLabel="Folder" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
              </>
            )}
            {addKind === 'link' && <p className="tf-hint">Links appear in the client&apos;s <strong>Links</strong> card.</p>}

            <div className="tf-options">
              <label className="tf-check">
                <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                <span><strong>Visible to the client</strong><small>Turn off to keep it internal for now.</small></span>
              </label>
              {visible && (
                <label className="tf-inline">
                  <span>Visible until (optional)</span>
                  <input className="field-input" type="date" value={expires} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpires(e.target.value)} />
                </label>
              )}
              {allowNotify ? (
                <ChannelPicker client={client} chat={notify} email={viaEmail} whatsapp={viaWhatsApp} onChat={setNotify} onEmail={setViaEmail} onWhatsApp={setViaWhatsApp} message={message} onMessage={setMessage} link={portalUrl(addKind === 'link' ? '#links' : '#all-files')} />
              ) : (
                <p className="tf-hint">Hidden items cannot be announced to the client. Turn visibility on to notify them.</p>
              )}
            </div>

            {error && <p className="tf-error">{error}</p>}
            {progress && <p className="tf-hint">Uploading {progress.index} of {progress.total} · {progress.pct}%</p>}

            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddKind(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>
                <Icon name={tells ? 'send' : 'upload'} size={14} /> {busy ? 'Working…' : tells ? (addKind === 'link' ? 'Save link and notify' : 'Upload and notify') : addKind === 'link' ? 'Save link' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- message about something already shared ---- */}
      {shareFor && (
        <div className="modal-overlay tf-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setShareFor(null); }}>
          <form className="modal-box tf-modal" onSubmit={sendShare}>
            <div className="tf-modal-head">
              <h2 className="tf-modal-title">Message the client</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShareFor(null)} disabled={busy}>
                <Icon name="close" size={15} />
              </button>
            </div>
            {shareFor.hidden_from_client && <p className="tf-error">This item is hidden from the client. They will not be able to open it until you show it.</p>}
            <ChannelPicker client={client} chat={notify} email={viaEmail} whatsapp={viaWhatsApp} onChat={setNotify} onEmail={setViaEmail} onWhatsApp={setViaWhatsApp} message={shareText} onMessage={setShareText} link={portalUrl(shareFor.file_type === 'link' ? '#links' : '#all-files')} />
            {error && <p className="tf-error">{error}</p>}
            <div className="modal-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShareFor(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-accent btn-sm" disabled={busy || !shareText.trim() || !(notify || viaEmail || viaWhatsApp)}>
                <Icon name="send" size={14} /> {busy ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- visible until ---- */}
      {expiryFor && (
        <div className="modal-overlay tf-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setExpiryFor(null); }}>
          <form className="modal-box tf-modal" onSubmit={saveExpiry}>
            <div className="tf-modal-head">
              <h2 className="tf-modal-title">Visible until</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setExpiryFor(null)} disabled={busy}>
                <Icon name="close" size={15} />
              </button>
            </div>
            <p className="tf-hint">After this date the client can no longer see &ldquo;{expiryFor.name}&rdquo;. Leave it empty to keep it visible.</p>
            <input className="field-input" type="date" value={expiryValue} onChange={(e) => setExpiryValue(e.target.value)} />
            {error && <p className="tf-error">{error}</p>}
            <div className="modal-foot">
              {expiryFor.expires_at && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setExpiryValue('')}>Clear date</button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpiryFor(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-accent btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
