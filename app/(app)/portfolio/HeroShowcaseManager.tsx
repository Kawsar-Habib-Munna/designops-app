'use client';

// Portfolio > Hero Showcase: the two rows of project images under "Trusted By Partners" on the public homepage.
// Add images (uploaded to Drive like the other portfolio images), reorder them, make a card wide or narrow, hide it
// without deleting it, or delete it. The homepage reads the hero_showcase table (see app/page.tsx).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { uploadFileToDrive } from '@/lib/driveUpload';
import { DEFAULT_SHOWCASE_ROWS, HERO_SHOWCASE_SQL, showcaseImageSrc } from '@/lib/heroShowcase';

type Item = { id: string; row_no: 1 | 2; width: 228 | 284; image_url: string; order_index: number; published: boolean };

const ROWS: { no: 1 | 2; title: string; sub: string }[] = [
  { no: 1, title: 'Top row', sub: 'drifts to the left' },
  { no: 2, title: 'Bottom row', sub: 'drifts to the right' },
];

export default function HeroShowcaseManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // what is happening right now (a short message)
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const r = await supabase.from('hero_showcase').select('id, row_no, width, image_url, order_index, published').order('order_index');
    setMissing(!!r.error);
    setItems((r.data as Item[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase.from('hero_showcase').select('id, row_no, width, image_url, order_index, published').order('order_index');
      if (cancelled) return;
      setMissing(!!r.error);
      setItems((r.data as Item[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 3200);
  };
  const rowItems = (no: number) => items.filter((i) => i.row_no === no).sort((a, b) => a.order_index - b.order_index);

  async function addImages(no: 1 | 2, files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return flash('Sign in again to upload.');
    let order = rowItems(no).reduce((m, i) => Math.max(m, i.order_index), 0);
    let added = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        flash(`${file.name} is not an image.`);
        continue;
      }
      try {
        setBusy(`Uploading ${file.name}…`);
        const up = await uploadFileToDrive(file, session.access_token, (p) => setBusy(`Uploading ${file.name} · ${p}%`));
        order += 10;
        const { error } = await supabase.from('hero_showcase').insert({ row_no: no, width: 284, image_url: up.webViewLink, order_index: order, published: true });
        if (error) throw new Error(error.message);
        added += 1;
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Upload failed.');
      }
    }
    setBusy(null);
    if (added > 0) flash(`${added} image${added === 1 ? '' : 's'} added. It shows on the homepage within a minute.`);
    await load();
  }

  async function addCurrentImages() {
    setBusy('Adding the current images…');
    const { error } = await supabase.from('hero_showcase').insert(DEFAULT_SHOWCASE_ROWS.map((r) => ({ ...r, published: true })));
    setBusy(null);
    if (error) return flash(error.message);
    await load();
  }

  async function patch(id: string, changes: Partial<Pick<Item, 'width' | 'published'>>) {
    setItems((p) => p.map((i) => (i.id === id ? { ...i, ...changes } : i)));
    const { error } = await supabase.from('hero_showcase').update(changes).eq('id', id);
    if (error) {
      flash(error.message);
      await load();
    }
  }

  async function move(no: 1 | 2, id: string, dir: -1 | 1) {
    const list = rowItems(no);
    const idx = list.findIndex((i) => i.id === id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    [next[idx], next[to]] = [next[to], next[idx]];
    const orders = new Map(next.map((i, k) => [i.id, (k + 1) * 10]));
    setItems((p) => p.map((i) => (orders.has(i.id) ? { ...i, order_index: orders.get(i.id) as number } : i)));
    const results = await Promise.all(next.map((i) => supabase.from('hero_showcase').update({ order_index: orders.get(i.id) }).eq('id', i.id)));
    if (results.some((r) => r.error)) {
      flash('Could not save the new order.');
      await load();
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this image from the homepage strip? The file stays in Drive.')) return;
    setItems((p) => p.filter((i) => i.id !== id));
    const { error } = await supabase.from('hero_showcase').delete().eq('id', id);
    if (error) {
      flash(error.message);
      await load();
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Loading…</p>;

  if (missing) {
    return (
      <div className="hs-card">
        <p className="hs-note">One-time setup: copy this SQL, run it in the Supabase SQL editor, then reload this page. Until then the homepage shows its built-in images. It is safe to run again.</p>
        <button type="button" className="btn btn-accent btn-sm" onClick={() => { void navigator.clipboard?.writeText(HERO_SHOWCASE_SQL); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied' : 'Copy SQL'}</button>
      </div>
    );
  }

  return (
    <div className="hs">
      <p className="hs-note">The two rows of project images under &ldquo;Trusted By Partners&rdquo; on the public homepage. Changes show within a minute. If you hide or delete every image, the strip is not shown.</p>
      {msg && <div className="hs-msg">{msg}</div>}
      {busy && <div className="hs-msg">{busy}</div>}

      {items.length === 0 && (
        <div className="hs-card hs-empty">
          <div>
            <b>Nothing is managed here yet</b>
            <p className="hs-note" style={{ margin: '4px 0 0' }}>The homepage is showing its built-in images. Start from those to reorder, hide or replace them, or add your own below.</p>
          </div>
          <button type="button" className="btn btn-accent btn-sm" disabled={!!busy} onClick={() => void addCurrentImages()}>Use the current images</button>
        </div>
      )}

      {ROWS.map((row) => {
        const list = rowItems(row.no);
        return (
          <div className="hs-card" key={row.no}>
            <div className="hs-head">
              <div>
                <div className="hs-title">{row.title} <span className="hs-count">{list.length}</span></div>
                <div className="hs-sub">{row.sub}</div>
              </div>
              <button type="button" className="btn btn-accent btn-sm" disabled={!!busy} onClick={() => inputs.current[row.no]?.click()}>Add images</button>
              <input ref={(el) => { inputs.current[row.no] = el; }} type="file" accept="image/*" multiple hidden onChange={(e) => { void addImages(row.no, e.target.files); e.target.value = ''; }} />
            </div>
            {list.length === 0 ? (
              <p className="hs-note" style={{ margin: 0 }}>No images in this row.</p>
            ) : (
              <div className="hs-grid">
                {list.map((it, k) => (
                  <div className={`hs-tile${it.published ? '' : ' off'}`} key={it.id}>
                    <div className="hs-thumb" style={{ backgroundImage: `url(${showcaseImageSrc(it.image_url, 400)})` }}>
                      <span className="hs-pos">{k + 1}</span>
                      {!it.published && <span className="hs-hidden">Hidden</span>}
                    </div>
                    <div className="hs-tools">
                      <button type="button" title="Move earlier" aria-label="Move earlier" disabled={k === 0} onClick={() => void move(row.no, it.id, -1)}>‹</button>
                      <button type="button" title="Move later" aria-label="Move later" disabled={k === list.length - 1} onClick={() => void move(row.no, it.id, 1)}>›</button>
                      <button type="button" title="Card width" onClick={() => void patch(it.id, { width: it.width === 284 ? 228 : 284 })}>{it.width === 284 ? 'Wide' : 'Narrow'}</button>
                      <button type="button" title={it.published ? 'Hide from the homepage' : 'Show on the homepage'} onClick={() => void patch(it.id, { published: !it.published })}>{it.published ? 'Hide' : 'Show'}</button>
                      <button type="button" className="danger" title="Delete" aria-label="Delete" onClick={() => void remove(it.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
