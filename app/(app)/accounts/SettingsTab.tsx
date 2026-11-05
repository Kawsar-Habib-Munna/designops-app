'use client';

// Accounts settings: exchange rates (every amount is shown in BASE), monthly budgets per category, and recurring expenses.
import { useState } from 'react';
import { formatMoney } from '@/lib/currency';
import { BASE, CATEGORIES, CURRENCY_CHOICES, monthLabel, type AccountsData, type Recurring } from '@/lib/accountsCore';

type Props = {
  data: AccountsData;
  missing: string[];
  thisMonth: string;
  onSaveRate: (currency: string, rate: number) => Promise<void>;
  onDeleteRate: (currency: string) => Promise<void>;
  onSaveBudgets: (rows: { category: string; amount: number }[]) => Promise<void>;
  onAddRecurring: (r: Omit<Recurring, 'id' | 'last_posted_month' | 'active'>) => Promise<void>;
  onToggleRecurring: (id: string, active: boolean) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onPostRecurring: () => Promise<number>;
};

export default function SettingsTab({ data, missing, thisMonth, onSaveRate, onDeleteRate, onSaveBudgets, onAddRecurring, onToggleRecurring, onDeleteRecurring, onPostRecurring }: Props) {
  const [rateCur, setRateCur] = useState('USD');
  const [rateVal, setRateVal] = useState('');
  const [budgetEdit, setBudgetEdit] = useState<Record<string, string>>({});
  const [rec, setRec] = useState({ name: '', category: CATEGORIES[0], vendor: '', amount: '', currency: BASE, day: '1', projectId: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2500); };

  const budgetOf = (c: string) => budgetEdit[c] ?? String(data.budgets.find((b) => b.category === c)?.monthly_amount ?? '');
  const dueRecurring = data.recurring.filter((r) => r.active && r.last_posted_month !== thisMonth);

  return (
    <>
      {msg && <div className="ac-toast">{msg}</div>}
      {missing.length > 0 && <div className="ac-error">No exchange rate for {missing.join(', ')}: those amounts are left out of the totals until you add a rate below.</div>}

      <div className="ac-pair">
        <section className="ac-card">
          <div className="ac-card-head"><h2>Exchange rates</h2><span className="ac-count">1 unit = ? {BASE}</span></div>
          <div className="ac-card-body">
            <p className="ac-note">All totals are shown in {BASE}. Add a rate for every other currency you invoice or spend in, and update it when the rate moves.</p>
            <table className="ac-table ac-mini">
              <tbody>
                <tr><td className="ac-strong">{BASE}</td><td className="tabular">1.00</td><td className="ac-r ac-faint">base currency</td></tr>
                {data.rates.map((r) => (
                  <tr key={r.currency}>
                    <td className="ac-strong">{r.currency}</td>
                    <td className="tabular">{Number(r.rate_to_base).toLocaleString('en-US', { maximumFractionDigits: 4 })} {BASE}</td>
                    <td className="ac-r"><button type="button" className="ac-link ac-linkbtn" onClick={() => { setRateCur(r.currency); setRateVal(String(r.rate_to_base)); }}>Edit</button><button type="button" className="ac-link ac-linkbtn danger" onClick={() => void onDeleteRate(r.currency)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ac-form-row">
              <select className="ac-select" value={rateCur} onChange={(e) => setRateCur(e.target.value)} aria-label="Currency">{CURRENCY_CHOICES.filter((c) => c !== BASE).map((c) => <option key={c} value={c}>{c}</option>)}</select>
              <input className="ac-input" type="number" min="0" step="0.0001" value={rateVal} onChange={(e) => setRateVal(e.target.value)} placeholder={`1 ${rateCur} = ? ${BASE}`} />
              <button type="button" className="ac-btn" onClick={async () => { const v = Number(rateVal); if (!v || v <= 0) return flash('Enter a rate above zero.'); await onSaveRate(rateCur, v); setRateVal(''); flash('Rate saved.'); }}>Save rate</button>
            </div>
          </div>
        </section>

        <section className="ac-card">
          <div className="ac-card-head"><h2>Monthly budgets</h2><span className="ac-count">{BASE}</span></div>
          <div className="ac-card-body">
            <p className="ac-note">Set a monthly limit per category. The overview shows how much of it you have used. Leave blank for no budget.</p>
            <div className="ac-budget-grid">
              {CATEGORIES.map((c) => (
                <label key={c}><span>{c}</span><input className="ac-input" type="number" min="0" value={budgetOf(c)} onChange={(e) => setBudgetEdit({ ...budgetEdit, [c]: e.target.value })} placeholder="No budget" /></label>
              ))}
            </div>
            <button type="button" className="ac-primary" onClick={async () => { await onSaveBudgets(CATEGORIES.map((c) => ({ category: c, amount: Number(budgetOf(c)) || 0 }))); setBudgetEdit({}); flash('Budgets saved.'); }}>Save budgets</button>
          </div>
        </section>
      </div>

      <section className="ac-card">
        <div className="ac-card-head">
          <h2>Recurring expenses</h2><span className="ac-count tabular">{data.recurring.length}</span>
          <button type="button" className="ac-primary ac-right" disabled={dueRecurring.length === 0} onClick={async () => { const n = await onPostRecurring(); flash(`${n} expense${n === 1 ? '' : 's'} added for ${monthLabel(thisMonth)}.`); }}>Post {monthLabel(thisMonth)} ({dueRecurring.length})</button>
        </div>
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Name</th><th>Category</th><th>Day</th><th className="ac-r">Amount</th><th>This month</th><th /></tr></thead>
            <tbody>
              {data.recurring.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'ac-off'}>
                  <td className="ac-strong">{r.name}{r.vendor && <em className="ac-sub-line">{r.vendor}</em>}</td>
                  <td>{r.category}</td>
                  <td className="tabular">{r.day_of_month}</td>
                  <td className="ac-r tabular">{formatMoney(r.amount, r.currency)}</td>
                  <td><span className={`ac-status${r.last_posted_month === thisMonth ? '' : ' late'}`}>{!r.active ? 'Paused' : r.last_posted_month === thisMonth ? 'Posted' : 'Not posted yet'}</span></td>
                  <td className="ac-r"><button type="button" className="ac-link ac-linkbtn" onClick={() => void onToggleRecurring(r.id, !r.active)}>{r.active ? 'Pause' : 'Resume'}</button><button type="button" className="ac-link ac-linkbtn danger" onClick={() => void onDeleteRecurring(r.id)}>Delete</button></td>
                </tr>
              ))}
              {data.recurring.length === 0 && <tr><td colSpan={6} className="ac-empty-cell">No recurring expenses yet. Add rent, salaries or subscriptions below.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="ac-card-body ac-rec-form">
          <input className="ac-input" value={rec.name} onChange={(e) => setRec({ ...rec, name: e.target.value })} placeholder="Name, e.g. Office rent" />
          <select className="ac-select" value={rec.category} onChange={(e) => setRec({ ...rec, category: e.target.value })} aria-label="Category">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <input className="ac-input" value={rec.vendor} onChange={(e) => setRec({ ...rec, vendor: e.target.value })} placeholder="Vendor (optional)" />
          <input className="ac-input" type="number" min="0" value={rec.amount} onChange={(e) => setRec({ ...rec, amount: e.target.value })} placeholder="Amount" />
          <select className="ac-select" value={rec.currency} onChange={(e) => setRec({ ...rec, currency: e.target.value })} aria-label="Currency">{CURRENCY_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select className="ac-select" value={rec.day} onChange={(e) => setRec({ ...rec, day: e.target.value })} aria-label="Day of month">{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}</select>
          <select className="ac-select" value={rec.projectId} onChange={(e) => setRec({ ...rec, projectId: e.target.value })} aria-label="Project"><option value="">No project</option>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <button type="button" className="ac-btn" onClick={async () => { const a = Number(rec.amount); if (!rec.name.trim() || !a || a <= 0) return flash('Enter a name and an amount.'); await onAddRecurring({ name: rec.name.trim(), category: rec.category, vendor: rec.vendor.trim() || null, amount: a, currency: rec.currency, day_of_month: Number(rec.day), project_id: rec.projectId || null }); setRec({ ...rec, name: '', vendor: '', amount: '' }); flash('Recurring expense added.'); }}>Add recurring</button>
        </div>
      </section>
    </>
  );
}
