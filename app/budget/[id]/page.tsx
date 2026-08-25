'use client';

// Quote Detail (Phase 6, minimal; card panel added Phase 5)। budget_quotes-এর
// একটা রো-ই পুরো সত্য — snapshot কলাম থেকে সরাসরি রেন্ডার হয়, বর্তমান
// budget_services-এর সাথে কখনো join করা হয় না (ফেজ ২০-এর মূল ডিজাইন
// সিদ্ধান্ত)। Duplicate Quote শুধু service+client/company/project প্রি-ফিল
// করে নতুন wizard খোলে — প্যাকেজ/নোট/discount ইচ্ছাকৃতভাবে ক্যারি হয় না,
// কারণ সেগুলো প্রতি quote-এ আলাদা হওয়াই স্বাভাবিক।

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBudgetRange, formatBudgetAmount } from '@/lib/budgetFormat';
import { formatBnDateLong } from '@/lib/format';
import { MESSAGE_STYLE_LABEL, type MessageStyle } from '@/lib/budgetMessage';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';
import QuoteCardPanel from '../components/QuoteCardPanel';
import type { CardTier } from '@/lib/budgetCard';

type SettingsRow = { team_name: string; website: string | null; contact_email: string | null; brand_accent: string; logo_url: string | null };

type QuoteDetail = {
  id: string;
  quote_number: string;
  client_name: string | null;
  company_name: string | null;
  project_name: string | null;
  service_id: string | null;
  service_name_snapshot: string;
  service_brief_snapshot: string | null;
  starter_min_snapshot: number | null;
  starter_max_snapshot: number | null;
  standard_min_snapshot: number | null;
  standard_max_snapshot: number | null;
  advanced_min_snapshot: number | null;
  advanced_max_snapshot: number | null;
  currency_snapshot: string;
  exchange_rate_used: number | null;
  selected_packages: string[];
  discount: number | null;
  custom_note: string | null;
  estimated_timeline: string | null;
  valid_until: string | null;
  generated_message: string;
  message_style: string;
  created_at: string;
  creator: { full_name: string } | { full_name: string }[] | null;
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default function QuoteDetailPage() {
  const params = useParams();
  const quoteId = params.id as string;
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [profileRes, quoteRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single(),
        supabase.from('budget_quotes').select('*, creator:profiles!created_by(full_name)').eq('id', quoteId).maybeSingle(),
        supabase.from('budget_settings').select('team_name, website, contact_email, brand_accent, logo_url').eq('id', true).maybeSingle(),
      ]);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      if (!quoteRes.data) {
        setLoadError(true);
      } else {
        setQuote(quoteRes.data as unknown as QuoteDetail);
      }
      setSettings(settingsRes.data as SettingsRow | null);
      setLoading(false);
    }
    run();
  }, [user, quoteId]);

  async function handleCopy() {
    if (!quote) return;
    try {
      await navigator.clipboard.writeText(quote.generated_message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard এক্সেস না থাকলে শুধু কপি করা যাবে না, error দেখানোর দরকার নেই — টেক্সট এমনিতেই স্ক্রিনে আছে
    }
  }

  function handleDuplicate() {
    if (!quote?.service_id) return;
    const paramsObj = new URLSearchParams({ service: quote.service_id });
    if (quote.client_name) paramsObj.set('client', quote.client_name);
    if (quote.company_name) paramsObj.set('company', quote.company_name);
    if (quote.project_name) paramsObj.set('project', quote.project_name);
    router.push(`/budget/new?${paramsObj.toString()}`);
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  if (loading) {
    return (
      <BudgetShell active="history" topbarTitle="Quote" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
      </BudgetShell>
    );
  }

  if (loadError || !quote) {
    return (
      <BudgetShell active="history" topbarTitle="Quote" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
        <div className="dcard">
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="clock" />
            </div>
            <div className="empty-title">Quote not found</div>
            <p className="empty-sub">This quotation may not exist, or you may not have access to it.</p>
            <Link href="/budget/history" className="btn btn-ghost btn-sm">
              Back to History
            </Link>
          </div>
        </div>
      </BudgetShell>
    );
  }

  const creator = toOne(quote.creator);
  const tiers: { key: string; label: string; min: number | null; max: number | null; openEnded?: boolean }[] = [
    { key: 'starter', label: 'Starter', min: quote.starter_min_snapshot, max: quote.starter_max_snapshot },
    { key: 'standard', label: 'Standard', min: quote.standard_min_snapshot, max: quote.standard_max_snapshot },
    { key: 'advanced', label: 'Advanced', min: quote.advanced_min_snapshot, max: quote.advanced_max_snapshot, openEnded: true },
  ];
  const cardTiers: CardTier[] = tiers
    .filter((t) => quote.selected_packages.includes(t.key))
    .map((t) => ({
      key: t.key as CardTier['key'],
      label: t.label,
      range: formatBudgetRange(t.min, t.max, quote.currency_snapshot, t.openEnded),
      recommended: t.key === 'standard',
    }));

  return (
    <BudgetShell active="history" topbarTitle="Quote" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="breadcrumb">
        <Link href="/budget/history">Quote History</Link> / {quote.quote_number}
      </div>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">{quote.quote_number}</h1>
          <p className="page-sub">
            {quote.client_name ?? 'No client name'}
            {quote.company_name ? ` · ${quote.company_name}` : ''}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? 'Copied ✓' : 'Copy Message'}
          </button>
          {quote.service_id && (
            <button type="button" className="btn btn-accent btn-sm" onClick={handleDuplicate}>
              <Icon name="plus" size={12} /> Duplicate Quote
            </button>
          )}
        </div>
      </div>

      <div className="dcard">
        <span className="dcard-title">{quote.service_name_snapshot}</span>
        {quote.service_brief_snapshot && <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '-6px 0 14px' }}>{quote.service_brief_snapshot}</p>}
        <div className="package-pick-grid">
          {tiers.map((t) => (
            <div key={t.key} className={`package-pick${quote.selected_packages.includes(t.key) ? ' checked' : ''}`} style={{ cursor: 'default', opacity: quote.selected_packages.includes(t.key) ? 1 : 0.45 }}>
              <span className="service-tier-label">{t.label}</span>
              <span className="service-tier-price tabular">{formatBudgetRange(t.min, t.max, quote.currency_snapshot, t.openEnded)}</span>
            </div>
          ))}
        </div>
        {quote.exchange_rate_used != null && (
          <p className="field-hint" style={{ marginTop: 12 }}>
            Converted at 1 {quote.currency_snapshot} ≈ {formatBudgetAmount(quote.exchange_rate_used, 'BDT')} — the rate in effect when this quote was generated, frozen here even if Settings has since changed.
          </p>
        )}
      </div>

      <div className="dcard">
        <span className="dcard-title">Details</span>
        <div className="quote-detail-grid">
          <div>
            <span className="field-label">Project</span>
            <p style={{ margin: 0, fontSize: 13 }}>{quote.project_name ?? '—'}</p>
          </div>
          <div>
            <span className="field-label">Created By</span>
            <p style={{ margin: 0, fontSize: 13 }}>{creator?.full_name ?? '—'}</p>
          </div>
          <div>
            <span className="field-label">Created On</span>
            <p style={{ margin: 0, fontSize: 13 }}>{formatBnDateLong(quote.created_at)}</p>
          </div>
          <div>
            <span className="field-label">Valid Until</span>
            <p style={{ margin: 0, fontSize: 13 }}>{quote.valid_until ? formatBnDateLong(quote.valid_until) : '—'}</p>
          </div>
          <div>
            <span className="field-label">Estimated Timeline</span>
            <p style={{ margin: 0, fontSize: 13 }}>{quote.estimated_timeline ?? '—'}</p>
          </div>
          <div>
            <span className="field-label">Discount</span>
            <p style={{ margin: 0, fontSize: 13 }}>{quote.discount != null ? formatBudgetRange(quote.discount, quote.discount, quote.currency_snapshot) : '—'}</p>
          </div>
        </div>
        {quote.custom_note && (
          <>
            <span className="field-label" style={{ display: 'block', marginTop: 14 }}>
              Note
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>{quote.custom_note}</p>
          </>
        )}
      </div>

      <div className="dcard">
        <span className="dcard-title">Message · {MESSAGE_STYLE_LABEL[quote.message_style as MessageStyle] ?? quote.message_style}</span>
        <div className="message-preview">{quote.generated_message}</div>
      </div>

      <div className="dcard" style={{ marginBottom: 0 }}>
        <span className="dcard-title">Quote Card</span>
        <QuoteCardPanel
          data={{
            teamName: settings?.team_name ?? 'FLOW 53',
            logoUrl: settings?.logo_url ?? null,
            serviceName: quote.service_name_snapshot,
            serviceBrief: quote.service_brief_snapshot ?? '',
            clientName: quote.client_name ?? '',
            companyName: quote.company_name ?? '',
            validUntilLabel: quote.valid_until ? formatBnDateLong(quote.valid_until) : null,
            tiers: cardTiers,
            website: settings?.website ?? '',
            contactEmail: settings?.contact_email ?? '',
            brandAccent: settings?.brand_accent ?? '#5B4FE8',
          }}
        />
      </div>
    </BudgetShell>
  );
}
