'use client';

// AI Prompts — the team's shared prompt library. Every prompt belongs to one AI tool (ChatGPT, Claude, Midjourney …) and
// one purpose (Copywriting, Research, Image …), so prompts are easy to find, copy and keep tidy instead of living in chats.

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import '../todos/todos.css';
import './prompts.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import SignInScreen from '@/app/components/SignInScreen';
import Avatar from '@/app/components/Avatar';

const ICONS = {
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
  pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  arrow: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
} as const;

function Icon({ name, size = 16 }: { name: keyof typeof ICONS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />;
}

type Prompt = { id: string; title: string; body: string; ai_tool: string; category: string; pinned: boolean; created_by: string | null; created_at: string };

const AI_TOOLS = ['ChatGPT', 'Claude', 'Gemini', 'Midjourney', 'Copilot', 'Perplexity', 'Figma AI', 'Other'];
const CATEGORIES = ['General', 'Design', 'UI/UX', 'Copywriting', 'Research', 'Code', 'Image', 'Client', 'Marketing'];
const SELECT = 'id, title, body, ai_tool, category, pinned, created_by, created_at';
const TOOL_COLORS: Record<string, string> = {
  chatgpt: '#10A37F', claude: '#D97757', gemini: '#4285F4', midjourney: '#1F1F27', copilot: '#0F7BD0', perplexity: '#20808D', 'figma ai': '#A259FF', other: '#6E6E7A',
};
const FALLBACK = ['#5B4FE8', '#E5484D', '#F5A524', '#17A34A', '#0EA5E9', '#DB2777'];

function toolColor(name: string) {
  const key = name.trim().toLowerCase();
  if (TOOL_COLORS[key]) return TOOL_COLORS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
function ago(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const emptyForm = { title: '', body: '', ai_tool: 'ChatGPT', category: 'General', pinned: false };

export default function PromptsPage() {
  const { user, loading: sessionLoading } = useSession();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; avatar_color: string | null; avatar_url: string | null }>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tool, setTool] = useState('All');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [view, setView] = useState<'card' | 'list'>('card');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await supabase.from('ai_prompts').select(SELECT).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (error) setLoadError(true);
    else setPrompts((data as Prompt[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    supabase.from('profiles').select('id, full_name, avatar_color, avatar_url, is_admin').then(({ data }) => {
      const rows = (data as { id: string; full_name: string; avatar_color: string | null; avatar_url: string | null; is_admin?: boolean }[]) ?? [];
      setProfiles(Object.fromEntries(rows.map((r) => [r.id, { full_name: r.full_name, avatar_color: r.avatar_color, avatar_url: r.avatar_url }])));
      setPeople(Object.fromEntries(rows.map((r) => [r.id, r.full_name])));
      setIsAdmin(!!rows.find((r) => r.id === user.id)?.is_admin);
    });
  }, [user, load]);

  const toolCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prompts) m.set(p.ai_tool, (m.get(p.ai_tool) ?? 0) + 1);
    return m;
  }, [prompts]);
  const tools = useMemo(() => ['All', ...Array.from(toolCounts.keys()).sort((a, b) => (toolCounts.get(b) ?? 0) - (toolCounts.get(a) ?? 0))], [toolCounts]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(prompts.map((p) => p.category))).sort()], [prompts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => (tool === 'All' || p.ai_tool === tool) && (category === 'All' || p.category === category) && (!q || `${p.title} ${p.body} ${p.ai_tool} ${p.category}`.toLowerCase().includes(q)));
  }, [prompts, tool, category, query]);

  const opened = prompts.find((p) => p.id === openId) ?? null;
  const pinnedCount = prompts.filter((p) => p.pinned).length;

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, ai_tool: tool !== 'All' ? tool : emptyForm.ai_tool, category: category !== 'All' ? category : emptyForm.category });
    setFormError(null);
    setModalOpen(true);
  }
  function openEdit(p: Prompt) {
    setOpenId(null);
    setEditingId(p.id);
    setForm({ title: p.title, body: p.body, ai_tool: p.ai_tool, category: p.category, pinned: p.pinned });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const title = form.title.trim();
    const body = form.body.trim();
    const ai_tool = form.ai_tool.trim();
    const cat = form.category.trim();
    if (!title || !body || !ai_tool || !cat) { setFormError('Title, AI tool, category and the prompt are all needed.'); return; }
    setSaving(true);
    setFormError(null);
    const payload = { title, body, ai_tool, category: cat, pinned: form.pinned };
    const { error } = editingId
      ? await supabase.from('ai_prompts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      : await supabase.from('ai_prompts').insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (error) { setFormError("Couldn't save the prompt. Please try again."); return; }
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('ai_prompts').delete().eq('id', deleteTarget.id);
    if (!error) setPrompts((list) => list.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function togglePin(p: Prompt) {
    const { error } = await supabase.from('ai_prompts').update({ pinned: !p.pinned }).eq('id', p.id);
    if (!error) load();
  }

  async function copy(p: Prompt) {
    try {
      await navigator.clipboard.writeText(p.body);
      setCopiedId(p.id);
      window.setTimeout(() => setCopiedId((id) => (id === p.id ? null : id)), 1600);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const stats = [
    { icon: 'sparkles' as const, label: 'Prompts', value: prompts.length, foot: 'In the library' },
    { icon: 'layers' as const, label: 'AI tools', value: toolCounts.size, foot: 'Tools in use' },
    { icon: 'tag' as const, label: 'Categories', value: Math.max(categories.length - 1, 0), foot: 'Ways to sort' },
    { icon: 'pin' as const, label: 'Pinned', value: pinnedCount, foot: 'Kept on top' },
  ];

  return (
    <>
      <main className="content">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">AI prompts</h1>
            <p className="page-sub">Every prompt the team uses, sorted by AI tool and purpose.</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-accent" onClick={openCreate}><Icon name="plus" size={15} /> Add prompt</button>
          </div>
        </div>

        <div className="pr-stats">
          {stats.map((s) => (
            <div className="pr-stat" key={s.label}>
              <div className="pr-stat-top">
                <span className="pr-stat-icon"><Icon name={s.icon} size={18} /></span>
                <span className="pr-stat-arrow" aria-hidden="true"><Icon name="arrow" size={14} /></span>
              </div>
              <div className="pr-stat-value tabular">{s.value}</div>
              <div className="pr-stat-label">{s.label}</div>
              <div className="pr-stat-foot"><i />{s.foot}</div>
            </div>
          ))}
        </div>

        <section className="pr-panel">
          <div className="pr-toolbar">
            <label className="pr-search">
              <Icon name="search" size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, tool or text" aria-label="Search prompts" />
            </label>
            <select className="pr-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              {categories.map((c) => <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>)}
            </select>
            <div className="pr-view" role="group" aria-label="View">
              <button type="button" className={`pr-view-btn${view === 'card' ? ' on' : ''}`} onClick={() => setView('card')} aria-pressed={view === 'card'}><Icon name="grid" size={15} /> Cards</button>
              <button type="button" className={`pr-view-btn${view === 'list' ? ' on' : ''}`} onClick={() => setView('list')} aria-pressed={view === 'list'}><Icon name="list" size={15} /> List</button>
            </div>
          </div>
          <div className="pr-tabs" role="tablist" aria-label="AI tool">
            {tools.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tool === t} className={`pr-tab${tool === t ? ' on' : ''}`} onClick={() => setTool(t)}>
                {t !== 'All' && <i style={{ background: toolColor(t) }} />}
                {t}
                <span className="pr-tab-n tabular">{t === 'All' ? prompts.length : toolCounts.get(t)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="pr-empty">Loading prompts…</div>
          ) : loadError ? (
            <div className="pr-empty">Couldn&apos;t load the prompts. If this is the first time, run the new <b>ai_prompts</b> SQL in Supabase, then reload.</div>
          ) : visible.length === 0 ? (
            <div className="pr-empty">
              <span className="pr-empty-icon"><Icon name="sparkles" size={22} /></span>
              <b>{prompts.length === 0 ? 'No prompts yet' : 'No prompts match'}</b>
              <span>{prompts.length === 0 ? 'Add the first prompt and pick the AI tool it is for.' : 'Try another tool, category or search.'}</span>
              {prompts.length === 0 && <button className="btn btn-accent" onClick={openCreate}><Icon name="plus" size={15} /> Add prompt</button>}
            </div>
          ) : view === 'list' ? (
            <div className="pr-list">
              {visible.map((p) => {
                const canManage = isAdmin || p.created_by === user.id;
                return (
                  <div className="pr-row-item" key={p.id} style={{ '--tc': toolColor(p.ai_tool) } as CSSProperties}>
                    <span className="pr-row-tag">
                      <span className="pr-tag-mark">{p.ai_tool.trim().charAt(0).toUpperCase()}</span>
                      <span className="pr-tag-name">{p.ai_tool}</span>
                      <span className="pr-tag-sep" aria-hidden="true" />
                      <span className="pr-tag-cat">{p.category}</span>
                    </span>
                    <button type="button" className="pr-row-main" onClick={() => setOpenId(p.id)}>
                      <span className="pr-row-title">{p.title}</span>
                      <span className="pr-row-text">{p.body}</span>
                    </button>
                    <span className="pr-row-by"><Avatar person={(p.created_by && profiles[p.created_by]) || { full_name: 'Team' }} size={24} /><em>{ago(p.created_at)}</em></span>
                    <span className="pr-row-actions">
                      <button type="button" className={`pr-icon-btn pr-pin${p.pinned ? ' on' : ''}`} onClick={() => togglePin(p)} aria-label={p.pinned ? 'Unpin' : 'Pin'} title={p.pinned ? 'Unpin' : 'Pin to top'}><Icon name="pin" size={15} /></button>
                      {canManage && <button type="button" className="pr-icon-btn" onClick={() => openEdit(p)} aria-label="Edit" title="Edit"><Icon name="edit" size={15} /></button>}
                      {canManage && <button type="button" className="pr-icon-btn danger" onClick={() => setDeleteTarget(p)} aria-label="Delete" title="Delete"><Icon name="trash" size={15} /></button>}
                      <button type="button" className={`pr-copy${copiedId === p.id ? ' done' : ''}`} onClick={() => copy(p)}><Icon name={copiedId === p.id ? 'check' : 'copy'} size={14} /> {copiedId === p.id ? 'Copied' : 'Copy'}</button>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pr-grid">
              {visible.map((p) => {
                const canManage = isAdmin || p.created_by === user.id;
                const color = toolColor(p.ai_tool);
                return (
                  <article className="pr-card" key={p.id} style={{ '--tc': color } as CSSProperties}>
                    <div className="pr-card-top">
                      <span className="pr-tag-mark">{p.ai_tool.trim().charAt(0).toUpperCase()}</span>
                      <span className="pr-tag-name">{p.ai_tool}</span>
                      <span className="pr-tag-sep" aria-hidden="true" />
                      <span className="pr-tag-cat">{p.category}</span>
                      <button type="button" className={`pr-icon-btn pr-pin${p.pinned ? ' on' : ''}`} onClick={() => togglePin(p)} aria-label={p.pinned ? 'Unpin' : 'Pin'} title={p.pinned ? 'Unpin' : 'Pin to top'}>
                        <Icon name="pin" size={15} />
                      </button>
                    </div>
                    <button type="button" className="pr-open" onClick={() => setOpenId(p.id)}>
                      <h3 className="pr-title">{p.title}</h3>
                      <p className="pr-body">{p.body}</p>
                    </button>
                    <div className="pr-foot">
                      <Avatar person={(p.created_by && profiles[p.created_by]) || { full_name: 'Team' }} size={30} />
                      <span className="pr-by">
                        <b>{(p.created_by && people[p.created_by]) || 'Team'}</b>
                        <em>{ago(p.created_at)}</em>
                      </span>
                      {canManage && (
                        <>
                          <button type="button" className="pr-icon-btn" onClick={() => openEdit(p)} aria-label="Edit" title="Edit"><Icon name="edit" size={15} /></button>
                          <button type="button" className="pr-icon-btn danger" onClick={() => setDeleteTarget(p)} aria-label="Delete" title="Delete"><Icon name="trash" size={15} /></button>
                        </>
                      )}
                      <button type="button" className={`pr-copy${copiedId === p.id ? ' done' : ''}`} onClick={() => copy(p)}>
                        <Icon name={copiedId === p.id ? 'check' : 'copy'} size={14} /> {copiedId === p.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {opened && (
        <div className="pr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpenId(null); }}>
          <div className="pr-modal pr-modal-read" style={{ '--tc': toolColor(opened.ai_tool) } as CSSProperties}>
            <div className="pr-read-top">
              <span className="pr-tag-mark">{opened.ai_tool.trim().charAt(0).toUpperCase()}</span>
              <span className="pr-tag-name">{opened.ai_tool}</span>
              <span className="pr-tag-sep" aria-hidden="true" />
              <span className="pr-tag-cat">{opened.category}</span>
              <button type="button" className="pr-icon-btn pr-read-close" onClick={() => setOpenId(null)} aria-label="Close"><Icon name="close" size={16} /></button>
            </div>
            <h2 className="pr-read-title">{opened.title}</h2>
            <p className="pr-read-body">{opened.body}</p>
            <div className="pr-read-foot">
              <Avatar person={(opened.created_by && profiles[opened.created_by]) || { full_name: 'Team' }} size={28} />
              <span className="pr-by">
                <b>{(opened.created_by && people[opened.created_by]) || 'Team'}</b>
                <em>{ago(opened.created_at)}</em>
              </span>
              <button type="button" className={`pr-copy solid${copiedId === opened.id ? ' done' : ''}`} onClick={() => copy(opened)}>
                <Icon name={copiedId === opened.id ? 'check' : 'copy'} size={14} /> {copiedId === opened.id ? 'Copied' : 'Copy prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="pr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="pr-modal" onSubmit={handleSave}>
            <div className="pr-modal-head">
              <h2>{editingId ? 'Edit prompt' : 'Add prompt'}</h2>
              <button type="button" className="pr-icon-btn" onClick={() => setModalOpen(false)} aria-label="Close"><Icon name="close" size={16} /></button>
            </div>
            <label className="pr-field">
              <span>Title</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Landing page hero copy" autoFocus />
            </label>
            <div className="pr-row">
              <label className="pr-field">
                <span>AI tool</span>
                <input list="pr-tools" value={form.ai_tool} onChange={(e) => setForm({ ...form, ai_tool: e.target.value })} placeholder="ChatGPT" />
                <datalist id="pr-tools">{AI_TOOLS.map((t) => <option key={t} value={t} />)}</datalist>
              </label>
              <label className="pr-field">
                <span>Category</span>
                <input list="pr-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Design" />
                <datalist id="pr-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </label>
            </div>
            <label className="pr-field">
              <span>Prompt</span>
              <textarea rows={9} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write the full prompt here. Use [brackets] for the parts people should fill in." />
            </label>
            <label className="pr-check">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to the top
            </label>
            {formError && <div className="pr-error">{formError}</div>}
            <div className="pr-modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-accent" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add prompt'}</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="pr-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="pr-modal pr-modal-sm">
            <h2>Delete this prompt?</h2>
            <p className="pr-confirm">&ldquo;{deleteTarget.title}&rdquo; will be removed for the whole team.</p>
            <div className="pr-modal-foot">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
