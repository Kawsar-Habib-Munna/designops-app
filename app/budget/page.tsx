'use client';

// Budget & Quote Generator — Overview (Phase 2)। budget_services এখন real
// প্রাইসিং শিট থেকে সিড করা ১৪টা সার্ভিস ধরে রাখে (ফেজ ২১) — সার্চ এখন সত্যিই
// রেজাল্ট দেখাবে। কার্ড রেন্ডারিং ServiceCard কম্পোনেন্ট রিইউজ করে (Services
// লাইব্রেরি পাতার সাথে শেয়ার্ড, ডুপ্লিকেট মার্কআপ না)।

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatBnDateLong } from '@/lib/format';
import { formatBudgetRange } from '@/lib/budgetFormat';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from './components/BudgetShell';
import ServiceCard, { type ServiceCardData } from './components/ServiceCard';

const CATEGORY_CHIPS = ['Website', 'Landing Page', 'Dashboard', 'Web App', 'Mobile App', 'E-commerce', 'SaaS'];

type ServiceRow = ServiceCardData & { keywords: string | null };

type QuoteRow = {
  id: string;
  quote_number: string;
  client_name: string | null;
  company_name: string | null;
  service_name_snapshot: string;
  standard_min_snapshot: number | null;
  standard_max_snapshot: number | null;
  currency_snapshot: string;
  created_at: string;
  creator: { full_name: string } | { full_name: string }[] | null;
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function BudgetOverviewPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<QuoteRow[]>([]);
  const [quotesThisMonth, setQuotesThisMonth] = useState(0);
  const [activeServiceCount, setActiveServiceCount] = useState(0);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [mostQuoted, setMostQuoted] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    async function run() {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [profileRes, servicesRes, quotesRes, monthQuotesRes, activeServicesRes, teamRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single(),
        supabase.from('budget_services').select('id, name, brief, keywords, starter_min, starter_max, standard_min, standard_max, advanced_min, advanced_max, currency').eq('status', 'active').order('name'),
        supabase
          .from('budget_quotes')
          .select('id, quote_number, client_name, company_name, service_name_snapshot, standard_min_snapshot, standard_max_snapshot, currency_snapshot, created_at, creator:profiles!created_by(full_name)')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('budget_quotes').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
        supabase.from('budget_services').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setServices((servicesRes.data as ServiceRow[]) ?? []);
      const quotes = (quotesRes.data as unknown as QuoteRow[]) ?? [];
      setRecentQuotes(quotes);
      setQuotesThisMonth(monthQuotesRes.count ?? 0);
      setActiveServiceCount(activeServicesRes.count ?? 0);
      setTeamMemberCount(teamRes.count ?? 0);

      const { data: allQuoteNames } = await supabase.from('budget_quotes').select('service_name_snapshot');
      if (allQuoteNames && allQuoteNames.length > 0) {
        const counts = new Map<string, number>();
        for (const row of allQuoteNames as { service_name_snapshot: string }[]) {
          counts.set(row.service_name_snapshot, (counts.get(row.service_name_snapshot) ?? 0) + 1);
        }
        let top: string | null = null;
        let topCount = 0;
        for (const [name, count] of counts) {
          if (count > topCount) {
            top = name;
            topCount = count;
          }
        }
        setMostQuoted(top);
      }

      setLoading(false);
    }
    run();
  }, [user]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return services.filter((s) => s.name.toLowerCase().includes(q) || (s.brief ?? '').toLowerCase().includes(q) || (s.keywords ?? '').toLowerCase().includes(q));
  }, [services, search]);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const displayName = profile?.full_name?.trim() || user.email || '';

  return (
    <BudgetShell active="overview" topbarTitle="Overview" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            {greeting()}, {displayName}
          </h1>
          <p className="page-sub">Create consistent and professional client quotations.</p>
        </div>
      </div>

      <div className="dcard">
        <span className="dcard-title">Client Budget Generator</span>
        <div className="search-hero">
          <Icon name="search" size={16} />
          <input
            placeholder="Search website, dashboard, mobile app, SaaS..."
            aria-label="What service does the client need?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chip-row">
          {CATEGORY_CHIPS.map((c) => (
            <button key={c} type="button" className={`chip${search === c ? ' active' : ''}`} onClick={() => setSearch(c)}>
              {c}
            </button>
          ))}
        </div>

        {search.trim() && (
          <div style={{ marginTop: 4 }}>
            {loading ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>লোড হচ্ছে…</p>
            ) : filteredServices.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <div className="empty-icon">
                  <Icon name="search" />
                </div>
                <div className="empty-title">No matching service found</div>
                <p className="empty-sub">
                  {services.length === 0
                    ? 'The service library is still being set up — check back soon or ask an admin.'
                    : 'Try another keyword or browse service categories.'}
                </p>
              </div>
            ) : (
              filteredServices.map((s) => <ServiceCard key={s.id} service={s} />)
            )}
          </div>
        )}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon">
              <Icon name="clock" />
            </div>
          </div>
          <div className="kpi-value tabular">{loading ? '—' : quotesThisMonth}</div>
          <div className="kpi-label">Quotes This Month</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon">
              <Icon name="layers" />
            </div>
          </div>
          <div className="kpi-value tabular">{loading ? '—' : activeServiceCount}</div>
          <div className="kpi-label">Active Services</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon">
              <Icon name="users" />
            </div>
          </div>
          <div className="kpi-value tabular">{loading ? '—' : teamMemberCount}</div>
          <div className="kpi-label">Team Members</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon">
              <Icon name="grid" />
            </div>
          </div>
          <div className="kpi-value" style={{ fontSize: 14 }}>
            {loading ? '—' : (mostQuoted ?? '—')}
          </div>
          <div className="kpi-label">Most Quoted Service</div>
        </div>
      </div>

      <div className="dcard" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="dcard-title" style={{ marginBottom: 0 }}>
            Recent Quotations
          </span>
          {recentQuotes.length > 0 && (
            <Link href="/budget/history" className="btn btn-ghost btn-sm">
              View All
            </Link>
          )}
        </div>

        {loading ? (
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '12px 0' }}>লোড হচ্ছে…</p>
        ) : recentQuotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="plus" />
            </div>
            <div className="empty-title">No quotations yet</div>
            <p className="empty-sub">Generate your first client quotation to see it here.</p>
            <Link href="/budget/new" className="btn btn-accent btn-sm">
              Generate Quote
            </Link>
          </div>
        ) : (
          <div className="table-scroll" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Budget</th>
                  <th>Created By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((q) => {
                  const creator = toOne(q.creator);
                  return (
                    <tr key={q.id} className="row-clickable" onClick={() => router.push(`/budget/${q.id}`)}>
                      <td>{q.client_name ?? q.company_name ?? 'Not specified'}</td>
                      <td>{q.service_name_snapshot}</td>
                      <td className="tabular">{formatBudgetRange(q.standard_min_snapshot, q.standard_max_snapshot, q.currency_snapshot)}</td>
                      <td>{creator?.full_name ?? '—'}</td>
                      <td className="tabular">{formatBnDateLong(q.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </BudgetShell>
  );
}
