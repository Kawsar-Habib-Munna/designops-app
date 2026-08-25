'use client';

// Settings (admin-only, Phase 7)। budget_settings একটা singleton রো (ফেজ
// ২০, id সবসময় true) — এখানে সেটাই এডিট হয়। RLS-এ "admin can write
// budget_settings" আগে থেকেই আছে, তাই non-admin-এর জন্য নিচের গার্ডটা শুধু
// UX (RLS-ই আসল প্রোটেকশন)। Logo আপলোড বাকি অ্যাপের মতোই Google Drive
// পাইপলাইন (lib/driveUpload.ts) রিইউজ করে — কোনো নতুন storage মেকানিজম না।
// Message template এডিটর প্রতিটা টেমপ্লেটের জন্য আলাদা draft + save, প্লাস
// sample ডেটা দিয়ে লাইভ প্রিভিউ — renderBudgetMessage() অচেনা
// {{variable}} থাকলে খালি স্ট্রিং দিয়ে রিপ্লেস করে, তাই ভাঙা ভ্যারিয়েবল
// কখনো quote generation ক্র্যাশ করাতে পারে না (স্পেক §26)।

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { uploadFileToDrive, driveThumbnailUrl } from '@/lib/driveUpload';
import { renderBudgetMessage, buildGreetingLine, buildPriceBlock, DEFAULT_MESSAGE_TEMPLATES, MESSAGE_STYLE_LABEL, type MessageStyle } from '@/lib/budgetMessage';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';

const CURRENCIES = ['BDT', 'INR', 'USD', 'GBP'];

type SettingsForm = {
  team_name: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  default_currency: string;
  logo_url: string | null;
  brand_accent: string;
  card_footer: string;
  default_validity_days: string;
  default_message_style: MessageStyle;
  show_starter_default: boolean;
  show_standard_default: boolean;
  show_advanced_default: boolean;
  exchange_rate_usd: string;
  exchange_rate_gbp: string;
  exchange_rate_inr: string;
};

type TemplateRow = { type: MessageStyle; name: string; template: string };

const SAMPLE_MESSAGE_VARS = {
  client_name: 'Jane Doe',
  service_name: 'Dashboard UI/UX',
  service_brief: 'Admin, analytics or management dashboard with navigation, cards, charts, tables, filters and common states.',
  starter_price: '৳25,000 – ৳35,000',
  standard_price: '৳35,000 – ৳55,000',
  advanced_price: '৳55,000 – ৳90,000+',
  team_name: 'FLOW 53',
  price_block: buildPriceBlock(
    [
      { key: 'starter', label: 'Starter', range: '৳25,000 – ৳35,000' },
      { key: 'standard', label: 'Standard', range: '৳35,000 – ৳55,000' },
      { key: 'advanced', label: 'Advanced', range: '৳55,000 – ৳90,000+' },
    ],
    ['starter', 'standard', 'advanced'],
  ),
  greeting_line: buildGreetingLine('Jane Doe'),
};

