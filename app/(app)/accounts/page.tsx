'use client';

// Accounts: the agency's money in one place (owners / admins only).
//  Overview · Receivables · Expenses · Payroll · Profitability · Reports (profit & loss) · Settings (exchange rates, budgets, recurring) · Audit log
// Income comes from the existing invoices / payments tables; everything else lives in the tables of lib/accountsCore.ts
// (ACCOUNTS_SQL, also kept in sql/schema.sql). Every amount is shown in one base currency using the saved exchange rates.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '../todos/todos.css';
import './accounts.css';
import './accounts2.css';
import { supabase } from '@/lib/supabaseClient';
import { useSession } from '@/lib/useSession';
import { formatMoney } from '@/lib/currency';
import { todayISO, formatDateLong } from '@/lib/format';
import { ACCOUNTS_SQL, BASE, CATEGORIES, CURRENCY_CHOICES, buildCalc, daysBetween, fetchAccounts, monthLabel, one, type AccountsData, type Recurring } from '@/lib/accountsCore';
import SignInScreen from '@/app/components/SignInScreen';
import { TopbarActions } from '@/app/components/appShellContext';
import ProfitabilityTab from './ProfitabilityTab';
import ReportsTab from './ReportsTab';
import SettingsTab from './SettingsTab';
import PayrollTab from './PayrollTab';
import DistributionTab from './DistributionTab';

