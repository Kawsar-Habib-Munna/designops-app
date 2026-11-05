'use client';

// Accounts > Distribution: every month's received money is split into equal parts:
//  one part for Allah, one for the Agency fund, and one for each team member (the team pool, from which salaries are paid).
//  With 6 members that is 8 equal parts. The Allah and Agency fund shares are saved to two separate accounts (fund_ledger),
//  where money can also be taken out again with a note. Tables: fund_ledger (see lib/accountsCore.ts).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatMoney } from '@/lib/currency';
import { BASE, monthLabel, type buildCalc } from '@/lib/accountsCore';

type Fund = 'allah' | 'agency';
type Entry = { id: string; fund: Fund; entry_date: string; month: string | null; kind: 'deposit' | 'withdrawal'; source: 'distribution' | 'manual'; amount: number; note: string | null };
type Member = { id: string; full_name: string };
type Staff = { id: string; profile_id: string | null; currency: string };
type Slip = { staff_id: string; month: string; base: number; bonus: number; deduction: number; status: string };

const FUNDS: { key: Fund; label: string }[] = [
  { key: 'allah', label: 'For Allah' },
  { key: 'agency', label: 'Agency fund' },
];

async function fetchAll() {
  const [lg, pr, st, sl] = await Promise.all([
    supabase.from('fund_ledger').select('id, fund, entry_date, month, kind, source, amount, note').order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('staff_salaries').select('id, profile_id, currency'),
    supabase.from('payslips').select('staff_id, month, base, bonus, deduction, status'),
  ]);
  return { ready: !lg.error, ledger: (lg.data as Entry[]) ?? [], members: (pr.data as Member[]) ?? [], staff: (st.data as Staff[]) ?? [], slips: (sl.data as Slip[]) ?? [] };
}

type Props = {
  calc: ReturnType<typeof buildCalc>;
  today: string;
  audit: (action: string, entity: string, entityId: string | null, detail: string) => Promise<void>;
};

