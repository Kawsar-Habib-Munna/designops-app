'use client';

// Accounts > Distribution: every month's received money is split into equal parts:
//  one part for Allah, one for the Agency fund, and one for each team member (the team pool, from which salaries are paid).
//  With 6 members that is 8 equal parts. The Allah and Agency fund shares are saved to two separate accounts (fund_ledger),
//  where money can also be taken out again with a note. Tables: fund_ledger (see lib/accountsCore.ts).
// Two ways to share the money: the monthly split above, and pay rounds: once at least MIN_ROUND is waiting, it is split equally
//  (Allah, Agency fund, each member); whatever cannot be split evenly goes to the Agency fund. Table: pay_rounds.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatMoney } from '@/lib/currency';
import { BASE, MIN_ROUND, monthLabel, type buildCalc } from '@/lib/accountsCore';
import { formatDateLong } from '@/lib/format';
import StatementPreview, { type StatementDoc } from './StatementPreview';
import { MultiLine, SegBar, SLOT, VizCard, VizRow } from './viz';

type Fund = 'allah' | 'agency';
type Entry = { id: string; fund: Fund; entry_date: string; month: string | null; kind: 'deposit' | 'withdrawal'; source: 'distribution' | 'manual' | 'round'; amount: number; note: string | null; approval: string };
type Round = { id: string; round_no: number; from_date: string; round_date: string; pool: number; parts: number; share: number; remainder: number; approval: string };
type Member = { id: string; full_name: string };
type Staff = { id: string; profile_id: string | null; currency: string; pay_method: string | null; pay_account_name: string | null; pay_account_no: string | null; pay_code: string | null; pay_bank: string | null };
type Slip = { staff_id: string; month: string; base: number; bonus: number; deduction: number; status: string; approval: string };

const FUNDS: { key: Fund; label: string }[] = [
  { key: 'allah', label: 'For Allah' },
  { key: 'agency', label: 'Agency fund' },
];

async function fetchAll() {
  const [lg, pr, st, sl, rd] = await Promise.all([
    supabase.from('fund_ledger').select('id, fund, entry_date, month, kind, source, amount, note, approval').order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('staff_salaries').select('id, profile_id, currency, pay_method, pay_account_name, pay_account_no, pay_code, pay_bank'),
    supabase.from('payslips').select('staff_id, month, base, bonus, deduction, status, approval'),
    supabase.from('pay_rounds').select('id, round_no, from_date, round_date, pool, parts, share, remainder, approval').order('round_no', { ascending: false }),
  ]);
  return { roundsReady: !rd.error, rounds: (rd.data as Round[]) ?? [], ready: !lg.error, ledger: (lg.data as Entry[]) ?? [], members: (pr.data as Member[]) ?? [], staff: (st.data as Staff[]) ?? [], slips: (sl.data as Slip[]) ?? [] };
}

type Props = {
  calc: ReturnType<typeof buildCalc>;
  today: string;
  audit: (action: string, entity: string, entityId: string | null, detail: string) => Promise<void>;
  canEdit: boolean;
  isAdmin: boolean;
  visuals?: boolean;
  userId: string | null;
  onChanged: () => Promise<void>;
};

