'use client';

// Accounts settings as a hub: one summary card per setting (the accountant, exchange rates, monthly budgets, recurring expenses).
// "Manage" slides a panel in from the right with the form, so the page itself stays calm. View-only members can open the
// panels to read, but every field and button inside is disabled.
import { useEffect, useState, type ReactNode } from 'react';
import { formatMoney } from '@/lib/currency';
import { BASE, CATEGORIES, CURRENCY_CHOICES, monthLabel, type AccountsData, type Recurring } from '@/lib/accountsCore';

type Props = {
  data: AccountsData;
  missing: string[];
  thisMonth: string;
  readOnly?: boolean;
  accountant?: ReactNode; // the accountant picker, for admins only
  budgetChart?: ReactNode; // budget use chart (not on the accountant's page)
  onSaveRate: (currency: string, rate: number) => Promise<void>;
  onDeleteRate: (currency: string) => Promise<void>;
  onSaveBudgets: (rows: { category: string; amount: number }[]) => Promise<void>;
  onAddRecurring: (r: Omit<Recurring, 'id' | 'last_posted_month' | 'active'>) => Promise<void>;
  onToggleRecurring: (id: string, active: boolean) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onPostRecurring: () => Promise<number>;
};

type Section = 'accountant' | 'rates' | 'budgets' | 'recurring';

const ICONS: Record<Section, string> = {
  accountant: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  rates: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  budgets: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  recurring: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
};
const Ico = ({ s }: { s: Section }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[s] }} />;

