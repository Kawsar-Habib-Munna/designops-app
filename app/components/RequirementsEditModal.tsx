'use client';

// Lets the team fill in or correct a client's project requirements (the client_requirements row) when the client skipped
// onboarding or left fields empty. Saves with an upsert on client_id, so it works whether a row exists yet or not.
// Self-contained styling (Tailwind utilities, portalled to <body>) like ProfileMenu, so it looks right on any page and
// in dark mode without depending on a page's scoped CSS.
import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';

export type RequirementsData = {
  project_name: string | null;
  project_type: string | null;
  project_description: string | null;
  goals: string | null;
  target_audience: string | null;
  required_features: string | null;
  expected_timeline: string | null;
  budget_range: string | null;
  reference_notes: string | null;
  priority: string | null;
  competitors: string | null;
  existing_assets: string | null;
};

const PROJECT_TYPES = ['Website', 'Mobile App', 'Web App', 'SaaS Product', 'Dashboard', 'E-commerce', 'Branding', 'UI/UX Design', 'Product Design', 'Other'];
const TIMELINES = ['No fixed deadline', 'Within 2 weeks', 'Within 1 month', '1–3 months'];
const BUDGETS = ['Not sure yet', 'Under $500', '$500–$1,000', '$1,000–$2,500', '$2,500–$5,000', '$5,000+'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

type Form = Record<keyof RequirementsData, string>;
const KEYS: (keyof RequirementsData)[] = ['project_name', 'project_type', 'project_description', 'goals', 'target_audience', 'required_features', 'expected_timeline', 'budget_range', 'reference_notes', 'priority', 'competitors', 'existing_assets'];

function toForm(r: RequirementsData | null): Form {
  const form = {} as Form;
  for (const k of KEYS) form[k] = r?.[k] ?? '';
  if (!form.priority) form.priority = 'normal';
  return form;
}

export default function RequirementsEditModal({
  clientId,
  initial,
  dark = false,
  onClose,
  onSaved,
}: {
  clientId: string;
  initial: RequirementsData | null;
  dark?: boolean;
  onClose: () => void;
  onSaved: (next: RequirementsData) => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof RequirementsData, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {} as RequirementsData;
    for (const k of KEYS) payload[k] = form[k].trim() === '' ? null : form[k].trim();
    const { error: saveError } = await supabase.from('client_requirements').upsert({ client_id: clientId, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'client_id' });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved(payload);
    onClose();
  }

  const card = dark ? 'border-zinc-700 bg-zinc-900 text-zinc-50' : 'border-zinc-200 bg-white text-zinc-900';
  const line = dark ? '#3f3f46' : '#e4e4e7';
  const input = dark
    ? 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-50 outline-none focus:border-[#7C72FF]'
    : 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-[#5B4FE8]';
  const label = `mb-1.5 block text-xs font-medium ${dark ? 'text-zinc-400' : 'text-zinc-500'}`;
  const ghostBtn = `rounded-lg border px-3 py-1.5 text-xs font-semibold ${dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'}`;

  const select = (key: keyof RequirementsData, options: string[], blank = 'Not specified') => {
    const value = form[key];
    const extra = value && !options.includes(value) ? [value] : [];
    return (
      <select className={input} value={value} onChange={(e) => set(key, e.target.value)}>
        <option value="">{blank}</option>
        {[...options, ...extra].map((o) => (
          <option key={o} value={o}>
            {key === 'priority' ? o.charAt(0).toUpperCase() + o.slice(1) : o}
          </option>
        ))}
      </select>
    );
  };
  const text = (key: keyof RequirementsData, placeholder: string, rows = 3) => (
    <textarea className={input} style={{ minHeight: rows * 24 + 16, resize: 'vertical' }} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
  );

  const modal = (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[5vh] font-[Manrope,Google_Sans,sans-serif] sm:px-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className={`w-full max-w-[760px] rounded-2xl border shadow-2xl ${card}`}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: line }}>
          <div>
            <div className="text-base font-semibold">Client requirements</div>
            <div className={`mt-0.5 text-xs ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>Fill in or correct what the client left empty. Every field is optional.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`flex h-7 w-7 items-center justify-center rounded-md ${dark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-400 hover:bg-zinc-100'}`}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="px-5 py-5">
          <div className="grid gap-x-5 md:grid-cols-2">
            <div>
              <label className={label}>Project name</label>
              <input className={`${input} mb-3`} type="text" value={form.project_name} onChange={(e) => set('project_name', e.target.value)} placeholder="e.g. Company website redesign" />
            </div>
            <div className="mb-3">
              <label className={label}>Project type</label>
              {select('project_type', PROJECT_TYPES)}
            </div>
            <div className="mb-3">
              <label className={label}>Expected timeline</label>
              {select('expected_timeline', TIMELINES)}
            </div>
            <div className="mb-3">
              <label className={label}>Budget range</label>
              {select('budget_range', BUDGETS)}
            </div>
            <div className="mb-3">
              <label className={label}>Priority</label>
              {select('priority', PRIORITIES, 'Normal')}
            </div>
            <div>
              <label className={label}>Target audience</label>
              <input className={`${input} mb-3`} type="text" value={form.target_audience} onChange={(e) => set('target_audience', e.target.value)} placeholder="Who is this project for?" />
            </div>

            <div className="mb-3 md:col-span-2">
              <label className={label}>Project description</label>
              {text('project_description', 'What does the client want built?', 4)}
            </div>
            <div className="mb-3 md:col-span-2">
              <label className={label}>Client goal</label>
              {text('goals', 'What should this project achieve?')}
            </div>
            <div className="mb-3 md:col-span-2">
              <label className={label}>Requested features (comma separated)</label>
              {text('required_features', 'e.g. Login, Payments, Admin dashboard', 2)}
            </div>
            <div className="mb-3">
              <label className={label}>Existing assets</label>
              {text('existing_assets', 'Logo, brand guidelines, content…', 2)}
            </div>
            <div className="mb-3">
              <label className={label}>Competitors</label>
              {text('competitors', 'Competitor names or links', 2)}
            </div>
            <div className="mb-3 md:col-span-2">
              <label className={label}>References</label>
              {text('reference_notes', 'Links or notes the client shared', 2)}
            </div>
          </div>

          {error && (
            <p className="mb-2.5 text-xs text-red-500">
              {error}
              {/row-level security|policy|permission/i.test(error) && ' — run the "team can write client_requirements" SQL from sql/schema.sql in Supabase first.'}
            </p>
          )}

          <div className="mt-1.5 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving} className={ghostBtn}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#5B4FE8' }}>
              {saving ? 'Saving…' : 'Save requirements'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
