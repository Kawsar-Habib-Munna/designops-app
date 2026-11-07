'use client';

// Accounts > Payroll: team salaries. Staff with a monthly base salary, one payslip per person per month
// (base + bonus - deduction = net), and "Mark paid" which books the net amount as a "Salaries" expense
// so it shows up in the profit & loss automatically. Tables: staff_salaries, payslips (see lib/accountsCore.ts).

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { formatMoney } from '@/lib/currency';
import '@/app/components/receipt-document.css';
import '@/app/components/receipt-preview-modal.css';
import { formatDateLong } from '@/lib/format';
import StatementPreview, { type StatementDoc } from './StatementPreview';
import { Columns, Donut, SLOT, VizCard, VizRow } from './viz';
import { renderReceiptPdf } from '@/lib/receiptPdf';
import { AGENCY_INFO } from '@/lib/agencyInfo';
import { BASE, CURRENCY_CHOICES, monthLabel, type FxRate } from '@/lib/accountsCore';

const PAY_METHODS = ['Bank transfer', 'UK bank transfer', 'International transfer', 'Card', 'bKash', 'Nagad', 'Rocket', 'Cash', 'Cheque', 'PayPal', 'Wise', 'Other'];
type StaffRow = { approval?: string; id: string; profile_id: string | null; name: string; role: string | null; base_salary: number; currency: string; active: boolean; pay_method: string | null; pay_account_name: string | null; pay_account_no: string | null; pay_bank: string | null; pay_code: string | null; pay_country: string | null };
type Staff = StaffRow & { virtual?: boolean; auto?: boolean }; // virtual: no saved row yet; auto: the pay is the member's share from Distribution
type RoundRow = { round_date: string; share: number; approval: string };
type Member = { id: string; full_name: string; role: string | null };

async function fetchPayroll() {
  const [st, sl, pr, rd] = await Promise.all([
    supabase.from('staff_salaries').select('id, profile_id, name, role, base_salary, currency, active, pay_method, pay_account_name, pay_account_no, pay_bank, pay_code, pay_country, approval').order('name'),
    supabase.from('payslips').select('id, staff_id, month, base, bonus, deduction, status, paid_on, expense_id, approval'),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
    supabase.from('pay_rounds').select('round_date, share, approval'),
  ]);
  return { ready: !st.error && !sl.error, rows: (st.data as StaffRow[]) ?? [], slips: (sl.data as Slip[]) ?? [], members: (pr.data as Member[]) ?? [], rounds: (rd.data as RoundRow[]) ?? [] };
}
type Slip = { id: string; staff_id: string; month: string; base: number; bonus: number; deduction: number; status: 'pending' | 'paid'; paid_on: string | null; expense_id: string | null; approval: string };

type Props = {
  received: { month: string; base: number }[]; // money received, in the base currency
  rates: FxRate[];
  today: string;
  audit: (action: string, entity: string, entityId: string | null, detail: string) => Promise<void>;
  userId: string | null;
  onChanged: () => Promise<void>;
  canEdit: boolean; // the admin or the accountant
  visuals?: boolean; // charts on or off
  isAdmin: boolean; // an admin's changes are approved straight away
};

const net = (s: Slip) => Number(s.base) + Number(s.bonus) - Number(s.deduction);

