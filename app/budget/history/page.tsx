'use client';

// Quote History (Phase 6, minimal) — every saved quote, real query, search
// by client/company/service/quote number/teammate, filter by service or
// creator। budget_quotes-এর কোনো status কলাম নেই (ইচ্ছাকৃতভাবে — ফেজ ২০-এর
// নোট: approval workflow MVP-তে নেই, immutable audit রেকর্ড), তাই স্পেকের
// "Status" ফিল্টার এখানে বাদ।

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/useSession';
import { supabase } from '@/lib/supabaseClient';
import { formatBudgetRange } from '@/lib/budgetFormat';
import { formatBnDateLong } from '@/lib/format';
import SignInScreen from '@/app/components/SignInScreen';
import BudgetShell, { Icon, type ProfileRow } from '../components/BudgetShell';

type QuoteRow = {
  id: string;
  quote_number: string;
  client_name: string | null;
  company_name: string | null;
  service_name_snapshot: string;
  standard_min_snapshot: number | null;
  standard_max_snapshot: number | null;
  currency_snapshot: string;
  created_by: string;
  created_at: string;
  creator: { full_name: string } | { full_name: string }[] | null;
};

function toOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const PAGE_SIZE = 15;

export default function BudgetHistoryPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);

  const [search, setSearch] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    async function run() {
      const [profileRes, quotesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_color, avatar_url, behance_url, linkedin_url, is_admin').eq('id', user!.id).single(),
        supabase
          .from('budget_quotes')
          .select('id, quote_number, client_name, company_name, service_name_snapshot, standard_min_snapshot, standard_max_snapshot, currency_snapshot, created_by, created_at, creator:profiles!created_by(full_name)')
          .order('created_at', { ascending: false }),
      ]);
      if (profileRes.data) setProfile(profileRes.data as ProfileRow);
      setQuotes((quotesRes.data as unknown as QuoteRow[]) ?? []);
      setLoading(false);
    }
    run();
  }, [user]);

  const creators = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of quotes) {
      const c = toOne(q.creator);
      if (c) map.set(q.created_by, c.full_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [quotes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((row) => {
      if (creatorFilter && row.created_by !== creatorFilter) return false;
      if (!q) return true;
      const creator = toOne(row.creator);
      return (
        (row.client_name ?? '').toLowerCase().includes(q) ||
        (row.company_name ?? '').toLowerCase().includes(q) ||
        row.service_name_snapshot.toLowerCase().includes(q) ||
        row.quote_number.toLowerCase().includes(q) ||
        (creator?.full_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [quotes, search, creatorFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  return (
    <BudgetShell active="history" topbarTitle="Quote History" profile={profile} email={user.email ?? ''} onProfileUpdated={setProfile}>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Quote History</h1>
          <p className="page-sub">Every quotation the team has generated.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={13} />
          <input
            placeholder="Search client, company, service, quote #..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {creators.length > 0 && (
          <select
            className="filter-select"
            value={creatorFilter}
            onChange={(e) => {
              setCreatorFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Created By: All</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '12px 0' }}>লোড হচ্ছে…</p>
      ) : quotes.length === 0 ? (
        <div className="dcard">
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="plus" />
            </div>
            <div className="empty-title">No quotations yet</div>
            <p className="empty-sub">Generate your first client quotation to see it here.</p>
            <button type="button" className="btn btn-accent btn-sm" onClick={() => router.push('/budget/new')}>
              Generate Quote
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dcard">
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name="search" />
            </div>
            <div className="empty-title">No matching quotations</div>
          </div>
        </div>
      ) : (
        <>
          <div className="result-count tabular">{filtered.length} quotes</div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quote #</th>
                  <th>Client</th>
                  <th>Service</th>
                  <th>Budget</th>
                  <th>Created By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((q) => {
                  const creator = toOne(q.creator);
                  return (
                    <tr key={q.id} className="row-clickable" onClick={() => router.push(`/budget/${q.id}`)}>
                      <td className="tabular">{q.quote_number}</td>
                      <td>
                        {q.client_name ?? 'Not specified'}
                        {q.company_name && <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{q.company_name}</div>}
                      </td>
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

          {totalPages > 1 && (
            <div className="pagination-row">
              <span className="pagination-info tabular">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="pagination-controls">
                <button className="page-btn nav" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={`page-btn${n === currentPage ? ' active' : ''}`} onClick={() => setPage(n)}>
                    {n}
                  </button>
                ))}
                <button className="page-btn nav" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </BudgetShell>
  );
}
