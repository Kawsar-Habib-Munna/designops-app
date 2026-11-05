// Accounts: shared types, constants, the data fetch and all the calculations behind the /accounts page.
// Everything is converted to one base currency (BASE) with the exchange rates saved in the fx_rates table.
import { supabase } from '@/lib/supabaseClient';

export const BASE = 'BDT';
export const CATEGORIES = ['Software & tools', 'Hosting & domains', 'Freelancers', 'Salaries', 'Equipment', 'Marketing', 'Office & rent', 'Taxes & fees', 'Other'];
export const CURRENCY_CHOICES = ['BDT', 'USD', 'EUR', 'GBP', 'AED', 'INR', 'SGD', 'CAD', 'AUD', 'SAR', 'MYR', 'JPY'];

export type InvoiceRow = {
  id: string;
  request_number: string | null;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  description: string | null;
  payment_type: string;
  project_id: string;
  projects: { name: string } | { name: string }[] | null;
  clients: { company_name: string; primary_contact: string | null } | { company_name: string; primary_contact: string | null }[] | null;
};
export type PaymentRow = { id: string; invoice_id: string; amount: number | null; payment_date: string | null; confirmed_at: string | null };
export type ExpenseRow = { id: string; expense_date: string; amount: number; currency: string; category: string; vendor: string | null; description: string | null; project_id: string | null; receipt_url: string | null };
export type ProjectOpt = { id: string; name: string };
export type FxRate = { currency: string; rate_to_base: number };
export type Budget = { id: string; category: string; monthly_amount: number };
export type Recurring = { id: string; name: string; category: string; vendor: string | null; amount: number; currency: string; project_id: string | null; day_of_month: number; active: boolean; last_posted_month: string | null };
export type AuditRow = { id: string; at: string; action: string; entity: string | null; detail: string | null };

export type AccountsData = {
  isAdmin: boolean;
  error: string | null;
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  projects: ProjectOpt[];
  rates: FxRate[];
  budgets: Budget[];
  recurring: Recurring[];
  audit: AuditRow[];
  expensesReady: boolean; // the expenses table exists
  v2Ready: boolean; // fx_rates, budgets, recurring_expenses and accounts_audit exist
};

export const ACCOUNTS_SQL = `-- Accounts: run once in the Supabase SQL editor (the tables are for admins only)
create or replace function public.accounts_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  expense_date date not null default current_date,
  amount numeric not null check (amount >= 0),
  currency text not null default 'BDT',
  category text not null,
  vendor text,
  description text,
  project_id uuid references projects(id) on delete set null,
  receipt_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create table if not exists fx_rates (
  currency text primary key,
  rate_to_base numeric not null check (rate_to_base > 0),
  updated_at timestamptz default now()
);
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  category text not null unique,
  monthly_amount numeric not null check (monthly_amount >= 0)
);
create table if not exists recurring_expenses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text not null,
  vendor text,
  amount numeric not null check (amount >= 0),
  currency text not null default 'BDT',
  project_id uuid references projects(id) on delete set null,
  day_of_month int not null default 1 check (day_of_month between 1 and 28),
  active boolean not null default true,
  last_posted_month text,
  created_at timestamptz default now()
);
create table if not exists accounts_audit (
  id uuid default gen_random_uuid() primary key,
  at timestamptz default now(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text,
  entity_id text,
  detail text
);
alter table expenses enable row level security;
alter table fx_rates enable row level security;
alter table budgets enable row level security;
alter table recurring_expenses enable row level security;
alter table accounts_audit enable row level security;
drop policy if exists "team manages expenses" on expenses;
create policy "team manages expenses" on expenses for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
drop policy if exists "team manages fx_rates" on fx_rates;
create policy "team manages fx_rates" on fx_rates for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
drop policy if exists "team manages budgets" on budgets;
create policy "team manages budgets" on budgets for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
drop policy if exists "team manages recurring_expenses" on recurring_expenses;
create policy "team manages recurring_expenses" on recurring_expenses for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
drop policy if exists "team manages accounts_audit" on accounts_audit;
create policy "team manages accounts_audit" on accounts_audit for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
create table if not exists staff_salaries (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  role text,
  base_salary numeric not null default 0 check (base_salary >= 0),
  currency text not null default 'BDT',
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table staff_salaries add column if not exists profile_id uuid unique references profiles(id) on delete cascade;
create table if not exists payslips (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid not null references staff_salaries(id) on delete cascade,
  month text not null,
  base numeric not null default 0,
  bonus numeric not null default 0 check (bonus >= 0),
  deduction numeric not null default 0 check (deduction >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_on date,
  expense_id uuid,
  created_at timestamptz default now(),
  unique (staff_id, month)
);
alter table staff_salaries enable row level security;
alter table payslips enable row level security;
drop policy if exists "admins manage staff_salaries" on staff_salaries;
create policy "admins manage staff_salaries" on staff_salaries for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
drop policy if exists "admins manage payslips" on payslips;
create policy "admins manage payslips" on payslips for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());
create table if not exists fund_ledger (
  id uuid default gen_random_uuid() primary key,
  fund text not null check (fund in ('allah', 'agency')),
  entry_date date not null default current_date,
  month text,
  kind text not null check (kind in ('deposit', 'withdrawal')),
  source text not null default 'manual' check (source in ('distribution', 'manual')),
  amount numeric not null check (amount >= 0),
  note text,
  created_at timestamptz default now()
);
create unique index if not exists fund_ledger_one_share_per_month on fund_ledger (fund, month) where source = 'distribution';
alter table fund_ledger enable row level security;
drop policy if exists "admins manage fund_ledger" on fund_ledger;
create policy "admins manage fund_ledger" on fund_ledger for all using (public.accounts_is_admin()) with check (public.accounts_is_admin());`;