export default function SettingsTab({ data, missing, thisMonth, readOnly = false, accountant, budgetChart, onSaveRate, onDeleteRate, onSaveBudgets, onAddRecurring, onToggleRecurring, onDeleteRecurring, onPostRecurring }: Props) {
  const [open, setOpen] = useState<Section | null>(null);
  const [rateCur, setRateCur] = useState('USD');
  const [rateVal, setRateVal] = useState('');
  const [budgetEdit, setBudgetEdit] = useState<Record<string, string>>({});
  const [rec, setRec] = useState({ name: '', category: CATEGORIES[0], vendor: '', amount: '', currency: BASE, day: '1', projectId: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2500); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const budgetOf = (c: string) => budgetEdit[c] ?? String(data.budgets.find((b) => b.category === c)?.monthly_amount ?? '');
  const dueRecurring = data.recurring.filter((r) => r.active && r.last_posted_month !== thisMonth);
  const budgetCount = data.budgets.filter((b) => Number(b.monthly_amount) > 0).length;
  const budgetTotal = data.budgets.reduce((n, b) => n + Number(b.monthly_amount), 0);
  const activeRec = data.recurring.filter((r) => r.active);

  const cards: { key: Section; title: string; stat: string; line: string; flag?: string }[] = [
    ...(accountant ? [{ key: 'accountant' as const, title: 'Accountant', stat: 'Who keeps the books', line: 'Chosen from the team. Edits wait for your approval.' }] : []),
    { key: 'rates', title: 'Exchange rates', stat: `${data.rates.length} ${data.rates.length === 1 ? 'currency' : 'currencies'}`, line: `Everything is shown in ${BASE}.`, flag: missing.length > 0 ? `Rate missing: ${missing.join(', ')}` : undefined },
    { key: 'budgets', title: 'Monthly budgets', stat: budgetCount === 0 ? 'None set' : `${budgetCount} of ${CATEGORIES.length} categories`, line: budgetCount === 0 ? 'Set a spending limit per category.' : `${formatMoney(budgetTotal, BASE)} a month in total.` },
    { key: 'recurring', title: 'Recurring expenses', stat: `${activeRec.length} active`, line: activeRec.length === 0 ? 'Rent, tools and subscriptions.' : `${formatMoney(activeRec.reduce((n, r) => n + (r.currency === BASE ? r.amount : 0), 0), BASE)} a month in ${BASE}.`, flag: dueRecurring.length > 0 ? `${dueRecurring.length} to post for ${monthLabel(thisMonth)}` : undefined },
  ];
  const titleOf = (s: Section) => cards.find((c) => c.key === s)?.title ?? '';

  return (
    <>
      {msg && <div className="ac-toast">{msg}</div>}

      <div className="ac-hub">
        {cards.map((c) => (
          <article key={c.key} className="ac-hub-card">
            <div className="ac-hub-top">
              <span className="ac-hub-ico"><Ico s={c.key} /></span>
              <h3>{c.title}</h3>
            </div>
            <b className="ac-hub-stat">{c.stat}</b>
            <p>{c.line}</p>
            {c.flag && <span className="ac-hub-flag">{c.flag}</span>}
            <button type="button" className="ac-btn ac-hub-btn" onClick={() => setOpen(c.key)}>{readOnly ? 'View' : 'Manage'}<span aria-hidden="true">›</span></button>
          </article>
        ))}
      </div>

      {open && (
        <div className="ac-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <aside className="ac-drawer" role="dialog" aria-modal="true" aria-label={titleOf(open)}>
            <header className="ac-drawer-head">
              <h2>{titleOf(open)}</h2>
              <button type="button" className="ac-ico ac-ico-plain" aria-label="Close" onClick={() => setOpen(null)}>×</button>
            </header>
            <fieldset className="ac-fs ac-drawer-body" disabled={readOnly}>
              {open === 'accountant' && accountant}

              {open === 'rates' && (
                <>
                  <p className="ac-drawer-desc">Add a rate for every currency you invoice or spend in, and update it when the rate moves. Amounts with no rate are left out of the totals.</p>
                  {missing.length > 0 && <div className="ac-error">No exchange rate for {missing.join(', ')}.</div>}
                  <ul className="ac-rate-list">
                    <li><span className="ac-rate-cur">{BASE}</span><span className="ac-rate-val tabular">1.00</span><span className="ac-faint">Base currency</span></li>
                    {data.rates.map((r) => (
                      <li key={r.currency}>
                        <span className="ac-rate-cur">{r.currency}</span>
                        <span className="ac-rate-val tabular">1 {r.currency} = {Number(r.rate_to_base).toLocaleString('en-US', { maximumFractionDigits: 4 })} {BASE}</span>
                        <span className="ac-rate-actions"><button type="button" className="ac-link ac-linkbtn" onClick={() => { setRateCur(r.currency); setRateVal(String(r.rate_to_base)); }}>Edit</button><button type="button" className="ac-link ac-linkbtn danger" onClick={() => void onDeleteRate(r.currency)}>Remove</button></span>
                      </li>
                    ))}
                  </ul>
                  <div className="ac-drawer-block">
                    <h4>Add or change a rate</h4>
                    <label className="ac-pf-field"><span>Currency</span><select className="ac-select" value={rateCur} onChange={(e) => setRateCur(e.target.value)}>{CURRENCY_CHOICES.filter((c) => c !== BASE).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                    <label className="ac-pf-field"><span>1 {rateCur} equals ({BASE})</span><input className="ac-input" type="number" min="0" step="0.0001" value={rateVal} onChange={(e) => setRateVal(e.target.value)} placeholder="e.g. 120" /></label>
                    <button type="button" className="ac-primary" onClick={async () => { const v = Number(rateVal); if (!v || v <= 0) return flash('Enter a rate above zero.'); await onSaveRate(rateCur, v); setRateVal(''); flash('Rate saved.'); }}>Save rate</button>
                  </div>
                </>
              )}

              {open === 'budgets' && (
                <>
                  <p className="ac-drawer-desc">A monthly limit per category ({BASE}). The overview shows how much has been used. Leave a box empty for no budget.</p>
                  {budgetChart}
                  <div className="ac-drawer-block">
                    {CATEGORIES.map((c) => (
                      <label key={c} className="ac-pf-field"><span>{c}</span><input className="ac-input" type="number" min="0" value={budgetOf(c)} onChange={(e) => setBudgetEdit({ ...budgetEdit, [c]: e.target.value })} placeholder="No budget" /></label>
                    ))}
                    <button type="button" className="ac-primary" onClick={async () => { await onSaveBudgets(CATEGORIES.map((c) => ({ category: c, amount: Number(budgetOf(c)) || 0 }))); setBudgetEdit({}); flash('Budgets saved.'); }}>Save budgets</button>
                  </div>
                </>
              )}

              {open === 'recurring' && (
                <>
                  <p className="ac-drawer-desc">Costs that repeat every month. Post adds this month&apos;s expense for each one that is not posted yet.</p>
                  <button type="button" className="ac-primary" disabled={dueRecurring.length === 0} onClick={async () => { const n = await onPostRecurring(); flash(`${n} expense${n === 1 ? '' : 's'} added for ${monthLabel(thisMonth)}.`); }}>Post {monthLabel(thisMonth)} ({dueRecurring.length})</button>
                  <ul className="ac-rec-list">
                    {data.recurring.map((r) => (
                      <li key={r.id} className={r.active ? '' : 'ac-off'}>
                        <div>
                          <b>{r.name}</b>
                          <small>{r.category}{r.vendor ? ` · ${r.vendor}` : ''} · day {r.day_of_month}</small>
                          <span className={`ac-status${r.last_posted_month === thisMonth ? '' : ' late'}`}>{!r.active ? 'Paused' : r.last_posted_month === thisMonth ? 'Posted' : 'Not posted yet'}</span>
                        </div>
                        <div className="ac-rec-right">
                          <b className="tabular">{formatMoney(r.amount, r.currency)}</b>
                          <span><button type="button" className="ac-link ac-linkbtn" onClick={() => void onToggleRecurring(r.id, !r.active)}>{r.active ? 'Pause' : 'Resume'}</button><button type="button" className="ac-link ac-linkbtn danger" onClick={() => void onDeleteRecurring(r.id)}>Delete</button></span>
                        </div>
                      </li>
                    ))}
                    {data.recurring.length === 0 && <li className="ac-rec-empty">No recurring expenses yet. Add rent, salaries or subscriptions below.</li>}
                  </ul>
                  <div className="ac-drawer-block">
                    <h4>Add a recurring expense</h4>
                    <label className="ac-pf-field"><span>Name</span><input className="ac-input" value={rec.name} onChange={(e) => setRec({ ...rec, name: e.target.value })} placeholder="e.g. Office rent" /></label>
                    <label className="ac-pf-field"><span>Category</span><select className="ac-select" value={rec.category} onChange={(e) => setRec({ ...rec, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                    <label className="ac-pf-field"><span>Vendor (optional)</span><input className="ac-input" value={rec.vendor} onChange={(e) => setRec({ ...rec, vendor: e.target.value })} placeholder="Who is paid" /></label>
                    <div className="ac-pf-field"><span>Amount</span><div className="ac-pf-inline"><input className="ac-input" type="number" min="0" value={rec.amount} onChange={(e) => setRec({ ...rec, amount: e.target.value })} placeholder="0" aria-label="Amount" /><select className="ac-select" value={rec.currency} onChange={(e) => setRec({ ...rec, currency: e.target.value })} aria-label="Currency">{CURRENCY_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div></div>
                    <label className="ac-pf-field"><span>Posted on day</span><select className="ac-select" value={rec.day} onChange={(e) => setRec({ ...rec, day: e.target.value })}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}</select></label>
                    <label className="ac-pf-field"><span>Project (optional)</span><select className="ac-select" value={rec.projectId} onChange={(e) => setRec({ ...rec, projectId: e.target.value })}><option value="">No project</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                    <button type="button" className="ac-primary" onClick={async () => { const a = Number(rec.amount); if (!rec.name.trim() || !a || a <= 0) return flash('Enter a name and an amount.'); await onAddRecurring({ name: rec.name.trim(), category: rec.category, vendor: rec.vendor.trim() || null, amount: a, currency: rec.currency, day_of_month: Number(rec.day), project_id: rec.projectId || null }); setRec({ ...rec, name: '', vendor: '', amount: '' }); flash('Recurring expense added.'); }}>Add recurring expense</button>
                  </div>
                </>
              )}
            </fieldset>
          </aside>
        </div>
      )}
    </>
  );
}
