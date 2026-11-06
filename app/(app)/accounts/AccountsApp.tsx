'use client';

// Accounts: the agency's money in one place (owners / admins only).
//  Two pages share this component: /accounts (admin: can approve) and /accountant (the accountant edits, everyone else views).
//  Overview · Receivables · Expenses · Payroll · Profitability · Settings (exchange rates, budgets, recurring)
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
import { ACCOUNTS_SQL, BASE, CATEGORIES, CURRENCY_CHOICES, buildCalc, daysBetween, fetchAccounts, monthLabel, one, waitingCount, type AccountsData, type Recurring } from '@/lib/accountsCore';
import SignInScreen from '@/app/components/SignInScreen';
import { TopbarActions } from '@/app/components/appShellContext';
import ProfitabilityTab from './ProfitabilityTab';
import SettingsTab from './SettingsTab';
import ApprovalsTab, { type DecideKind } from './ApprovalsTab';
import AccountantCard from './AccountantCard';
import OverviewCharts from './OverviewCharts';
import { Columns, Donut, OTHER, RankColumns, SLOT, VizCard, VizRow } from './viz';
import PayrollTab from './PayrollTab';
import StatementPreview, { type StatementDoc } from './StatementPreview';
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
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  trend: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
};
function Icon({ name, size = 16 }: { name: keyof typeof ICON_PATHS; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'distribution', label: 'Distribution' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'profit', label: 'Profitability' },
  { key: 'settings', label: 'Settings' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const PAGE_SIZE = 8;
const emptyForm = () => ({ date: todayISO(), amount: '', currency: BASE, category: CATEGORIES[0], vendor: '', description: '', projectId: '', receipt: '' });

export default function AccountsApp({ variant }: { variant: 'admin' | 'desk' }) {
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
  const [preview, setPreview] = useState<StatementDoc | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tell = (m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice(null), 3200);
  };

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

  // /accounts is for admins (the accountant and the team have /accountant); /accountant is for the whole team
  useEffect(() => {
    if (!data) return;
    if (variant === 'admin' && !data.isAdmin) router.replace(data.member ? '/accountant' : '/dashboard');
    if (variant === 'desk' && !data.member) router.replace('/dashboard');
  }, [data, router, variant]);

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
    if (!data?.isAdmin) tell('Sent to the admin for approval.');
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

  const TABLE_OF: Record<DecideKind, string> = { expense: 'expenses', slip: 'payslips', ledger: 'fund_ledger', staff: 'staff_salaries', round: 'pay_rounds' };
  // a pay round's team salaries and fund deposits follow the round's decision
  async function followRound(id: string, approval: string) {
    await supabase.from('expenses').update({ approval }).eq('round_id', id);
    await supabase.from('fund_ledger').update({ approval }).eq('round_id', id);
  }
  async function decide(kind: DecideKind, id: string, ok: boolean, label: string, expenseId?: string | null) {
    const approval = ok ? 'approved' : 'rejected';
    const { error } = await supabase.from(TABLE_OF[kind]).update({ approval }).eq('id', id);
    if (error) return tell(error.message);
    if (kind === 'slip' && expenseId) await supabase.from('expenses').update({ approval }).eq('id', expenseId);
    if (kind === 'round') await followRound(id, approval);
    await audit(ok ? 'approved' : 'rejected', kind, id, label);
    await load();
  }
  async function approveAll() {
    if (!data) return;
    const p = data.pending;
    const todo: [DecideKind, string, string, string | null][] = [
      ...p.expenses.filter((x) => x.approval === 'pending').map((x): [DecideKind, string, string, string | null] => ['expense', x.id, `${x.category}: ${formatMoney(x.amount, x.currency)}`, null]),
      ...p.slips.filter((x) => x.approval === 'pending').map((x): [DecideKind, string, string, string | null] => ['slip', x.id, `Payslip ${monthLabel(x.month)}`, x.expense_id]),
      ...p.ledger.filter((x) => x.approval === 'pending').map((x): [DecideKind, string, string, string | null] => ['ledger', x.id, `${x.fund} ${x.kind}: ${formatMoney(Number(x.amount), BASE)}`, null]),
      ...p.staff.filter((x) => x.approval === 'pending').map((x): [DecideKind, string, string, string | null] => ['staff', x.id, `Salary: ${x.name}`, null]),
      ...p.rounds.filter((x) => x.approval === 'pending').map((x): [DecideKind, string, string, string | null] => ['round', x.id, `Pay round #${x.round_no}`, null]),
    ];
    if (todo.length === 0 || !window.confirm(`Approve all ${todo.length} waiting item${todo.length === 1 ? '' : 's'}?`)) return;
    for (const [k, id, label, exp] of todo) {
      await supabase.from(TABLE_OF[k]).update({ approval: 'approved' }).eq('id', id);
      if (k === 'slip' && exp) await supabase.from('expenses').update({ approval: 'approved' }).eq('id', exp);
      if (k === 'round') await followRound(id, 'approved');
      await audit('approved', k, id, label);
    }
    tell(`${todo.length} approved.`);
    await load();
  }

  // the top few names with the biggest totals, for the ranked bars
  const topSum = (rows: { k: string; v: number }[], n = 6) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.k, (m.get(r.k) ?? 0) + r.v));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
  };

  if (sessionLoading) return null;
  if (!user) return <SignInScreen />;

  const projectName = (id: string | null) => data?.projects.find((p) => p.id === id)?.name ?? '-';
  const expList = calc ? calc.exp.filter((e) => catFilter === 'all' || e.category === catFilter) : [];
  // everything we have now: all the money ever received minus all the (approved) expenses
  const totalNow = calc ? calc.received.reduce((n, r) => n + r.base, 0) - calc.exp.reduce((n, e) => n + e.base, 0) : 0;
  const monthKeys = calc ? calc.trend.map((m) => m.month) : [];
  // the five biggest categories get their own colour, the rest are grouped as Other
  const catTotals = new Map<string, number>();
  expList.forEach((e) => catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + e.base));
  const ranked = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const stackedCats = ranked.length > 5 ? [...ranked.slice(0, 5), 'Other'] : ranked;
  const pages = Math.max(1, Math.ceil(expList.length / PAGE_SIZE));
  const pg = Math.min(page, pages);
  const needsSetup = !!data && (!data.expensesReady || !data.v2Ready);
  const waiting = data ? waitingCount(data.pending) : 0;
  const tabs = TABS.filter((t) => t.key !== 'approvals' || variant === 'admin');
  const canEdit = !!data?.canEdit;
  const showViz = variant === 'admin'; // the accountant's page is figures only, no charts

  return (
    <>
      <TopbarActions>{null}</TopbarActions>
      <main className="content ac-page">
        <div className="ac-head">
          <div className="ac-text">
            <h1 className="ac-title">{variant === 'admin' ? 'Accounts' : 'Accountant'}</h1>
            <p className="ac-sub">{variant === 'admin' ? `Income, receivables, expenses, payroll and reports in ${BASE}. Admins only. Approve what the accountant adds.` : `The agency's money in ${BASE}. The accountant keeps it up to date and the admin approves it. Everyone on the team can view it.`}</p>
          </div>
          {data?.canEdit && (
            <div className="ac-actions">
              <button type="button" className="ac-btn" onClick={() => void load()}><Icon name="reload" size={14} /> Reload</button>
              <button type="button" className="ac-primary" onClick={() => { setFormError(null); setShowAdd(true); }} disabled={!data.expensesReady}><Icon name="plus" size={14} /> Add expense</button>
            </div>
          )}
        </div>

        {!data || !calc ? (
          <p className="ac-empty">Loading…</p>
        ) : (variant === 'admin' ? !data.isAdmin : !data.member) ? (
          <div className="ac-card"><div className="ac-card-body"><p className="ac-empty">You do not have access to this page.</p></div></div>
        ) : (
          <>
            {data.error && <div className="ac-error">{data.error}</div>}
            {needsSetup && !data.isAdmin && <div className="ac-error">The accounts setup is not finished yet. Ask an admin to run the accounts SQL.</div>}
            {needsSetup && data.isAdmin && (
              <div className="ac-card ac-setup">
                <div className="ac-card-head"><h2>One-time setup: the accounts tables</h2></div>
                <div className="ac-card-body">
                  <p className="ac-note">Run this once in the Supabase SQL editor, then reload this page. It is safe to run again. Income and receivables already work without it.</p>
                  <pre className="ac-sql">{ACCOUNTS_SQL}</pre>
                  <button type="button" className="ac-btn" onClick={() => { void navigator.clipboard?.writeText(ACCOUNTS_SQL); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy SQL'}</button>
                </div>
              </div>
            )}

            <div className="ac-kpis ac-kpis-6">
              <div className="ac-kpi"><span className="ac-kpi-label pos"><Icon name="wallet" size={16} />Total money now</span><b className={`tabular${totalNow < 0 ? ' red' : ''}`}>{money(totalNow)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label pos"><Icon name="in" size={16} />Received this month</span><b className="tabular">{money(calc.receivedMonth)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label"><Icon name="clock" size={16} />Outstanding</span><b className="tabular">{money(calc.outstanding)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label bad"><Icon name="alert" size={16} />Overdue{calc.overdue.length > 0 ? ` (${calc.overdue.length})` : ''}</span><b className={`tabular${calc.overdueTotal > 0 ? ' red' : ''}`}>{money(calc.overdueTotal)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label"><Icon name="out" size={16} />Expenses this month</span><b className="tabular">{money(calc.expensesMonth)}</b></div>
              <div className="ac-kpi"><span className="ac-kpi-label pos"><Icon name="trend" size={16} />Profit this month</span><b className={`tabular${calc.profitMonth < 0 ? ' red' : ''}`}>{money(calc.profitMonth)}</b></div>
            </div>
            {calc.missing.size > 0 && tab !== 'settings' && <p className="ac-note ac-warn">No exchange rate for {[...calc.missing].join(', ')}: those amounts are left out. <button type="button" className="ac-link ac-linkbtn" onClick={() => setTab('settings')}>Add the rate</button></p>}

            {!data.canEdit && <p className="ac-note ac-viewonly">View only. You can see everything here. Only the admin and the accountant can make changes.</p>}
            {data.isAccountant && !data.isAdmin && <p className="ac-note ac-viewonly">Everything you add or change is sent to the admin and counts in the totals once it is approved.{waiting > 0 ? ` ${waiting} item${waiting === 1 ? ' is' : 's are'} waiting now.` : ''}</p>}
            {variant === 'admin' && waiting > 0 && tab !== 'approvals' && <p className="ac-note ac-warn">{waiting} item{waiting === 1 ? ' is' : 's are'} waiting for your approval. <button type="button" className="ac-link ac-linkbtn" onClick={() => setTab('approvals')}>Review</button></p>}

            <div className="ac-tabs" role="tablist">
              {tabs.map((t) => <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => { setTab(t.key); setPage(1); }}>{t.key === 'approvals' && waiting > 0 ? `Approvals (${waiting})` : t.label}</button>)}
            </div>

            {tab === 'overview' && (
              <>
                {showViz && <OverviewCharts calc={calc} />}
                <div className="ac-pair">
                  <section className="ac-card">
                    <div className="ac-card-head"><h2>Last 6 months</h2><button type="button" className="ac-btn ac-right" onClick={() => setPreview({
                      title: 'Accounts overview',
                      period: monthLabel(thisMonth),
                      note: `Generated ${formatDateLong(today)} · amounts in ${BASE}`,
                      summary: [['Received this month', money(calc.receivedMonth)], ['Outstanding', money(calc.outstanding)], ['Overdue', money(calc.overdueTotal)], ['Expenses this month', money(calc.expensesMonth)], ['Profit this month', money(calc.profitMonth)]],
                      sections: [
                        { heading: 'Last 6 months', columns: [{ label: 'Month' }, { label: 'Income', right: true }, { label: 'Expenses', right: true }, { label: 'Profit', right: true }], rows: [...calc.trend].reverse().map((m) => [monthLabel(m.month), money(m.income), money(m.expenses), money(m.profit)]) },
                        { heading: `Expenses by category · ${monthLabel(thisMonth)}`, columns: [{ label: 'Category' }, { label: 'Amount', right: true }], rows: calc.catThisMonth.map((c) => [c.category, money(c.amount)]), total: ['Total', money(calc.expensesMonth)], empty: 'No expenses recorded this month.' },
                        { heading: `Budget vs spent · ${monthLabel(thisMonth)}`, columns: [{ label: 'Category' }, { label: 'Spent', right: true }, { label: 'Budget', right: true }, { label: 'Used', right: true }], rows: calc.budgetRows.map((b) => [b.category, money(b.spent), money(b.budget), `${b.pct}%`]), empty: 'No budgets set.' },
                      ],
                      filename: `accounts-overview-${thisMonth}`,
                    })}>Preview PDF</button></div>
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
                {showViz && (
<VizRow>
                  <VizCard title="Unpaid by age" sub="How late the unpaid invoices are">
                    <Columns labels={['Not due', '1-7 days', '8-30 days', '30+ days']} tipTitles={calc.aging.map((a) => a.label)} series={[{ name: 'Unpaid', color: SLOT[0], values: calc.aging.map((a) => a.rows.reduce((n, r) => n + r.base, 0)) }]} fmt={money} ariaLabel="Unpaid invoices grouped by how late they are" />
                  </VizCard>
                  <VizCard title="Unpaid by client" sub="The clients who owe the most">
                    <Donut items={topSum(calc.openRows.map((i) => ({ k: one(i.clients)?.company_name ?? 'Unknown', v: i.base })), 7)} fmt={money} empty="Nothing is waiting to be paid." />
                  </VizCard>
                </VizRow>
)}
                <div className="ac-aging">
                  {calc.aging.map((a) => (
                    <div className={`ac-age ${a.key}`} key={a.key}><span>{a.label}</span><b className="tabular">{money(a.rows.reduce((n, r) => n + r.base, 0))}</b><em>{a.rows.length} invoice{a.rows.length === 1 ? '' : 's'}</em></div>
                  ))}
                </div>
                <section className="ac-card">
                  <div className="ac-card-head">
                    <h2>Unpaid invoices</h2><span className="ac-count tabular">{calc.openRows.length}</span>
                    <button type="button" className="ac-btn ac-right" onClick={() => setPreview({
                      title: 'Unpaid invoices',
                      period: formatDateLong(today),
                      note: `Everything still waiting to be paid · totals in ${BASE}`,
                      summary: [['Outstanding', money(calc.outstanding)], ['Overdue', money(calc.overdueTotal)], ['Invoices', String(calc.openRows.length)]],
                      sections: [{ heading: 'Unpaid invoices', columns: [{ label: 'Invoice' }, { label: 'Client' }, { label: 'Project' }, { label: 'Due' }, { label: 'Status' }, { label: 'Amount', right: true }], rows: calc.openRows.map((i) => [i.request_number ?? '-', one(i.clients)?.company_name ?? '-', one(i.projects)?.name ?? '-', i.due_date ? formatDateLong(i.due_date) : '-', i.status === 'processing' ? 'Awaiting check' : i.due_date && i.due_date < today ? `${daysBetween(today, i.due_date)} days late` : 'Pending', formatMoney(i.amount, i.currency)]), total: ['', '', '', '', `Outstanding (${BASE})`, money(calc.outstanding)], empty: 'Nothing is waiting to be paid.' }],
                      filename: `receivables-${today}`,
                    })}>Preview PDF</button>
                    <button type="button" className="ac-btn" onClick={() => downloadCsv(`receivables-${today}.csv`, [['Invoice', 'Client', 'Project', 'Description', 'Due', 'Status', 'Currency', 'Amount'], ...calc.openRows.map((i) => [i.request_number ?? '', one(i.clients)?.company_name ?? '', one(i.projects)?.name ?? '', i.description ?? i.payment_type, i.due_date ?? '', i.status, i.currency, i.amount])])}><Icon name="export" size={14} /> CSV</button>
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
              <>
              {showViz && (
<VizRow>
                <VizCard
                  title="Spending by month"
                  sub="Last 6 months, split by category"
                  legend={stackedCats.map((c, k) => ({ color: c === 'Other' ? OTHER : SLOT[k], label: c }))}
                >
                  <Columns stacked labels={monthKeys.map((m) => monthLabel(m).split(' ')[0])} tipTitles={monthKeys.map((m) => monthLabel(m))} series={stackedCats.map((c, k) => ({ name: c, color: c === 'Other' ? OTHER : SLOT[k], values: monthKeys.map((m) => expList.filter((e) => e.expense_date.slice(0, 7) === m && (c === 'Other' ? !stackedCats.includes(e.category) : e.category === c)).reduce((n, e) => n + e.base, 0)) }))} fmt={money} ariaLabel="Expenses for the last 6 months, stacked by category" />
                </VizCard>
                <VizCard title="Top vendors" sub="Who the money goes to">
                  <Donut items={topSum(expList.map((e) => ({ k: e.vendor || 'No vendor', v: e.base })), 7)} fmt={money} empty="No expenses yet." />
                </VizCard>
              </VizRow>
)}
              <section className="ac-card">
                <div className="ac-card-head">
                  <h2>Expenses</h2><span className="ac-count tabular">{expList.length}</span>
                  <div className="ac-right ac-inline">
                    <select className="ac-select" value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} aria-label="Category">
                      <option value="all">All categories</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="button" className="ac-btn" onClick={() => setPreview({
                      title: 'Expenses',
                      period: catFilter === 'all' ? 'All categories' : catFilter,
                      note: `Generated ${formatDateLong(today)} · totals in ${BASE}`,
                      summary: [['Entries', String(expList.length)], ['Total', money(expList.reduce((n, e) => n + e.base, 0))]],
                      sections: [{ heading: 'Expense list', columns: [{ label: 'Date' }, { label: 'Category' }, { label: 'Vendor' }, { label: 'Project' }, { label: 'Amount', right: true }, { label: BASE, right: true }], rows: expList.map((e) => [formatDateLong(e.expense_date), e.category, (e.vendor ?? '-') + (e.description ? ` · ${e.description}` : ''), projectName(e.project_id), formatMoney(e.amount, e.currency), money(e.base)]), total: ['', '', '', '', 'Total', money(expList.reduce((n, e) => n + e.base, 0))], empty: 'No expenses.' }],
                      filename: `expenses-${today}`,
                    })}>Preview PDF</button>
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
                            {canEdit && data.isAdmin && <button type="button" className="ac-ico" aria-label="Delete expense" onClick={() => void removeExpense(e.id, `${e.category}: ${formatMoney(e.amount, e.currency)}`)}><Icon name="trash" size={14} /></button>}
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
              </>
            )}

            {tab === 'expenses' && data.pending.expenses.length > 0 && (
              <section className="ac-card" style={{ marginTop: 14 }}>
                <div className="ac-card-head"><h2>Waiting for the admin</h2><span className="ac-count tabular">{data.pending.expenses.length}</span></div>
                <div className="ac-scroll">
                  <table className="ac-table">
                    <thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th className="ac-r">Amount</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {data.pending.expenses.map((e) => (
                        <tr key={e.id}>
                          <td>{formatDateLong(e.expense_date)}</td>
                          <td>{e.category}</td>
                          <td>{e.vendor ?? '-'}{e.description && <em className="ac-sub-line">{e.description}</em>}</td>
                          <td className="ac-r tabular ac-strong">{formatMoney(e.amount, e.currency)}</td>
                          <td><span className={`ac-status${e.approval === 'rejected' ? ' late' : ''}`}>{e.approval === 'rejected' ? 'Rejected' : 'Awaiting approval'}</span></td>
                          <td className="ac-r">{canEdit && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void removeExpense(e.id, `${e.category}: ${formatMoney(e.amount, e.currency)}`)}>Delete</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ac-note" style={{ padding: '0 18px 14px' }}>These are not in the totals yet.</p>
              </section>
            )}

            {tab === 'approvals' && variant === 'admin' && <ApprovalsTab pending={data.pending} onDecide={decide} onApproveAll={approveAll} />}
            <StatementPreview doc={preview} onClose={() => setPreview(null)} />
            {tab === 'distribution' && <DistributionTab calc={calc} today={today} audit={audit} canEdit={canEdit} isAdmin={data.isAdmin} userId={user?.id ?? null} onChanged={load} visuals={showViz} />}
            {tab === 'payroll' && <PayrollTab rates={data.rates} today={today} audit={audit} userId={user?.id ?? null} onChanged={load} canEdit={canEdit} isAdmin={data.isAdmin} visuals={showViz} />}
            {tab === 'profit' && <ProfitabilityTab calc={calc} visuals={showViz} />}
            {tab === 'settings' && (
              <SettingsTab data={data} missing={[...calc.missing]} thisMonth={thisMonth} readOnly={!canEdit} accountant={variant === 'admin' && data.isAdmin ? <AccountantCard audit={audit} onChanged={load} /> : undefined} budgetChart={showViz && calc.budgetRows.length > 0 ? (
                  <VizCard title="Budget used this month" sub={`${monthLabel(thisMonth)} · amber from 80%, red over 100%`}>
                    <RankColumns ariaLabel="Share of each monthly budget used so far" fmt={(n) => `${n}%`} tickFmt={(n) => `${n}%`} items={calc.budgetRows.map((bd) => ({ label: bd.category, value: bd.pct, note: `${money(bd.spent)} of ${money(bd.budget)}`, color: bd.pct >= 100 ? 'var(--viz-neg)' : bd.pct >= 80 ? 'var(--viz-2)' : 'var(--viz-1)' }))} />
                  </VizCard>
                ) : undefined} onSaveRate={saveRate} onDeleteRate={deleteRate} onSaveBudgets={saveBudgets} onAddRecurring={addRecurring} onToggleRecurring={toggleRecurring} onDeleteRecurring={deleteRecurring} onPostRecurring={postRecurring} />
            )}
          </>
        )}
      </main>

      {notice && <div className="ac-toast">{notice}</div>}
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