export const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
export const monthKey = (iso: string | null | undefined) => (iso ?? '').slice(0, 7);
export const monthLabel = (key: string) => new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
export const daysBetween = (a: string, b: string) => Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86400000);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const EMPTY: AccountsData = { isAdmin: false, error: null, invoices: [], payments: [], expenses: [], projects: [], rates: [], budgets: [], recurring: [], audit: [], expensesReady: true, v2Ready: true };

// Only admins get any financial data: the admin check runs first, and for everyone else no other query is sent.
export async function fetchAccounts(): Promise<AccountsData> {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return EMPTY;
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', me.user.id).maybeSingle();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) return EMPTY;
  const [inv, pay, exp, prj, fx, bud, rec, aud] = await Promise.all([
    supabase.from('invoices').select('id, request_number, amount, currency, status, due_date, description, payment_type, project_id, projects(name), clients(company_name, primary_contact)'),
    supabase.from('payments').select('id, invoice_id, amount, payment_date, confirmed_at'),
    supabase.from('expenses').select('id, expense_date, amount, currency, category, vendor, description, project_id, receipt_url').order('expense_date', { ascending: false }),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('fx_rates').select('currency, rate_to_base'),
    supabase.from('budgets').select('id, category, monthly_amount'),
    supabase.from('recurring_expenses').select('id, name, category, vendor, amount, currency, project_id, day_of_month, active, last_posted_month').order('created_at'),
    supabase.from('accounts_audit').select('id, at, action, entity, detail').order('at', { ascending: false }).limit(80),
  ]);
  return {
    isAdmin: true,
    error: inv.error?.message ?? pay.error?.message ?? null,
    invoices: (inv.data as unknown as InvoiceRow[]) ?? [],
    payments: (pay.data as PaymentRow[]) ?? [],
    expenses: (exp.data as ExpenseRow[]) ?? [],
    projects: (prj.data as ProjectOpt[]) ?? [],
    rates: (fx.data as FxRate[]) ?? [],
    budgets: (bud.data as Budget[]) ?? [],
    recurring: (rec.data as Recurring[]) ?? [],
    audit: (aud.data as AuditRow[]) ?? [],
    expensesReady: !exp.error,
    v2Ready: !fx.error && !bud.error && !rec.error && !aud.error,
  };
}

const sum = (rows: { base: number }[]) => rows.reduce((n, r) => n + r.base, 0);