export default function DistributionTab({ calc, today, audit }: Props) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [ready, setReady] = useState(true);
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [wFund, setWFund] = useState<Fund>('allah');
  const [wAmount, setWAmount] = useState('');
  const [wNote, setWNote] = useState('');

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2600);
  };
  const apply = (r: Awaited<ReturnType<typeof fetchAll>>) => {
    setReady(r.ready);
    setLedger(r.ledger);
    setMembers(r.members);
    setStaff(r.staff);
    setSlips(r.slips);
  };
  const reload = useCallback(async () => apply(await fetchAll()), []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAll();
      if (!cancelled) apply(r);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const money = (n: number) => formatMoney(n, BASE);
  const income = calc.received.filter((r) => r.month === month).reduce((n, r) => n + r.base, 0);
  const parts = members.length + 2;
  const share = parts > 0 ? income / parts : 0;
  const teamPool = share * members.length;
  const netOf = (s: Slip) => Number(s.base) + Number(s.bonus) - Number(s.deduction);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const paidBase = (profileId: string) =>
    slips
      .filter((s) => s.month === month && s.status === 'paid')
      .reduce((n, s) => {
        const st = staffById.get(s.staff_id);
        return st?.profile_id === profileId ? n + calc.conv(netOf(s), st.currency) : n;
      }, 0);
  const salariesPaid = members.reduce((n, m) => n + paidBase(m.id), 0);

  const balance = (f: Fund) => ledger.filter((e) => e.fund === f).reduce((n, e) => n + (e.kind === 'deposit' ? Number(e.amount) : -Number(e.amount)), 0);
  const savedFor = (f: Fund) => ledger.find((e) => e.fund === f && e.source === 'distribution' && e.month === month);

  function shiftMonth(delta: number) {
    const d = new Date(month + '-01T00:00:00');
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // saves (or refreshes) the Allah and Agency fund shares of the month into their accounts
  async function saveShares() {
    if (income <= 0) return flash('No money was received this month.');
    const amount = Math.round(share * 100) / 100;
    for (const f of FUNDS) {
      const ex = savedFor(f.key);
      const note = `${monthLabel(month)} share: 1 of ${parts} parts`;
      if (ex) await supabase.from('fund_ledger').update({ amount, note }).eq('id', ex.id);
      else await supabase.from('fund_ledger').insert({ fund: f.key, entry_date: today, month, kind: 'deposit', source: 'distribution', amount, note });
    }
    await audit('distribution_saved', 'fund', null, `${monthLabel(month)}: ${money(income)} in ${parts} parts, ${money(amount)} each to Allah and the Agency fund`);
    flash('Saved to both accounts.');
    await reload();
  }
  async function withdraw() {
    const amount = Number(wAmount);
    if (!wAmount || Number.isNaN(amount) || amount <= 0) return flash('Enter a valid amount.');
    if (amount > balance(wFund)) return flash('That is more than the balance.');
    if (!wNote.trim()) return flash('Write what it was for.');
    const { error } = await supabase.from('fund_ledger').insert({ fund: wFund, entry_date: today, month: null, kind: 'withdrawal', source: 'manual', amount, note: wNote.trim() });
    if (error) return flash(error.message);
    await audit('fund_withdrawal', 'fund', null, `${FUNDS.find((x) => x.key === wFund)?.label}: ${money(amount)} · ${wNote.trim()}`);
    setWAmount('');
    setWNote('');
    flash('Withdrawal recorded.');
    await reload();
  }
  async function removeEntry(e: Entry) {
    if (!window.confirm('Delete this entry from the account?')) return;
    await supabase.from('fund_ledger').delete().eq('id', e.id);
    await audit('fund_entry_deleted', 'fund', e.id, `${e.fund}: ${money(Number(e.amount))} · ${e.note ?? ''}`);
    await reload();
  }

  if (!ready) {
    return (
      <section className="ac-card">
        <div className="ac-card-head"><h2>Distribution</h2></div>
        <div className="ac-card-body"><p className="ac-note ac-warn">The fund account table is missing. Run the accounts SQL (Settings tab, or the end of sql/schema.sql) in the Supabase SQL editor, then reload.</p></div>
      </section>
    );
  }

  const allSaved = FUNDS.every((f) => {
    const ex = savedFor(f.key);
    return ex && Math.abs(Number(ex.amount) - share) < 0.01;
  });

  return (
    <>
      {msg && <div className="ac-toast">{msg}</div>}
      <div className="ac-kpis ac-kpis-4">
        <div className="ac-kpi"><span className="ac-kpi-label">{monthLabel(month)} received</span><b className="tabular">{money(income)}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">One part (1 of {parts})</span><b className="tabular">{money(share)}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">Allah account</span><b className="tabular">{money(balance('allah'))}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">Agency fund account</span><b className="tabular">{money(balance('agency'))}</b></div>
      </div>

      <section className="ac-card">
        <div className="ac-card-head">
          <h2>Monthly split</h2>
          <div className="ac-seg">
            <button type="button" onClick={() => shiftMonth(-1)}>‹</button>
            <button type="button" className="on">{monthLabel(month)}</button>
            <button type="button" onClick={() => shiftMonth(1)}>›</button>
          </div>
          <button type="button" className="ac-primary ac-right" onClick={() => void saveShares()} disabled={income <= 0 || allSaved}>{allSaved ? 'Saved' : FUNDS.some((f) => savedFor(f.key)) ? 'Update accounts' : 'Save to accounts'}</button>
        </div>
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Sector</th><th className="ac-r">Parts</th><th className="ac-r">Amount</th><th>Where it goes</th></tr></thead>
            <tbody>
              <tr><td className="ac-strong">For Allah</td><td className="ac-r tabular">1</td><td className="ac-r tabular">{money(share)}</td><td>{savedFor('allah') ? 'Saved in the Allah account' : 'Not saved yet'}</td></tr>
              <tr><td className="ac-strong">Agency fund</td><td className="ac-r tabular">1</td><td className="ac-r tabular">{money(share)}</td><td>{savedFor('agency') ? 'Saved in the Agency fund account' : 'Not saved yet'}</td></tr>
              <tr><td className="ac-strong">Team ({members.length} members)</td><td className="ac-r tabular">{members.length}</td><td className="ac-r tabular">{money(teamPool)}</td><td>Salary pool: {money(salariesPaid)} paid, {money(teamPool - salariesPaid)} {teamPool - salariesPaid < 0 ? 'over the pool' : 'left'}</td></tr>
              <tr><td className="ac-strong">Total</td><td className="ac-r tabular ac-strong">{parts}</td><td className="ac-r tabular ac-strong">{money(income)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="ac-card">
        <div className="ac-card-head"><h2>Team share</h2><span className="ac-count">{monthLabel(month)}</span></div>
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Member</th><th className="ac-r">Share (1 part)</th><th className="ac-r">Salary paid</th><th className="ac-r">Difference</th></tr></thead>
            <tbody>
              {members.map((m) => {
                const paid = paidBase(m.id);
                return (
                  <tr key={m.id}>
                    <td className="ac-strong">{m.full_name}</td>
                    <td className="ac-r tabular">{money(share)}</td>
                    <td className="ac-r tabular">{money(paid)}</td>
                    <td className="ac-r tabular">{money(share - paid)}</td>
                  </tr>
                );
              })}
              {members.length === 0 && <tr><td colSpan={4} className="ac-empty-cell">No team members yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {FUNDS.map((f) => {
        const rows = ledger.filter((e) => e.fund === f.key);
        return (
          <section className="ac-card" key={f.key}>
            <div className="ac-card-head"><h2>{f.label} account</h2><span className="ac-count tabular">Balance {money(balance(f.key))}</span></div>
            <div className="ac-scroll">
              <table className="ac-table">
                <thead><tr><th>Date</th><th>Note</th><th className="ac-r">In</th><th className="ac-r">Out</th><th /></tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="ac-nowrap">{e.entry_date}</td>
                      <td>{e.note || '-'}</td>
                      <td className="ac-r tabular">{e.kind === 'deposit' ? money(Number(e.amount)) : ''}</td>
                      <td className="ac-r tabular">{e.kind === 'withdrawal' ? money(Number(e.amount)) : ''}</td>
                      <td className="ac-r"><button type="button" className="ac-link ac-linkbtn danger" onClick={() => void removeEntry(e)}>Delete</button></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="ac-empty-cell">Nothing saved yet. Press Save to accounts above.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="ac-card">
        <div className="ac-card-head"><h2>Take money out</h2></div>
        <div className="ac-card-body ac-staff-form">
          <select className="ac-select" value={wFund} onChange={(e) => setWFund(e.target.value as Fund)}>{FUNDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
          <input className="ac-input" placeholder={`Amount (${BASE})`} inputMode="decimal" value={wAmount} onChange={(e) => setWAmount(e.target.value)} />
          <input className="ac-input" placeholder="What it was for" value={wNote} onChange={(e) => setWNote(e.target.value)} />
          <button type="button" className="ac-primary" onClick={() => void withdraw()}>Record</button>
        </div>
      </section>
    </>
  );
}