const ICON_PATHS: Record<string, string> = {
  reload: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  export: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  in: '<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>',
  clock: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  out: '<path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/>',
  trend: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
};
function Icon({ name, size = 16 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'distribution', label: 'Distribution' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'profit', label: 'Profitability' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit', label: 'Audit log' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const PAGE_SIZE = 8;
const emptyForm = () => ({ date: todayISO(), amount: '', currency: BASE, category: CATEGORIES[0], vendor: '', description: '', projectId: '', receipt: '' });

export default function AccountsPage() {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AccountsData | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [page, setPage] = useState(1);
  const [catFilter, setCatFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [f, setF] = useState(emptyForm());
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => setData(await fetchAccounts()), []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const r = await fetchAccounts();
      if (!cancelled) setData(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // not an admin: back to the dashboard
  useEffect(() => {
    if (data && !data.isAdmin) router.replace('/dashboard');
  }, [data, router]);

  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const calc = data ? buildCalc(data, today) : null;
  const money = (n: number) => formatMoney(n, BASE);

  // every change is written to the audit log (best effort: a failed log never blocks the change)
  async function audit(action: string, entity: string, entityId: string | null, detail: string) {
    await supabase.from('accounts_audit').insert({ actor_id: user?.id ?? null, action, entity, entity_id: entityId, detail });
  }

  function downloadCsv(name: string, rows: (string | number)[][]) {
    const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveExpense() {
    const amount = Number(f.amount);
    if (!f.amount || Number.isNaN(amount) || amount <= 0) return setFormError('Enter a valid amount.');
    if (!f.date) return setFormError('Pick the date.');
    setSaving(true);
    setFormError(null);
    const { data: row, error } = await supabase
      .from('expenses')
      .insert({ expense_date: f.date, amount, currency: f.currency, category: f.category, vendor: f.vendor.trim() || null, description: f.description.trim() || null, project_id: f.projectId || null, receipt_url: f.receipt.trim() || null, created_by: user?.id ?? null })
      .select('id')
      .single();
    setSaving(false);
    if (error) return setFormError(error.message);
    await audit('expense_added', 'expense', (row as { id: string }).id, `${f.category}: ${formatMoney(amount, f.currency)}${f.vendor ? ` · ${f.vendor}` : ''}`);
    setShowAdd(false);
    setF(emptyForm());
    await load();
  }
  async function removeExpense(id: string, label: string) {
    if (!window.confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    await audit('expense_deleted', 'expense', id, label);
    await load();
  }
  async function saveRate(currency: string, rate: number) {
    await supabase.from('fx_rates').upsert({ currency, rate_to_base: rate, updated_at: new Date().toISOString() });
    await audit('rate_saved', 'fx_rate', currency, `1 ${currency} = ${rate} ${BASE}`);
    await load();
  }
  async function deleteRate(currency: string) {
    await supabase.from('fx_rates').delete().eq('currency', currency);
    await audit('rate_removed', 'fx_rate', currency, `${currency} rate removed`);
    await load();
  }
  async function saveBudgets(rows: { category: string; amount: number }[]) {
    const keep = rows.filter((r) => r.amount > 0);
    const drop = rows.filter((r) => r.amount <= 0).map((r) => r.category);
    if (keep.length) await supabase.from('budgets').upsert(keep.map((r) => ({ category: r.category, monthly_amount: r.amount })), { onConflict: 'category' });
    if (drop.length) await supabase.from('budgets').delete().in('category', drop);
    await audit('budgets_saved', 'budget', null, keep.map((r) => `${r.category} ${r.amount}`).join(', ') || 'all budgets cleared');
    await load();
  }
  async function addRecurring(r: Omit<Recurring, 'id' | 'last_posted_month' | 'active'>) {
    const { data: row } = await supabase.from('recurring_expenses').insert(r).select('id').single();
    await audit('recurring_added', 'recurring', (row as { id: string } | null)?.id ?? null, `${r.name}: ${formatMoney(r.amount, r.currency)} monthly`);
    await load();
  }
  async function toggleRecurring(id: string, active: boolean) {
    await supabase.from('recurring_expenses').update({ active }).eq('id', id);
    await audit(active ? 'recurring_resumed' : 'recurring_paused', 'recurring', id, '');
    await load();
  }
  async function deleteRecurring(id: string) {
    if (!window.confirm('Delete this recurring expense? Expenses it already posted stay.')) return;
    await supabase.from('recurring_expenses').delete().eq('id', id);
    await audit('recurring_deleted', 'recurring', id, '');
    await load();
  }
  // posts this month's expense for every active recurring item that has not been posted yet
  async function postRecurring(): Promise<number> {
    if (!data) return 0;
    const due = data.recurring.filter((r) => r.active && r.last_posted_month !== thisMonth);
    for (const r of due) {
      const day = String(Math.min(r.day_of_month, 28)).padStart(2, '0');
      await supabase.from('expenses').insert({ expense_date: `${thisMonth}-${day}`, amount: r.amount, currency: r.currency, category: r.category, vendor: r.vendor, description: `${r.name} (recurring)`, project_id: r.project_id, created_by: user?.id ?? null });
      await supabase.from('recurring_expenses').update({ last_posted_month: thisMonth }).eq('id', r.id);
      await audit('recurring_posted', 'recurring', r.id, `${r.name}: ${formatMoney(r.amount, r.currency)} for ${monthLabel(thisMonth)}`);
    }
    await load();
    return due.length;
  }

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const projectName = (id: string | null) => data?.projects.find((p) => p.id === id)?.name ?? '-';
  const expList = calc ? calc.exp.filter((e) => catFilter === 'all' || e.category === catFilter) : [];
  const pages = Math.max(1, Math.ceil(expList.length / PAGE_SIZE));
  const pg = Math.min(page, pages);
  const needsSetup = !!data && (!data.expensesReady || !data.v2Ready);

  return (
    <>
      <TopbarActions>{null}</TopbarActions>
      <main className="content ac-page">
        <div className="ac-head">
          <div className="ac-text">
            <h1 className="ac-title">Accounts</h1>
            <p className="ac-sub">Income, receivables, expenses, profitability and reports in {BASE}. Owners and admins only.</p>
          </div>
          {data?.isAdmin && (
            <div className="ac-actions">
              <button type="button" className="ac-btn" onClick={() => void load()}><Icon name="reload" size={14} /> Reload</button>
              <button type="button" className="ac-primary" onClick={() => { setFormError(null); setShowAdd(true); }} disabled={!data.expensesReady}><Icon name="plus" size={14} /> Add expense</button>
            </div>
          )}
        </div>

        {!data || !calc ? (
          <p className="ac-empty">Loading…</p>
        ) : !data.isAdmin ? (
          <div className="ac-card"><div className="ac-card-body"><p className="ac-empty">Only owners and admins can see the accounts.</p></div></div>
        ) : (
          <>
            {data.error && <div className="ac-error">{data.error}</div>}
            {needsSetup && (
              <div className="ac-card ac-setup">
                <div className="ac-card-head"><h2>One-time setup: the accounts tables</h2></div>
                <div className="ac-card-body">
                  <p className="ac-note">Run this once in the Supabase SQL editor, then reload this page. It is safe to run again. Income and receivables already work without it.</p>
                  <pre className="ac-sql">{ACCOUNTS_SQL}</pre>
                  <button type="button" className="ac-btn" onClick={() => { void navigator.clipboard?.writeText(ACCOUNTS_SQL); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy SQL'}</button>
                </div>
              </div>
            )}

            <div className="ac-kpis">
              <div className="ac-kpi"><span className="ac-kpi-label pos"><Icon name="in" size={16} />Received this month</span><b className="tabular">{money(calc.receivedMonth)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label"><Icon name="clock" size={16} />Outstanding</span><b className="tabular">{money(calc.outstanding)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label bad"><Icon name="alert" size={16} />Overdue{calc.overdue.length > 0 ? ` (${calc.overdue.length})` : ''}</span><b className={`tabular${calc.overdueTotal > 0 ? ' red' : ''}`}>{money(calc.overdueTotal)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label"><Icon name="out" size={16} />Expenses this month</span><b className="tabular">{money(calc.expensesMonth)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label pos"><Icon name="trend" size={16} />Profit this month</span><b className={`tabular${calc.profitMonth < 0 ? ' red' : ''}`}>{money(calc.profitMonth)}</b></div>
            </div>
            {calc.missing.size > 0 && tab !== 'settings' && <p className="ac-note ac-warn">No exchange rate for {[...calc.missing].join(', ')}: those amounts are left out. <button type="button" className="ac-link ac-linkbtn" onClick={() => setTab('settings')}>Add the rate</button></p>}

            <div className="ac-tabs" role="tablist">
              {TABS.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => { setTab(t.key); setPage(1); }}>{t.label}</button>)}
            </div>

            {tab === 'overview' && (
              <>
                <div className="ac-pair">
                  <section className="ac-card">
                    <div className="ac-card-head"><h2>Last 6 months</h2></div>
                    <div className="ac-scroll">
                      <table className="ac-table">
                        <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Profit</th></tr></thead>
                        <tbody>
                          {[...calc.trend].reverse().map((m) => (
                            <tr key={m.month}><td>{monthLabel(m.month)}</td><td className="tabular">{money(m.income)}</td><td className="tabular">{money(m.expenses)}</td><td className={`tabular ac-strong${m.profit < 0 ? ' red' : ''}`}>{money(m.profit)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="ac-card">
                    <div className="ac-card-head"><h2>Expenses by category</h2><span className="ac-count">{monthLabel(thisMonth)}</span></div>
                    <div className="ac-card-body">
                      {calc.catThisMonth.length === 0 ? (
                        <p className="ac-empty">No expenses recorded this month.</p>
                      ) : (
                        <ul className="ac-bars">
                          {calc.catThisMonth.map((c) => (
                            <li key={c.category}><span>{c.category}</span><span className="ac-bar"><i style={{ width: `${(c.amount / calc.expensesMonth) * 100}%` }} /></span><b className="tabular">{money(c.amount)}</b></li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </div>
                <section className="ac-card" style={{ marginTop: 14 }}>
                  <div className="ac-card-head"><h2>Budget vs spent</h2><span className="ac-count">{monthLabel(thisMonth)}</span><button type="button" className="ac-link ac-linkbtn ac-right" onClick={() => setTab('settings')}>Set budgets</button></div>
                  <div className="ac-card-body">
                    {calc.budgetRows.length === 0 ? (
                      <p className="ac-empty">No budgets yet. Set a monthly limit per category in Settings.</p>
                    ) : (
                      <ul className="ac-bars ac-budget-bars">
                        {calc.budgetRows.map((b) => (
                          <li key={b.category} className={b.pct >= 100 ? 'over' : b.pct >= 80 ? 'warn' : ''}><span>{b.category}</span><span className="ac-bar"><i style={{ width: `${Math.min(100, b.pct)}%` }} /></span><b className="tabular">{money(b.spent)} / {money(b.budget)} · {b.pct}%</b></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </>
            )}

            {tab === 'receivables' && (
              <>
                <div className="ac-aging">
                  {calc.aging.map((a) => (
                    <div className={`ac-age ${a.key}`} key={a.key}><span>{a.label}</span><b className="tabular">{money(a.rows.reduce((n, r) => n + r.base, 0))}</b><em>{a.rows.length} invoice{a.rows.length === 1 ? '' : 's'}</em></div>
                  ))}
                </div>
                <section className="ac-card">
                  <div className="ac-card-head">
                    <h2>Unpaid invoices</h2><span className="ac-count tabular">{calc.openRows.length}</span>
                    <button type="button" className="ac-btn ac-right" onClick={() => downloadCsv(`receivables-${today}.csv`, [['Invoice', 'Client', 'Project', 'Description', 'Due', 'Status', 'Currency', 'Amount'], ...calc.openRows.map((i) => [i.request_number ?? '', one(i.clients)?.company_name ?? '', one(i.projects)?.name ?? '', i.description ?? i.payment_type, i.due_date ?? '', i.status, i.currency, i.amount])])}><Icon name="export" size={14} /> CSV</button>
                  </div>
                  <div className="ac-scroll">
                    <table className="ac-table">
                      <thead><tr><th>Invoice</th><th>Client</th><th>Project</th><th>Due</th><th>Status</th><th className="ac-r">Amount</th></tr></thead>
                      <tbody>
                        {calc.openRows.map((i) => {
                          const late = i.status === 'pending' && i.due_date && i.due_date < today ? daysBetween(today, i.due_date) : 0;
                          return (
                            <tr key={i.id}>
                              <td><Link href={`/projects/${i.project_id}/payments`} className="ac-link">{i.request_number ?? '-'}</Link></td>
                              <td>{one(i.clients)?.company_name ?? '-'}</td>
                              <td>{one(i.projects)?.name ?? '-'}</td>
                              <td>{i.due_date ? formatDateLong(i.due_date) : '-'}</td>
                              <td><span className={`ac-status${late ? ' late' : ''}`}>{i.status === 'processing' ? 'Awaiting check' : late ? `${late} day${late === 1 ? '' : 's'} late` : 'Pending'}</span></td>
                              <td className="ac-r tabular ac-strong">{formatMoney(i.amount, i.currency)}</td>
                            </tr>
                          );
                        })}
                        {calc.openRows.length === 0 && <tr><td colSpan={6} className="ac-empty-cell">Nothing is waiting to be paid.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {tab === 'expenses' && (
              <section className="ac-card">
                <div className="ac-card-head">
                  <h2>Expenses</h2><span className="ac-count tabular">{expList.length}</span>
                  <div className="ac-right ac-inline">
                    <select className="ac-select" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} aria-label="Category">
                      <option value="all">All categories</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" className="ac-btn" onClick={() => downloadCsv(`expenses-${today}.csv`, [['Date', 'Category', 'Vendor', 'Description', 'Project', 'Currency', 'Amount', `Amount in ${BASE}`], ...expList.map((e) => [e.expense_date, e.category, e.vendor ?? '', e.description ?? '', projectName(e.project_id), e.currency, e.amount, Math.round(e.base * 100) / 100])])}><Icon name="export" size={14} /> CSV</button>
                  </div>
                </div>
                <div className="ac-scroll">
                  <table className="ac-table">
                    <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Project</th><th className="ac-r">Amount</th><th /></tr></thead>
                    <tbody>
                      {expList.slice((pg - 1) * PAGE_SIZE, pg * PAGE_SIZE).map((e) => (
                        <tr key={e.id}>
                          <td>{formatDateLong(e.expense_date)}</td>
                          <td>{e.category}</td>
                          <td>{e.vendor ?? '-'}{e.description && <em className="ac-sub-line">{e.description}</em>}</td>
                          <td>{projectName(e.project_id)}</td>
                          <td className="ac-r tabular ac-strong">{formatMoney(e.amount, e.currency)}{e.currency !== BASE && <em className="ac-sub-line">≈ {money(e.base)}</em>}</td>
                          <td className="ac-r">
                            {e.receipt_url && <a className="ac-link" href={e.receipt_url} target="_blank" rel="noopener noreferrer">Receipt</a>}
                            <button type="button" className="ac-ico" aria-label="Delete expense" onClick={() => void removeExpense(e.id, `${e.category}: ${formatMoney(e.amount, e.currency)}`)}><Icon name="trash" size={14} /></button>
                          </td>
                        </tr>
                      ))}
                      {expList.length === 0 && <tr><td colSpan={6} className="ac-empty-cell">{data.expensesReady ? 'No expenses yet. Add the first one.' : 'Create the accounts tables first (see the setup box above).'}</td></tr>}
                    </tbody>
                  </table>
                </div>
                {pages > 1 && (
                  <div className="ac-pager">
                    <span className="tabular">{(pg - 1) * PAGE_SIZE + 1}-{Math.min(pg * PAGE_SIZE, expList.length)} of {expList.length}</span>
                    <div><button type="button" disabled={pg === 1} onClick={() => setPage(pg - 1)}>Previous</button><button type="button" disabled={pg === pages} onClick={() => setPage(pg + 1)}>Next</button></div>
                  </div>
                )}
              </section>
            )}

            {tab === 'distribution' && <DistributionTab calc={calc} today={today} audit={audit} />}
            {tab === 'payroll' && <PayrollTab rates={data.rates} today={today} audit={audit} userId={user?.id ?? null} onChanged={load} />}
            {tab === 'profit' && <ProfitabilityTab calc={calc} />}
            {tab === 'reports' && <ReportsTab calc={calc} today={today} />}
            {tab === 'settings' && (
              <SettingsTab data={data} missing={[...calc.missing]} thisMonth={thisMonth} onSaveRate={saveRate} onDeleteRate={deleteRate} onSaveBudgets={saveBudgets} onAddRecurring={addRecurring} onToggleRecurring={toggleRecurring} onDeleteRecurring={deleteRecurring} onPostRecurring={postRecurring} />
            )}
            {tab === 'audit' && (
              <section className="ac-card">
                <div className="ac-card-head"><h2>Audit log</h2><span className="ac-count tabular">{data.audit.length}</span></div>
                <div className="ac-scroll">
                  <table className="ac-table">
                    <thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
                    <tbody>
                      {data.audit.map((a) => (
                        <tr key={a.id}>
                          <td className="ac-nowrap">{new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                          <td className="ac-strong">{a.action.replace(/_/g, ' ')}</td>
                          <td>{a.detail || '-'}</td>
                        </tr>
                      ))}
                      {data.audit.length === 0 && <tr><td colSpan={3} className="ac-empty-cell">{data.v2Ready ? 'Nothing logged yet. Every change you make here is recorded.' : 'Create the accounts tables first (see the setup box above).'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {showAdd && data && (
        <div className="ac-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="ac-modal" role="dialog" aria-modal="true" aria-label="Add expense">
            <div className="ac-modal-head"><h2>Add expense</h2><button type="button" className="ac-ico ac-ico-plain" aria-label="Close" onClick={() => setShowAdd(false)}><Icon name="close" size={16} /></button></div>
            <div className="ac-modal-body">
              <div className="ac-grid2">
                <label>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
                <label>Amount<div className="ac-amt"><input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" autoFocus /><select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} aria-label="Currency">{CURRENCY_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div></label>
                <label>Category<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                <label>Vendor<input type="text" value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="e.g. Figma, Namecheap" /></label>
              </div>
              <label>What was it for<input type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Short note" /></label>
              <div className="ac-grid2">
                <label>Project (optional)<select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}><option value="">Overhead, no project</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label>Receipt link (optional)<input type="url" value={f.receipt} onChange={(e) => setF({ ...f, receipt: e.target.value })} placeholder="https://..." /></label>
              </div>
              {f.currency !== BASE && !data.rates.some((r) => r.currency === f.currency) && <p className="ac-error-inline">No {f.currency} exchange rate yet: add one in Settings, or this expense will not count in the totals.</p>}
              {formError && <p className="ac-error-inline">{formError}</p>}
            </div>
            <div className="ac-modal-foot">
              <button type="button" className="ac-btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="button" className="ac-primary" onClick={() => void saveExpense()} disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