export function buildCalc(data: AccountsData, today: string) {
  const rates = new Map(data.rates.map((r) => [r.currency, Number(r.rate_to_base)]));
  const missing = new Set<string>();
  const conv = (amount: number, cur: string) => {
    if (cur === BASE) return amount;
    const r = rates.get(cur);
    if (!r) {
      missing.add(cur);
      return 0;
    }
    return amount * r;
  };
  const thisMonth = today.slice(0, 7);
  const invById = new Map(data.invoices.map((i) => [i.id, i]));

  // money in: confirmed payments, in the base currency
  const received = data.payments
    .filter((p) => p.confirmed_at && invById.has(p.invoice_id))
    .map((p) => {
      const inv = invById.get(p.invoice_id) as InvoiceRow;
      const date = (p.payment_date ?? p.confirmed_at ?? '').slice(0, 10);
      return { date, month: date.slice(0, 7), base: conv(p.amount ?? inv.amount, inv.currency), projectId: inv.project_id, client: one(inv.clients)?.company_name ?? 'Unknown' };
    });
  // money out
  const exp = data.expenses.map((e) => ({ ...e, base: conv(e.amount, e.currency) }));
  // money still to come
  const open = data.invoices.filter((i) => ['pending', 'processing'].includes(i.status)).map((i) => ({ ...i, base: conv(i.amount, i.currency) }));
  const overdue = open.filter((i) => i.status === 'pending' && i.due_date && i.due_date < today);

  const d0 = new Date(today + 'T00:00:00');
  const months: string[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(d0.getFullYear(), d0.getMonth() - k, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const trend = months.map((m) => {
    const income = sum(received.filter((r) => r.month === m));
    const out = sum(exp.filter((e) => monthKey(e.expense_date) === m));
    return { month: m, income, expenses: out, profit: income - out };
  });
  const cur = trend[trend.length - 1];
  const catThisMonth = CATEGORIES.map((c) => ({ category: c, amount: sum(exp.filter((e) => e.category === c && monthKey(e.expense_date) === thisMonth)) })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);

  const aging = [
    { key: 'notdue', label: 'Not due yet', rows: open.filter((i) => !i.due_date || i.due_date >= today) },
    { key: 'd7', label: '1 to 7 days late', rows: overdue.filter((i) => daysBetween(today, i.due_date as string) <= 7) },
    { key: 'd30', label: '8 to 30 days late', rows: overdue.filter((i) => { const d = daysBetween(today, i.due_date as string); return d > 7 && d <= 30; }) },
    { key: 'd30p', label: 'Over 30 days late', rows: overdue.filter((i) => daysBetween(today, i.due_date as string) > 30) },
  ];

  // budgets: this month's spending against the monthly budget of each category
  const budgetRows = data.budgets
    .filter((b) => b.monthly_amount > 0)
    .map((b) => {
      const spent = sum(exp.filter((e) => e.category === b.category && monthKey(e.expense_date) === thisMonth));
      return { category: b.category, budget: Number(b.monthly_amount), spent, pct: Math.round((spent / Number(b.monthly_amount)) * 100) };
    })
    .sort((a, b) => b.pct - a.pct);

  // profitability: income, costs and margin per project and per client
  const projectRows = data.projects
    .map((p) => {
      const revenue = sum(received.filter((r) => r.projectId === p.id));
      const invoiced = sum(data.invoices.filter((i) => i.project_id === p.id && !['draft', 'cancelled', 'failed'].includes(i.status)).map((i) => ({ base: conv(i.amount, i.currency) })));
      const costs = sum(exp.filter((e) => e.project_id === p.id));
      return { id: p.id, name: p.name, invoiced, revenue, costs, profit: revenue - costs, margin: revenue > 0 ? Math.round(((revenue - costs) / revenue) * 100) : null };
    })
    .filter((r) => r.invoiced > 0 || r.revenue > 0 || r.costs > 0)
    .sort((a, b) => b.profit - a.profit);
  const clientMap = new Map<string, { name: string; revenue: number }>();
  received.forEach((r) => clientMap.set(r.client, { name: r.client, revenue: (clientMap.get(r.client)?.revenue ?? 0) + r.base }));
  const clientRows = [...clientMap.values()].sort((a, b) => b.revenue - a.revenue);
  const overhead = sum(exp.filter((e) => !e.project_id));

  return {
    conv, missing, rates, received, exp, open, overdue, trend, catThisMonth, aging, budgetRows, projectRows, clientRows, overhead,
    receivedMonth: cur.income,
    expensesMonth: cur.expenses,
    profitMonth: cur.profit,
    outstanding: sum(open),
    overdueTotal: sum(overdue),
    openRows: [...open].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')),
  };
}
export type Calc = ReturnType<typeof buildCalc>;

// Profit & loss for a month, a quarter or a year (offset 0 = this one, -1 = the one before)
export type PeriodType = 'month' | 'quarter' | 'year';
export function periodRange(type: PeriodType, offset: number, today: string) {
  const t = new Date(today + 'T00:00:00');
  let start: Date;
  let end: Date;
  let label: string;
  if (type === 'month') {
    start = new Date(t.getFullYear(), t.getMonth() + offset, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (type === 'quarter') {
    const q = Math.floor(t.getMonth() / 3) + offset;
    start = new Date(t.getFullYear(), q * 3, 1);
    end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
    label = `Q${((start.getMonth() / 3) | 0) + 1} ${start.getFullYear()}`;
  } else {
    start = new Date(t.getFullYear() + offset, 0, 1);
    end = new Date(start.getFullYear(), 11, 31);
    label = String(start.getFullYear());
  }
  return { start: iso(start), end: iso(end), label };
}

export function periodReport(calc: Calc, type: PeriodType, offset: number, today: string) {
  const one1 = (o: number) => {
    const r = periodRange(type, o, today);
    const inc = calc.received.filter((x) => x.date >= r.start && x.date <= r.end);
    const out = calc.exp.filter((x) => x.expense_date >= r.start && x.expense_date <= r.end);
    const income = sum(inc);
    const expenses = sum(out);
    return { ...r, income, expenses, profit: income - expenses, inc, out };
  };
  const cur = one1(offset);
  const prev = one1(offset - 1);
  const byCategory = CATEGORIES.map((c) => ({ category: c, amount: sum(cur.out.filter((e) => e.category === c)) })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const byClient = [...cur.inc.reduce((m, r) => m.set(r.client, (m.get(r.client) ?? 0) + r.base), new Map<string, number>())].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  return { cur, prev, byCategory, byClient, margin: cur.income > 0 ? Math.round((cur.profit / cur.income) * 100) : null };
}