export default function DistributionTab({ calc, today, audit, canEdit, isAdmin, userId, onChanged, visuals = true }: Props) {
  const ap = isAdmin ? { approval: 'approved' } : {};
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
  const [doc, setDoc] = useState<StatementDoc | null>(null);
  const [mode, setMode] = useState<'rounds' | 'monthly'>('rounds');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundsReady, setRoundsReady] = useState(true);
  const [fromDate, setFromDate] = useState(`${today.slice(0, 7)}-01`);
  const [busy, setBusy] = useState(false);

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
    setRounds(r.rounds);
    setRoundsReady(r.roundsReady);
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
      .filter((s) => s.month === month && s.status === 'paid' && s.approval === 'approved')
      .reduce((n, s) => {
        const st = staffById.get(s.staff_id);
        return st?.profile_id === profileId ? n + calc.conv(netOf(s), st.currency) : n;
      }, 0);
  const salariesPaid = members.reduce((n, m) => n + paidBase(m.id), 0);

  const balance = (f: Fund) => ledger.filter((e) => e.fund === f && e.approval === 'approved').reduce((n, e) => n + (e.kind === 'deposit' ? Number(e.amount) : -Number(e.amount)), 0);
  const savedFor = (f: Fund) => ledger.find((e) => e.fund === f && e.source === 'distribution' && e.month === month);

  // ---- pay rounds: everything received since the start date, minus what earlier rounds already shared
  const live = rounds.filter((r) => r.approval !== 'rejected');
  const startFrom = live.length ? live.reduce((m, r) => (r.from_date < m ? r.from_date : m), live[0].from_date) : fromDate;
  const receivedSince = calc.received.filter((r) => r.date >= startFrom).reduce((n, r) => n + r.base, 0);
  const alreadyShared = live.reduce((n, r) => n + Number(r.pool), 0);
  const pool = Math.max(Math.floor(receivedSince - alreadyShared), 0);
  const rParts = members.length + 2;
  const rShare = Math.floor(pool / rParts);
  const rExtra = pool - rShare * rParts;
  const canRun = pool >= MIN_ROUND && members.length > 0;
  const nextNo = rounds.reduce((m, r) => Math.max(m, r.round_no), 0) + 1;
  const staffOf = (profileId: string) => staff.find((x) => x.profile_id === profileId);
  const payTo = (profileId: string) => {
    const p = staffOf(profileId);
    if (!p?.pay_method) return '-';
    return [p.pay_method, p.pay_account_name, p.pay_code, p.pay_method === 'Card' && p.pay_account_no ? `•••• ${p.pay_account_no}` : p.pay_account_no, p.pay_bank].filter(Boolean).join(' · ');
  };

  async function distributeNow() {
    if (!canRun || busy) return;
    if (!window.confirm(`Share ${money(pool)} now? Allah, the Agency fund and each of the ${members.length} members get ${money(rShare)}${rExtra > 0 ? `, and the extra ${money(rExtra)} goes to the Agency fund` : ''}.`)) return;
    setBusy(true);
    const { data: row, error } = await supabase.from('pay_rounds').insert({ round_no: nextNo, from_date: startFrom, round_date: today, pool, parts: rParts, share: rShare, remainder: rExtra }).select('id').single();
    if (error) {
      setBusy(false);
      return flash(error.message);
    }
    const id = (row as { id: string }).id;
    const note = `Pay round #${nextNo}`;
    const [l, e] = await Promise.all([
      supabase.from('fund_ledger').insert([
        { fund: 'allah', entry_date: today, month: null, kind: 'deposit', source: 'round', round_id: id, amount: rShare, note },
        { fund: 'agency', entry_date: today, month: null, kind: 'deposit', source: 'round', round_id: id, amount: rShare + rExtra, note: rExtra > 0 ? `${note} (includes ${money(rExtra)} extra)` : note },
      ]),
      supabase.from('expenses').insert(members.map((m) => ({ expense_date: today, amount: rShare, currency: BASE, category: 'Salaries', vendor: m.full_name, description: note, round_id: id, created_by: userId }))),
    ]);
    if (l.error || e.error) {
      await supabase.from('pay_rounds').delete().eq('id', id);
      setBusy(false);
      return flash((l.error ?? e.error)?.message ?? 'Could not save the round.');
    }
    await audit('pay_round_created', 'pay_round', id, `${note}: ${money(pool)} in ${rParts} parts, ${money(rShare)} each, ${money(rExtra)} extra to the Agency fund`);
    setBusy(false);
    flash(isAdmin ? 'Round saved.' : 'Round saved and sent to the admin for approval.');
    await Promise.all([reload(), onChanged()]);
  }
  async function removeRound(r: Round) {
    if (!window.confirm(`Delete pay round #${r.round_no}? Its team salaries and fund deposits are removed too.`)) return;
    const { error } = await supabase.from('pay_rounds').delete().eq('id', r.id);
    if (error) return flash(error.message);
    await audit('pay_round_deleted', 'pay_round', r.id, `Pay round #${r.round_no}: ${money(Number(r.pool))}`);
    await Promise.all([reload(), onChanged()]);
  }
  function previewRound(r: Round) {
    setDoc({
      title: `Pay round #${r.round_no}`,
      period: formatDateLong(r.round_date),
      note: `${money(Number(r.pool))} shared equally in ${r.parts} parts · amounts in ${BASE}`,
      summary: [['Money shared', money(Number(r.pool))], ['Parts', String(r.parts)], ['Each part', money(Number(r.share))], ['Extra to the Agency fund', money(Number(r.remainder))]],
      sections: [
        { heading: 'Split', columns: [{ label: 'Sector' }, { label: 'Amount', right: true }], rows: [['For Allah', money(Number(r.share))], ['Agency fund', money(Number(r.share) + Number(r.remainder))], [`Team (${r.parts - 2} members)`, money(Number(r.share) * (r.parts - 2))]], total: ['Total', money(Number(r.pool))] },
        { heading: 'Team payouts', columns: [{ label: 'Member' }, { label: 'Receives by' }, { label: 'Amount', right: true }], rows: members.map((m) => [m.full_name, payTo(m.id), money(Number(r.share))]), empty: 'No team members.' },
      ],
      filename: `pay-round-${r.round_no}`,
    });
  }

  // the Allah and Agency fund balances at the end of each of the last six months (approved entries only)
  const sixMonths = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(today.slice(0, 7) + '-01T00:00:00');
    d.setMonth(d.getMonth() - (5 - k));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const balanceAt = (f: Fund, m: string) => ledger.filter((e) => e.fund === f && e.approval === 'approved' && e.entry_date.slice(0, 7) <= m).reduce((n, e) => n + (e.kind === 'deposit' ? Number(e.amount) : -Number(e.amount)), 0);

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
      if (ex) await supabase.from('fund_ledger').update({ amount, note, ...ap }).eq('id', ex.id);
      else await supabase.from('fund_ledger').insert({ fund: f.key, entry_date: today, month, kind: 'deposit', source: 'distribution', amount, note });
    }
    await audit('distribution_saved', 'fund', null, `${monthLabel(month)}: ${money(income)} in ${parts} parts, ${money(amount)} each to Allah and the Agency fund`);
    flash('Saved to both accounts.');
    await reload();
  }
  function previewStatement() {
    const acct = (f: Fund, label: string) => ({
      heading: `${label} account`,
      columns: [{ label: 'Date' }, { label: 'Note' }, { label: 'In', right: true }, { label: 'Out', right: true }],
      rows: ledger.filter((e) => e.fund === f && e.approval === 'approved').map((e) => [e.entry_date, e.note ?? '-', e.kind === 'deposit' ? money(Number(e.amount)) : '', e.kind === 'withdrawal' ? money(Number(e.amount)) : '']),
      total: ['', 'Balance', money(balance(f)), ''],
      empty: 'Nothing saved yet.',
    });
    setDoc({
      title: 'Distribution statement',
      period: monthLabel(month),
      note: `Received money split into ${parts} equal parts · amounts in ${BASE}`,
      summary: [['Received', money(income)], ['Parts', String(parts)], ['One part', money(share)], ['Team pool', money(teamPool)], ['Salaries paid', money(salariesPaid)]],
      sections: [
        { heading: 'Monthly split', columns: [{ label: 'Sector' }, { label: 'Parts', right: true }, { label: 'Amount', right: true }], rows: [['For Allah', '1', money(share)], ['Agency fund', '1', money(share)], [`Team (${members.length} members)`, String(members.length), money(teamPool)]], total: ['Total', String(parts), money(income)] },
        acct('allah', 'For Allah'),
        acct('agency', 'Agency fund'),
      ],
      filename: `distribution-${month}`,
    });
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
      <StatementPreview doc={doc} onClose={() => setDoc(null)} />
      <div className="ac-seg" role="tablist" aria-label="How the money is shared" style={{ marginBottom: 14 }}>
        <button type="button" className={mode === 'rounds' ? 'on' : ''} onClick={() => setMode('rounds')}>Pay rounds ({money(MIN_ROUND)} minimum)</button>
        <button type="button" className={mode === 'monthly' ? 'on' : ''} onClick={() => setMode('monthly')}>Monthly</button>
      </div>

      {visuals && (
<VizRow>
        <VizCard title={mode === 'rounds' ? 'How the next round splits' : `How ${monthLabel(month)} splits`} sub={mode === 'rounds' ? 'Allah, the Agency fund and the team' : 'One equal part each for Allah, the Agency fund and every member'}>
          <SegBar fmt={money} parts={mode === 'rounds' ? [{ label: 'For Allah', value: rShare, color: SLOT[0] }, { label: 'Agency fund', value: rShare + rExtra, color: SLOT[1] }, { label: 'Team', value: rShare * members.length, color: SLOT[2] }] : [{ label: 'For Allah', value: share, color: SLOT[0] }, { label: 'Agency fund', value: share, color: SLOT[1] }, { label: 'Team', value: teamPool, color: SLOT[2] }]} />
        </VizCard>
        <VizCard title="Fund balances" sub="At each month end, last 6 months" legend={[{ color: SLOT[0], label: 'For Allah' }, { color: SLOT[1], label: 'Agency fund' }]}>
          <MultiLine labels={sixMonths.map((m) => monthLabel(m).split(' ')[0])} fmt={money} ariaLabel="Allah and Agency fund balances at the end of each of the last six months" series={[{ name: 'For Allah', color: SLOT[0], values: sixMonths.map((m) => balanceAt('allah', m)) }, { name: 'Agency fund', color: SLOT[1], values: sixMonths.map((m) => balanceAt('agency', m)) }]} />
        </VizCard>
      </VizRow>
)}

      {mode === 'rounds' && (!roundsReady ? (
        <section className="ac-card">
          <div className="ac-card-head"><h2>Pay rounds</h2></div>
          <div className="ac-card-body"><p className="ac-note ac-warn">The pay rounds table is missing. Run the accounts SQL (Settings tab, or the end of sql/schema.sql) in the Supabase SQL editor, then reload.</p></div>
        </section>
      ) : (
        <>
          <div className="ac-kpis ac-kpis-4">
            <div className="ac-kpi"><span className="ac-kpi-label">Waiting to be shared</span><b className="tabular">{money(pool)}</b></div>
            <div className="ac-kpi"><span className="ac-kpi-label">Needed for a round</span><b className="tabular">{money(MIN_ROUND)}</b></div>
            <div className="ac-kpi"><span className="ac-kpi-label">Each part (1 of {rParts})</span><b className="tabular">{money(rShare)}</b></div>
            <div className="ac-kpi"><span className="ac-kpi-label">Extra to the Agency fund</span><b className="tabular">{money(rExtra)}</b></div>
          </div>

          <section className="ac-card">
            <div className="ac-card-head">
              <h2>Next pay round</h2>
              {canEdit && <button type="button" className="ac-primary ac-right" disabled={!canRun || busy} onClick={() => void distributeNow()}>{busy ? 'Saving…' : 'Share now'}</button>}
            </div>
            <div className="ac-card-body">
              {live.length === 0 && (
                <label className="ac-pf-field" style={{ maxWidth: 260, marginBottom: 14 }}>
                  <span>Count the money received from</span>
                  <input className="ac-input" type="date" value={fromDate} max={today} onChange={(e) => setFromDate(e.target.value)} disabled={!canEdit} />
                </label>
              )}
              <span className="ac-bar" style={{ display: 'block' }}><i style={{ width: `${Math.min(100, (pool / MIN_ROUND) * 100)}%` }} /></span>
              <p className="ac-note">{canRun ? `Ready. ${money(pool)} can be shared now.` : `Not yet. ${money(Math.max(MIN_ROUND - pool, 0))} more is needed (the minimum is ${money(MIN_ROUND)}).`} Money counted: everything received since {formatDateLong(startFrom)}, minus what earlier rounds already shared.</p>
            </div>
            <div className="ac-scroll">
              <table className="ac-table">
                <thead><tr><th>Sector</th><th className="ac-r">Parts</th><th className="ac-r">Amount</th></tr></thead>
                <tbody>
                  <tr><td className="ac-strong">For Allah</td><td className="ac-r tabular">1</td><td className="ac-r tabular">{money(rShare)}</td></tr>
                  <tr><td className="ac-strong">Agency fund</td><td className="ac-r tabular">1</td><td className="ac-r tabular">{money(rShare + rExtra)}{rExtra > 0 && <em className="ac-sub-line">includes {money(rExtra)} extra</em>}</td></tr>
                  <tr><td className="ac-strong">Team ({members.length} members, {money(rShare)} each)</td><td className="ac-r tabular">{members.length}</td><td className="ac-r tabular">{money(rShare * members.length)}</td></tr>
                  <tr><td className="ac-strong">Total</td><td className="ac-r tabular ac-strong">{rParts}</td><td className="ac-r tabular ac-strong">{money(pool)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="ac-card">
            <div className="ac-card-head"><h2>Past rounds</h2><span className="ac-count tabular">{rounds.length}</span></div>
            <div className="ac-scroll">
              <table className="ac-table">
                <thead><tr><th>Round</th><th>Date</th><th className="ac-r">Money shared</th><th className="ac-r">Each part</th><th className="ac-r">Extra to fund</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rounds.map((r) => (
                    <tr key={r.id}>
                      <td className="ac-strong">#{r.round_no}<div className="ac-faint">{r.parts} parts</div></td>
                      <td className="ac-nowrap">{formatDateLong(r.round_date)}</td>
                      <td className="ac-r tabular ac-strong">{money(Number(r.pool))}</td>
                      <td className="ac-r tabular">{money(Number(r.share))}</td>
                      <td className="ac-r tabular">{money(Number(r.remainder))}</td>
                      <td>{r.approval === 'approved' ? 'Approved' : r.approval === 'rejected' ? <span style={{ color: 'var(--danger)' }}>Rejected</span> : 'Awaiting approval'}</td>
                      <td className="ac-r ac-nowrap">
                        <button type="button" className="ac-link ac-linkbtn" onClick={() => previewRound(r)}>Preview PDF</button>
                        {canEdit && (isAdmin || r.approval !== 'approved') && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void removeRound(r)}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                  {rounds.length === 0 && <tr><td colSpan={7} className="ac-empty-cell">No pay round yet. The first one starts once {money(MIN_ROUND)} is waiting.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ))}

      {mode === 'monthly' && (
      <>
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
          <button type="button" className="ac-btn ac-right" onClick={previewStatement}>Preview PDF</button>
          {canEdit && <button type="button" className="ac-primary" onClick={() => void saveShares()} disabled={income <= 0 || allSaved}>{allSaved ? (FUNDS.every((f) => savedFor(f.key)?.approval === 'approved') ? 'Saved' : 'Waiting for approval') : FUNDS.some((f) => savedFor(f.key)) ? 'Update accounts' : 'Save to accounts'}</button>}
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

      </>
      )}
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
                      <td>{e.note || '-'}{e.approval === 'pending' && <div className="ac-faint">Awaiting approval</div>}{e.approval === 'rejected' && <div className="ac-faint" style={{ color: 'var(--danger)' }}>Rejected</div>}</td>
                      <td className="ac-r tabular">{e.kind === 'deposit' ? money(Number(e.amount)) : ''}</td>
                      <td className="ac-r tabular">{e.kind === 'withdrawal' ? money(Number(e.amount)) : ''}</td>
                      <td className="ac-r">{canEdit && (isAdmin || e.approval !== 'approved') && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void removeEntry(e)}>Delete</button>}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="ac-empty-cell">Nothing saved yet. Press Save to accounts above.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {canEdit && (
      <section className="ac-card">
        <div className="ac-card-head"><h2>Take money out</h2></div>
        <div className="ac-card-body ac-staff-form">
          <select className="ac-select" value={wFund} onChange={(e) => setWFund(e.target.value as Fund)}>{FUNDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select>
          <input className="ac-input" placeholder={`Amount (${BASE})`} inputMode="decimal" value={wAmount} onChange={(e) => setWAmount(e.target.value)} />
          <input className="ac-input" placeholder="What it was for" value={wNote} onChange={(e) => setWNote(e.target.value)} />
          <button type="button" className="ac-primary" onClick={() => void withdraw()}>Record</button>
        </div>
      </section>
      )}
    </>
  );
}
