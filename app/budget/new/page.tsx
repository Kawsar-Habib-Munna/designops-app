'use client';

// Generate Quote flow (Phase 3/4) — Search→Select→Generate→Copy, in under a
// minute (স্পেক §33)। ৪ ধাপ: Service → Client → Pricing/Packages →
// Message+Save। মেসেজ real deterministic টেমপ্লেট (lib/budgetMessage.ts)
// থেকে রেন্ডার হয় — budget_message_templates টেবিল (ফেজ ২২) থেকে লোড হয়,
// টেবিল খালি/না-পাওয়া গেলে DEFAULT_MESSAGE_TEMPLATES ফলব্যাক। সেভ করলে
// budget_quotes-এ পুরো প্রাইস স্ন্যাপশট যায় (ফেজ ২০ ডিজাইন — পুরনো quote
// কখনো বর্তমান সার্ভিস প্রাইসের সাথে বদলাবে না), quote_number DB-সাইড
// generate_budget_quote_number() থেকে আসে (রেস-কন্ডিশন-মুক্ত)।
//
// useSearchParams() static route-এ Suspense ছাড়া build-time এরর দেয়
// (Phase 1-এ একবার হিট হয়েছিল) — তাই সার্চ-প্যারাম পড়া অংশ আলাদা child
// কম্পোনেন্টে, <Suspense> দিয়ে মোড়ানো।

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBudgetRange } from '@/lib/budgetFormat';
import { buildGreetingLine, buildPriceBlock, renderBudgetMessage, DEFAULT_MESSAGE_TEMPLATES, MESSAGE_STYLE_LABEL, type BudgetPackageKey, type MessageStyle } from '@/lib/budgetMessage';
import { todayISO } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';
import type { ServiceCardData } from '../components/ServiceCard';

type ServiceRow = ServiceCardData & { keywords: string | null };
type TemplateRow = { type: MessageStyle; template: string };
type SettingsRow = { team_name: string; default_validity_days: number; default_message_style: string; show_starter_default: boolean; show_standard_default: boolean; show_advanced_default: boolean };