export default function BudgetSettingsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});
  const [templateSaving, setTemplateSaving] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [profileRes, settingsRes, templatesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single(),
        supabase.from('budget_settings').select('*').eq('id', true).maybeSingle(),
        supabase.from('budget_message_templates').select('type, name, template').order('type'),
      ]);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      const s = settingsRes.data as Record<string, unknown> | null;
      if (s) {
        setForm({
          team_name: (s.team_name as string) ?? 'FLOW 53',
          website: (s.website as string) ?? '',
          contact_email: (s.contact_email as string) ?? '',
          contact_phone: (s.contact_phone as string) ?? '',
          default_currency: (s.default_currency as string) ?? 'BDT',
          logo_url: (s.logo_url as string) ?? null,
          brand_accent: (s.brand_accent as string) ?? '#5B4FE8',
          card_footer: (s.card_footer as string) ?? '',
          default_validity_days: String(s.default_validity_days ?? 14),
          default_message_style: ((s.default_message_style as string) ?? 'professional') as MessageStyle,
          show_starter_default: (s.show_starter_default as boolean) ?? true,
          show_standard_default: (s.show_standard_default as boolean) ?? true,
          show_advanced_default: (s.show_advanced_default as boolean) ?? true,
          exchange_rate_usd: s.exchange_rate_usd != null ? String(s.exchange_rate_usd) : '',
          exchange_rate_gbp: s.exchange_rate_gbp != null ? String(s.exchange_rate_gbp) : '',
          exchange_rate_inr: s.exchange_rate_inr != null ? String(s.exchange_rate_inr) : '',
        });
      }
      const tRows = (templatesRes.data as TemplateRow[]) ?? [];
      setTemplates(tRows);
      const drafts: Record<string, string> = {};
      for (const t of tRows) drafts[t.type] = t.template;
      setTemplateDrafts(drafts);
      setLoading(false);
    }
    run();
  }, [user]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !form) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;
    setUploadingLogo(true);
    setLogoProgress(0);
    try {
      const result = await uploadFileToDrive(file, accessToken, setLogoProgress);
      setForm((f) => (f ? { ...f, logo_url: result.webViewLink } : f));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'লোগো আপলোড ব্যর্থ হয়েছে।');
    }
    setUploadingLogo(false);
  }

  async function handleSaveSettings() {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    const { error: updateError } = await supabase
      .from('budget_settings')
      .update({
        team_name: form.team_name.trim() || 'FLOW 53',
        website: form.website.trim() || null,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        default_currency: form.default_currency,
        logo_url: form.logo_url,
        brand_accent: form.brand_accent,
        card_footer: form.card_footer.trim() || null,
        default_validity_days: Number(form.default_validity_days) || 14,
        default_message_style: form.default_message_style,
        show_starter_default: form.show_starter_default,
        show_standard_default: form.show_standard_default,
        show_advanced_default: form.show_advanced_default,
        exchange_rate_usd: form.exchange_rate_usd.trim() ? Number(form.exchange_rate_usd) : null,
        exchange_rate_gbp: form.exchange_rate_gbp.trim() ? Number(form.exchange_rate_gbp) : null,
        exchange_rate_inr: form.exchange_rate_inr.trim() ? Number(form.exchange_rate_inr) : null,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaveMsg('Settings saved ✓');
    setTimeout(() => setSaveMsg(null), 2500);
  }

  async function handleSaveTemplate(type: MessageStyle) {
    const draft = templateDrafts[type];
    if (draft == null) return;
    setTemplateSaving(type);
    const { error: updateError } = await supabase.from('budget_message_templates').update({ template: draft, updated_at: new Date().toISOString() }).eq('type', type);
    setTemplateSaving(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setTemplates((prev) => prev.map((t) => (t.type === type ? { ...t, template: draft } : t)));
    setTemplateSaved(type);
    setTimeout(() => setTemplateSaved(null), 2000);
  }

  function handleResetTemplate(type: MessageStyle) {
    setTemplateDrafts((prev) => ({ ...prev, [type]: DEFAULT_MESSAGE_TEMPLATES[type] }));
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  if (!loading && !profile?.is_admin) {
    return (
      <BudgetShell active="settings" topbarTitle="Settings" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
        <div className="dcard">
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="settings" />
            </div>
            <div className="empty-title">Admins only</div>
            <p className="empty-sub">Settings are managed by team admins.</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push('/budget')}>
              Back to Overview
            </button>
          </div>
        </div>
      </BudgetShell>
    );
  }

  return (
    <BudgetShell active="settings" topbarTitle="Settings" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Team branding, quote defaults, and message templates.</p>
        </div>
        {form && (
          <div className="header-actions">
            {saveMsg && <span style={{ fontSize: 12.5, color: 'var(--positive)', fontWeight: 600 }}>{saveMsg}</span>}
            <button type="button" className="btn btn-accent" disabled={saving} onClick={handleSaveSettings}>
              {saving ? 'সেভ হচ্ছে…' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading || !form ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
      ) : (
        <>
          <div className="dcard">
            <span className="dcard-title">General</span>
            <div className="field-grid-2">
              <div className="field">
                <label className="field-label">Team Name</label>
                <input className="field-input" value={form.team_name} onChange={(e) => setForm({ ...form, team_name: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Website</label>
                <input className="field-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="flow53design.com" />
              </div>
            </div>
            <div className="field-grid-2">
              <div className="field">
                <label className="field-label">Contact Email</label>
                <input className="field-input" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Contact Phone</label>
                <input className="field-input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="field-label">Default Currency</label>
              <select className="field-select" value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <p className="field-hint">New services default to this currency — existing services keep their own.</p>
            </div>
          </div>

          <div className="dcard">
            <span className="dcard-title">Currency &amp; Exchange Rates</span>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '-6px 0 16px' }}>
              All services are priced in BDT. Set a rate here to let the quote wizard convert a quote into that currency for a client — leave a rate blank to keep that currency unavailable. Rates are never fetched automatically; each saved quote
              records the exact rate used, so an old quote&apos;s converted price never changes later even if you update the rate.
            </p>
            <div className="field-grid-2">
              <div className="field">
                <label className="field-label">1 USD = ___ BDT</label>
                <input className="field-input" type="number" min="0" step="0.01" value={form.exchange_rate_usd} onChange={(e) => setForm({ ...form, exchange_rate_usd: e.target.value })} placeholder="e.g. 122" />
              </div>
              <div className="field">
                <label className="field-label">1 GBP = ___ BDT</label>
                <input className="field-input" type="number" min="0" step="0.01" value={form.exchange_rate_gbp} onChange={(e) => setForm({ ...form, exchange_rate_gbp: e.target.value })} placeholder="e.g. 155" />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0, maxWidth: 'calc(50% - 6px)' }}>
              <label className="field-label">1 INR = ___ BDT</label>
              <input className="field-input" type="number" min="0" step="0.01" value={form.exchange_rate_inr} onChange={(e) => setForm({ ...form, exchange_rate_inr: e.target.value })} placeholder="e.g. 1.47" />
            </div>
          </div>

          <div className="dcard">
            <span className="dcard-title">Branding</span>
            <div className="field">
              <label className="field-label">Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {form.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={driveThumbnailUrl(form.logo_url)} alt="Team logo" style={{ width: 56, height: 56, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }} />
                )}
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  <Icon name="upload" size={13} /> {uploadingLogo ? `আপলোড হচ্ছে… ${logoProgress}%` : form.logo_url ? 'Replace Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" hidden onChange={handleLogoUpload} disabled={uploadingLogo} />
                </label>
                {form.logo_url && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, logo_url: null })}>
                    Remove
                  </button>
                )}
              </div>
              <p className="field-hint">Used on the quote card when &quot;Show logo&quot; is enabled.</p>
            </div>
            <div className="field-grid-2">
              <div className="field">
                <label className="field-label">Brand Accent</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={form.brand_accent} onChange={(e) => setForm({ ...form, brand_accent: e.target.value })} style={{ width: 44, height: 40, padding: 2, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} />
                  <input className="field-input" value={form.brand_accent} onChange={(e) => setForm({ ...form, brand_accent: e.target.value })} style={{ flex: 1 }} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Card Footer (optional)</label>
                <input className="field-input" value={form.card_footer} onChange={(e) => setForm({ ...form, card_footer: e.target.value })} placeholder="e.g. Estimated pricing — final quote after requirements review" />
              </div>
            </div>
          </div>

          <div className="dcard">
            <span className="dcard-title">Quote Defaults</span>
            <div className="field-grid-2">
              <div className="field">
                <label className="field-label">Default Validity (days)</label>
                <input className="field-input" type="number" min="1" value={form.default_validity_days} onChange={(e) => setForm({ ...form, default_validity_days: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Default Message Style</label>
                <select className="field-select" value={form.default_message_style} onChange={(e) => setForm({ ...form, default_message_style: e.target.value as MessageStyle })}>
                  {(Object.keys(MESSAGE_STYLE_LABEL) as MessageStyle[]).map((s) => (
                    <option key={s} value={s}>
                      {MESSAGE_STYLE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.show_starter_default} onChange={(e) => setForm({ ...form, show_starter_default: e.target.checked })} /> Show Starter by default
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.show_standard_default} onChange={(e) => setForm({ ...form, show_standard_default: e.target.checked })} /> Show Standard by default
            </label>
            <label className="checkbox-row" style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={form.show_advanced_default} onChange={(e) => setForm({ ...form, show_advanced_default: e.target.checked })} /> Show Advanced by default
            </label>
          </div>

          <div className="dcard" style={{ marginBottom: 0 }}>
            <span className="dcard-title">Message Templates</span>
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '-6px 0 16px' }}>
              Safe variables: <code>{'{{client_name}}'}</code> <code>{'{{service_name}}'}</code> <code>{'{{service_brief}}'}</code> <code>{'{{price_block}}'}</code> <code>{'{{greeting_line}}'}</code> <code>{'{{team_name}}'}</code>. Unknown variables are
              silently removed rather than breaking the quote.
            </p>
            {(Object.keys(MESSAGE_STYLE_LABEL) as MessageStyle[]).map((type) => {
              const draft = templateDrafts[type] ?? DEFAULT_MESSAGE_TEMPLATES[type];
              const exists = templates.some((t) => t.type === type);
              return (
                <div key={type} className="template-editor-block">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{MESSAGE_STYLE_LABEL[type]}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {templateSaved === type && <span style={{ fontSize: 11.5, color: 'var(--positive)', fontWeight: 600 }}>Saved ✓</span>}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleResetTemplate(type)}>
                        Reset to Default
                      </button>
                      <button type="button" className="btn btn-accent btn-sm" disabled={!exists || templateSaving === type} onClick={() => handleSaveTemplate(type)}>
                        {templateSaving === type ? 'সেভ হচ্ছে…' : 'Save'}
                      </button>
                    </div>
                  </div>
                  {!exists && <p className="field-hint">Not seeded in the database yet — run the Phase 22 SQL to enable saving this template.</p>}
                  <textarea
                    className="field-textarea"
                    style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 12.5 }}
                    value={draft}
                    onChange={(e) => setTemplateDrafts((prev) => ({ ...prev, [type]: e.target.value }))}
                  />
                  <div className="template-preview">
                    <span className="field-label">Preview</span>
                    <div className="message-preview" style={{ padding: '12px 14px', fontSize: 12 }}>
                      {renderBudgetMessage(draft, SAMPLE_MESSAGE_VARS)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </BudgetShell>
  );
}
