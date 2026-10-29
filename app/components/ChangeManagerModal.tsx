'use client';

// Change a project's manager after the project (and even a signed SOW) exists. The manager is a project-level setting
// (projects.project_manager_id), not part of the signed document's terms, so it stays editable. Self-contained styling
// (Tailwind utilities, portalled to <body>) like ProfileMenu, so it works on any page and in dark mode.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import Avatar from './Avatar';

export type ManagerProfile = { id: string; full_name: string; role: string | null; avatar_color: string | null; avatar_url: string | null };

export default function ChangeManagerModal({
  projectId,
  projectName,
  clientId,
  currentManagerId,
  actorId,
  dark = false,
  onClose,
  onSaved,
}: {
  projectId: string;
  projectName: string;
  clientId: string | null;
  currentManagerId: string | null;
  actorId: string;
  dark?: boolean;
  onClose: () => void;
  onSaved: (manager: ManagerProfile) => void;
}) {
  const [people, setPeople] = useState<ManagerProfile[]>([]);
  const [selected, setSelected] = useState<string | null>(currentManagerId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, full_name, role, avatar_color, avatar_url')
      .order('full_name')
      .then(({ data }) => {
        if (cancelled) return;
        setPeople((data as ManagerProfile[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const next = people.find((p) => p.id === selected);
    if (!next || next.id === currentManagerId) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('projects').update({ project_manager_id: next.id }).eq('id', projectId);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    const detail = `"${projectName}"-এর প্রজেক্ট ম্যানেজার ${next.full_name}-এ পরিবর্তন করা হয়েছে`;
    await supabase.from('activity_log').insert([
      { actor_id: actorId, action: 'manager_assigned', entity_type: 'project', entity_id: projectId, detail },
      ...(clientId ? [{ actor_id: actorId, action: 'manager_assigned', entity_type: 'client', entity_id: clientId, detail }] : []),
    ]);
    setSaving(false);
    onSaved(next);
    onClose();
  }

  const card = dark ? 'border-zinc-700 bg-zinc-900 text-zinc-50' : 'border-zinc-200 bg-white text-zinc-900';
  const line = dark ? '#3f3f46' : '#e4e4e7';
  const sub = dark ? 'text-zinc-400' : 'text-zinc-500';

  const modal = (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[8vh] font-[Manrope,Google_Sans,sans-serif]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className={`w-full max-w-[460px] rounded-2xl border shadow-2xl ${card}`}>
        <div className="border-b px-5 py-4" style={{ borderColor: line }}>
          <div className="text-base font-semibold">Change project manager</div>
          <div className={`mt-0.5 text-xs ${sub}`}>
            {projectName} — this works even after the SOW has been signed.
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-3 py-3">
          {loading ? (
            <p className={`px-2 py-3 text-sm ${sub}`}>Loading team…</p>
          ) : (
            people.map((p) => {
              const active = selected === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(p.id)}
                  className={`mb-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-[#5B4FE8] bg-[#5B4FE8]/10' : dark ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <Avatar person={p} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.full_name}</span>
                    <span className={`block truncate text-xs ${sub}`}>{p.role ?? 'Team member'}</span>
                  </span>
                  {p.id === currentManagerId && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>Current</span>}
                  {active && <span className="text-sm text-[#5B4FE8]">✓</span>}
                </button>
              );
            })
          )}
        </div>

        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: line }}>
          <button type="button" onClick={onClose} disabled={saving} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'}`}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading || !selected} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#5B4FE8' }}>
            {saving ? 'Saving…' : 'Change manager'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