export default function PayrollTab({ received, rates, today, audit, userId, onChanged, canEdit, isAdmin, visuals = true }: Props) {
  const ap = isAdmin ? { approval: 'approved' } : {};
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [ready, setReady] = useState(true);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [msg, setMsg] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [salary, setSalary] = useState('');
  const [pMethod, setPMethod] = useState(PAY_METHODS[0]);
  const [pAccName, setPAccName] = useState('');
  const [pAccNo, setPAccNo] = useState('');
  const [pBank, setPBank] = useState('');
  const [pCode, setPCode] = useState('');
  const [pCountry, setPCountry] = useState('');
  const resetPay = () => { setPMethod(PAY_METHODS[0]); setPAccName(''); setPAccNo(''); setPBank(''); setPCode(''); setPCountry(''); };
  const [cur, setCur] = useState(BASE);
  const [view, setView] = useState<Slip | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sheet, setSheet] = useState<StatementDoc | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [adj, setAdj] = useState<Record<string, { bonus?: string; deduction?: string }>>({});

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2600);
  };

  const reload = useCallback(async () => {
    const r = await fetchPayroll();
    setReady(r.ready);
    setRows(r.rows);
    setSlips(r.slips);
    setMembers(r.members);
    setRounds(r.rounds);
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchPayroll();
      if (cancelled) return;
      setReady(r.ready);
      setRows(r.rows);
      setSlips(r.slips);
      setMembers(r.members);
      setRounds(r.rounds);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rateMap = new Map(rates.map((r) => [r.currency, Number(r.rate_to_base)]));
  const toBase = (amount: number, c: string) => (c === BASE ? amount : amount * (rateMap.get(c) ?? 0));
  const fromBase = (amount: number, c: string) => (c === BASE ? amount : amount / (rateMap.get(c) || 1));

  // Each team member's pay is worked out from Distribution: their equal share of the money shared in the month.
  // Pay rounds made in the month count; if there were none, the month's received money is split equally (members + Allah + Agency fund).
  const memberCount = members.length;
  const shareOf = (m: string) => {
    const done = rounds.filter((r) => r.approval !== 'rejected' && r.round_date.slice(0, 7) === m);
    if (done.length > 0) return done.reduce((n, r) => n + Number(r.share), 0);
    const income = received.filter((r) => r.month === m).reduce((n, r) => n + r.base, 0);
    return Math.floor(income / (memberCount + 2));
  };
  const monthShare = shareOf(month);

  // every team member (profile) is listed automatically with their automatic share; outside people keep a fixed salary
  const staff: Staff[] = [
    ...members.map((m): Staff => {
      const r = rows.find((x) => x.profile_id === m.id);
      return r
        ? { ...r, name: m.full_name, role: m.role, base_salary: fromBase(monthShare, r.currency), auto: true }
        : { id: 'p:' + m.id, profile_id: m.id, name: m.full_name, role: m.role, base_salary: monthShare, currency: BASE, active: true, pay_method: null, pay_account_name: null, pay_account_no: null, pay_bank: null, pay_code: null, pay_country: null, virtual: true, auto: true };
    }),
    ...rows.filter((r) => !r.profile_id || !members.some((m) => m.id === r.profile_id)),
  ];
  const byId = new Map(staff.map((s) => [s.id, s]));
  const monthSlips = slips.filter((s) => s.month === month && byId.has(s.staff_id)).sort((a, b) => (byId.get(a.staff_id)?.name ?? '').localeCompare(byId.get(b.staff_id)?.name ?? ''));
  const missingSlips = staff.filter((s) => s.active && (!s.auto || Number(s.base_salary) > 0) && (s.virtual || (s.approval ?? 'approved') === 'approved') && !monthSlips.some((p) => p.staff_id === s.id));
  // unpaid payslips of team members follow the share, so they stay right when more money arrives
  const staleSlips = monthSlips.filter((p) => p.status === 'pending' && byId.get(p.staff_id)?.auto && Math.abs(Number(p.base) - Number(byId.get(p.staff_id)?.base_salary ?? 0)) >= 0.01);
  const todoCount = missingSlips.length + staleSlips.length;
  const total = monthSlips.reduce((n, p) => n + toBase(net(p), byId.get(p.staff_id)?.currency ?? BASE), 0);
  const paid = monthSlips.filter((p) => p.status === 'paid' && p.approval === 'approved').reduce((n, p) => n + toBase(net(p), byId.get(p.staff_id)?.currency ?? BASE), 0);
  const monthlyBase = staff.filter((s) => s.active).reduce((n, s) => n + toBase(Number(s.base_salary), s.currency), 0);

  const editTarget = editId ? staff.find((x) => x.id === editId) ?? null : null;
  const isMember = !!editTarget?.profile_id;
  const isMobile = ['bKash', 'Nagad', 'Rocket'].includes(pMethod);
  const isEmail = ['PayPal', 'Wise'].includes(pMethod);
  type Fld = { label: string; ph: string };
  const spec: { holder: string; number?: Fld; code?: Fld; bank?: Fld; country?: boolean; hint?: string } = (() => {
    switch (pMethod) {
      case 'Bank transfer': return { holder: 'Account holder name', number: { label: 'Account number', ph: 'Account number' }, bank: { label: 'Bank and branch', ph: 'e.g. City Bank, Sylhet' } };
      case 'UK bank transfer': return { holder: 'Account holder name', code: { label: 'Sort code', ph: '12-34-56' }, number: { label: 'Account number', ph: '8 digits' }, bank: { label: 'Bank name', ph: 'e.g. Barclays' }, hint: 'UK accounts are paid with a sort code and account number.' };
      case 'International transfer': return { holder: 'Account holder name', number: { label: 'IBAN or account number', ph: 'GB29 NWBK 6016 1331 9268 19' }, code: { label: 'SWIFT / BIC', ph: 'NWBKGB2L' }, bank: { label: 'Bank name', ph: 'Bank name' }, country: true, hint: 'For banks outside Bangladesh and the UK: IBAN and SWIFT / BIC.' };
      case 'Card': return { holder: 'Cardholder name', number: { label: 'Last 4 digits of the card', ph: '1234' }, bank: { label: 'Card type and bank', ph: 'e.g. Visa, City Bank' }, hint: 'For safety, only the last 4 digits are saved, never the full card number.' };
      case 'Cheque': return { holder: 'Payee name' };
      default: return { holder: 'Account holder name', number: { label: isMobile ? 'Mobile number' : isEmail ? 'Email' : 'Number / ID', ph: isMobile ? '01XXXXXXXXX' : isEmail ? 'name@example.com' : 'Number or ID' } };
    }
  })();
  const payLine = (m: string | null, no: string | null, code: string | null) => (!no ? '' : m === 'Card' ? `•••• ${no}` : m === 'UK bank transfer' && code ? `${code} · ${no}` : no);
  const formTitle = !editTarget ? 'Add an outside person' : editTarget.virtual ? `Set pay details for ${editTarget.name}` : `Edit ${editTarget.name}`;
  const formSub = isMember ? 'Name and role come from the team profile.' : 'For freelancers or anyone without a login. Team members are added automatically.';

  // the six months ending at the chosen month: net pay that is paid (and approved) against what is still to pay
  const sixMonths = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(month + '-01T00:00:00');
    d.setMonth(d.getMonth() - (5 - k));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const monthTotal = (m: string, paidOnly: boolean) => slips.filter((p) => p.month === m && byId.has(p.staff_id) && (p.status === 'paid' && p.approval === 'approved') === paidOnly).reduce((n, p) => n + toBase(net(p), byId.get(p.staff_id)?.currency ?? BASE), 0);

  function shiftMonth(delta: number) {
    const d = new Date(month + '-01T00:00:00');
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  async function saveStaff() {
    const cash = pMethod === 'Cash';
    const uk = pMethod === 'UK bank transfer';
    const intl = pMethod === 'International transfer';
    let code = pCode.trim();
    let acct = pAccNo.trim();
    if (uk) {
      const d = code.replace(/\D/g, '');
      if (code && d.length !== 6) return flash('A UK sort code has 6 digits, like 12-34-56.');
      code = d ? `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}` : '';
      if (acct && !/^\d{6,8}$/.test(acct)) return flash('A UK account number has 8 digits.');
    }
    if (intl) {
      code = code.replace(/\s+/g, '').toUpperCase();
      if (code && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(code)) return flash('SWIFT / BIC has 8 or 11 letters and digits.');
      acct = acct.replace(/\s+/g, '').toUpperCase();
    }
    if (pMethod === 'Card' && pAccNo.trim() && !/^\d{4}$/.test(pAccNo.trim())) return flash('Enter only the last 4 digits of the card.');
    const pay = { pay_method: pMethod, pay_account_name: cash ? null : pAccName.trim() || null, pay_account_no: cash || pMethod === 'Cheque' ? null : acct || null, pay_bank: spec.bank ? pBank.trim() || null : null, pay_code: uk || intl ? code || null : null, pay_country: intl ? pCountry.trim() || null : null };
    const target = editId ? staff.find((x) => x.id === editId) : null;
    const base = target?.auto ? 0 : Number(salary);
    if (!name.trim()) return flash('Enter the name.');
    if (!target?.auto && (!salary || Number.isNaN(base) || base < 0)) return flash('Enter a valid salary.');
    if (target?.virtual) {
      const { data: row, error } = await supabase.from('staff_salaries').insert({ profile_id: target.profile_id, name: target.name, role: target.role, base_salary: 0, currency: BASE, ...pay }).select('id').single();
      if (error) return flash(error.message);
      await audit('salary_set', 'staff', (row as { id: string }).id, `${target.name}: pay details saved`);
    } else if (editId) {
      const { error } = await supabase.from('staff_salaries').update({ ...(target?.profile_id ? {} : { name: name.trim(), role: role.trim() || null }), ...(target?.auto ? {} : { base_salary: base, currency: cur }), ...pay, ...ap }).eq('id', editId);
      if (error) return flash(error.message);
      await audit('staff_updated', 'staff', editId, target?.auto ? `${name.trim()}: pay details updated` : `${name.trim()}: ${formatMoney(base, cur)} / month`);
    } else {
      const { data: row, error } = await supabase.from('staff_salaries').insert({ name: name.trim(), role: role.trim() || null, base_salary: base, currency: cur, ...pay }).select('id').single();
      if (error) return flash(error.message);
      await audit('staff_added', 'staff', (row as { id: string }).id, `${name.trim()}: ${formatMoney(base, cur)} / month`);
    }
    setName('');
    setRole('');
    setSalary('');
    resetPay();
    setEditId(null);
    flash('Saved.');
    await reload();
  }
  async function toggleActive(s: Staff) {
    await supabase.from('staff_salaries').update({ active: !s.active, ...ap }).eq('id', s.id);
    await audit(s.active ? 'staff_paused' : 'staff_resumed', 'staff', s.id, s.name);
    await reload();
  }
  async function removeStaff(s: Staff) {
    if (!window.confirm(`Delete ${s.name} and all their payslips? Expenses already booked stay.`)) return;
    await supabase.from('staff_salaries').delete().eq('id', s.id);
    await audit('staff_deleted', 'staff', s.id, s.name);
    await reload();
  }

  async function generate() {
    if (todoCount === 0) return;
    const ids = new Map<string, string>();
    for (const s of missingSlips) {
      if (!s.virtual) { ids.set(s.id, s.id); continue; }
      const { data: row, error } = await supabase.from('staff_salaries').insert({ profile_id: s.profile_id, name: s.name, role: s.role, base_salary: 0, currency: BASE }).select('id').single();
      if (error) return flash(error.message);
      ids.set(s.id, (row as { id: string }).id);
    }
    const rows = missingSlips.map((s) => ({ staff_id: ids.get(s.id) as string, month, base: s.base_salary, bonus: 0, deduction: 0 }));
    if (rows.length > 0) {
      const { error } = await supabase.from('payslips').insert(rows);
      if (error) return flash(error.message);
    }
    for (const p of staleSlips) {
      const { error } = await supabase.from('payslips').update({ base: byId.get(p.staff_id)?.base_salary ?? p.base, ...ap }).eq('id', p.id);
      if (error) return flash(error.message);
    }
    await audit('payslips_generated', 'payroll', null, `${rows.length} created, ${staleSlips.length} updated for ${monthLabel(month)} (each member ${formatMoney(monthShare, BASE)})`);
    flash(`${rows.length} payslip${rows.length === 1 ? '' : 's'} created${staleSlips.length ? `, ${staleSlips.length} updated` : ''}.`);
    await reload();
  }
  async function saveAdjust(p: Slip) {
    const a = adj[p.id];
    if (!a) return;
    const bonus = a.bonus !== undefined ? Number(a.bonus) || 0 : p.bonus;
    const deduction = a.deduction !== undefined ? Number(a.deduction) || 0 : p.deduction;
    if (bonus < 0 || deduction < 0) return flash('Amounts cannot be negative.');
    await supabase.from('payslips').update({ bonus, deduction, ...ap }).eq('id', p.id);
    await audit('payslip_adjusted', 'payslip', p.id, `${byId.get(p.staff_id)?.name ?? ''} ${monthLabel(p.month)}: bonus ${bonus}, deduction ${deduction}`);
    setAdj((x) => {
      const { [p.id]: _drop, ...rest } = x;
      void _drop;
      return rest;
    });
    await reload();
  }
  async function markPaid(p: Slip) {
    const s = byId.get(p.staff_id);
    if (!s) return;
    const { data: exp, error } = await supabase
      .from('expenses')
      .insert({ expense_date: today, amount: net(p), currency: s.currency, category: 'Salaries', vendor: s.name, description: `Salary ${monthLabel(p.month)}`, created_by: userId })
      .select('id')
      .single();
    if (error) return flash(error.message);
    await supabase.from('payslips').update({ status: 'paid', paid_on: today, expense_id: (exp as { id: string }).id, ...ap }).eq('id', p.id);
    await audit('salary_paid', 'payslip', p.id, `${s.name} ${monthLabel(p.month)}: ${formatMoney(net(p), s.currency)}`);
    await Promise.all([reload(), onChanged()]);
  }
  async function markUnpaid(p: Slip) {
    if (!window.confirm('Undo this payment? The salary expense is removed.')) return;
    if (p.expense_id) await supabase.from('expenses').delete().eq('id', p.expense_id);
    await supabase.from('payslips').update({ status: 'pending', paid_on: null, expense_id: null, ...ap }).eq('id', p.id);
    await audit('salary_unpaid', 'payslip', p.id, `${byId.get(p.staff_id)?.name ?? ''} ${monthLabel(p.month)}`);
    await Promise.all([reload(), onChanged()]);
  }
  async function payAll() {
    const todo = monthSlips.filter((p) => p.status === 'pending');
    if (todo.length === 0) return;
    if (!window.confirm(`Mark ${todo.length} payslip${todo.length === 1 ? '' : 's'} as paid?`)) return;
    for (const p of todo) await markPaid(p);
    flash('All paid.');
  }

  async function downloadPdf(p: Slip) {
    if (!docRef.current) return;
    setPdfBusy(true);
    try {
      const { blob } = await renderReceiptPdf(docRef.current);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip-${(byId.get(p.staff_id)?.name ?? 'staff').replace(/s+/g, '-').toLowerCase()}-${p.month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash('Could not create the PDF.');
    }
    setPdfBusy(false);
  }

  function previewSheet() {
    setSheet({
      title: 'Payroll sheet',
      period: monthLabel(month),
      note: `Net pay for every team member · totals in ${BASE}`,
      summary: [['Net payroll', formatMoney(total, BASE)], ['Paid', formatMoney(paid, BASE)], ['Still to pay', formatMoney(Math.max(total - paid, 0), BASE)]],
      sections: [{
        heading: 'Payslips',
        columns: [{ label: 'Name' }, { label: 'Role' }, { label: 'Base', right: true }, { label: 'Bonus', right: true }, { label: 'Deduction', right: true }, { label: 'Net', right: true }, { label: 'Status' }],
        rows: monthSlips.map((p) => { const s = byId.get(p.staff_id) as Staff; return [s.name, s.role ?? '-', formatMoney(Number(p.base), s.currency), formatMoney(Number(p.bonus), s.currency), formatMoney(Number(p.deduction), s.currency), formatMoney(net(p), s.currency), p.status === 'paid' ? 'Paid' : 'Pending']; }),
        total: ['Total', '', '', '', '', formatMoney(total, BASE), ''],
        empty: 'No payslips for this month.',
      }],
      filename: `payroll-${month}`,
    });
  }

  function exportCsv() {
    const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows: (string | number)[][] = [['Name', 'Role', 'Currency', 'Base', 'Bonus', 'Deduction', 'Net', 'Status', 'Paid on']];
    for (const p of monthSlips) {
      const s = byId.get(p.staff_id);
      rows.push([s?.name ?? '', s?.role ?? '', s?.currency ?? '', p.base, p.bonus, p.deduction, net(p), p.status, p.paid_on ?? '']);
    }
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return (
      <section className="ac-card">
        <div className="ac-card-head"><h2>Payroll</h2></div>
        <div className="ac-card-body"><p className="ac-note ac-warn">The payroll tables are missing. Run the accounts SQL (Settings tab, or the end of sql/schema.sql) in the Supabase SQL editor, then reload.</p></div>
      </section>
    );
  }

  return (
    <>
      {msg && <div className="ac-toast">{msg}</div>}
      <StatementPreview doc={sheet} onClose={() => setSheet(null)} />
      <div className="ac-kpis ac-kpis-3">
        <div className="ac-kpi"><span className="ac-kpi-label">Monthly base payroll</span><b className="tabular">{formatMoney(monthlyBase, BASE)}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">{monthLabel(month)} net payroll</span><b className="tabular">{formatMoney(total, BASE)}</b></div>
        <div className="ac-kpi"><span className="ac-kpi-label">Paid / still to pay</span><b className="tabular">{formatMoney(paid, BASE)} / {formatMoney(Math.max(total - paid, 0), BASE)}</b></div>
      </div>

      {visuals && (
<VizRow>
        <VizCard title="Payroll by month" sub="Net pay, paid against still to pay" legend={[{ color: SLOT[0], label: 'Paid' }, { color: SLOT[1], label: 'Still to pay' }]}>
          <Columns stacked labels={sixMonths.map((m) => monthLabel(m).split(' ')[0])} tipTitles={sixMonths.map((m) => monthLabel(m))} fmt={(n) => formatMoney(n, BASE)} ariaLabel="Net payroll for six months, paid against still to pay" series={[{ name: 'Paid', color: SLOT[0], values: sixMonths.map((m) => monthTotal(m, true)) }, { name: 'Still to pay', color: SLOT[1], values: sixMonths.map((m) => monthTotal(m, false)) }]} />
        </VizCard>
        <VizCard title={`Net pay · ${monthLabel(month)}`} sub="Each person's share of the month's pay">
          <Donut fmt={(n) => formatMoney(n, BASE)} empty="No payslips for this month yet." items={[...monthSlips].map((p) => ({ label: byId.get(p.staff_id)?.name ?? '-', value: toBase(net(p), byId.get(p.staff_id)?.currency ?? BASE) })).sort((a, b) => b.value - a.value)} />
        </VizCard>
      </VizRow>
)}
      <section className="ac-card">
        <div className="ac-card-head">
          <h2>Payslips</h2>
          <div className="ac-seg ac-noprint">
            <button type="button" onClick={() => shiftMonth(-1)}>‹</button>
            <button type="button" className="on">{monthLabel(month)}</button>
            <button type="button" onClick={() => shiftMonth(1)}>›</button>
          </div>
          <span className="ac-right" style={{ display: 'inline-flex', gap: 8 }}>
            <button type="button" className="ac-btn" onClick={previewSheet} disabled={monthSlips.length === 0}>Preview PDF</button>
            <button type="button" className="ac-btn" onClick={exportCsv} disabled={monthSlips.length === 0}>Export CSV</button>
            {canEdit && <button type="button" className="ac-btn" onClick={() => void generate()} disabled={todoCount === 0}>{staleSlips.length > 0 && missingSlips.length === 0 ? 'Update' : 'Generate'} ({todoCount})</button>}
            {canEdit && <button type="button" className="ac-primary" onClick={() => void payAll()} disabled={!monthSlips.some((p) => p.status === 'pending')}>Pay all</button>}
          </span>
        </div>
        {memberCount > 0 && <p className="ac-note" style={{ margin: '0 22px 12px' }}>Team pay is worked out automatically from Distribution: each of the {memberCount} members gets an equal share, <b>{formatMoney(monthShare, BASE)}</b> for {monthLabel(month)}.</p>}
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Name</th><th className="ac-r">Base</th><th className="ac-r">Bonus</th><th className="ac-r">Deduction</th><th className="ac-r">Net</th><th>Status</th><th /></tr></thead>
            <tbody>
              {monthSlips.map((p) => {
                const s = byId.get(p.staff_id) as Staff;
                const a = adj[p.id];
                const locked = p.status === 'paid';
                return (
                  <tr key={p.id}>
                    <td className="ac-strong">{s.name}{s.role && <div className="ac-faint">{s.role}</div>}</td>
                    <td className="ac-r tabular">{formatMoney(p.base, s.currency)}</td>
                    <td className="ac-r"><input className={`ac-input${locked || !canEdit ? ' ac-input-plain' : ''}`} style={{ width: 96, textAlign: 'right' }} inputMode="decimal" disabled={locked || !canEdit} value={a?.bonus ?? String(p.bonus)} onChange={(e) => setAdj({ ...adj, [p.id]: { ...a, bonus: e.target.value } })} onBlur={() => void saveAdjust(p)} /></td>
                    <td className="ac-r"><input className={`ac-input${locked || !canEdit ? ' ac-input-plain' : ''}`} style={{ width: 96, textAlign: 'right' }} inputMode="decimal" disabled={locked || !canEdit} value={a?.deduction ?? String(p.deduction)} onChange={(e) => setAdj({ ...adj, [p.id]: { ...a, deduction: e.target.value } })} onBlur={() => void saveAdjust(p)} /></td>
                    <td className="ac-r tabular ac-strong">{formatMoney(net(p), s.currency)}</td>
                    <td>{locked ? <>Paid{p.paid_on && <div className="ac-faint">{p.paid_on}</div>}</> : 'Pending'}{p.approval === 'pending' && <div className="ac-faint">Awaiting approval</div>}{p.approval === 'rejected' && <div className="ac-faint" style={{ color: 'var(--danger)' }}>Rejected</div>}</td>
                    <td className="ac-r ac-nowrap"><button type="button" className="ac-link ac-linkbtn" style={{ marginRight: 12 }} onClick={() => setView(p)}>Payslip</button>{!canEdit ? null : locked ? (isAdmin || p.approval !== 'approved' ? <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void markUnpaid(p)}>Undo</button> : <span className="ac-faint">Approved</span>) : <button type="button" className="ac-link ac-linkbtn" onClick={() => void markPaid(p)}>Mark paid</button>}</td>
                  </tr>
                );
              })}
              {monthSlips.length === 0 && <tr><td colSpan={7} className="ac-empty-cell">{monthShare <= 0 && staff.every((x) => x.auto) ? `Nothing has been shared for ${monthLabel(month)} yet, so there is no pay to give.` : `No payslips for ${monthLabel(month)} yet. Press Generate.`}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ac-card">
        <div className="ac-card-head"><h2>Team salaries</h2><span className="ac-count tabular">{staff.length}</span></div>
        <div className="ac-scroll">
          <table className="ac-table">
            <thead><tr><th>Name</th><th>Role</th><th className="ac-r">Pay ({monthLabel(month)})</th><th>Receives by</th><th>Status</th><th /></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'ac-off'}>
                  <td className="ac-strong">{s.name}</td>
                  <td>{s.role || '-'}</td>
                  <td className="ac-r tabular">{formatMoney(Number(s.base_salary), s.currency)}{s.auto && <div className="ac-faint">Automatic share</div>}</td>
                  <td>{s.pay_method ? <>{s.pay_method}{s.pay_account_no && <div className="ac-faint">{payLine(s.pay_method, s.pay_account_no, s.pay_code)}</div>}</> : <span className="ac-faint">Not set</span>}</td>
                  <td>{s.active ? 'Active' : 'Paused'}{!s.virtual && s.approval === 'pending' && <div className="ac-faint">Awaiting approval</div>}{!s.virtual && s.approval === 'rejected' && <div className="ac-faint" style={{ color: 'var(--danger)' }}>Rejected</div>}</td>
                  <td className="ac-r ac-nowrap">{canEdit && <>
                    <button type="button" className="ac-link ac-linkbtn" onClick={() => { setEditId(s.id); setName(s.name); setRole(s.role ?? ''); setSalary(s.auto ? '' : String(s.base_salary)); setCur(s.currency); setPMethod(s.pay_method ?? PAY_METHODS[0]); setPAccName(s.pay_account_name ?? ''); setPAccNo(s.pay_account_no ?? ''); setPBank(s.pay_bank ?? ''); setPCode(s.pay_code ?? ''); setPCountry(s.pay_country ?? ''); window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}>{s.virtual ? 'Set pay details' : 'Edit'}</button>
                    {!s.virtual && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void toggleActive(s)}>{s.active ? 'Pause' : 'Resume'}</button>}
                    {!s.virtual && (isAdmin || s.approval !== 'approved') && <button type="button" className="ac-link ac-linkbtn danger" onClick={() => void removeStaff(s)}>{s.profile_id ? 'Clear' : 'Delete'}</button>}
                  </>}</td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={6} className="ac-empty-cell">No team members yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {canEdit && (
        <div className="ac-pf" ref={formRef}>
          <div className="ac-pf-head">
            <h3>{formTitle}</h3>
            <p>{formSub}</p>
          </div>
          <div className="ac-pf-grid">
            <div className="ac-pf-group">
              <h4>{editTarget?.auto ? 'Person' : 'Person and salary'}</h4>
              <label className="ac-pf-field"><span>Full name</span><input className="ac-input" placeholder="e.g. Kawsar Habib" disabled={isMember} value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="ac-pf-field"><span>Role</span><input className="ac-input" placeholder="e.g. Product Designer" disabled={isMember} value={role} onChange={(e) => setRole(e.target.value)} /></label>
              {editTarget?.auto ? <p className="ac-note" style={{ margin: 0 }}>Pay is automatic: an equal share of the money shared in Distribution.</p> : <div className="ac-pf-field">
                <span>Monthly salary</span>
                <div className="ac-pf-inline">
                  <input className="ac-input" placeholder="0" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} aria-label="Monthly salary" />
                  <select className="ac-select" value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Currency">{CURRENCY_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                </div>
              </div>}
            </div>
            <div className="ac-pf-group">
              <h4>How they receive their pay</h4>
              <label className="ac-pf-field"><span>Method</span><select className="ac-select" value={pMethod} onChange={(e) => setPMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
              {pMethod === 'Cash' ? (
                <p className="ac-pf-hint">Paid in cash, so no account details are needed.</p>
              ) : (
                <>
                  <label className="ac-pf-field"><span>{spec.holder}</span><input className="ac-input" placeholder="Name on the account" value={pAccName} onChange={(e) => setPAccName(e.target.value)} /></label>
                  {spec.code && <label className="ac-pf-field"><span>{spec.code.label}</span><input className="ac-input" placeholder={spec.code.ph} value={pCode} onChange={(e) => setPCode(e.target.value)} /></label>}
                  {spec.number && <label className="ac-pf-field"><span>{spec.number.label}</span><input className="ac-input" placeholder={spec.number.ph} value={pAccNo} maxLength={pMethod === 'Card' ? 4 : undefined} inputMode={pMethod === 'Card' ? 'numeric' : undefined} onChange={(e) => setPAccNo(pMethod === 'Card' ? e.target.value.replace(/\D/g, '') : e.target.value)} /></label>}
                  {spec.bank && <label className="ac-pf-field"><span>{spec.bank.label}</span><input className="ac-input" placeholder={spec.bank.ph} value={pBank} onChange={(e) => setPBank(e.target.value)} /></label>}
                  {spec.country && <label className="ac-pf-field"><span>Country</span><input className="ac-input" placeholder="e.g. United Kingdom" value={pCountry} onChange={(e) => setPCountry(e.target.value)} /></label>}
                  {spec.hint && <p className="ac-pf-hint">{spec.hint}</p>}
                </>
              )}
            </div>
          </div>
          <div className="ac-pf-actions">
            {editId && <button type="button" className="ac-btn" onClick={() => { setEditId(null); setName(''); setRole(''); setSalary(''); resetPay(); }}>Cancel</button>}
            <button type="button" className="ac-primary" onClick={() => void saveStaff()}>{editId ? (editTarget?.virtual ? 'Save salary' : 'Save changes') : 'Add person'}</button>
          </div>
        </div>
        )}
      </section>
      {view && byId.get(view.staff_id) && (() => {
        const p = view;
        const st = byId.get(p.staff_id) as Staff;
        return (
          <div role="dialog" aria-modal="true" className="ac-noprint" style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(16,16,20,.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: 24 }} onClick={() => setView(null)}>
            <div style={{ background: '#fff', borderRadius: 14, width: 'min(834px, 100%)', padding: 20 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <button type="button" className="ac-primary" disabled={pdfBusy} onClick={() => void downloadPdf(p)}>{pdfBusy ? 'Creating…' : 'Download PDF'}</button>
                <button type="button" className="ac-btn" onClick={() => setView(null)}>Close</button>
              </div>
              <div className="rpm-sheet">
              <div className="receipt-document theme-light rd-fixed" ref={docRef}>
                <div className="rd-card rd3">
                  <div className="rd3-head">
                    <div className="rd3-brand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/New%20Logo.png" alt="FLOW 53" className="rd-logo rd3-logo" />
                    </div>
                    <div className="rd3-ref">
                      <div className="rd3-ref-label">Payslip</div>
                      <div className="rd3-ref-date">{monthLabel(p.month)}</div>
                      <div className="rd3-ref-number">{p.status === 'paid' ? 'Paid' : 'Pending'}</div>
                    </div>
                  </div>
                  <hr className="rd3-rule" />

                  <table className="rd3-pair">
                    <tbody>
                      <tr>
                        <td>
                          <div className="rd3-cap">Employee</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Name</th><td>{st.name}</td></tr>
                              <tr><th>Role</th><td>{st.role || '—'}</td></tr>
                              <tr><th>Pay period</th><td>{monthLabel(p.month)}</td></tr>
                            </tbody>
                          </table>
                        </td>
                        <td>
                          <div className="rd3-cap">Paid by</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Name</th><td>{AGENCY_INFO.name}</td></tr>
                              <tr><th>Address</th><td>{AGENCY_INFO.address}</td></tr>
                              <tr><th>Email</th><td>{AGENCY_INFO.email}</td></tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      <tr className="rd3-pair-row2 ps-pair-row">
                        <td>
                          <div className="rd3-cap">Payment details</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Status</th><td>{p.status === 'paid' ? 'Paid' : 'Pending'}</td></tr>
                              <tr><th>Paid on</th><td>{p.paid_on ? formatDateLong(p.paid_on) : '—'}</td></tr>
                              <tr><th>Currency</th><td>{st.currency}</td></tr>
                            </tbody>
                          </table>
                        </td>
                        <td>
                          <div className="rd3-cap">Receive details</div>
                          <table className="rd3-kv">
                            <tbody>
                              <tr><th>Receives by</th><td>{st.pay_method ?? '—'}</td></tr>
                              {st.pay_account_name && <tr><th>Account name</th><td>{st.pay_account_name}</td></tr>}
                              {st.pay_code && <tr><th>{st.pay_method === 'UK bank transfer' ? 'Sort code' : 'SWIFT / BIC'}</th><td>{st.pay_code}</td></tr>}
                              {st.pay_account_no && <tr><th>{st.pay_method === 'Card' ? 'Card' : st.pay_method === 'International transfer' ? 'IBAN / account' : st.pay_method === 'Bank transfer' || st.pay_method === 'UK bank transfer' ? 'Account number' : 'Number / ID'}</th><td>{payLine(st.pay_method === 'UK bank transfer' ? null : st.pay_method, st.pay_account_no, null)}</td></tr>}
                              {st.pay_bank && <tr><th>{st.pay_method === 'Card' ? 'Card type' : 'Bank'}</th><td>{st.pay_bank}</td></tr>}
                              {st.pay_country && <tr><th>Country</th><td>{st.pay_country}</td></tr>}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="rd3-cap rd3-cap-items">Salary summary</div>
                  <table className="rd3-items">
                    <thead>
                      <tr><th className="rd3-n">#</th><th>Description</th><th className="rd3-r">Amount</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="rd3-n">1</td><td className="rd3-desc">Base salary</td><td className="rd3-r rd3-strong">{formatMoney(Number(p.base), st.currency)}</td></tr>
                      <tr><td className="rd3-n">2</td><td className="rd3-desc">Bonus</td><td className="rd3-r rd3-strong">{formatMoney(Number(p.bonus), st.currency)}</td></tr>
                      <tr><td className="rd3-n">3</td><td className="rd3-desc">Deductions</td><td className="rd3-r rd3-strong">− {formatMoney(Number(p.deduction), st.currency)}</td></tr>
                    </tbody>
                  </table>

                  <table className="rd3-totals">
                    <tbody>
                      <tr>
                        <td className="rd3-totals-spacer"></td>
                        <td>
                          <table className="rd3-totals-inner">
                            <tbody>
                              <tr className="rd3-sub"><th>Gross pay</th><td>{formatMoney(Number(p.base) + Number(p.bonus), st.currency)}</td></tr>
                              <tr className="rd3-sub"><th>Deductions</th><td>− {formatMoney(Number(p.deduction), st.currency)}</td></tr>
                              <tr className="rd3-grand"><th>Net pay</th><td>{formatMoney(net(p), st.currency)}</td></tr>
                            </tbody>
                          </table>
                          <div className="rd3-paid">{p.status === 'paid' ? 'Paid' : 'Pending'}{p.paid_on ? ` · ${formatDateLong(p.paid_on)}` : ''}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="rd3-cap rd3-cap-items">Notes</div>
                  <ul className="rd3-notes">
                    <li>This payslip is a computer-generated record of the salary for {monthLabel(p.month)} from {AGENCY_INFO.name}, so no signature is needed.</li>
                    <li>If any detail looks wrong, please contact the accounts team.</li>
                  </ul>

                  <div className="rd3-thanks">
                    <div className="rd3-thanks-title">Thank you for your work!</div>
                    <div className="rd3-thanks-sub">Questions about this payslip? Contact {AGENCY_INFO.name}.</div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