type Step = 'service' | 'client' | 'pricing' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'service', label: 'Service' },
  { key: 'client', label: 'Client' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'review', label: 'Message' },
];

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function GenerateQuoteBody({ profile, email, onProfileUpdated }: { profile: ProfileRow | null; email: string; onProfileUpdated: (p: ProfileRow) => void }) {
  const searchParams = useSearchParams();
  const preselectServiceId = searchParams.get('service');
  const preselectClient = searchParams.get('client');
  const preselectCompany = searchParams.get('company');
  const preselectProject = searchParams.get('project');

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [settings, setSettings] = useState<SettingsRow | null>(null);

  const [step, setStep] = useState<Step>('service');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const [clientName, setClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [projectName, setProjectName] = useState('');

  const [includeStarter, setIncludeStarter] = useState(true);
  const [includeStandard, setIncludeStandard] = useState(true);
  const [includeAdvanced, setIncludeAdvanced] = useState(true);
  const [discount, setDiscount] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [estimatedTimeline, setEstimatedTimeline] = useState('');
  const [customNote, setCustomNote] = useState('');

  const [messageStyle, setMessageStyle] = useState<MessageStyle>('professional');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedQuote, setSavedQuote] = useState<{ id: string; quote_number: string; generated_message: string } | null>(null);

  useEffect(() => {
    async function run() {
      const [servicesRes, templatesRes, settingsRes] = await Promise.all([
        supabase.from('budget_services').select('id, name, brief, keywords, starter_min, starter_max, standard_min, standard_max, advanced_min, advanced_max, currency').eq('status', 'active').order('name'),
        supabase.from('budget_message_templates').select('type, template').eq('active', true),
        supabase.from('budget_settings').select('team_name, default_validity_days, default_message_style, show_starter_default, show_standard_default, show_advanced_default').eq('id', true).maybeSingle(),
      ]);
      setServices((servicesRes.data as ServiceRow[]) ?? []);
      setTemplates((templatesRes.data as TemplateRow[]) ?? []);
      const s = settingsRes.data as SettingsRow | null;
      setSettings(s);
      if (s) {
        setIncludeStarter(s.show_starter_default);
        setIncludeStandard(s.show_standard_default);
        setIncludeAdvanced(s.show_advanced_default);
        setMessageStyle((s.default_message_style as MessageStyle) ?? 'professional');
        setValidUntil(addDays(todayISO(), s.default_validity_days ?? 14));
      } else {
        setValidUntil(addDays(todayISO(), 14));
      }
      if (preselectServiceId) {
        setSelectedServiceId(preselectServiceId);
        setStep('client');
      }
      if (preselectClient) setClientName(preselectClient);
      if (preselectCompany) setCompanyName(preselectCompany);
      if (preselectProject) setProjectName(preselectProject);
      setLoading(false);
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedService = useMemo(() => services.find((s) => s.id === selectedServiceId) ?? null, [services, selectedServiceId]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q) || (s.brief ?? '').toLowerCase().includes(q) || (s.keywords ?? '').toLowerCase().includes(q));
  }, [services, serviceSearch]);

  const selectedPackages = useMemo<BudgetPackageKey[]>(() => {
    const list: BudgetPackageKey[] = [];
    if (includeStarter) list.push('starter');
    if (includeStandard) list.push('standard');
    if (includeAdvanced) list.push('advanced');
    return list;
  }, [includeStarter, includeStandard, includeAdvanced]);

  const activeTemplate = useMemo(() => templates.find((t) => t.type === messageStyle)?.template ?? DEFAULT_MESSAGE_TEMPLATES[messageStyle], [templates, messageStyle]);

  const generatedMessage = useMemo(() => {
    if (!selectedService) return '';
    const priceBlock = buildPriceBlock(
      [
        { key: 'starter', label: 'Starter', range: formatBudgetRange(selectedService.starter_min, selectedService.starter_max, selectedService.currency) },
        { key: 'standard', label: 'Standard', range: formatBudgetRange(selectedService.standard_min, selectedService.standard_max, selectedService.currency) },
        { key: 'advanced', label: 'Advanced', range: formatBudgetRange(selectedService.advanced_min, selectedService.advanced_max, selectedService.currency, true) },
      ],
      selectedPackages,
    );
    return renderBudgetMessage(activeTemplate, {
      client_name: clientName.trim(),
      service_name: selectedService.name,
      service_brief: selectedService.brief ?? '',
      starter_price: formatBudgetRange(selectedService.starter_min, selectedService.starter_max, selectedService.currency),
      standard_price: formatBudgetRange(selectedService.standard_min, selectedService.standard_max, selectedService.currency),
      advanced_price: formatBudgetRange(selectedService.advanced_min, selectedService.advanced_max, selectedService.currency, true),
      team_name: settings?.team_name ?? 'FLOW 53',
      price_block: priceBlock,
      greeting_line: buildGreetingLine(clientName),
    });
  }, [selectedService, selectedPackages, activeTemplate, clientName, settings]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setSaveError('Could not copy — please copy the text manually.');
    }
  }

  async function handleSave() {
    if (!selectedService) return;
    if (selectedPackages.length === 0) {
      setSaveError('Select at least one package to include in this quote.');
      return;
    }
    setSaving(true);
    setSaveError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setSaving(false);
      setSaveError('Session expired — please sign in again.');
      return;
    }

    const { data, error } = await supabase
      .from('budget_quotes')
      .insert({
        client_name: clientName.trim() || null,
        company_name: companyName.trim() || null,
        project_name: projectName.trim() || null,
        service_id: selectedService.id,
        service_name_snapshot: selectedService.name,
        service_brief_snapshot: selectedService.brief,
        starter_min_snapshot: selectedService.starter_min,
        starter_max_snapshot: selectedService.starter_max,
        standard_min_snapshot: selectedService.standard_min,
        standard_max_snapshot: selectedService.standard_max,
        advanced_min_snapshot: selectedService.advanced_min,
        advanced_max_snapshot: selectedService.advanced_max,
        currency_snapshot: selectedService.currency,
        selected_packages: selectedPackages,
        discount: discount.trim() ? Number(discount) : null,
        custom_note: customNote.trim() || null,
        estimated_timeline: estimatedTimeline.trim() || null,
        valid_until: validUntil || null,
        generated_message: generatedMessage,
        message_style: messageStyle,
        created_by: userId,
      })
      .select('id, quote_number, generated_message')
      .single();

    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSavedQuote(data as { id: string; quote_number: string; generated_message: string });
  }

  function resetWizard() {
    setStep('service');
    setSelectedServiceId(null);
    setServiceSearch('');
    setClientName('');
    setCompanyName('');
    setProjectName('');
    setDiscount('');
    setEstimatedTimeline('');
    setCustomNote('');
    setSavedQuote(null);
    setSaveError(null);
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  if (loading) {
    return (
      <BudgetShell active="new" topbarTitle="Generate Quote" profile={profile} email={email} onProfileUpdated={onProfileUpdated}>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
      </BudgetShell>
    );
  }

  if (savedQuote) {
    return (
      <BudgetShell active="new" topbarTitle="Generate Quote" profile={profile} email={email} onProfileUpdated={onProfileUpdated}>
        <div className="dcard" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="empty-state">
            <div className="empty-icon" style={{ background: 'var(--positive-soft)', color: 'var(--positive)' }}>
              <Icon name="plus" />
            </div>
            <div className="empty-title">Quote {savedQuote.quote_number} saved</div>
            <p className="empty-sub">Copy the message below, or view the full record in history.</p>
          </div>
          <div className="message-preview">{savedQuote.generated_message}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-accent btn-sm" onClick={handleCopy}>
              {copied ? 'Copied to clipboard ✓' : 'Copy Message'}
            </button>
            <Link href={`/budget/${savedQuote.id}`} className="btn btn-ghost btn-sm">
              View Quote
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetWizard}>
              Create Another
            </button>
          </div>
        </div>
      </BudgetShell>
    );
  }

  return (
    <BudgetShell active="new" topbarTitle="Generate Quote" profile={profile} email={email} onProfileUpdated={onProfileUpdated}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Generate Quote</h1>
          <p className="page-sub">Search → Select → Generate → Copy, in under a minute.</p>
        </div>
      </div>

      <nav className="wizard-steps" aria-label="Quote steps">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`wizard-step${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}>
            <span className="wizard-step-num">{i < stepIndex ? '✓' : i + 1}</span>
            {s.label}
          </div>
        ))}
      </nav>

      {step === 'service' && (
        <div className="dcard">
          <span className="dcard-title">Choose a Service</span>
          <div className="toolbar-search" style={{ maxWidth: 'none', marginBottom: 14 }}>
            <Icon name="search" size={13} />
            <input placeholder="Search services..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} autoFocus />
          </div>
          {services.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No active services yet</div>
              <p className="empty-sub">Ask an admin to add services in the Service Library.</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No matching service found</div>
            </div>
          ) : (
            <div className="service-pick-list">
              {filteredServices.map((s) => (
                <button type="button" key={s.id} className={`service-pick-item${s.id === selectedServiceId ? ' active' : ''}`} onClick={() => setSelectedServiceId(s.id)}>
                  <div>
                    <div className="service-pick-name">{s.name}</div>
                    {s.brief && <div className="service-pick-brief">{s.brief}</div>}
                  </div>
                  <div className="service-pick-price tabular">{formatBudgetRange(s.standard_min, s.standard_max, s.currency)}</div>
                </button>
              ))}
            </div>
          )}
          <div className="wizard-nav">
            <span />
            <button type="button" className="btn btn-accent" disabled={!selectedServiceId} onClick={() => setStep('client')}>
              Next: Client Info
            </button>
          </div>
        </div>
      )}

      {step === 'client' && selectedService && (
        <div className="dcard">
          <span className="dcard-title">Client Info</span>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '-6px 0 16px' }}>
            {selectedService.name} · <button type="button" className="link-btn" onClick={() => setStep('service')}>Change service</button>
          </p>
          <div className="field">
            <label className="field-label">Client Name (optional)</label>
            <input className="field-input" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Rashed Karim" />
          </div>
          <div className="field-grid-2">
            <div className="field">
              <label className="field-label">Company (optional)</label>
              <input className="field-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Project Name (optional)</label>
              <input className="field-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
          </div>
          <div className="wizard-nav">
            <button type="button" className="btn btn-ghost" onClick={() => setStep('service')}>
              Back
            </button>
            <button type="button" className="btn btn-accent" onClick={() => setStep('pricing')}>
              Next: Pricing
            </button>
          </div>
        </div>
      )}

      {step === 'pricing' && selectedService && (
        <div className="dcard">
          <span className="dcard-title">Pricing &amp; Packages</span>
          <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '-6px 0 16px' }}>Choose which packages to include in the client quotation.</p>

          <div className="package-pick-grid">
            <label className={`package-pick${includeStarter ? ' checked' : ''}`}>
              <input type="checkbox" checked={includeStarter} onChange={(e) => setIncludeStarter(e.target.checked)} />
              <span className="service-tier-label">Starter</span>
              <span className="service-tier-price tabular">{formatBudgetRange(selectedService.starter_min, selectedService.starter_max, selectedService.currency)}</span>
            </label>
            <label className={`package-pick${includeStandard ? ' checked' : ''} recommended`}>
              <input type="checkbox" checked={includeStandard} onChange={(e) => setIncludeStandard(e.target.checked)} />
              <span className="service-tier-label">
                Standard <span className="recommended-badge">Recommended</span>
              </span>
              <span className="service-tier-price tabular">{formatBudgetRange(selectedService.standard_min, selectedService.standard_max, selectedService.currency)}</span>
            </label>
            <label className={`package-pick${includeAdvanced ? ' checked' : ''}`}>
              <input type="checkbox" checked={includeAdvanced} onChange={(e) => setIncludeAdvanced(e.target.checked)} />
              <span className="service-tier-label">Advanced</span>
              <span className="service-tier-price tabular">{formatBudgetRange(selectedService.advanced_min, selectedService.advanced_max, selectedService.currency, true)}</span>
            </label>
          </div>

          <div className="field-grid-2" style={{ marginTop: 18 }}>
            <div className="field">
              <label className="field-label">Discount (optional)</label>
              <input className="field-input" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={`Amount in ${selectedService.currency}`} />
            </div>
            <div className="field">
              <label className="field-label">Quote Valid Until</label>
              <input className="field-input" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Estimated Timeline (optional)</label>
            <input className="field-input" value={estimatedTimeline} onChange={(e) => setEstimatedTimeline(e.target.value)} placeholder="e.g. 3–4 weeks" />
          </div>
          <div className="field">
            <label className="field-label">Custom Note (optional)</label>
            <textarea className="field-textarea" value={customNote} onChange={(e) => setCustomNote(e.target.value)} placeholder="Anything specific to mention for this quote — not shown to the client automatically." />
          </div>

          <div className="wizard-nav">
            <button type="button" className="btn btn-ghost" onClick={() => setStep('client')}>
              Back
            </button>
            <button type="button" className="btn btn-accent" disabled={selectedPackages.length === 0} onClick={() => setStep('review')}>
              Next: Message
            </button>
          </div>
        </div>
      )}

      {step === 'review' && selectedService && (
        <div className="dcard">
          <span className="dcard-title">Message</span>
          <div className="chip-row" style={{ margin: '0 0 14px' }}>
            {(Object.keys(MESSAGE_STYLE_LABEL) as MessageStyle[]).map((style) => (
              <button key={style} type="button" className={`chip${messageStyle === style ? ' active' : ''}`} onClick={() => setMessageStyle(style)}>
                {MESSAGE_STYLE_LABEL[style]}
              </button>
            ))}
          </div>

          <div className="message-preview">{generatedMessage}</div>

          {saveError && <div className="error-banner" style={{ marginTop: 14 }}>{saveError}</div>}

          <div className="wizard-nav">
            <button type="button" className="btn btn-ghost" onClick={() => setStep('pricing')} disabled={saving}>
              Back
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={handleCopy}>
                {copied ? 'Copied ✓' : 'Copy Message'}
              </button>
              <button type="button" className="btn btn-accent" disabled={saving} onClick={handleSave}>
                {saving ? 'সেভ হচ্ছে…' : 'Save Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BudgetShell>
  );
}

export default function GenerateQuotePage() {
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as ProfileRow);
      });
  }, [user]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <Suspense fallback={null}>
      <GenerateQuoteBody profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile} />
    </Suspense>
  );
}
